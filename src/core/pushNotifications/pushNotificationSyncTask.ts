import { AppState } from 'react-native';
import { getPersistedConfig } from '../background/backgroundSyncConfig';
import { ExpoTaskManager } from '../common/optionalDependencies';
import { createLogger } from '../common/logger';
import { BACKGROUND_SYNC_TASK_NAME } from '../constants';
import { executeBackgroundSync } from '../background/executeBackgroundSync';
import { getForegroundSyncCallback } from './pushNotificationSyncCallbacks';
import { isSqliteCloudNotification } from './isSqliteCloudNotification';

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

      logger.info(
        '📲 Background sync task triggered',
        JSON.stringify(data, null, 2)
      );

      /** HANDLE TASK ERROR */
      if (error) {
        logger.error('❌ Background task error:', error);
        return;
      }

      /** VALIDATE NOTIFICATION SOURCE */
      if (!isSqliteCloudNotification(data)) {
        logger.info('📲 Not a SQLite Cloud notification, skipping');
        return;
      }

      logger.info('📲 SQLite Cloud notification detected');

      /** FOREGROUND MODE */
      // If app is active and we have a callback, use existing DB connection
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

      /** BACKGROUND/TERMINATED MODE */
      if (!config) {
        logger.info('📲 No config found, skipping background sync');
        return;
      }

      await executeBackgroundSync(config);
    }
  );
}
