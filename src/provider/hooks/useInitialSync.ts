import { useEffect, useRef } from 'react';
import type { Logger } from '../../utils/logger';

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

  /** INITIAL SYNC - Trigger sync when app starts */
  useEffect(() => {
    if (isSyncReady && !hasInitialSyncedRef.current) {
      hasInitialSyncedRef.current = true;
      logger.info('🚀 Triggering initial sync on app start');
      performSyncRef.current?.();
    }
  }, [isSyncReady, performSyncRef, logger]);
}
