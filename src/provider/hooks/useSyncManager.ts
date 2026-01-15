import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { DB, QueryResult } from '@op-engineering/op-sqlite';
import type { AdaptivePollingConfig } from '../../types/SQLiteSyncProviderProps';
import type { Logger } from '../../utils/logger';
import { calculateAdaptiveInterval } from '../utils/calculateAdaptiveInterval';

/**
 * Helper function to delay execution
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extracts the number of changes from a CloudSync query result
 */
const extractChanges = (result: QueryResult | undefined): number => {
  const firstRow = result?.rows?.[0];
  const value = firstRow ? Object.values(firstRow)[0] : 0;
  return typeof value === 'number' ? value : 0;
};

/**
 * Parameters for useSyncManager hook
 */
export interface SyncManagerParams {
  /**
   * Ref to write database instance
   */
  writeDbRef: React.RefObject<DB | null>;

  /**
   * Whether sync is ready and configured
   */
  isSyncReady: boolean;

  /**
   * Logger instance for logging
   */
  logger: Logger;

  /**
   * Adaptive polling configuration
   */
  adaptiveConfig: Required<AdaptivePollingConfig>;

  /**
   * Ref to current polling interval
   */
  currentIntervalRef: React.RefObject<number>;

  /**
   * Setter for current interval state
   */
  setCurrentInterval: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * Return type for useSyncManager hook
 */
export interface SyncManagerResult {
  /**
   * Function to perform a sync operation
   */
  performSync: () => Promise<void>;

  /**
   * Ref to performSync function (for avoiding closure issues)
   */
  performSyncRef: React.RefObject<(() => Promise<void>) | null>;

  /**
   * Whether a sync is currently in progress
   */
  isSyncing: boolean;

  /**
   * Timestamp of last successful sync
   */
  lastSyncTime: number | null;

  /**
   * Number of changes in last sync
   */
  lastSyncChanges: number;

  /**
   * Number of consecutive empty syncs
   */
  consecutiveEmptySyncs: number;

  /**
   * Number of consecutive sync errors
   */
  consecutiveSyncErrors: number;

  /**
   * Last sync error
   */
  syncError: Error | null;

  /**
   * Setter for consecutive empty syncs (used by lifecycle hooks)
   */
  setConsecutiveEmptySyncs: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * Custom hook for managing sync operations
 *
 * Handles:
 * - Sync execution with guards (network, concurrency, sync ready)
 * - Adaptive interval calculation based on sync results
 * - Sync state management (isSyncing, lastSyncTime, changes, errors)
 * - performSyncRef pattern to avoid closure issues
 *
 * @param params - Sync manager parameters
 * @returns Sync functions and state
 *
 * @example
 * ```typescript
 * const {
 *   performSync,
 *   performSyncRef,
 *   isSyncing,
 *   lastSyncTime
 * } = useSyncManager({
 *   writeDbRef,
 *   isSyncReady,
 *   logger,
 *   adaptiveConfig,
 *   currentIntervalRef,
 *   setCurrentInterval
 * });
 * ```
 */
export function useSyncManager(params: SyncManagerParams): SyncManagerResult {
  const {
    writeDbRef,
    isSyncReady,
    logger,
    adaptiveConfig,
    currentIntervalRef,
    setCurrentInterval,
  } = params;

  /** SYNC STATE */
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [lastSyncChanges, setLastSyncChanges] = useState(0);
  const [consecutiveEmptySyncs, setConsecutiveEmptySyncs] = useState<number>(0);
  const [consecutiveSyncErrors, setConsecutiveErrors] = useState<number>(0);
  const [syncError, setSyncError] = useState<Error | null>(null);

  /** REFS */
  const isSyncingRef = useRef(false);
  const performSyncRef = useRef<(() => Promise<void>) | null>(null);

  /** SYNC FUNCTION - used for both manual and automatic sync */
  const performSync = useCallback(async () => {
    /** GUARD: DB */
    if (!writeDbRef.current) {
      return;
    }

    /** GUARD: CONCURRENCY */
    if (isSyncingRef.current) {
      return;
    }

    /** GUARD: NETWORK CONNECTIVITY (Android Only) */
    // On Android, the native call blocks for ~10-15s if offline.
    // We check NetInfo first to prevent this freeze.
    // On iOS, the OS fails fast, so we let the native code handle it.
    if (Platform.OS === 'android') {
      const networkState = await NetInfo.fetch();
      const isOnline =
        (networkState.isConnected ?? false) &&
        (networkState.isInternetReachable ?? true);

      if (!isOnline) {
        logger.info(`⚠️ Sync skipped: No internet connection`);
        return;
      }
    }

    /** GUARD: OFFLINE MODE */
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

        let changes = extractChanges(syncResult);

        if (changes > 0) {
          return;
        }

        await delay(1000);

        syncResult = await tx.execute('SELECT cloudsync_network_sync();');

        changes = extractChanges(syncResult);

        if (changes > 0) {
          return;
        }

        await delay(1000);

        syncResult = await tx.execute('SELECT cloudsync_network_sync();');
      });

      const changes = extractChanges(syncResult);

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
      const newInterval = calculateAdaptiveInterval(
        {
          lastSyncChanges: changes,
          consecutiveEmptySyncs: changes === 0 ? consecutiveEmptySyncs + 1 : 0,
          consecutiveSyncErrors: 0,
        },
        adaptiveConfig
      );

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
      const newInterval = calculateAdaptiveInterval(
        {
          lastSyncChanges: 0,
          consecutiveEmptySyncs: 0,
          consecutiveSyncErrors: consecutiveSyncErrors + 1,
        },
        adaptiveConfig
      );

      currentIntervalRef.current = newInterval;
      setCurrentInterval(newInterval);

      logger.info(`🔄 Next sync in ${newInterval / 1000}s (after error)`);
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, [
    writeDbRef,
    isSyncReady,
    logger,
    adaptiveConfig,
    currentIntervalRef,
    setCurrentInterval,
    consecutiveEmptySyncs,
    consecutiveSyncErrors,
  ]);

  /** Keep performSyncRef updated */
  useEffect(() => {
    performSyncRef.current = performSync;
  }, [performSync]);

  return {
    performSync,
    performSyncRef,
    isSyncing,
    lastSyncTime,
    lastSyncChanges,
    consecutiveEmptySyncs,
    consecutiveSyncErrors,
    syncError,
    setConsecutiveEmptySyncs,
  };
}
