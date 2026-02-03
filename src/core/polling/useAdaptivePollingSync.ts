import { useEffect, useRef } from 'react';
import type { SyncMode } from '../../types/SQLiteSyncProviderProps';

/**
 * Parameters for useAdaptivePollingSync hook
 */
export interface AdaptivePollingParams {
  /**
   * Whether sync is ready and configured
   */
  isSyncReady: boolean;

  /**
   * Current app state ('active', 'background', or 'inactive')
   */
  appState: string;

  /**
   * Ref to performSync function
   */
  performSyncRef: React.RefObject<(() => Promise<void>) | null>;

  /**
   * Ref to current polling interval in milliseconds (null in push mode)
   */
  currentIntervalRef: React.RefObject<number | null>;

  /**
   * Sync mode - polling is only enabled when set to 'polling'
   */
  syncMode: SyncMode;
}

/**
 * Custom hook for managing adaptive polling loop
 *
 * Handles:
 * - Recursive setTimeout-based polling (not setInterval)
 * - Pauses polling when app is backgrounded
 * - Prevents multiple polling loops from starting
 * - Uses dynamic interval from currentIntervalRef
 * - Only runs when syncMode is 'polling'
 *
 * Note: Initial sync is handled by SQLiteSyncProvider, not this hook.
 *
 * @param params - Adaptive polling parameters
 *
 * @example
 * ```typescript
 * useAdaptivePollingSync({
 *   isSyncReady,
 *   appState,
 *   performSyncRef,
 *   currentIntervalRef,
 *   syncMode: 'polling'
 * });
 * ```
 */
export function useAdaptivePollingSync(params: AdaptivePollingParams): void {
  const {
    isSyncReady,
    appState,
    performSyncRef,
    currentIntervalRef,
    syncMode,
  } = params;

  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingActiveRef = useRef<boolean>(false);

  /** ADAPTIVE SYNC POLLING EFFECT */
  useEffect(() => {
    /** GUARD: POLLING MODE ONLY */
    if (
      !isSyncReady ||
      syncMode !== 'polling' ||
      currentIntervalRef.current === null
    ) {
      isPollingActiveRef.current = false;
      return;
    }

    /** GUARD: PAUSE WHEN BACKGROUNDED */
    if (appState !== 'active') {
      if (syncTimerRef.current !== null) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      isPollingActiveRef.current = false;
      return;
    }

    /** GUARD: PREVENT MULTIPLE LOOPS */
    if (isPollingActiveRef.current) {
      return;
    }

    isPollingActiveRef.current = true;

    /** RECURSIVE POLLING LOOP */
    const scheduleNextSync = () => {
      if (syncTimerRef.current !== null) {
        clearTimeout(syncTimerRef.current);
      }

      const interval = currentIntervalRef.current;
      if (interval === null) {
        // Polling disabled, stop scheduling
        isPollingActiveRef.current = false;
        return;
      }

      syncTimerRef.current = setTimeout(() => {
        performSyncRef.current?.().finally(() => {
          // Reschedule after sync completes
          if (isPollingActiveRef.current) {
            scheduleNextSync();
          }
        });
      }, interval);
    };

    scheduleNextSync();

    /** CLEANUP */
    return () => {
      if (syncTimerRef.current !== null) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      isPollingActiveRef.current = false;
    };
  }, [isSyncReady, appState, performSyncRef, currentIntervalRef, syncMode]);
}
