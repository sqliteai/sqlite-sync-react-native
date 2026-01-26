import {
  ExpoNotifications,
  isBackgroundSyncAvailable,
} from '../common/optionalDependencies';
import { createLogger } from '../common/logger';
import { BACKGROUND_SYNC_TASK_NAME } from '../constants';
import {
  clearPersistedConfig,
  persistConfig,
  type BackgroundSyncConfig,
} from './backgroundSyncConfig';

/**
 * Register for background notification handling.
 * Persists config and registers the background task.
 */
export async function registerBackgroundSync(
  config: BackgroundSyncConfig
): Promise<void> {
  const logger = createLogger(config.debug ?? false);

  if (!isBackgroundSyncAvailable()) {
    logger.warn(
      '⚠️ Background sync dependencies not available (expo-notifications, expo-task-manager, expo-secure-store)'
    );
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
