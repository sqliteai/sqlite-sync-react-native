import { AppState } from 'react-native';
import {
  runBackgroundSync,
  type BackgroundSyncConfig,
} from './runBackgroundSync';
import {
  getPersistedConfig,
  persistConfig,
  clearPersistedConfig,
  isSecureStoreAvailable,
} from './backgroundSyncConfig';
import { createLogger } from '../utils/logger';

// Task name for background notification handling
const BACKGROUND_SYNC_TASK_NAME = 'SQLITE_SYNC_BACKGROUND_TASK';

// Callback for foreground sync (uses existing DB connection)
let foregroundSyncCallback: (() => Promise<void>) | null = null;

/**
 * Set the callback to use for foreground sync
 * This allows the background task to use the existing DB connection when app is in foreground
 */
export function setForegroundSyncCallback(
  callback: (() => Promise<void>) | null
): void {
  foregroundSyncCallback = callback;
}

// Optional expo dependencies
let TaskManager: any = null;
let ExpoNotifications: any = null;

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
 * Check if task data is from SQLite Cloud
 * Handles different data structures from foreground vs background notifications
 */
const isSqliteCloudNotification = (taskData: any): boolean => {
  // Background notification: data is in taskData.data.body (as JSON string)
  const bodyString = taskData?.data?.body || taskData?.data?.dataString;
  if (bodyString) {
    try {
      const parsed = JSON.parse(bodyString);
      if (parsed?.artifactURI === 'https://sqlite.ai') {
        return true;
      }
    } catch {
      // Not valid JSON
    }
  }

  // Foreground notification structure
  const artifactURI = taskData?.request?.content?.data?.artifactURI;
  if (artifactURI === 'https://sqlite.ai') {
    return true;
  }

  return false;
};

/**
 * Auto-define background task at module level
 * This runs when the module is first imported (via the provider)
 */
if (TaskManager) {
  TaskManager.defineTask(
    BACKGROUND_SYNC_TASK_NAME,
    async ({ data, error }: { data: any; error: any }) => {
      const config = await getPersistedConfig();
      const logger = createLogger(config?.debug ?? false);

      logger.info('📲 Background task triggered');

      if (error) {
        logger.error('❌ Background task error:', error);
        return;
      }

      // Check if this is a SQLite Cloud notification
      if (!isSqliteCloudNotification(data)) {
        logger.info('📲 Not a SQLite Cloud notification, skipping');
        return;
      }

      logger.info('📲 SQLite Cloud notification detected');

      // If app is in foreground and we have a callback, use existing DB connection
      if (AppState.currentState === 'active' && foregroundSyncCallback) {
        logger.info('📲 App is in foreground, using existing sync');
        try {
          await foregroundSyncCallback();
          logger.info('✅ Foreground sync completed');
        } catch (syncError) {
          logger.error('❌ Foreground sync failed:', syncError);
        }
        return;
      }

      // Background/terminated: open new connection and sync
      if (!config) {
        logger.info('📲 No config found, skipping background sync');
        return;
      }

      logger.info('📲 Starting background sync...');

      try {
        await runBackgroundSync(config);
        logger.info('✅ Background sync completed');
      } catch (syncError) {
        logger.error('❌ Background sync failed:', syncError);
      }
    }
  );
}

/**
 * Register for background notification handling
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
 * Unregister background notification handling
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
 * Check if background sync is available
 */
export function isBackgroundSyncAvailable(): boolean {
  return (
    TaskManager !== null &&
    ExpoNotifications !== null &&
    isSecureStoreAvailable()
  );
}
