import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
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
import { Platform } from 'react-native';
import { isForegroundSqliteCloudNotification } from './isSqliteCloudNotification';
import { registerPushToken } from './registerPushToken';

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
   * Render prop for showing a custom permission prompt before requesting push notification permissions.
   * Receives `allow` and `deny` callbacks to resolve the permission request.
   */
  renderPushPermissionPrompt?: (props: {
    allow: () => void;
    deny: () => void;
  }) => ReactNode;
}

export function usePushNotificationSync(params: PushNotificationSyncParams): {
  permissionPromptNode: ReactNode;
} {
  const {
    isSyncReady,
    performSyncRef,
    writeDbRef,
    syncMode,
    notificationListening,
    logger,
    onPermissionsDenied,
    renderPushPermissionPrompt,
    connectionString,
    databaseName,
    tablesToBeSynced,
    apiKey,
    accessToken,
    debug,
  } = params;

  /** SERIALIZED CONFIG */
  // Detect actual changes (avoids re-runs from unstable references like tablesToBeSynced)
  const serializedBackgroundConfig = JSON.stringify({
    connectionString,
    databaseName,
    tablesToBeSynced,
    apiKey,
    accessToken,
    debug,
  });

  /** REFS */
  const prevSyncModeRef = useRef<SyncMode>(syncMode);
  const hasRequestedPermissionsRef = useRef(false);
  const permissionsGrantedRef = useRef(false);
  const onPermissionsDeniedRef = useRef(onPermissionsDenied);
  const renderPushPermissionPromptRef = useRef(renderPushPermissionPrompt);
  const permissionResolverRef = useRef<((value: boolean) => void) | null>(null);

  /** KEEP REFS IN SYNC */
  useEffect(() => {
    onPermissionsDeniedRef.current = onPermissionsDenied;
  }, [onPermissionsDenied]);
  useEffect(() => {
    renderPushPermissionPromptRef.current = renderPushPermissionPrompt;
  }, [renderPushPermissionPrompt]);

  /** PERMISSION PROMPT STATE */
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  /** PERMISSION PROMPT HANDLERS */
  const handlePermissionAllow = useCallback(() => {
    setShowPermissionPrompt(false);
    permissionResolverRef.current?.(true);
    permissionResolverRef.current = null;
  }, []);

  const handlePermissionDeny = useCallback(() => {
    setShowPermissionPrompt(false);
    permissionResolverRef.current?.(false);
    permissionResolverRef.current = null;
  }, []);

  /** PERMISSION PROMPT NODE */
  const permissionPromptNode =
    showPermissionPrompt && renderPushPermissionPrompt
      ? renderPushPermissionPrompt({
          allow: handlePermissionAllow,
          deny: handlePermissionDeny,
        })
      : null;

  /** SYNC MODE CHANGE HANDLER */
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
      unregisterBackgroundSync();
    }
  }, [syncMode, logger]);

  /** PERMISSION REQUEST EFFECT */
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

    hasRequestedPermissionsRef.current = true;

    const requestPermissions = async () => {
      try {
        /** CHECK EXISTING PERMISSIONS */
        const { status: existingStatus } =
          await ExpoNotifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        /** REQUEST PERMISSIONS IF NEEDED */
        if (existingStatus !== 'granted') {
          if (renderPushPermissionPromptRef.current) {
            const shouldProceed = await new Promise<boolean>((resolve) => {
              permissionResolverRef.current = resolve;
              setShowPermissionPrompt(true);
            });

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

        /** HANDLE DENIED PERMISSIONS */
        if (finalStatus !== 'granted') {
          logger.warn(
            '⚠️ Push notification permissions denied - falling back to polling mode'
          );
          onPermissionsDeniedRef.current?.();
          return;
        }

        /** PERMISSIONS GRANTED */
        permissionsGrantedRef.current = true;
        logger.info('📲 Push notification permissions granted');

        /** GET PROJECT ID */
        const projectId =
          ExpoConstants?.expoConfig?.extra?.eas?.projectId ??
          ExpoConstants?.manifest?.extra?.eas?.projectId ??
          ExpoConstants?.easConfig?.projectId;

        /** GET DEVICE TOKEN */
        const deviceToken = await ExpoNotifications.getDevicePushTokenAsync();
        if (deviceToken?.data) {
          logger.info('📱 APNs Device Token:', deviceToken.data);
        }

        /** GET EXPO PUSH TOKEN */
        const token = await ExpoNotifications.getExpoPushTokenAsync({
          projectId,
        });

        /** REGISTER TOKEN WITH BACKEND */
        if (token?.data) {
          logger.info('📱 Expo Push Token:', token.data);

          // Get site ID for token registration
          let siteId: string | undefined;
          try {
            const firstTable = tablesToBeSynced[0];
            if (firstTable && writeDbRef.current) {
              const initResult = await writeDbRef.current.execute(
                'SELECT cloudsync_init(?);',
                [firstTable.name]
              );
              const firstRow = initResult.rows?.[0];
              siteId = firstRow
                ? String(Object.values(firstRow)[0])
                : undefined;
            }
          } catch {
            logger.warn('⚠️ Could not retrieve siteId');
          }

          try {
            await registerPushToken({
              expoToken: token.data,
              databaseName,
              siteId,
              platform: Platform.OS,
              connectionString,
              apiKey,
              accessToken,
              logger,
            });
          } catch (registerError) {
            logger.warn('⚠️ Failed to register push token:', registerError);
          }
        }
      } catch (error) {
        // Network errors and other temporary failures - don't fallback
        logger.warn('⚠️ Failed to get push token (will retry):', error);
      }
    };

    requestPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per mount, guarded by hasRequestedPermissionsRef
  }, [isSyncReady, syncMode]);

  /** NOTIFICATION LISTENERS EFFECT */
  useEffect(() => {
    /** GUARDS */
    if (!isSyncReady || syncMode !== 'push' || !writeDbRef.current) {
      return;
    }

    if (!ExpoNotifications) {
      logger.warn(
        '⚠️ Push mode enabled but expo-notifications not found. Install it with: npx expo install expo-notifications'
      );
      return;
    }

    logger.info(
      `📲 SQLite Sync push mode enabled (listening: ${notificationListening})`
    );

    /** HELPER: ADD FOREGROUND LISTENER */
    const addForegroundListener = () =>
      ExpoNotifications.addNotificationReceivedListener((notification: any) => {
        logger.info(
          '📬 Foreground notification received:',
          JSON.stringify(notification, null, 2)
        );

        if (isForegroundSqliteCloudNotification(notification)) {
          logger.info(
            '📲 SQLite Cloud notification (foreground) - triggering sync'
          );
          performSyncRef.current?.();
        }
      });

    const subscriptions: { remove: () => void }[] = [];

    /** REGISTER LISTENERS BASED ON MODE */
    if (notificationListening === 'always') {
      // BACKGROUND & TERMINATED MODE
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
        subscriptions.push(addForegroundListener());
      }
    } else {
      // FOREGROUND ONLY MODE
      subscriptions.push(addForegroundListener());
    }

    /** CLEANUP */
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

  return { permissionPromptNode };
}
