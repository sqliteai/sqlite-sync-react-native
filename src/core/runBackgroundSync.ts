import type { DB } from '@op-engineering/op-sqlite';
import type { TableConfig } from '../types/TableConfig';
import type { ChangeRecord } from '../types/BackgroundSyncHandler';
import { createDatabase } from '../provider/utils/createDatabase';
import { createLogger } from '../utils/logger';
import { initializeSyncExtension } from './initializeSyncExtension';
import { performSyncOperation } from './performSyncOperation';
import { getBackgroundSyncHandler } from './backgroundSync';

/**
 * Configuration for background sync
 */
export interface BackgroundSyncConfig {
  connectionString: string;
  databaseName: string;
  tablesToBeSynced: TableConfig[];
  apiKey?: string;
  accessToken?: string;
  debug?: boolean;
}

/**
 * Run a complete background sync cycle
 * Opens database, initializes sync, performs sync, closes database
 */
export async function runBackgroundSync(
  config: BackgroundSyncConfig
): Promise<void> {
  const logger = createLogger(config.debug ?? false);
  let db: DB | null = null;
  const changes: ChangeRecord[] = [];

  try {
    logger.info('📲 Starting background sync...');

    // Open database connection
    db = await createDatabase(config.databaseName, 'write');
    logger.info('✅ Database connection opened');

    // Initialize sync extension
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

    // Set up updateHook to capture changes during sync
    const handler = getBackgroundSyncHandler();
    if (handler) {
      db.updateHook(({ operation, table, rowId }) => {
        changes.push({
          operation: operation as 'INSERT' | 'UPDATE' | 'DELETE',
          table,
          rowId,
        });
      });
      logger.info('📲 Update hook registered for change tracking');
    }

    await performSyncOperation(db, logger, {
      useNativeRetry: true,
      maxAttempts: 3,
      attemptDelay: 500,
    });

    logger.info('✅ Background sync completed successfully');

    // Call the handler with changes (before closing db so handler can query)
    if (handler && db) {
      logger.info(
        `📲 Calling background sync handler with ${changes.length} changes`
      );
      try {
        // Remove the hook before calling handler to avoid capturing handler's queries
        db.updateHook(null);
        await handler({ changes, db });
        logger.info('✅ Background sync handler completed');
      } catch (handlerError) {
        logger.error('❌ Background sync handler failed:', handlerError);
      }
    }
  } catch (error) {
    logger.error('❌ Background sync failed:', error);
    throw error;
  } finally {
    // Always close database connection
    if (db) {
      try {
        // Ensure hook is removed
        db.updateHook(null);
        db.close();
        logger.info('✅ Database connection closed');
      } catch (closeError) {
        logger.error('❌ Error closing database:', closeError);
      }
    }
  }
}
