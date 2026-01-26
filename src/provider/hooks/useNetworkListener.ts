import { useState, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import type { Logger } from '../../core/logger';

/**
 * Parameters for useNetworkListener hook
 */
export interface NetworkListenerParams {
  /**
   * Whether sync is ready and configured
   */
  isSyncReady: boolean;

  /**
   * Ref to performSync function
   */
  performSyncRef: React.RefObject<(() => Promise<void>) | null>;

  /**
   * Current app state
   */
  appState: string;

  /**
   * Logger instance for logging
   */
  logger: Logger;
}

/**
 * Return type for useNetworkListener hook
 */
export interface NetworkListenerResult {
  /**
   * Whether network is currently available
   */
  isNetworkAvailable: boolean;
}

/**
 * Custom hook for monitoring network connectivity
 *
 * Handles:
 * - NetInfo listener for connectivity changes
 * - Triggers immediate sync when network reconnects (while app is active)
 *
 * @param params - Network listener parameters
 * @returns Network availability status
 *
 * @example
 * ```typescript
 * const { isNetworkAvailable } = useNetworkListener({
 *   isSyncReady,
 *   performSyncRef,
 *   appState,
 *   logger
 * });
 * ```
 */
export function useNetworkListener(
  params: NetworkListenerParams
): NetworkListenerResult {
  const { isSyncReady, performSyncRef, appState, logger } = params;

  /** NETWORK STATE */
  const [isNetworkAvailable, setIsNetworkAvailable] = useState<boolean>(true);

  /** REFS */
  const appStateRef = useRef<string>('active');
  const isNetworkAvailableRef = useRef<boolean>(true);

  // Keep appStateRef in sync
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  /** NETWORK LISTENER - Detect connectivity changes */
  useEffect(() => {
    if (!isSyncReady) {
      return;
    }

    const unsubscribe = NetInfo.addEventListener((state) => {
      const wasOffline = !isNetworkAvailableRef.current;
      const isNowOnline =
        (state.isConnected ?? false) && (state.isInternetReachable ?? true);

      isNetworkAvailableRef.current = isNowOnline;
      setIsNetworkAvailable(isNowOnline);

      // Network reconnected - trigger immediate sync (only when app is active)
      if (wasOffline && isNowOnline && appStateRef.current === 'active') {
        logger.info('🌐 Network reconnected - triggering sync');
        performSyncRef.current?.();
      }
    });

    return () => {
      unsubscribe();
    };
    // performSyncRef is a stable ref, logger is memoized
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncReady]);

  return {
    isNetworkAvailable,
  };
}
