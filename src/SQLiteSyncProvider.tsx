import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { open, getDylibPath, type DB } from '@op-engineering/op-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { SQLiteDbContext } from './SQLiteDbContext';
import { SQLiteSyncStatusContext } from './SQLiteSyncStatusContext';
import { SQLiteSyncActionsContext } from './SQLiteSyncActionsContext';
import type { SQLiteSyncProviderProps } from './types/SQLiteSyncProviderProps';
import type { SQLiteDbContextValue } from './types/SQLiteDbContextValue';
import type { SQLiteSyncStatusContextValue } from './types/SQLiteSyncStatusContextValue';
import type { SQLiteSyncActionsContextValue } from './types/SQLiteSyncActionsContextValue';
import { createLogger } from './utils/logger';

/**
 * SQLiteSyncProvider
 *
 * A robust, offline-first context provider that manages a local SQLite database
 * with automatic, bi-directional synchronization to SQLite Cloud.
 *
 * **Core Behaviors:**
 * 1. **Two-Phase Initialization:**
 *    - **Phase 1 (Database):** Opens the local database immediately. If this fails, `initError` is set.
 *    - **Phase 2 (Sync):** Attempts to load the CloudSync extension and connect to the network.
 *      If this fails (e.g., offline), `syncError` is set, but the app **remains usable** in offline mode.
 *
 * 2. **Offline-First:**
 *    - The `db` instance is exposed as soon as Phase 1 completes.
 *    - Operations can be performed immediately, even if `isSyncReady` is false.
 *
 * 3. **Reactive Configuration:**
 *    - Changes to critical props (`connectionString`, `apiKey`, `tablesToBeSynced`) will trigger
 *      a safe teardown (closing DB) and re-initialization to ensure auth consistency.
 *    - Configuration objects are serialized internally to prevent unnecessary re-renders.
 *
 * 4. **Android Optimization:**
 *    - Performs a direct network check before syncing to prevent the native blocking socket
 *      from freezing the database thread for ~10s on Android when offline.
 *
 * @param props.connectionString - SQLite Cloud connection string
 * @param props.databaseName - Local filename (e.g., 'app.db')
 * @param props.tablesToBeSynced - Array of table configs. (Changes to content trigger re-init)
 * @param props.syncInterval - Time in ms between automatic sync attempts
 * @param props.apiKey - (Optional) API Key for auth. Triggers re-init when changed.
 * @param props.accessToken - (Optional) Access Token for auth. Triggers re-init when changed.
 * @param props.debug - Enable console logging
 */
export function SQLiteSyncProvider({
  connectionString,
  databaseName,
  tablesToBeSynced,
  syncInterval,
  debug = false,
  children,
  ...authProps
}: SQLiteSyncProviderProps) {
  /** PUBLIC CONTEXT STATE - Values exposed to consumers via Context */
  const [db, setDb] = useState<DB | null>(null);
  const [isSyncReady, setIsSyncReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [lastSyncChanges, setLastSyncChanges] = useState(0);
  const [initError, setInitError] = useState<Error | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);

  /** REFS - Used for internal async logic to avoid closure staleness **/
  const dbRef = useRef<DB | null>(null);
  const isSyncingRef = useRef(false);

  /** SYNC LISTENERS - Subscription pattern for sync events **/
  // Uses Set to allow multiple components to subscribe simultaneously
  // Each component's callback is independent and all are executed on sync
  const syncListenersRef = useRef<Set<() => void>>(new Set());

  /** SUBSCRIBE FUNCTION - Allows components to listen for sync events without re-rendering **/
  // Returns an unsubscribe function for cleanup
  const subscribe = useCallback((callback: () => void) => {
    syncListenersRef.current.add(callback);
    return () => {
      syncListenersRef.current.delete(callback);
    };
  }, []);

  /** EXTRACT AUTH CREDENTIALS **/
  const apiKey = 'apiKey' in authProps ? authProps.apiKey : undefined;
  const accessToken =
    'accessToken' in authProps ? authProps.accessToken : undefined;

  /** CREATE LOGGER **/
  const logger = useMemo(() => createLogger(debug), [debug]);

  /** CONFIG SERIALIZATION - Stabilizes dependency array to prevent infinite loops **/
  const serializedConfig = JSON.stringify({
    connectionString,
    databaseName,
    tables: tablesToBeSynced,
    apiKey,
    accessToken,
  });

  /** SYNC FUNCTION - used for both manual and automatic sync **/
  const performSync = useCallback(async () => {
    /** GUARD: DB **/
    if (!dbRef.current) {
      return;
    }

    /** GUARD: CONCURRENCY **/
    if (isSyncingRef.current) {
      return;
    }

    /** GUARD: NETWORK CONNECTIVITY (Android Only) **/
    // On Android, the native call blocks for ~10-15s if offline.
    // We check NetInfo first to prevent this freeze.
    // On iOS, the OS fails fast, so we let the native code handle it.
    if (Platform.OS === 'android') {
      const networkState = await NetInfo.fetch();
      const isOnline =
        networkState.isConnected && (networkState.isInternetReachable ?? true);

      if (!isOnline) {
        logger.info(`⚠️ Sync skipped: No internet connection`);
        return;
      }
    }

    /** GUARD: OFFLINE MODE **/
    // If Phase 2 Init failed (e.g. bad credentials), we can't sync.
    if (!isSyncReady) {
      return;
    }

    try {
      setIsSyncing(true);
      isSyncingRef.current = true;

      const syncResult = await dbRef.current.execute(
        'SELECT cloudsync_network_sync();'
      );

      const firstRow = syncResult.rows?.[0];
      const result = firstRow ? Object.values(firstRow)[0] : 0;
      const changes = typeof result === 'number' ? result : 0;

      setLastSyncTime(Date.now());
      setLastSyncChanges(changes);

      if (changes > 0) {
        // Notify all sync listeners
        syncListenersRef.current.forEach((listener) => {
          try {
            listener();
          } catch (err) {
            logger.error('❌ Error in sync listener:', err);
          }
        });
      }

      logger.info(`✅ Sync completed: ${changes} changes synced`);

      setSyncError(null);
    } catch (err) {
      logger.error('❌ Sync failed:', err);
      setSyncError(err instanceof Error ? err : new Error('Sync failed'));
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, [logger, isSyncReady]);

  /** INITIALIZATION EFFECT **/
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        /** PHASE 1: DATABASE INITIALIZATION (must succeed) **/
        logger.info('📦 Starting database initialization...');

        /** CHECK PLATFORM SUPPORT **/
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
          throw new Error(
            `Platform "${Platform.OS}" is not supported. This library only works on iOS and Android.`
          );
        }

        /** OPEN DATABASE **/
        if (!databaseName) {
          throw new Error('Database name is required');
        }

        const localDb = open({ name: databaseName });
        dbRef.current = localDb;
        if (isMounted) {
          setDb(localDb);
        }

        logger.info('✅ Database opened:', databaseName);

        /** CREATE TABLES **/
        if (tablesToBeSynced.length === 0) {
          logger.warn('⚠️ No tables configured for sync');
        } else {
          for (const table of tablesToBeSynced) {
            try {
              await localDb.execute(table.createTableSql);
              logger.info(`✅ Table created: ${table.name}`);
            } catch (createErr) {
              logger.error(
                `❌ Failed to create table ${table.name}:`,
                createErr
              );
              throw new Error(
                `Failed to create table ${table.name}: ${createErr}`
              );
            }
          }
        }

        logger.info('✅ Database ready for local use');

        if (isMounted) {
          setInitError(null);
        }

        /** PHASE 2: SYNC INITIALIZATION **/
        try {
          logger.info('🔄 Starting sync initialization...');

          /** CHECK SYNC CONFIGURATION **/
          if (!connectionString || (!apiKey && !accessToken)) {
            throw new Error(
              'Sync configuration incomplete. Database works offline-only.'
            );
          }

          /** LOAD CLOUDSYNC EXTENSION **/
          let extensionPath: string;
          if (Platform.OS === 'ios') {
            extensionPath = getDylibPath('ai.sqlite.cloudsync', 'CloudSync');
          } else {
            extensionPath = 'cloudsync';
          }

          localDb.loadExtension(extensionPath);
          logger.info('✅ CloudSync extension loaded');

          /** VERIFY CLOUDSYNC EXTENSION **/
          const versionResult = await localDb.execute(
            'SELECT cloudsync_version();'
          );
          const version = versionResult.rows?.[0]?.['cloudsync_version()'];

          if (!version) {
            throw new Error('CloudSync extension not loaded properly');
          }
          logger.info('✅ CloudSync version:', version);

          /** INITIALIZE CLOUDSYNC FOR TABLES **/
          for (const table of tablesToBeSynced) {
            const initResult = await localDb.execute(
              'SELECT cloudsync_init(?);',
              [table.name]
            );

            const firstRow = initResult.rows?.[0];
            const result = firstRow ? Object.values(firstRow)[0] : undefined;

            logger.info(
              `✅ CloudSync initialized for table: ${table.name}${
                result ? ` (site_id: ${result})` : ''
              }`
            );
          }

          /** INITIALIZE NETWORK CONNECTION **/
          await localDb.execute('SELECT cloudsync_network_init(?);', [
            connectionString,
          ]);
          logger.info('✅ Network initialized');

          /** SET AUTHENTICATION **/
          if (apiKey) {
            await localDb.execute('SELECT cloudsync_network_set_apikey(?);', [
              apiKey,
            ]);
            logger.info('✅ API key set');
          } else if (accessToken) {
            await localDb.execute('SELECT cloudsync_network_set_token(?);', [
              accessToken,
            ]);
            logger.info('✅ Access token set');
          }

          logger.info('✅ Sync initialization complete');

          if (isMounted) {
            setIsSyncReady(true);
            setSyncError(null);
          }
        } catch (err) {
          /** NON-FATAL ERROR - database works, but sync doesn't **/
          logger.warn(
            '⚠️ Sync initialization failed. Database works in offline-only mode:',
            err
          );
          if (isMounted) {
            setIsSyncReady(false);
            setSyncError(
              err instanceof Error
                ? err
                : new Error('Sync initialization failed')
            );
          }
        }
      } catch (err) {
        /** FATAL ERROR - database can not be used **/
        logger.error('❌ Database initialization failed:', err);
        if (isMounted) {
          setInitError(
            err instanceof Error
              ? err
              : new Error('Database initialization failed')
          );
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;

      /** CLEANUP - close database safeguard **/
      const closingDb = dbRef.current;
      dbRef.current = null;

      if (closingDb) {
        try {
          closingDb.close();
          logger.info('Database closed');
        } catch (err) {
          logger.error('❌ Error closing database:', err);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedConfig, logger]);

  /** SYNC INTERVAL **/
  useEffect(() => {
    // Note: We check !isSyncReady here to avoid starting the interval if phase 2 failed.
    // However, performSync ALSO performs a network check, so double protection.
    if (!isSyncReady) {
      return;
    }

    performSync();

    const intervalId = setInterval(performSync, syncInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [isSyncReady, syncInterval, performSync]);

  // Split context values for optimized re-rendering
  const dbContextValue = useMemo<SQLiteDbContextValue>(
    () => ({
      db,
      initError,
    }),
    [db, initError]
  );

  const syncStatusContextValue = useMemo<SQLiteSyncStatusContextValue>(
    () => ({
      isSyncReady,
      isSyncing,
      lastSyncTime,
      lastSyncChanges,
      syncError,
    }),
    [isSyncReady, isSyncing, lastSyncTime, lastSyncChanges, syncError]
  );

  const syncActionsContextValue = useMemo<SQLiteSyncActionsContextValue>(
    () => ({
      triggerSync: performSync,
      subscribe,
    }),
    [performSync, subscribe]
  );

  return (
    <SQLiteDbContext.Provider value={dbContextValue}>
      <SQLiteSyncStatusContext.Provider value={syncStatusContextValue}>
        <SQLiteSyncActionsContext.Provider value={syncActionsContextValue}>
          {children}
        </SQLiteSyncActionsContext.Provider>
      </SQLiteSyncStatusContext.Provider>
    </SQLiteDbContext.Provider>
  );
}
