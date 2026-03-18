import { Platform } from 'react-native';
import { getDylibPath, type DB } from '@op-engineering/op-sqlite';
import type { TableConfig } from '../../types/TableConfig';
import type { Logger } from '../common/logger';
import { getCloudSyncBaseUrlOverride } from '../constants';

/**
 * Configuration for sync initialization
 */
export interface SyncInitConfig {
  databaseId: string;
  databaseName: string;
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
  const databaseId = config.databaseId.trim();
  const databaseName = config.databaseName.trim();
  const apiKey = config.apiKey?.trim();
  const accessToken = config.accessToken?.trim();
  const { tablesToBeSynced } = config;

  /** VALIDATE CONFIG */
  if (
    !databaseId ||
    !databaseName ||
    (!apiKey && !accessToken)
  ) {
    throw new Error('Sync configuration incomplete');
  }

  /** LOAD CLOUDSYNC EXTENSION */
  let extensionPath: string;
  if (Platform.OS === 'ios') {
    extensionPath = getDylibPath('ai.sqlite.cloudsync', 'CloudSync');
  } else {
    extensionPath = 'cloudsync';
  }

  db.loadExtension(extensionPath);
  logger.info('✅ CloudSync extension loaded');

  /** VERIFY EXTENSION */
  const versionResult = await db.execute('SELECT cloudsync_version();');
  const version = versionResult.rows?.[0]?.['cloudsync_version()'];

  if (!version) {
    throw new Error('CloudSync extension not loaded properly');
  }
  logger.info('✅ CloudSync version:', version);

  /** INITIALIZE TABLES */
  for (const table of tablesToBeSynced) {
    await db.execute('SELECT cloudsync_init(?);', [table.name]);

    logger.info(`✅ CloudSync initialized for table: ${table.name}`);
  }

  /** INITIALIZE NETWORK */
  const baseUrlOverride = getCloudSyncBaseUrlOverride();
  if (baseUrlOverride) {
    await db.execute('SELECT cloudsync_network_init_custom(?, ?);', [
      baseUrlOverride,
      databaseId,
    ]);
  } else {
    await db.execute('SELECT cloudsync_network_init(?);', [databaseId]);
  }
  logger.info('✅ Network initialized');

  /** SET AUTHENTICATION */
  if (apiKey) {
    await db.execute('SELECT cloudsync_network_set_apikey(?);', [apiKey]);
    logger.info('✅ API key set');
  } else if (accessToken) {
    await db.execute('SELECT cloudsync_network_set_token(?);', [accessToken]);
    logger.info('✅ Access token set');
  }

  logger.info('✅ Sync initialization complete');
}
