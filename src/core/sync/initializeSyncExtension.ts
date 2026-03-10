import { Platform } from 'react-native';
import { getDylibPath, type DB } from '@op-engineering/op-sqlite';
import type { TableConfig } from '../../types/TableConfig';
import type { Logger } from '../common/logger';
import { CLOUDSYNC_BASE_URL } from '../constants';

/**
 * Configuration for sync initialization
 */
export interface SyncInitConfig {
  projectID: string;
  organizationID: string;
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
  const projectID = config.projectID.trim();
  const organizationID = config.organizationID.trim();
  const databaseName = config.databaseName.trim();
  const apiKey = config.apiKey?.trim();
  const accessToken = config.accessToken?.trim();
  const { tablesToBeSynced } = config;

  /** VALIDATE CONFIG */
  if (
    !projectID ||
    !organizationID ||
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

  /** INITIALIZE NETWORK */
  const networkConfig = JSON.stringify({
    address: CLOUDSYNC_BASE_URL,
    database: databaseName,
    projectID,
    organizationID,
  });
  const escapedNetworkConfig = networkConfig.replace(/'/g, "''");

  await db.execute(`SELECT cloudsync_network_init('${escapedNetworkConfig}');`);
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
