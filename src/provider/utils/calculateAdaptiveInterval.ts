import type { AdaptivePollingConfig } from '../../types/SQLiteSyncProviderProps';
import { ERROR_BACKOFF_MULTIPLIER } from '../constants';

/**
 * Parameters for calculating the next adaptive sync interval
 */
export interface AdaptiveIntervalParams {
  /**
   * Number of changes from the last sync operation
   */
  lastSyncChanges: number;

  /**
   * Number of consecutive syncs that found no changes
   */
  consecutiveEmptySyncs: number;

  /**
   * Number of consecutive sync errors
   */
  consecutiveSyncErrors: number;
}

/**
 * Calculates the next sync interval based on sync activity
 *
 * **Algorithm:**
 * 1. **Error backoff (exponential)**: If errors detected → baseInterval × (2 ^ errorCount), capped at maxInterval
 * 2. **Idle backoff (linear)**: If 3+ consecutive empty syncs → baseInterval + (emptyCount × 15s), capped at maxInterval
 * 3. **Default**: baseInterval
 *
 * @param params - Sync activity parameters
 * @param config - Adaptive polling configuration
 * @returns The calculated interval in milliseconds
 *
 * @example
 * ```typescript
 * const interval = calculateAdaptiveInterval(
 *   { lastSyncChanges: 0, consecutiveEmptySyncs: 5, consecutiveSyncErrors: 0 },
 *   { baseInterval: 30000, maxInterval: 300000, emptyThreshold: 3 }
 * );
 * Returns: 60000 (baseInterval + 2 * 15000)
 * ```
 */
export function calculateAdaptiveInterval(
  params: AdaptiveIntervalParams,
  config: Required<AdaptivePollingConfig>
): number {
  const { consecutiveEmptySyncs: emptySyncs, consecutiveSyncErrors: errors } =
    params;
  const { baseInterval, maxInterval, emptyThreshold } = config;

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
}
