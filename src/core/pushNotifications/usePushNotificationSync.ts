import { useEffect, useRef } from 'react';
import type { DB } from '@op-engineering/op-sqlite';
import type {
  SyncMode,
  NotificationListeningMode,
} from '../../types/SQLiteSyncProviderProps';
import type { TableConfig } from '../../types/TableConfig';
import type { Logger } from '../common/logger';
import {
  ExpoConstants,
  ExpoNotifications,
  isBackgroundSyncAvailable,
} from '../common/optionalDependencies';
import {
  registerBackgroundSync,
  unregisterBackgroundSync,
} from '../background/backgroundSyncRegistry';
import { setForegroundSyncCallback } from './pushNotificationSyncCallbacks';

/**
 * Parameters for usePushNotificationSync hook
 */
export interface PushNotificationSyncParams {
  /**
   * Whether sync is ready and configured
   */
  isSyncReady: boolean;

  /**
   * Ref to performSync function
   */
  performSyncRef: React.RefObject<(() => Promise<void>) | null>;

  /**
   * Ref to write database instance
   */
  writeDbRef: React.RefObject<DB | null>;

  /**
   * Sync mode - push is only enabled when set to 'push'
   */
  syncMode: SyncMode;

  /**
   * Controls when push notifications trigger sync
   * - 'foreground': Only sync when app is in foreground
   * - 'always': Sync in foreground, background, and when app was terminated
   */
  notificationListening: NotificationListeningMode;

  /**
   * Logger instance for logging
   */
  logger: Logger;

  /**
   * Callback when push permissions are denied - triggers fallback to polling
   */
  onPermissionsDenied?: () => void;

  // Background sync configuration (needed for background/terminated modes)
  /**
   * SQLite Cloud connection string
   */
  connectionString: string;

  /**
   * Local database file name
   */
  databaseName: string;

  /**
   * Tables to be synced
   */
  tablesToBeSynced: TableConfig[];

  /**
   * API key for authentication
   */
  apiKey?: string;

  /**
   * Access token for authentication
   */
  accessToken?: string;

  /**
   * Enable debug logging
   */
  debug?: boolean;

  /**
   * Callback invoked before requesting push notification permissions.
   * Use this to show a custom UI explaining why permissions are needed.
   * @returns Promise<boolean> - true to proceed with system permission request, false to skip
   */
  onBeforePushPermissionRequest?: () => Promise<boolean>;
}

/**
 * Check if a notification is from SQLite Cloud
 */
const isSqliteCloudNotification = (notification: any): boolean => {
  const artifactURI = notification?.request?.content?.data?.artifactURI;
  return artifactURI === 'https://sqlite.ai';
};

export function usePushNotificationSync(
  params: PushNotificationSyncParams
): void {
  const {
    isSyncReady,
    performSyncRef,
    writeDbRef,
    syncMode,
    notificationListening,
    logger,
    onPermissionsDenied,
    onBeforePushPermissionRequest,
    connectionString,
    databaseName,
    tablesToBeSynced,
    apiKey,
    accessToken,
    debug,
  } = params;

  // Serialize config to detect actual changes (avoids re-runs from unstable references like tablesToBeSynced)
  const serializedBackgroundConfig = JSON.stringify({
    connectionString,
    databaseName,
    tablesToBeSynced,
    apiKey,
    accessToken,
    debug,
  });

  // Track previous syncMode to detect when switching away from push
  const prevSyncModeRef = useRef<SyncMode>(syncMode);
  const hasRequestedPermissionsRef = useRef(false);
  const permissionsGrantedRef = useRef(false);

  const onBeforePushPermissionRequestRef = useRef(
    onBeforePushPermissionRequest
  );
  const onPermissionsDeniedRef = useRef(onPermissionsDenied);

  useEffect(() => {
    onBeforePushPermissionRequestRef.current = onBeforePushPermissionRequest;
  }, [onBeforePushPermissionRequest]);

  useEffect(() => {
    onPermissionsDeniedRef.current = onPermissionsDenied;
  }, [onPermissionsDenied]);

  // Unregister background sync when switching away from push mode
  useEffect(() => {
    const prevSyncMode = prevSyncModeRef.current;
    prevSyncModeRef.current = syncMode;

    // If we switched FROM push TO polling, unregister background sync
    if (prevSyncMode === 'push' && syncMode !== 'push') {
      logger.info(
        '📲 Sync mode changed from push - unregistering background sync'
      );
      // Reset permission tracking when switching away from push
      hasRequestedPermissionsRef.current = false;
      permissionsGrantedRef.current = false;
      unregisterBackgroundSync().catch(() => {
        // Ignore errors
      });
    }
  }, [syncMode, logger]);

  /** PERMISSION REQUEST */
  useEffect(() => {
    if (
      !isSyncReady ||
      syncMode !== 'push' ||
      !writeDbRef.current ||
      !ExpoNotifications ||
      hasRequestedPermissionsRef.current
    ) {
      return;
    }

    // Mark that we're requesting permissions
    hasRequestedPermissionsRef.current = true;

    const requestPermissions = async () => {
      try {
        const { status: existingStatus } =
          await ExpoNotifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          // Call custom UI callback before system permission request
          if (onBeforePushPermissionRequestRef.current) {
            const shouldProceed =
              await onBeforePushPermissionRequestRef.current();
            if (!shouldProceed) {
              logger.info(
                '📲 User declined push permissions from custom UI - falling back to polling mode'
              );
              onPermissionsDeniedRef.current?.();
              return;
            }
          }

          const { status } = await ExpoNotifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          logger.warn(
            '⚠️ Push notification permissions denied - falling back to polling mode'
          );
          onPermissionsDeniedRef.current?.();
          return;
        }

        // Permissions granted
        permissionsGrantedRef.current = true;
        logger.info('📲 Push notification permissions granted');

        // Get push token
        const projectId =
          ExpoConstants?.expoConfig?.extra?.eas?.projectId ??
          ExpoConstants?.manifest?.extra?.eas?.projectId ??
          ExpoConstants?.easConfig?.projectId;

        // Get native APNs device token
        const deviceToken = await ExpoNotifications.getDevicePushTokenAsync();
        if (deviceToken?.data) {
          logger.info('📱 APNs Device Token:', deviceToken.data);
        }

        // Get Expo push token
        const token = await ExpoNotifications.getExpoPushTokenAsync({
          projectId,
        });

        if (token?.data) {
          logger.info('📱 Expo Push Token:', token.data);
          // TODO: Send token to backend
        }
      } catch (error) {
        // Network errors and other temporary failures - don't fallback
        logger.warn('⚠️ Failed to get push token (will retry):', error);
      }
    };

    requestPermissions();
  }, [isSyncReady, syncMode, writeDbRef, logger]);

  /** NOTIFICATION LISTENERS */
  useEffect(() => {
    // Only enable push when syncMode is 'push'
    if (!isSyncReady || syncMode !== 'push' || !writeDbRef.current) {
      return;
    }

    // Check if Expo Notifications is available
    if (!ExpoNotifications) {
      logger.warn(
        '⚠️ Push mode enabled but expo-notifications not found. Install it with: npx expo install expo-notifications'
      );
      return;
    }

    logger.info(
      `📲 SQLite Sync push mode enabled (listening: ${notificationListening})`
    );

    // Set up notification handler (temporarily showing alerts for debugging)
    ExpoNotifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const subscriptions: { remove: () => void }[] = [];

    // BACKGROUND & TERMINATED: Register background task
    // Enabled for 'always' mode
    if (notificationListening === 'always') {
      if (isBackgroundSyncAvailable()) {
        // Register callback for foreground sync (uses existing DB connection)
        setForegroundSyncCallback(
          () => performSyncRef.current?.() ?? Promise.resolve()
        );

        registerBackgroundSync({
          connectionString,
          databaseName,
          tablesToBeSynced,
          apiKey,
          accessToken,
          debug,
        });
      } else {
        logger.warn(
          '⚠️ Background sync not available. Install expo-task-manager and expo-secure-store for background/terminated notification handling.'
        );
        // Fallback to foreground-only listener
        const foregroundSubscription =
          ExpoNotifications.addNotificationReceivedListener(
            (notification: any) => {
              logger.info(
                '📬 RAW notification received:',
                JSON.stringify(notification.request?.content)
              );
              if (isSqliteCloudNotification(notification)) {
                logger.info(
                  '📲 SQLite Cloud notification (foreground) - triggering sync'
                );
                performSyncRef.current?.();
              }
            }
          );
        subscriptions.push(foregroundSubscription);
      }
    } else {
      // FOREGROUND ONLY: Use traditional listener
      const foregroundSubscription =
        ExpoNotifications.addNotificationReceivedListener(
          (notification: any) => {
            logger.info(
              '📬 RAW notification received:',
              JSON.stringify(notification.request?.content)
            );
            if (isSqliteCloudNotification(notification)) {
              logger.info(
                '📲 SQLite Cloud notification (foreground) - triggering sync'
              );
              performSyncRef.current?.();
            }
          }
        );
      subscriptions.push(foregroundSubscription);
    }

    return () => {
      subscriptions.forEach((sub) => sub.remove());
      setForegroundSyncCallback(null);
      logger.info('📲 Push notification listeners removed');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serializedBackgroundConfig contains all background sync config values
  }, [
    isSyncReady,
    syncMode,
    notificationListening,
    writeDbRef,
    performSyncRef,
    logger,
    serializedBackgroundConfig,
  ]);
}
