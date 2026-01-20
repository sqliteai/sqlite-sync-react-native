import type { BackgroundSyncConfig } from './runBackgroundSync';
import { createLogger } from '../utils/logger';

// Storage key for persisted config
const CONFIG_STORAGE_KEY = 'sqlite_sync_background_config';

// Optional expo-secure-store
let SecureStore: any = null;
try {
  SecureStore = require('expo-secure-store');
} catch {
  // expo-secure-store not available
}

/**
 * Check if SecureStore is available
 */
export function isSecureStoreAvailable(): boolean {
  return SecureStore !== null;
}

/**
 * Get persisted config from SecureStore
 */
export async function getPersistedConfig(): Promise<BackgroundSyncConfig | null> {
  if (!SecureStore) {
    return null;
  }

  try {
    const configJson = await SecureStore.getItemAsync(CONFIG_STORAGE_KEY);
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

  if (!SecureStore) {
    logger.warn(
      '⚠️ expo-secure-store not found. Background/terminated sync will not work.'
    );
    return;
  }

  try {
    const configJson = JSON.stringify(config);
    await SecureStore.setItemAsync(CONFIG_STORAGE_KEY, configJson);
    logger.info('✅ Background sync config saved');
  } catch (error) {
    logger.error('❌ Failed to persist config:', error);
  }
}

/**
 * Clear persisted config from SecureStore
 */
export async function clearPersistedConfig(): Promise<void> {
  if (!SecureStore) {
    return;
  }

  try {
    await SecureStore.deleteItemAsync(CONFIG_STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}
