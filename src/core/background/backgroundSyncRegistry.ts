import {
  ExpoNotifications,
  isBackgroundSyncAvailable,
} from '../common/optionalDependencies';
import { createLogger } from '../common/logger';
import { PUSH_NOTIFICATION_SYNC_TASK_NAME } from '../constants';
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

  /** GUARD: DEPENDENCIES REQUIRED */
  if (!isBackgroundSyncAvailable()) {
    logger.warn(
      '⚠️ Background sync dependencies not available (expo-notifications, expo-task-manager, expo-secure-store)'
    );
    return;
  }

  /** PERSIST CONFIG */
  // Config is needed for background/terminated task execution
  await persistConfig(config);

  /** REGISTER TASK */
  await ExpoNotifications.registerTaskAsync(PUSH_NOTIFICATION_SYNC_TASK_NAME);
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
    await ExpoNotifications.unregisterTaskAsync(
      PUSH_NOTIFICATION_SYNC_TASK_NAME
    );
    await clearPersistedConfig();
  } catch {
    // Task might not be registered
  }
}
