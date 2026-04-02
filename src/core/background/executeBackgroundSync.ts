import type { DB } from '@op-engineering/op-sqlite';
import type { ChangeRecord } from '../../types/BackgroundSyncCallback';
import type { BackgroundSyncConfig } from './backgroundSyncConfig';
import { initializeSyncExtension } from '../sync/initializeSyncExtension';
import { executeSync } from '../sync/executeSync';
import { createDatabase } from '../database/createDatabase';
import { createLogger } from '../common/logger';
import { getBackgroundSyncCallback } from '../pushNotifications/pushNotificationSyncCallbacks';
import {
  setActiveBackgroundDb,
  clearActiveBackgroundDb,
} from './activeBackgroundDb';

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
    // Pass setActiveBackgroundDb as onOpen so the reference is registered synchronously
    // after open() but before any awaited PRAGMAs — closing the kill-window gap
    db = await createDatabase(config.databaseName, 'write', (rawDb) => {
      setActiveBackgroundDb(rawDb);
    });
    logger.info('✅ Database connection opened');

    /** INITIALIZE SYNC EXTENSION */
    await initializeSyncExtension(
      db,
      {
        databaseId: config.databaseId,
        databaseName: config.databaseName,
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
    // No retries: in push mode the server sends a follow-up notification
    // (apply → check) when the artifact is ready. Client-side retries cause
    // concurrent background syncs and extend JS thread blocking on Android.
    await executeSync(db, logger, {
      maxAttempts: 1,
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
    clearActiveBackgroundDb();
    if (db) {
      try {
        db.updateHook(null);
        db.close();
        logger.info('✅ Database connection closed');
      } catch (closeError) {
        // Foreground may have already closed this connection — that is expected
        logger.warn(
          '⚠️ Error closing database (may already be closed by foreground):',
          closeError
        );
      }
    }
  }
}
