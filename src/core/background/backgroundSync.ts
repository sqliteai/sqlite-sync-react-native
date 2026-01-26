import { BACKGROUND_SYNC_TASK_NAME } from './syncTask';
import {
  isSecureStoreAvailable,
  persistConfig,
  clearPersistedConfig,
} from './persistedSyncConfig';
import { createLogger } from '../logger';
import type { BackgroundSyncConfig } from '../../types/BackgroundSyncConfig';

// Optional expo dependencies
let ExpoNotifications: any = null;
let TaskManager: any = null;

try {
  TaskManager = require('expo-task-manager');
} catch {
  // expo-task-manager not available
}

try {
  ExpoNotifications = require('expo-notifications');
} catch {
  // expo-notifications not available
}

/**
 * Register for background notification handling.
 * Persists config and registers the background task.
 */
export async function registerBackgroundSync(
  config: BackgroundSyncConfig
): Promise<void> {
  const logger = createLogger(config.debug ?? false);

  if (!ExpoNotifications || !TaskManager) {
    logger.warn('⚠️ ExpoNotifications or TaskManager not available');
    return;
  }

  // Persist config for background/terminated task execution
  await persistConfig(config);

  // Register the task to handle background notifications
  await ExpoNotifications.registerTaskAsync(BACKGROUND_SYNC_TASK_NAME);
  logger.info('📲 Background sync task registered');
}

/**
 * Unregister background notification handling.
 */
export async function unregisterBackgroundSync(): Promise<void> {
  if (!ExpoNotifications) {
    return;
  }

  try {
    await ExpoNotifications.unregisterTaskAsync(BACKGROUND_SYNC_TASK_NAME);
    await clearPersistedConfig();
  } catch {
    // Task might not be registered
  }
}

/**
 * Check if background sync is available.
 * Requires expo-task-manager, expo-notifications, and expo-secure-store.
 */
export function isBackgroundSyncAvailable(): boolean {
  return (
    TaskManager !== null &&
    ExpoNotifications !== null &&
    isSecureStoreAvailable()
  );
}
