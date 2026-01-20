import type { DB } from '@op-engineering/op-sqlite';
import type { TableConfig } from '../types/TableConfig';
import { createDatabase } from '../provider/utils/createDatabase';
import { createLogger } from '../utils/logger';
import { initializeSyncExtension } from './initializeSyncExtension';
import { performSyncOperation } from './performSyncOperation';

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

    await performSyncOperation(db, logger, {
      useNativeRetry: true,
      maxAttempts: 3,
      attemptDelay: 500,
    });

    logger.info('✅ Background sync completed successfully');
  } catch (error) {
    logger.error('❌ Background sync failed:', error);
    throw error;
  } finally {
    // Always close database connection
    if (db) {
      try {
        db.close();
        logger.info('✅ Database connection closed');
      } catch (closeError) {
        logger.error('❌ Error closing database:', closeError);
      }
    }
  }
}
