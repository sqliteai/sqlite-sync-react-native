import type { DB, QueryResult } from '@op-engineering/op-sqlite';
import type { Logger } from '../logger';

/**
 * Extracts the number of changes from a CloudSync query result
 */
const extractChangesFromResult = (result: QueryResult | undefined): number => {
  const firstRow = result?.rows?.[0];
  const value = firstRow ? Object.values(firstRow)[0] : 0;
  return typeof value === 'number' ? value : 0;
};

/**
 * Options for performSyncOperation
 */
export interface PerformSyncOptions {
  /** Whether to wrap sync in a transaction (needed for reactive queries) */
  useTransaction?: boolean;
  /** Maximum number of sync attempts */
  maxAttempts?: number;
  /** Delay between attempts in ms */
  attemptDelay?: number;
  /**
   * Use native retry logic (passes params to cloudsync_network_sync)
   * - true: retry/delay happens in native code (better for background - won't be killed by OS)
   * - false: retry/delay happens in JS (better for foreground - doesn't block write connection)
   */
  useNativeRetry?: boolean;
}

/**
 * Perform a sync operation with retry logic
 *
 * This is the core sync logic used by both:
 * - useSyncManager hook (foreground)
 * - runBackgroundSync (background/terminated)
 *
 * @param db - Database instance
 * @param logger - Logger instance
 * @param options - Optional configuration
 *
 * @returns Number of changes synced
 */
export async function performSyncOperation(
  db: DB,
  logger: Logger,
  options?: PerformSyncOptions
): Promise<number> {
  const {
    useTransaction = false,
    maxAttempts = 4,
    attemptDelay = 1000,
    useNativeRetry = false,
  } = options ?? {};

  let changes = 0;

  if (useNativeRetry) {
    // Native retry: pass params to cloudsync_network_sync
    // Retry/delay happens in native code - better for background (won't be killed by OS)
    logger.info(
      `🔄 Sync with native retry (max: ${maxAttempts}, delay: ${attemptDelay}ms)...`
    );

    const result = await db.execute('SELECT cloudsync_network_sync(?, ?);', [
      maxAttempts,
      attemptDelay,
    ]);

    changes = extractChangesFromResult(result);
    logger.info(`🔄 Sync result: ${changes} changes`);
  } else {
    // JS retry: retry/delay in JS thread - better for foreground (doesn't block write connection)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      logger.info(`🔄 Sync attempt ${attempt + 1}/${maxAttempts}...`);

      let result: QueryResult | undefined;

      if (useTransaction) {
        // Wrap in transaction for reactive query compatibility
        await db.transaction(async (tx) => {
          result = await tx.execute('SELECT cloudsync_network_sync();');
        });
      } else {
        result = await db.execute('SELECT cloudsync_network_sync();');
      }

      changes = extractChangesFromResult(result);
      logger.info(`🔄 Sync attempt ${attempt + 1} result: ${changes} changes`);

      if (changes > 0) {
        break;
      }

      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, attemptDelay));
      }
    }
  }

  if (changes > 0) {
    logger.info(`✅ Sync completed: ${changes} changes synced`);
  } else {
    logger.info('✅ Sync completed: no changes');
  }

  return changes;
}
