import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import type { AdaptivePollingConfig } from '../../types/SQLiteSyncProviderProps';
import type { Logger } from '../../utils/logger';
import { FOREGROUND_DEBOUNCE_MS } from '../constants';

/**
 * Parameters for useAppLifecycle hook
 */
export interface AppLifecycleParams {
  /**
   * Whether sync is ready and configured
   */
  isSyncReady: boolean;

  /**
   * Ref to performSync function
   */
  performSyncRef: React.RefObject<(() => Promise<void>) | null>;

  /**
   * Setter for consecutive empty syncs counter
   */
  setConsecutiveEmptySyncs: React.Dispatch<React.SetStateAction<number>>;

  /**
   * Ref to current polling interval
   */
  currentIntervalRef: React.RefObject<number>;

  /**
   * Setter for current interval state
   */
  setCurrentInterval: React.Dispatch<React.SetStateAction<number>>;

  /**
   * Adaptive polling configuration
   */
  adaptiveConfig: Required<AdaptivePollingConfig>;

  /**
   * Logger instance for logging
   */
  logger: Logger;
}

/**
 * Return type for useAppLifecycle hook
 */
export interface AppLifecycleResult {
  /**
   * Current app state ('active', 'background', or 'inactive')
   */
  appState: string;

  /**
   * Whether the app is in background
   */
  isInBackground: boolean;
}

/**
 * Custom hook for managing app lifecycle events
 *
 * Handles:
 * - AppState listener for foreground/background transitions
 * - Foreground sync trigger with debouncing
 * - Resetting to base interval when foregrounded
 *
 * @param params - App lifecycle parameters
 * @returns App state information
 *
 * @example
 * ```typescript
 * const { appState, isInBackground } = useAppLifecycle({
 *   isSyncReady,
 *   performSyncRef,
 *   setConsecutiveEmptySyncs,
 *   currentIntervalRef,
 *   setCurrentInterval,
 *   adaptiveConfig,
 *   logger
 * });
 * ```
 */
export function useAppLifecycle(
  params: AppLifecycleParams
): AppLifecycleResult {
  const {
    isSyncReady,
    performSyncRef,
    setConsecutiveEmptySyncs,
    currentIntervalRef,
    setCurrentInterval,
    adaptiveConfig,
    logger,
  } = params;

  /** APP STATE */
  const [appState, setAppState] = useState<string>('active');

  /** REFS */
  const lastForegroundSyncRef = useRef<number>(0);
  const appStateRef = useRef<string>('active');

  /** LIFECYCLE TRANSITION HANDLERS */
  const handleForegroundTransition = useCallback(() => {
    const now = Date.now();
    const timeSinceLastForegroundSync = now - lastForegroundSyncRef.current;

    // Debounce rapid foreground transitions (2s)
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
  }, [
    logger,
    adaptiveConfig,
    performSyncRef,
    setConsecutiveEmptySyncs,
    currentIntervalRef,
    setCurrentInterval,
  ]);

  const handleBackgroundTransition = useCallback(() => {
    logger.info('📱 App backgrounded - pausing sync polling');
  }, [logger]);

  /** APP STATE LISTENER - Detect foreground/background transitions */
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

  return {
    appState,
    isInBackground: appState !== 'active',
  };
}
