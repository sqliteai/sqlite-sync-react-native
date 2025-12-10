import { useState, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { open, getDylibPath, type DB } from '@op-engineering/op-sqlite';
import { SQLiteSyncContext } from './SQLiteSyncContext';
import type { SQLiteSyncProviderProps } from './types/SQLiteSyncProviderProps';
import type { SQLiteSyncContextValue } from './types/SQLiteSyncContextValue';
import { createLogger } from './utils/logger';

/**
 * SQLiteSyncProvider - An offline-first React context provider that enables local SQLite database
 * operations with optional real-time synchronization to SQLite Cloud.
 *
 * **Offline-First Design:**
 * - Database is always available for local operations, even without network connectivity
 * - Sync failures (missing credentials, network issues) don't prevent database access
 * - Only fatal errors (unsupported platform, cannot open database) prevent operation
 *
 * **Initialization Phases:**
 * 1. Database Phase: Opens database and creates tables (must succeed)
 * 2. Sync Phase: Loads CloudSync extension and configures network (best-effort)
 *
 * **Error Handling:**
 * - `initError`: Fatal database errors (db unavailable)
 * - `syncError`: Recoverable sync errors (db works offline-only)
 *
 * @param {SQLiteSyncProviderProps} props - Configuration props for the provider
 * @param {string} props.connectionString - SQLite Cloud connection string (optional for offline-only)
 * @param {string} props.databaseName - Local database file name
 * @param {Array<{name: string, schema: string}>} props.tablesToBeSynced - Array of tables to sync
 *   Each table requires:
 *   - `name`: Table name (must match remote table name)
 *   - `schema`: SQL CREATE TABLE statement
 * @param {number} props.syncInterval - Sync interval in milliseconds
 * @param {string} [props.apiKey] - SQLite Cloud API key for authentication (optional for offline-only)
 *   Use either `apiKey` OR `accessToken`, not both
 * @param {string} [props.accessToken] - SQLite Cloud access token for authentication (optional for offline-only)
 *   Use either `apiKey` OR `accessToken`, not both
 * @param {React.ReactNode} props.children - Child components that will have access to the sync context
 * @param {boolean} [props.debug=false] - Enable debug logging
 *
 * @returns {JSX.Element} Provider component wrapping children with SQLiteSyncContext
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
  const [isSyncReady, setIsSyncReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [lastSyncChanges, setLastSyncChanges] = useState(0);
  const [initError, setInitError] = useState<Error | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const dbRef = useRef<DB | null>(null);

  /** EXTRACT AUTH CREDENTIALS **/
  const apiKey = 'apiKey' in authProps ? authProps.apiKey : undefined;
  const accessToken =
    'accessToken' in authProps ? authProps.accessToken : undefined;

  /** CREATE LOGGER **/
  const logger = useMemo(() => createLogger(debug), [debug]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      let db: DB | null = null;

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

        db = open({ name: databaseName });
        dbRef.current = db;
        logger.info('✅ Database opened:', databaseName);

        /** CREATE TABLES **/
        if (tablesToBeSynced.length === 0) {
          logger.warn('⚠️ No tables configured for sync');
        } else {
          for (const table of tablesToBeSynced) {
            try {
              await db.execute(table.schema);
              logger.info(`✅ Table created: ${table.name}`);
            } catch (createErr) {
              logger.error(
                `❌ Failed to create table ${table.name}:`,
                createErr
              );
              throw new Error(`Failed to create table: ${table.name}`);
            }
          }
        }

        logger.info('✅ Database ready for local use');

        if (isMounted) {
          setInitError(null);
        }
      } catch (err) {
        /** FATAL ERROR - database cannot be used **/
        logger.error('❌ Database initialization failed:', err);
        if (isMounted) {
          setInitError(
            err instanceof Error
              ? err
              : new Error('Database initialization failed')
          );
        }
        return;
      }

      /** PHASE 2: SYNC INITIALIZATION **/
      try {
        logger.info('🔄 Starting sync initialization...');

        /** CHECK SYNC CONFIGURATION **/
        if (!connectionString || (!apiKey && !accessToken)) {
          throw new Error(
            'Sync configuration incomplete. Database works offline-only until credentials are provided.'
          );
        }

        /** LOAD CLOUDSYNC EXTENSION **/
        let extensionPath: string;
        if (Platform.OS === 'ios') {
          extensionPath = getDylibPath('ai.sqlite.cloudsync', 'CloudSync');
        } else {
          extensionPath = 'cloudsync';
        }

        db!.loadExtension(extensionPath);
        logger.info('✅ CloudSync extension loaded');

        /** VERIFY CLOUDSYNC EXTENSION **/
        const versionResult = await db!.execute('SELECT cloudsync_version();');
        const version = versionResult.rows?.[0]?.[
          'cloudsync_version()'
        ] as string;

        if (!version) {
          throw new Error('CloudSync extension not loaded properly');
        }
        logger.info('✅ CloudSync version:', version);

        /** INITIALIZE CLOUDSYNC FOR TABLES **/
        for (const table of tablesToBeSynced) {
          const initResult = await db!.execute(
            `SELECT cloudsync_init('${table.name}');`
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
        await db!.execute(
          `SELECT cloudsync_network_init('${connectionString}');`
        );
        logger.info('✅ Network initialized');

        /** SET AUTHENTICATION **/
        if (apiKey) {
          await db!.execute(
            `SELECT cloudsync_network_set_apikey('${apiKey}');`
          );
          logger.info('✅ API key set');
        } else if (accessToken) {
          await db!.execute(
            `SELECT cloudsync_network_set_token('${accessToken}');`
          );
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
            err instanceof Error ? err : new Error('Sync initialization failed')
          );
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;

      /** CLEANUP - CLOSE DATABASE **/
      if (dbRef.current) {
        try {
          dbRef.current.close();
        } catch (err) {
          logger.error('❌ Error closing database:', err);
        }
      }
    };
  }, [
    connectionString,
    databaseName,
    tablesToBeSynced,
    apiKey,
    accessToken,
    logger,
  ]);

  /** SYNC ON INTERVAL **/
  useEffect(() => {
    if (!isSyncReady || !dbRef.current) {
      return;
    }

    const performSync = async () => {
      if (isSyncing) {
        return;
      }

      try {
        setIsSyncing(true);

        const syncResult = await dbRef.current!.execute(
          'SELECT cloudsync_network_sync();'
        );

        const firstRow = syncResult.rows?.[0];
        const result = firstRow ? Object.values(firstRow)[0] : 0;

        const changes = typeof result === 'number' ? result : 0;

        logger.info(`✅ Sync completed: ${changes} changes synced`);

        setLastSyncChanges(changes);
        setLastSyncTime(Date.now());
        setSyncError(null);
      } catch (err) {
        logger.error('❌ Sync failed:', err);
        setSyncError(err instanceof Error ? err : new Error('Sync failed'));
      } finally {
        setIsSyncing(false);
      }
    };

    performSync();

    const intervalId = setInterval(performSync, syncInterval);

    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncReady, syncInterval]);

  const contextValue = useMemo<SQLiteSyncContextValue>(
    () => ({
      db: dbRef.current,
      isSyncReady,
      isSyncing,
      lastSyncTime,
      lastSyncChanges,
      initError,
      syncError,
    }),
    [
      isSyncReady,
      isSyncing,
      lastSyncTime,
      lastSyncChanges,
      initError,
      syncError,
    ]
  );

  return (
    <SQLiteSyncContext.Provider value={contextValue}>
      {children}
    </SQLiteSyncContext.Provider>
  );
}
