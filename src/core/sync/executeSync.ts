import type { DB, QueryResult } from '@op-engineering/op-sqlite';
import type { Logger } from '../common/logger';
import { decodeSQLiteText, extractFirstRowValue } from './cloudsyncResultUtils';

/**
 * Extracts the number of received rows from a CloudSync query result.
 *
 * The result row contains a JSON string:
 * {"send":{...},"receive":{"rows":N,"tables":["table1"]}}
 *
 * We only use receive.rows since polling is for downloading remote changes.
 */
const extractChangesFromResult = (result: QueryResult | undefined): number => {
  const raw = decodeSQLiteText(extractFirstRowValue(result));

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed?.receive?.rows === 'number'
        ? parsed.receive.rows
        : 0;
    } catch {
      return 0;
    }
  }

  return 0;
};

/**
 * Options for executeSync
 */
export interface ExecuteSyncOptions {
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
 * - executeBackgroundSync (background/terminated)
 *
 * @param db - Database instance
 * @param logger - Logger instance
 * @param options - Optional configuration
 *
 * @returns Number of changes synced
 */
export async function executeSync(
  db: DB,
  logger: Logger,
  options?: ExecuteSyncOptions
): Promise<number> {
  const {
    useTransaction = false,
    maxAttempts = 4,
    attemptDelay = 1000,
    useNativeRetry = false,
  } = options ?? {};

  let changes = 0;

  if (useNativeRetry) {
    /** NATIVE RETRY MODE */
    // Retry/delay happens in native code - better for background (won't be killed by OS)
    logger.info(
      `🔄 Sync with native retry (max: ${maxAttempts}, delay: ${attemptDelay}ms)...`
    );

    const result = await db.execute('SELECT cloudsync_network_sync(?, ?);', [
      attemptDelay,
      maxAttempts,
    ]);

    changes = extractChangesFromResult(result);
    logger.info(`🔄 Sync result: ${changes} changes downloaded`);
  } else {
    /** JS RETRY MODE */
    // Retry/delay in JS thread - better for foreground (doesn't block write connection)
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
      logger.info(
        `🔄 Sync attempt ${attempt + 1} result: ${changes} changes downloaded`
      );

      if (changes > 0) {
        break;
      }

      // Wait before next attempt (except on last attempt)
      if (attempt < maxAttempts - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, attemptDelay));
      }
    }
  }

  /** LOG RESULT */
  if (changes > 0) {
    logger.info(`✅ Sync completed: ${changes} changes downloaded`);
  } else {
    logger.info('✅ Sync completed: no changes downloaded');
  }

  return changes;
}
