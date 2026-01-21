import type { TableConfig } from './TableConfig';

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
