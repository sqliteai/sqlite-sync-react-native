import { useEffect } from 'react';
import type { DB } from '@op-engineering/op-sqlite';
import type { SyncMode } from '../../types/SQLiteSyncProviderProps';
import type { Logger } from '../../utils/logger';

// Optional Expo Notifications and Constants support
let ExpoNotifications: any = null;
let ExpoConstants: any = null;
try {
  ExpoNotifications = require('expo-notifications');
  const constantsModule = require('expo-constants');
  ExpoConstants = constantsModule.default || constantsModule;
} catch {
  // Expo not available - push mode will not work
}

/**
 * Parameters for useSqliteSyncPush hook
 */
export interface SqliteSyncPushParams {
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
   * Logger instance for logging
   */
  logger: Logger;

  /**
   * Callback when push permissions are denied - triggers fallback to polling
   */
  onPermissionsDenied?: () => void;
}

/**
 * Custom hook for handling SQLite Sync push notifications
 *
 * Handles:
 * - Setting up push notification listener via SQLite Sync
 * - Triggering sync when push notification is received
 * - Only runs when syncMode is 'push'
 *
 * @param params - Push notification parameters
 *
 * @example
 * ```typescript
 * useSqliteSyncPush({
 *   isSyncReady,
 *   performSyncRef,
 *   writeDbRef,
 *   syncMode: 'push',
 *   logger
 * });
 * ```
 */
export function useSqliteSyncPush(params: SqliteSyncPushParams): void {
  const {
    isSyncReady,
    performSyncRef,
    writeDbRef,
    syncMode,
    logger,
    onPermissionsDenied,
  } = params;

  /** PUSH NOTIFICATION LISTENER */
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

    logger.info('📲 SQLite Sync push mode enabled');

    // Request permissions and get push token
    const registerForPushNotifications = async () => {
      try {
        const { status: existingStatus } =
          await ExpoNotifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await ExpoNotifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          logger.warn(
            '⚠️ Push notification permissions denied - falling back to polling mode'
          );
          onPermissionsDenied?.();
          return;
        }

        const projectId =
          ExpoConstants?.expoConfig?.extra?.eas?.projectId ??
          ExpoConstants?.manifest?.extra?.eas?.projectId ??
          ExpoConstants?.easConfig?.projectId;

        const token = await ExpoNotifications.getExpoPushTokenAsync({
          projectId,
        });

        if (token?.data) {
          logger.info('📱 Expo Push Token:', token.data);
          // TODO: Send token to backend
        }
      } catch (error) {
        logger.warn(
          '⚠️ Failed to get push token - falling back to polling mode:',
          error
        );
        onPermissionsDenied?.();
      }
    };

    registerForPushNotifications();

    // Set up notification handler for silent sync (no user-facing alerts)
    ExpoNotifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    // Listen for notifications received while app is in foreground
    const foregroundSubscription =
      ExpoNotifications.addNotificationReceivedListener(
        (_notification: any) => {
          logger.info(
            '📲 Push notification received (foreground) - triggering sync'
          );
          performSyncRef.current?.();
        }
      );

    // Listen for notification responses (user tapped notification)
    const responseSubscription =
      ExpoNotifications.addNotificationResponseReceivedListener(
        (_response: any) => {
          logger.info(
            '📲 Push notification response received - triggering sync'
          );
          performSyncRef.current?.();
        }
      );

    return () => {
      // Cleanup subscriptions
      foregroundSubscription.remove();
      responseSubscription.remove();
      logger.info('📲 Push notification listeners removed');
    };
  }, [
    isSyncReady,
    syncMode,
    writeDbRef,
    performSyncRef,
    logger,
    onPermissionsDenied,
  ]);
}
