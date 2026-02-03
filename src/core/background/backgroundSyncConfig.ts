import type { TableConfig } from '../../types/TableConfig';
import { createLogger } from '../common/logger';
import { ExpoSecureStore } from '../common/optionalDependencies';

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

/** STORAGE KEY */
const CONFIG_STORAGE_KEY = 'sqlite_sync_background_config';

/**
 * Get persisted config from SecureStore
 */
export async function getPersistedConfig(): Promise<BackgroundSyncConfig | null> {
  if (!ExpoSecureStore) {
    return null;
  }

  try {
    const configJson = await ExpoSecureStore.getItemAsync(CONFIG_STORAGE_KEY);
    if (!configJson) {
      return null;
    }
    return JSON.parse(configJson) as BackgroundSyncConfig;
  } catch {
    return null;
  }
}

/**
 * Persist config to SecureStore
 */
export async function persistConfig(
  config: BackgroundSyncConfig
): Promise<void> {
  const logger = createLogger(config.debug ?? false);

  /** GUARD: SECURE STORE REQUIRED */
  if (!ExpoSecureStore) {
    logger.warn(
      '⚠️ expo-secure-store not found. Background/terminated sync will not work.'
    );
    return;
  }

  /** SAVE CONFIG */
  try {
    const configJson = JSON.stringify(config);
    await ExpoSecureStore.setItemAsync(CONFIG_STORAGE_KEY, configJson);
    logger.info('✅ Background sync config saved');
  } catch (error) {
    logger.error('❌ Failed to persist config:', error);
  }
}

/**
 * Clear persisted config from SecureStore
 */
export async function clearPersistedConfig(): Promise<void> {
  if (!ExpoSecureStore) {
    return;
  }

  try {
    await ExpoSecureStore.deleteItemAsync(CONFIG_STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}
