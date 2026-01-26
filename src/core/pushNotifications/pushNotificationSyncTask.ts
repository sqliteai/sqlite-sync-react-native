import { AppState } from 'react-native';
import { getPersistedConfig } from '../background/backgroundSyncConfig';
import { ExpoTaskManager } from '../common/optionalDependencies';
import { createLogger } from '../common/logger';
import { BACKGROUND_SYNC_TASK_NAME } from '../constants';
import { executeBackgroundSync } from '../background/executeBackgroundSync';
import { getForegroundSyncCallback } from './pushNotificationSyncCallbacks';

/**
 * Check if task data is from SQLite Cloud.
 * Handles different data structures from foreground vs background notifications.
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
 * Auto-define background task at module level.
 * This runs when the module is first imported (via the provider).
 */
if (ExpoTaskManager) {
  ExpoTaskManager.defineTask(
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
      const foregroundCallback = getForegroundSyncCallback();
      if (AppState.currentState === 'active' && foregroundCallback) {
        logger.info('📲 App is in foreground, using existing sync');
        try {
          await foregroundCallback();
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

      await executeBackgroundSync(config);
    }
  );
}
