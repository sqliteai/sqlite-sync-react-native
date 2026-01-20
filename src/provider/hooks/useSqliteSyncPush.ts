import { useEffect, useRef } from 'react';
import type { DB } from '@op-engineering/op-sqlite';
import type {
  SyncMode,
  NotificationListeningMode,
} from '../../types/SQLiteSyncProviderProps';
import type { TableConfig } from '../../types/TableConfig';
import type { Logger } from '../../utils/logger';
import {
  registerBackgroundSync,
  unregisterBackgroundSync,
  isBackgroundSyncAvailable,
  setForegroundSyncCallback,
} from '../../core/backgroundSync';

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
/**
 * Check if a notification is from SQLite Cloud
 */
const isSqliteCloudNotification = (notification: any): boolean => {
  const artifactURI = notification?.request?.content?.data?.artifactURI;
  return artifactURI === 'https://sqlite.ai';
};

export function useSqliteSyncPush(params: SqliteSyncPushParams): void {
  const {
    isSyncReady,
    performSyncRef,
    writeDbRef,
    syncMode,
    notificationListening,
    logger,
    onPermissionsDenied,
    connectionString,
    databaseName,
    tablesToBeSynced,
    apiKey,
    accessToken,
    debug,
  } = params;

  // Track previous syncMode to detect when switching away from push
  const prevSyncModeRef = useRef<SyncMode>(syncMode);

  // Unregister background sync when switching away from push mode
  useEffect(() => {
    const prevSyncMode = prevSyncModeRef.current;
    prevSyncModeRef.current = syncMode;

    // If we switched FROM push TO polling, unregister background sync
    if (prevSyncMode === 'push' && syncMode !== 'push') {
      logger.info(
        '📲 Sync mode changed from push - unregistering background sync'
      );
      unregisterBackgroundSync().catch(() => {
        // Ignore errors
      });
    }
  }, [syncMode, logger]);

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

    logger.info(
      `📲 SQLite Sync push mode enabled (listening: ${notificationListening})`
    );

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
        // Network errors and other temporary failures - don't fallback
        logger.warn('⚠️ Failed to get push token (will retry):', error);
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
        })
          .then(() => {
            logger.info('📲 Background sync task registered');
          })
          .catch((error) => {
            logger.warn('⚠️ Failed to register background sync:', error);
          });
      } else {
        logger.warn(
          '⚠️ Background sync not available. Install expo-task-manager and expo-secure-store for background/terminated notification handling.'
        );
        // Fallback to foreground-only listener
        const foregroundSubscription =
          ExpoNotifications.addNotificationReceivedListener(
            (notification: any) => {
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
      // Cleanup foreground subscriptions
      subscriptions.forEach((sub) => sub.remove());
      // Clear foreground callback
      setForegroundSyncCallback(null);
      logger.info('📲 Push notification listeners removed');
    };
  }, [
    isSyncReady,
    syncMode,
    notificationListening,
    writeDbRef,
    performSyncRef,
    logger,
    onPermissionsDenied,
    connectionString,
    databaseName,
    tablesToBeSynced,
    apiKey,
    accessToken,
    debug,
  ]);
}
