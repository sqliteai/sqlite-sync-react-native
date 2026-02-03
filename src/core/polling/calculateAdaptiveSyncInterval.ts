import type { AdaptivePollingConfig } from '../../types/SQLiteSyncProviderProps';

/**
 * Parameters for calculating the next adaptive sync interval
 */
export interface AdaptiveSyncIntervalParams {
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
 * 1. **Error backoff (exponential)**: If errors detected → baseInterval × (errorBackoffMultiplier ^ errorCount), capped at maxInterval
 * 2. **Idle backoff (exponential)**: If emptySyncs >= emptyThreshold → baseInterval × (idleBackoffMultiplier ^ (emptySyncs - threshold + 1)), capped at maxInterval
 * 3. **Default**: baseInterval
 *
 * @param params - Sync activity parameters
 * @param config - Adaptive polling configuration
 * @returns The calculated interval in milliseconds
 *
 * @example
 * ```typescript
 * Idle backoff example
 * const interval = calculateAdaptiveSyncInterval(
 *   { lastSyncChanges: 0, consecutiveEmptySyncs: 7, consecutiveSyncErrors: 0 },
 *   { baseInterval: 5000, maxInterval: 300000, emptyThreshold: 5, idleBackoffMultiplier: 1.5 }
 * );
 * Returns: 16875 (5000 × 1.5^3)
 *
 * Error backoff example
 * const interval = calculateAdaptiveSyncInterval(
 *   { lastSyncChanges: 0, consecutiveEmptySyncs: 0, consecutiveSyncErrors: 3 },
 *   { baseInterval: 5000, maxInterval: 300000, errorBackoffMultiplier: 2.0 }
 * );
 * Returns: 40000 (5000 × 2^3)
 * ```
 */
export function calculateAdaptiveSyncInterval(
  params: AdaptiveSyncIntervalParams,
  config: Required<AdaptivePollingConfig>
): number {
  const { consecutiveEmptySyncs: emptySyncs, consecutiveSyncErrors: errors } =
    params;
  const {
    baseInterval,
    maxInterval,
    emptyThreshold,
    idleBackoffMultiplier,
    errorBackoffMultiplier,
  } = config;

  /** PRIORITY 1: ERROR BACKOFF */
  if (errors > 0) {
    const errorInterval =
      baseInterval * Math.pow(errorBackoffMultiplier, errors);
    return Math.min(errorInterval, maxInterval);
  }

  /** PRIORITY 2: IDLE BACKOFF */
  if (emptySyncs >= emptyThreshold) {
    const backoffPower = emptySyncs - emptyThreshold + 1;
    const idleInterval =
      baseInterval * Math.pow(idleBackoffMultiplier, backoffPower);
    return Math.min(idleInterval, maxInterval);
  }

  /** DEFAULT: BASE INTERVAL */
  return baseInterval;
}
