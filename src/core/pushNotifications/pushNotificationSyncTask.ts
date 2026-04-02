import { getPersistedConfig } from '../background/backgroundSyncConfig';
import { ExpoTaskManager } from '../common/optionalDependencies';
import { createLogger } from '../common/logger';
import { PUSH_NOTIFICATION_SYNC_TASK_NAME } from '../constants';
import { executeBackgroundSync } from '../background/executeBackgroundSync';
import { getForegroundSyncCallback } from './pushNotificationSyncCallbacks';
import { isSqliteCloudNotification } from './isSqliteCloudNotification';

/**
 * Auto-define background task at module level.
 * This runs when the module is first imported (via the provider).
 */
if (ExpoTaskManager) {
  ExpoTaskManager.defineTask(
    PUSH_NOTIFICATION_SYNC_TASK_NAME,
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

      /** FOREGROUND / BACKGROUND-ALIVE MODE */
      // If the provider is mounted we have a callback — use the existing connection.
      // foregroundCallback being non-null means the component tree is alive,
      // which is true for both active and backgrounded-but-not-terminated states.
      const foregroundCallback = getForegroundSyncCallback();
      if (foregroundCallback) {
        logger.info('📲 Provider is mounted, using existing sync');
        try {
          await foregroundCallback();
          logger.info('✅ Sync completed');
        } catch (syncError) {
          logger.error('❌ Sync failed:', syncError);
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
