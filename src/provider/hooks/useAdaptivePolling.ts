import { useEffect, useRef } from 'react';
import type { SyncMode } from '../../types/SQLiteSyncProviderProps';

/**
 * Parameters for useAdaptivePolling hook
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
 * - Performs initial sync on mount
 * - Only runs when syncMode is 'polling'
 *
 * @param params - Adaptive polling parameters
 *
 * @example
 * ```typescript
 * useAdaptivePolling({
 *   isSyncReady,
 *   appState,
 *   performSyncRef,
 *   currentIntervalRef,
 *   syncMode: 'polling'
 * });
 * ```
 */
export function useAdaptivePolling(params: AdaptivePollingParams): void {
  const {
    isSyncReady,
    appState,
    performSyncRef,
    currentIntervalRef,
    syncMode,
  } = params;

  /** REFS */
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingActiveRef = useRef<boolean>(false);

  /** ADAPTIVE SYNC POLLING - Dynamic interval with foreground/background awareness */
  useEffect(() => {
    // Only enable polling when syncMode is 'polling'
    if (
      !isSyncReady ||
      syncMode !== 'polling' ||
      currentIntervalRef.current === null
    ) {
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
  }, [isSyncReady, appState, performSyncRef, currentIntervalRef, syncMode]);
}
