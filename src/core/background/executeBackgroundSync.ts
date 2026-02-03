import type { DB } from '@op-engineering/op-sqlite';
import type { ChangeRecord } from '../../types/BackgroundSyncCallback';
import type { BackgroundSyncConfig } from './backgroundSyncConfig';
import { initializeSyncExtension } from '../sync/initializeSyncExtension';
import { executeSync } from '../sync/executeSync';
import { createDatabase } from '../database/createDatabase';
import { createLogger } from '../common/logger';
import { getBackgroundSyncCallback } from '../pushNotifications/pushNotificationSyncCallbacks';

/**
 * Run a complete background sync cycle
 * Opens database, initializes sync, performs sync, closes database
 */
export async function executeBackgroundSync(
  config: BackgroundSyncConfig
): Promise<void> {
  const logger = createLogger(config.debug ?? false);
  let db: DB | null = null;
  const changes: ChangeRecord[] = [];

  try {
    logger.info('📲 Starting background sync...');

    /** OPEN DATABASE */
    db = await createDatabase(config.databaseName, 'write');
    logger.info('✅ Database connection opened');

    /** INITIALIZE SYNC EXTENSION */
    await initializeSyncExtension(
      db,
      {
        connectionString: config.connectionString,
        tablesToBeSynced: config.tablesToBeSynced,
        apiKey: config.apiKey,
        accessToken: config.accessToken,
      },
      logger
    );

    /** REGISTER UPDATE HOOK */
    const callback = getBackgroundSyncCallback();
    if (callback) {
      db.updateHook(({ operation, table, rowId }) => {
        changes.push({
          operation: operation as 'INSERT' | 'UPDATE' | 'DELETE',
          table,
          rowId,
        });
      });
      logger.info('📲 Update hook registered for change tracking');
    }

    /** EXECUTE SYNC */
    await executeSync(db, logger, {
      useNativeRetry: true,
      maxAttempts: 3,
      attemptDelay: 500,
    });

    logger.info('✅ Background sync completed successfully');

    /** INVOKE USER CALLBACK */
    if (callback && db) {
      logger.info(
        `📲 Calling background sync callback with ${changes.length} changes`
      );
      try {
        // Remove the hook before calling callback to avoid capturing callback's queries
        db.updateHook(null);
        await callback({ changes, db });
        logger.info('✅ Background sync callback completed');
      } catch (callbackError) {
        logger.error('❌ Background sync callback failed:', callbackError);
      }
    }
  } catch (error) {
    logger.error('❌ Background sync failed:', error);
    throw error;
  } finally {
    /** CLEANUP */
    if (db) {
      try {
        db.updateHook(null);
        db.close();
        logger.info('✅ Database connection closed');
      } catch (closeError) {
        logger.error('❌ Error closing database:', closeError);
      }
    }
  }
}
