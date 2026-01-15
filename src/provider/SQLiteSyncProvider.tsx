import { useState, useMemo, useRef } from 'react';
import { SQLiteDbContext } from '../contexts/SQLiteDbContext';
import { SQLiteSyncStatusContext } from '../contexts/SQLiteSyncStatusContext';
import { SQLiteSyncActionsContext } from '../contexts/SQLiteSyncActionsContext';
import type { SQLiteSyncProviderProps } from '../types/SQLiteSyncProviderProps';
import type { SQLiteDbContextValue } from '../types/SQLiteDbContextValue';
import type { SQLiteSyncStatusContextValue } from '../types/SQLiteSyncStatusContextValue';
import type { SQLiteSyncActionsContextValue } from '../types/SQLiteSyncActionsContextValue';
import { createLogger } from '../utils/logger';
import { DEFAULT_BASE_INTERVAL } from './constants';
import { useDatabaseInitialization } from './hooks/useDatabaseInitialization';
import { useSyncManager } from './hooks/useSyncManager';
import { useAppLifecycle } from './hooks/useAppLifecycle';
import { useNetworkListener } from './hooks/useNetworkListener';
import { useAdaptivePolling } from './hooks/useAdaptivePolling';
import { useSqliteSyncPush } from './hooks/useSqliteSyncPush';

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
 * 3. **Flexible Sync Modes:**
 *    - **Polling mode (default):** Adaptive polling with foreground, network reconnect triggers
 *      - Backs off when idle, increases frequency on errors (exponential backoff)
 *      - Pauses polling when app is backgrounded
 *    - **Push mode:** Relies on push notifications from SQLite Cloud
 *      - Still syncs on foreground and network reconnect for reliability
 *
 * 4. **Reactive Configuration:**
 *    - Changes to critical props (`connectionString`, `apiKey`, `tablesToBeSynced`) will trigger
 *      a safe teardown (closing DB) and re-initialization to ensure auth consistency.
 *    - Configuration objects are serialized internally to prevent unnecessary re-renders.
 *
 * @param props.connectionString - SQLite Cloud connection string
 * @param props.databaseName - Local filename (e.g., 'app.db')
 * @param props.tablesToBeSynced - Array of table configs. (Changes to content trigger re-init)
 * @param props.syncMode - Sync mode: 'polling' (default) or 'push'
 * @param props.adaptivePolling - Optional adaptive polling configuration (polling mode only)
 * @param props.apiKey - (Optional) API Key for auth. Triggers re-init when changed.
 * @param props.accessToken - (Optional) Access Token for auth. Triggers re-init when changed.
 * @param props.debug - Enable console logging
 */
export function SQLiteSyncProvider({
  connectionString,
  databaseName,
  tablesToBeSynced,
  adaptivePolling,
  syncMode = 'polling',
  debug = false,
  children,
  ...authProps
}: SQLiteSyncProviderProps) {
  /** EXTRACT AUTH CREDENTIALS */
  const apiKey = 'apiKey' in authProps ? authProps.apiKey : undefined;
  const accessToken =
    'accessToken' in authProps ? authProps.accessToken : undefined;

  /** CREATE LOGGER */
  const logger = useMemo(() => createLogger(debug), [debug]);

  /** ADAPTIVE POLLING CONFIGURATION (only used in polling mode) */
  const adaptiveConfig = useMemo(() => {
    const defaults = {
      baseInterval: 5000, // 5s base interval
      maxInterval: 300000, // 5min maximum backoff
      emptyThreshold: 5, // Back off after 3 empty syncs
    };
    return syncMode === 'polling'
      ? { ...defaults, ...adaptivePolling }
      : defaults;
  }, [adaptivePolling, syncMode]);

  /** CURRENT INTERVAL STATE (only used in polling mode) */
  const initialInterval =
    syncMode === 'polling'
      ? adaptivePolling?.baseInterval ?? DEFAULT_BASE_INTERVAL
      : DEFAULT_BASE_INTERVAL;

  const [currentInterval, setCurrentInterval] = useState(initialInterval);
  const currentIntervalRef = useRef(initialInterval);

  /** INITIALIZE DATABASE */
  const {
    writeDb,
    readDb,
    writeDbRef,
    isSyncReady,
    initError,
    syncError: initSyncError,
  } = useDatabaseInitialization({
    connectionString,
    databaseName,
    tablesToBeSynced,
    apiKey,
    accessToken,
    logger,
  });

  /** SYNC MANAGER */
  const {
    performSyncRef,
    isSyncing,
    lastSyncTime,
    lastSyncChanges,
    consecutiveEmptySyncs,
    consecutiveSyncErrors,
    syncError,
    setConsecutiveEmptySyncs,
  } = useSyncManager({
    writeDbRef,
    isSyncReady,
    logger,
    adaptiveConfig,
    currentIntervalRef,
    setCurrentInterval,
  });

  /** APP LIFECYCLE */
  const { appState, isInBackground } = useAppLifecycle({
    isSyncReady,
    performSyncRef,
    setConsecutiveEmptySyncs,
    currentIntervalRef,
    setCurrentInterval,
    adaptiveConfig,
    logger,
  });

  /** NETWORK LISTENER */
  const { isNetworkAvailable } = useNetworkListener({
    isSyncReady,
    performSyncRef,
    appState,
    logger,
  });

  /** ADAPTIVE POLLING - Only active when syncMode is 'polling' */
  useAdaptivePolling({
    isSyncReady,
    appState,
    performSyncRef,
    currentIntervalRef,
    syncMode,
  });

  /** PUSH NOTIFICATIONS - Only active when syncMode is 'push' */
  useSqliteSyncPush({
    isSyncReady,
    performSyncRef,
    writeDbRef,
    syncMode,
    logger,
  });

  /** CONTEXT VALUES */
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
      syncMode,
      isSyncReady,
      isSyncing,
      lastSyncTime,
      lastSyncChanges,
      syncError: syncError || initSyncError,
      currentSyncInterval: currentInterval,
      consecutiveEmptySyncs,
      consecutiveSyncErrors,
      isAppInBackground: isInBackground,
      isNetworkAvailable,
    }),
    [
      syncMode,
      isSyncReady,
      isSyncing,
      lastSyncTime,
      lastSyncChanges,
      syncError,
      initSyncError,
      currentInterval,
      consecutiveEmptySyncs,
      consecutiveSyncErrors,
      isInBackground,
      isNetworkAvailable,
    ]
  );

  const syncActionsContextValue = useMemo<SQLiteSyncActionsContextValue>(
    () => ({
      triggerSync: () => performSyncRef.current?.() ?? Promise.resolve(),
    }),
    [performSyncRef]
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
