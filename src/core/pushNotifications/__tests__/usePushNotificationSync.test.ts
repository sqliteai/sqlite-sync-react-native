jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));
jest.mock('../../common/optionalDependencies', () => ({
  ExpoConstants: {
    expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
  },
  ExpoNotifications: {
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    getDevicePushTokenAsync: jest.fn(),
    getExpoPushTokenAsync: jest.fn(),
    addNotificationReceivedListener: jest.fn(),
  },
  isBackgroundSyncAvailable: jest.fn(),
}));
jest.mock('../../background/backgroundSyncRegistry');
jest.mock('../pushNotificationSyncCallbacks');
jest.mock('../registerPushToken');
jest.mock('../isSqliteCloudNotification');

import { renderHook, act } from '@testing-library/react-native';
import { usePushNotificationSync } from '../usePushNotificationSync';
import {
  ExpoNotifications,
  isBackgroundSyncAvailable,
} from '../../common/optionalDependencies';
import {
  registerBackgroundSync,
  unregisterBackgroundSync,
} from '../../background/backgroundSyncRegistry';
import { setForegroundSyncCallback } from '../pushNotificationSyncCallbacks';
import { registerPushToken } from '../registerPushToken';
import { isForegroundSqliteCloudNotification } from '../isSqliteCloudNotification';
import { createLogger } from '../../common/logger';

const mockExpoNotifications = ExpoNotifications as any;

describe('usePushNotificationSync', () => {
  const logger = createLogger(false);

  const createDefaultParams = (overrides?: Partial<any>) => ({
    isSyncReady: true,
    performSyncRef: { current: jest.fn().mockResolvedValue(undefined) },
    writeDbRef: {
      current: {
        execute: jest
          .fn()
          .mockResolvedValue({ rows: [{ 'cloudsync_siteid()': 'site-123' }] }),
      },
    } as any,
    syncMode: 'push' as const,
    notificationListening: 'foreground' as const,
    logger,
    databaseId: 'db_test_database_id',
    databaseName: 'test.db',
    tablesToBeSynced: [
      {
        name: 'users',
        createTableSql:
          'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY)',
      },
    ],
    ...overrides,
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.clearAllMocks();

    mockExpoNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'granted',
    });
    mockExpoNotifications.requestPermissionsAsync.mockResolvedValue({
      status: 'granted',
    });
    mockExpoNotifications.getDevicePushTokenAsync.mockResolvedValue({
      data: 'device-token',
    });
    mockExpoNotifications.getExpoPushTokenAsync.mockResolvedValue({
      data: 'ExponentPushToken[xxx]',
    });
    mockExpoNotifications.addNotificationReceivedListener.mockReturnValue({
      remove: jest.fn(),
    });
    (isBackgroundSyncAvailable as jest.Mock).mockReturnValue(false);
    (registerPushToken as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing when syncMode is polling', async () => {
    renderHook(() =>
      usePushNotificationSync(createDefaultParams({ syncMode: 'polling' }))
    );

    await act(async () => {});

    expect(mockExpoNotifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(
      mockExpoNotifications.addNotificationReceivedListener
    ).not.toHaveBeenCalled();
  });

  it('does nothing when not sync ready', async () => {
    renderHook(() =>
      usePushNotificationSync(createDefaultParams({ isSyncReady: false }))
    );

    await act(async () => {});

    expect(mockExpoNotifications.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests permissions when push mode', async () => {
    renderHook(() => usePushNotificationSync(createDefaultParams()));

    await act(async () => {});

    expect(mockExpoNotifications.getPermissionsAsync).toHaveBeenCalled();
  });

  it('registers push token on permission granted', async () => {
    renderHook(() => usePushNotificationSync(createDefaultParams()));

    await act(async () => {});

    expect(registerPushToken).toHaveBeenCalledWith(
      expect.objectContaining({
        expoToken: 'ExponentPushToken[xxx]',
        databaseId: 'db_test_database_id',
      })
    );
  });

  it('calls onPermissionsDenied when permissions denied', async () => {
    mockExpoNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'denied',
    });
    mockExpoNotifications.requestPermissionsAsync.mockResolvedValue({
      status: 'denied',
    });

    const onPermissionsDenied = jest.fn();
    renderHook(() =>
      usePushNotificationSync(createDefaultParams({ onPermissionsDenied }))
    );

    await act(async () => {});

    expect(onPermissionsDenied).toHaveBeenCalled();
  });

  it('adds foreground listener in foreground mode', async () => {
    renderHook(() => usePushNotificationSync(createDefaultParams()));

    await act(async () => {});

    expect(
      mockExpoNotifications.addNotificationReceivedListener
    ).toHaveBeenCalledWith(expect.any(Function));
  });

  it('triggers sync on SQLite Cloud notification', async () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    let notificationHandler: any;
    mockExpoNotifications.addNotificationReceivedListener.mockImplementation(
      (handler: any) => {
        notificationHandler = handler;
        return { remove: jest.fn() };
      }
    );
    (isForegroundSqliteCloudNotification as jest.Mock).mockReturnValue(true);

    renderHook(() =>
      usePushNotificationSync(
        createDefaultParams({
          performSyncRef: { current: performSync },
        })
      )
    );

    await act(async () => {});

    // Simulate notification
    await act(async () => {
      notificationHandler({
        request: {
          content: { data: { artifactURI: 'https://sqlite.ai' } },
        },
      });
    });

    expect(performSync).toHaveBeenCalled();
  });

  it('does not trigger sync for non-SQLite Cloud notification', async () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    let notificationHandler: any;
    mockExpoNotifications.addNotificationReceivedListener.mockImplementation(
      (handler: any) => {
        notificationHandler = handler;
        return { remove: jest.fn() };
      }
    );
    (isForegroundSqliteCloudNotification as jest.Mock).mockReturnValue(false);

    renderHook(() =>
      usePushNotificationSync(
        createDefaultParams({
          performSyncRef: { current: performSync },
        })
      )
    );

    await act(async () => {});

    await act(async () => {
      notificationHandler({ request: { content: { data: {} } } });
    });

    expect(performSync).not.toHaveBeenCalled();
  });

  it('registers background sync in always mode when available', async () => {
    (isBackgroundSyncAvailable as jest.Mock).mockReturnValue(true);

    renderHook(() =>
      usePushNotificationSync(
        createDefaultParams({ notificationListening: 'always' })
      )
    );

    await act(async () => {});

    expect(registerBackgroundSync).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseName: 'test.db',
      })
    );
    expect(setForegroundSyncCallback).toHaveBeenCalledWith(
      expect.any(Function)
    );
  });

  it('falls back to foreground listener when background not available', async () => {
    (isBackgroundSyncAvailable as jest.Mock).mockReturnValue(false);

    renderHook(() =>
      usePushNotificationSync(
        createDefaultParams({ notificationListening: 'always' })
      )
    );

    await act(async () => {});

    expect(registerBackgroundSync).not.toHaveBeenCalled();
    expect(
      mockExpoNotifications.addNotificationReceivedListener
    ).toHaveBeenCalled();
  });

  it('unregisters background sync when switching from push to polling', async () => {
    const { rerender } = renderHook(
      ({ syncMode }: { syncMode: 'push' | 'polling' }) =>
        usePushNotificationSync(createDefaultParams({ syncMode })),
      { initialProps: { syncMode: 'push' as const } }
    );

    await act(async () => {});

    rerender({ syncMode: 'polling' });

    expect(unregisterBackgroundSync).toHaveBeenCalled();
  });

  it('skips token registration when siteId retrieval fails', async () => {
    const writeDbRef = {
      current: {
        execute: jest.fn().mockRejectedValue(new Error('cloudsync_siteid fail')),
      },
    };

    renderHook(() =>
      usePushNotificationSync(createDefaultParams({ writeDbRef }))
    );

    await act(async () => {});

    expect(registerPushToken).not.toHaveBeenCalled();
  });

  it('skips token registration when siteId is empty', async () => {
    const writeDbRef = {
      current: {
        execute: jest.fn().mockResolvedValue({ rows: [] }),
      },
    };

    renderHook(() =>
      usePushNotificationSync(createDefaultParams({ writeDbRef }))
    );

    await act(async () => {});

    expect(registerPushToken).not.toHaveBeenCalled();
  });

  it('falls back to polling when registerPushToken fails', async () => {
    (registerPushToken as jest.Mock).mockRejectedValue(new Error('token fail'));
    const onPermissionsDenied = jest.fn();

    renderHook(() =>
      usePushNotificationSync(createDefaultParams({ onPermissionsDenied }))
    );

    await act(async () => {});

    expect(registerPushToken).toHaveBeenCalled();
    expect(onPermissionsDenied).toHaveBeenCalled();
  });

  it('falls back to polling when databaseId is missing', async () => {
    const onPermissionsDenied = jest.fn();

    renderHook(() =>
      usePushNotificationSync(
        createDefaultParams({
          databaseId: '',
          onPermissionsDenied,
        })
      )
    );

    await act(async () => {});

    expect(registerPushToken).not.toHaveBeenCalled();
    expect(onPermissionsDenied).toHaveBeenCalled();
  });

  it('removes listeners on unmount', async () => {
    const removeMock = jest.fn();
    mockExpoNotifications.addNotificationReceivedListener.mockReturnValue({
      remove: removeMock,
    });

    const { unmount } = renderHook(() =>
      usePushNotificationSync(createDefaultParams())
    );

    await act(async () => {});

    unmount();

    expect(removeMock).toHaveBeenCalled();
    expect(setForegroundSyncCallback).toHaveBeenCalledWith(null);
  });
});
