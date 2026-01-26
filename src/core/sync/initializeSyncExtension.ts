import { Platform } from 'react-native';
import { getDylibPath, type DB } from '@op-engineering/op-sqlite';
import type { TableConfig } from '../../types/TableConfig';
import type { Logger } from '../common/logger';

/**
 * Configuration for sync initialization
 */
export interface SyncInitConfig {
  connectionString: string;
  tablesToBeSynced: TableConfig[];
  apiKey?: string;
  accessToken?: string;
}

/**
 * Load and initialize the CloudSync extension on a database
 *
 * This is the core initialization logic used by both:
 * - useDatabaseInitialization hook (foreground)
 * - executeBackgroundSync (background/terminated)
 */
export async function initializeSyncExtension(
  db: DB,
  config: SyncInitConfig,
  logger: Logger
): Promise<void> {
  const { connectionString, tablesToBeSynced, apiKey, accessToken } = config;

  // Check sync configuration
  if (!connectionString || (!apiKey && !accessToken)) {
    throw new Error('Sync configuration incomplete');
  }

  // Load CloudSync extension
  let extensionPath: string;
  if (Platform.OS === 'ios') {
    extensionPath = getDylibPath('ai.sqlite.cloudsync', 'CloudSync');
  } else {
    extensionPath = 'cloudsync';
  }

  db.loadExtension(extensionPath);
  logger.info('✅ CloudSync extension loaded');

  // Verify CloudSync extension
  const versionResult = await db.execute('SELECT cloudsync_version();');
  const version = versionResult.rows?.[0]?.['cloudsync_version()'];

  if (!version) {
    throw new Error('CloudSync extension not loaded properly');
  }
  logger.info('✅ CloudSync version:', version);

  // Initialize CloudSync for tables
  for (const table of tablesToBeSynced) {
    const initResult = await db.execute('SELECT cloudsync_init(?);', [
      table.name,
    ]);
    const firstRow = initResult.rows?.[0];
    const result = firstRow ? Object.values(firstRow)[0] : undefined;

    logger.info(
      `✅ CloudSync initialized for table: ${table.name}${
        result ? ` (site_id: ${result})` : ''
      }`
    );
  }

  // Initialize network connection
  await db.execute('SELECT cloudsync_network_init(?);', [connectionString]);
  logger.info('✅ Network initialized');

  // Set authentication
  if (apiKey) {
    await db.execute('SELECT cloudsync_network_set_apikey(?);', [apiKey]);
    logger.info('✅ API key set');
  } else if (accessToken) {
    await db.execute('SELECT cloudsync_network_set_token(?);', [accessToken]);
    logger.info('✅ Access token set');
  }

  logger.info('✅ Sync initialization complete');
}
