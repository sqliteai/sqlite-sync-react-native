import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import {
  open,
  getDylibPath,
  type DB,
  type QueryResult,
} from '@op-engineering/op-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { SQLiteDbContext } from './SQLiteDbContext';
import { SQLiteSyncStatusContext } from './SQLiteSyncStatusContext';
import { SQLiteSyncActionsContext } from './SQLiteSyncActionsContext';
import type {
  SQLiteSyncProviderProps,
  AdaptivePollingConfig,
} from './types/SQLiteSyncProviderProps';
import type { SQLiteDbContextValue } from './types/SQLiteDbContextValue';
import type { SQLiteSyncStatusContextValue } from './types/SQLiteSyncStatusContextValue';
import type { SQLiteSyncActionsContextValue } from './types/SQLiteSyncActionsContextValue';
import { createLogger } from './utils/logger';

/**
 * Default base interval for adaptive polling (30 seconds)
 */
const DEFAULT_BASE_INTERVAL = 10000;

/**
 * Hardcoded adaptive polling constants
 * These are sensible defaults that work for most apps
 */
const ERROR_BACKOFF_MULTIPLIER = 2; // Errors: 2x backoff
const FOREGROUND_DEBOUNCE_MS = 2000; // 5s between foreground syncs

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
  adaptivePolling,
  debug = false,
  children,
  ...authProps
}: SQLiteSyncProviderProps) {
  /** PUBLIC CONTEXT STATE - Values exposed to consumers via Context */
  const [writeDb, setWriteDb] = useState<DB | null>(null);
  const [readDb, setReadDb] = useState<DB | null>(null);
  const [isSyncReady, setIsSyncReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [lastSyncChanges, setLastSyncChanges] = useState(0);
  const [initError, setInitError] = useState<Error | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);

  /** ADAPTIVE POLLING STATE - Tracks polling behavior and lifecycle */
  const [appState, setAppState] = useState<string>('active');
  const [isNetworkAvailable, setIsNetworkAvailable] = useState<boolean>(true);
  const [currentInterval, setCurrentInterval] = useState<number>(
    adaptivePolling?.baseInterval ?? DEFAULT_BASE_INTERVAL
  );
  const [consecutiveEmptySyncs, setConsecutiveEmptySyncs] = useState<number>(0);
  const [consecutiveSyncErrors, setConsecutiveErrors] = useState<number>(0);

  /** REFS - Used for internal async logic to avoid closure staleness **/
  const writeDbRef = useRef<DB | null>(null);
  const readDbRef = useRef<DB | null>(null);
  const isSyncingRef = useRef(false);

  /** ADAPTIVE POLLING REFS - Track state without causing re-renders */
  const lastForegroundSyncRef = useRef<number>(0);
  const currentIntervalRef = useRef<number>(
    adaptivePolling?.baseInterval ?? DEFAULT_BASE_INTERVAL
  );
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<string>('active');
  const performSyncRef = useRef<(() => Promise<void>) | null>(null);
  const isPollingActiveRef = useRef<boolean>(false);

  /** EXTRACT AUTH CREDENTIALS **/
  const apiKey = 'apiKey' in authProps ? authProps.apiKey : undefined;
  const accessToken =
    'accessToken' in authProps ? authProps.accessToken : undefined;

  /** CREATE LOGGER **/
  const logger = useMemo(() => createLogger(debug), [debug]);

  /** ADAPTIVE POLLING CONFIGURATION - Merge user config with defaults **/
  const adaptiveConfig = useMemo<Required<AdaptivePollingConfig>>(() => {
    const defaults: Required<AdaptivePollingConfig> = {
      baseInterval: 30000, // 30s base interval
      maxInterval: 300000, // 5min maximum backoff
      emptyThreshold: 3, // Back off after 3 empty syncs
    };

    return {
      ...defaults,
      ...adaptivePolling, // User overrides
    };
  }, [adaptivePolling]);

  /** CONFIG SERIALIZATION - Stabilizes dependency array to prevent infinite loops **/
  const serializedConfig = JSON.stringify({
    connectionString,
    databaseName,
    tables: tablesToBeSynced,
    apiKey,
    accessToken,
  });

  /** ADAPTIVE INTERVAL CALCULATOR - Determines next sync interval based on activity **/
  const calculateAdaptiveInterval = useCallback(
    (params: {
      lastSyncChanges: number;
      consecutiveEmptySyncs: number;
      consecutiveSyncErrors: number;
    }): number => {
      const {
        consecutiveEmptySyncs: emptySyncs,
        consecutiveSyncErrors: errors,
      } = params;
      const { baseInterval, maxInterval, emptyThreshold } = adaptiveConfig;

      // Priority 1: Error backoff (exponential with 2x multiplier)
      if (errors > 0) {
        const errorInterval =
          baseInterval * Math.pow(ERROR_BACKOFF_MULTIPLIER, errors);
        return Math.min(errorInterval, maxInterval);
      }

      // Priority 2: Consecutive empty syncs - back off gradually
      if (emptySyncs >= emptyThreshold) {
        // Linear backoff: add 15s for each empty sync beyond threshold
        const backoffMs = (emptySyncs - emptyThreshold + 1) * 15000;
        const idleInterval = baseInterval + backoffMs;
        return Math.min(idleInterval, maxInterval);
      }

      // Default: base interval
      return baseInterval;
    },
    [adaptiveConfig]
  );

  /** SYNC FUNCTION - used for both manual and automatic sync **/
  const performSync = useCallback(async () => {
    /** GUARD: DB **/
    if (!writeDbRef.current) {
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

      let syncResult: QueryResult | undefined;

      /**
       * Wrap the sync command in a transaction. It ensures compatibility with op-sqlite's
       * `db.reactiveExecute`. Reactive queries are designed to re-run only
       * after a transaction successfully commits, providing a single, efficient update.
       */
      await writeDbRef.current.transaction(async (tx) => {
        syncResult = await tx.execute('SELECT cloudsync_network_sync();');
      });

      const firstRow = syncResult?.rows?.[0];
      const result = firstRow ? Object.values(firstRow)[0] : 0;
      const changes = typeof result === 'number' ? result : 0;

      setLastSyncTime(Date.now());
      setLastSyncChanges(changes);

      // Update adaptive counters
      if (changes > 0) {
        setConsecutiveEmptySyncs(0);
        setConsecutiveErrors(0);
        logger.info(`✅ Sync completed: ${changes} changes synced`);
      } else {
        setConsecutiveEmptySyncs((prev) => prev + 1);
        setConsecutiveErrors(0);
        logger.info(`✅ Sync completed: no changes`);
      }

      // Recalculate interval based on activity
      const newInterval = calculateAdaptiveInterval({
        lastSyncChanges: changes,
        consecutiveEmptySyncs: changes === 0 ? consecutiveEmptySyncs + 1 : 0,
        consecutiveSyncErrors: 0,
      });

      currentIntervalRef.current = newInterval;
      setCurrentInterval(newInterval);

      logger.info(`🔄 Next sync in ${newInterval / 1000}s`);

      setSyncError(null);
    } catch (err) {
      logger.error('❌ Sync failed:', err);
      setSyncError(err instanceof Error ? err : new Error('Sync failed'));

      // Increment error counter for backoff
      setConsecutiveErrors((prev) => prev + 1);

      // Recalculate interval with error backoff
      const newInterval = calculateAdaptiveInterval({
        lastSyncChanges: 0,
        consecutiveEmptySyncs: 0,
        consecutiveSyncErrors: consecutiveSyncErrors + 1,
      });

      currentIntervalRef.current = newInterval;
      setCurrentInterval(newInterval);

      logger.info(`🔄 Next sync in ${newInterval / 1000}s (after error)`);
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, [
    logger,
    isSyncReady,
    calculateAdaptiveInterval,
    consecutiveEmptySyncs,
    consecutiveSyncErrors,
  ]);

  /** Keep performSync ref updated **/
  useEffect(() => {
    performSyncRef.current = performSync;
  }, [performSync]);

  /** LIFECYCLE TRANSITION HANDLERS **/
  const handleForegroundTransition = useCallback(() => {
    const now = Date.now();
    const timeSinceLastForegroundSync = now - lastForegroundSyncRef.current;

    // Debounce rapid foreground transitions (5s)
    if (timeSinceLastForegroundSync < FOREGROUND_DEBOUNCE_MS) {
      logger.info('⏭️ Foreground sync debounced (too soon after last sync)');
      return;
    }

    logger.info('📱 App foregrounded - triggering immediate sync');
    lastForegroundSyncRef.current = now;

    // Reset to base interval and clear empty sync counter
    setConsecutiveEmptySyncs(0);
    currentIntervalRef.current = adaptiveConfig.baseInterval;
    setCurrentInterval(adaptiveConfig.baseInterval);

    performSyncRef.current?.();
  }, [logger, adaptiveConfig]);

  const handleBackgroundTransition = useCallback(() => {
    logger.info('📱 App backgrounded - pausing sync polling');

    // Clear any pending sync timer
    if (syncTimerRef.current !== null) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  }, [logger]);

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

        /** OPEN DATABASE CONNECTIONS **/
        if (!databaseName) {
          throw new Error('Database name is required');
        }

        logger.info('📂 Opening write connection...');
        const localWriteDb = open({ name: databaseName });
        await localWriteDb.execute('PRAGMA journal_mode = WAL');
        await localWriteDb.execute('PRAGMA synchronous = NORMAL');
        await localWriteDb.execute('PRAGMA locking_mode = NORMAL');
        writeDbRef.current = localWriteDb;
        if (isMounted) {
          setWriteDb(localWriteDb);
        }
        logger.info('✅ Write connection opened and configured');

        logger.info('📂 Opening read connection...');
        const localReadDb = open({ name: databaseName });
        await localReadDb.execute('PRAGMA journal_mode = WAL');
        await localReadDb.execute('PRAGMA query_only = true');
        readDbRef.current = localReadDb;
        if (isMounted) {
          setReadDb(localReadDb);
        }
        logger.info('✅ Read connection opened and configured (query_only)');

        /** CREATE TABLES (using write connection) **/
        if (tablesToBeSynced.length === 0) {
          logger.warn('⚠️ No tables configured for sync');
        } else {
          for (const table of tablesToBeSynced) {
            try {
              await localWriteDb.execute(table.createTableSql);
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

        logger.info('✅ Databases ready for local use');

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

          localWriteDb.loadExtension(extensionPath);
          logger.info('✅ CloudSync extension loaded');

          /** VERIFY CLOUDSYNC EXTENSION **/
          const versionResult = await localWriteDb.execute(
            'SELECT cloudsync_version();'
          );
          const version = versionResult.rows?.[0]?.['cloudsync_version()'];

          if (!version) {
            throw new Error('CloudSync extension not loaded properly');
          }
          logger.info('✅ CloudSync version:', version);

          /** INITIALIZE CLOUDSYNC FOR TABLES **/
          for (const table of tablesToBeSynced) {
            const initResult = await localWriteDb.execute(
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
          await localWriteDb.execute('SELECT cloudsync_network_init(?);', [
            connectionString,
          ]);
          logger.info('✅ Network initialized');

          /** SET AUTHENTICATION **/
          if (apiKey) {
            await localWriteDb.execute(
              'SELECT cloudsync_network_set_apikey(?);',
              [apiKey]
            );
            logger.info('✅ API key set');
          } else if (accessToken) {
            await localWriteDb.execute(
              'SELECT cloudsync_network_set_token(?);',
              [accessToken]
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

      /** CLEANUP - close both database connections **/
      const closingWriteDb = writeDbRef.current;
      const closingReadDb = readDbRef.current;
      writeDbRef.current = null;
      readDbRef.current = null;

      if (closingWriteDb) {
        try {
          closingWriteDb.close();
          logger.info('Write database closed');
        } catch (err) {
          logger.error('❌ Error closing write database:', err);
        }
      }

      if (closingReadDb) {
        try {
          closingReadDb.close();
          logger.info('Read database closed');
        } catch (err) {
          logger.error('❌ Error closing read database:', err);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedConfig, logger]);

  /** APP STATE LISTENER - Detect foreground/background transitions **/
  useEffect(() => {
    if (!isSyncReady) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;
      setAppState(nextAppState);

      // Transitioning from background to foreground
      if (
        previousState.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        handleForegroundTransition();
      }

      // Transitioning to background
      if (
        previousState === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        handleBackgroundTransition();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isSyncReady, handleForegroundTransition, handleBackgroundTransition]);

  /** NETWORK LISTENER - Detect connectivity changes **/
  useEffect(() => {
    if (!isSyncReady) {
      return;
    }

    const unsubscribe = NetInfo.addEventListener((state) => {
      const wasOffline = !isNetworkAvailable;
      const isNowOnline =
        (state.isConnected ?? false) && (state.isInternetReachable ?? true);

      setIsNetworkAvailable(isNowOnline);

      // Network reconnected - trigger immediate sync
      if (wasOffline && isNowOnline && appStateRef.current === 'active') {
        logger.info('🌐 Network reconnected - triggering sync');
        performSyncRef.current?.();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isSyncReady, isNetworkAvailable, logger]);

  /** ADAPTIVE SYNC POLLING - Dynamic interval with foreground/background awareness **/
  useEffect(() => {
    if (!isSyncReady) {
      isPollingActiveRef.current = false;
      return;
    }

    // Pause polling if app is in background
    if (appState !== 'active') {
      if (syncTimerRef.current !== null) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      isPollingActiveRef.current = false;
      return;
    }

    // Prevent multiple polling loops from starting
    if (isPollingActiveRef.current) {
      return;
    }

    isPollingActiveRef.current = true;

    // Schedule next sync with recursive setTimeout
    const scheduleNextSync = () => {
      if (syncTimerRef.current !== null) {
        clearTimeout(syncTimerRef.current);
      }

      syncTimerRef.current = setTimeout(() => {
        performSyncRef.current?.().finally(() => {
          // Reschedule after sync completes
          if (isPollingActiveRef.current) {
            scheduleNextSync();
          }
        });
      }, currentIntervalRef.current);
    };

    // Initial sync on mount
    performSyncRef.current?.().finally(() => {
      if (isPollingActiveRef.current) {
        scheduleNextSync();
      }
    });

    return () => {
      if (syncTimerRef.current !== null) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      isPollingActiveRef.current = false;
    };
  }, [isSyncReady, appState]);

  /** SPLIT CONTEXT VALUES - for optimized rendering */
  const dbContextValue = useMemo<SQLiteDbContextValue>(
    () => ({
      writeDb,
      readDb,
      initError,
    }),
    [writeDb, readDb, initError]
  );
  const syncStatusContextValue = useMemo<SQLiteSyncStatusContextValue>(
    () => ({
      isSyncReady,
      isSyncing,
      lastSyncTime,
      lastSyncChanges,
      syncError,
      currentSyncInterval: currentInterval,
      consecutiveEmptySyncs,
      consecutiveSyncErrors,
      isAppInBackground: appState !== 'active',
      isNetworkAvailable,
    }),
    [
      isSyncReady,
      isSyncing,
      lastSyncTime,
      lastSyncChanges,
      syncError,
      currentInterval,
      consecutiveEmptySyncs,
      consecutiveSyncErrors,
      appState,
      isNetworkAvailable,
    ]
  );
  const syncActionsContextValue = useMemo<SQLiteSyncActionsContextValue>(
    () => ({
      triggerSync: performSync,
    }),
    [performSync]
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
