import { useEffect, useRef } from 'react';
import type { Logger } from '../common/logger';

/**
 * Delay before initial sync to allow components to set up reactive subscriptions.
 * This must be longer than SUBSCRIPTION_DEBOUNCE_MS (1000ms) in useSqliteSyncQuery
 * to ensure subscriptions are established before sync data arrives.
 */
const INITIAL_SYNC_DELAY_MS = 1500;

/**
 * Parameters for useInitialSync hook
 */
export interface InitialSyncParams {
  /**
   * Whether sync is ready and configured
   */
  isSyncReady: boolean;

  /**
   * Ref to performSync function
   */
  performSyncRef: React.RefObject<(() => Promise<void>) | null>;

  /**
   * Logger instance for logging
   */
  logger: Logger;
}

/**
 * Custom hook for triggering initial sync when app starts
 *
 * Handles:
 * - One-time sync when isSyncReady becomes true
 * - Works in both polling and push modes
 * - Uses ref to ensure sync only happens once per session
 * - Delays sync to allow reactive subscriptions to be established first
 *
 * @param params - Initial sync parameters
 *
 * @example
 * ```typescript
 * useInitialSync({
 *   isSyncReady,
 *   performSyncRef,
 *   logger
 * });
 * ```
 */
export function useInitialSync(params: InitialSyncParams): void {
  const { isSyncReady, performSyncRef, logger } = params;

  /** Track if initial sync has been triggered */
  const hasInitialSyncedRef = useRef(false);

  /** INITIAL SYNC - Trigger sync when app starts (with delay for reactive subscriptions) */
  useEffect(() => {
    if (!isSyncReady || hasInitialSyncedRef.current) {
      return;
    }

    hasInitialSyncedRef.current = true;

    // Delay initial sync to allow components to mount and set up reactive subscriptions
    const timeoutId = setTimeout(() => {
      logger.info('🚀 Triggering initial sync on app start');
      performSyncRef.current?.();
    }, INITIAL_SYNC_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [isSyncReady, performSyncRef, logger]);
}
