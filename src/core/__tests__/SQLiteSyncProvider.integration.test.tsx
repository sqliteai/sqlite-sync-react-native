jest.mock('../database/createDatabase');
jest.mock('../sync/initializeSyncExtension');
jest.mock('../sync/executeSync');
jest.mock('@react-native-community/netinfo');
jest.mock('../common/optionalDependencies', () => ({
  ExpoNotifications: {
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    getDevicePushTokenAsync: jest.fn(),
    getExpoPushTokenAsync: jest.fn(),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  ExpoConstants: {
    expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
  },
  ExpoApplication: {
    getIosIdForVendorAsync: jest.fn().mockResolvedValue('device-id'),
    getAndroidId: jest.fn().mockReturnValue('android-id'),
  },
  ExpoSecureStore: {
    getItemAsync: jest.fn().mockResolvedValue(null),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
  },
  ExpoTaskManager: null,
  isBackgroundSyncAvailable: jest.fn().mockReturnValue(false),
}));
jest.mock('../pushNotifications/registerPushToken', () => ({
  registerPushToken: jest.fn().mockResolvedValue(undefined),
}));

import { useContext } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { render, act } from '@testing-library/react-native';
import { SQLiteSyncProvider } from '../SQLiteSyncProvider';
import { SQLiteSyncStatusContext } from '../../contexts/SQLiteSyncStatusContext';
import { createDatabase } from '../database/createDatabase';
import { initializeSyncExtension } from '../sync/initializeSyncExtension';
import { executeSync } from '../sync/executeSync';
import { createMockDB } from '../../__mocks__/@op-engineering/op-sqlite';
import { ExpoNotifications } from '../common/optionalDependencies';

const mockExpoNotifications = ExpoNotifications as any;

function CaptureStatus({
  onChange,
}: {
  onChange: (value: any) => void;
}) {
  const value = useContext(SQLiteSyncStatusContext);
  onChange(value);
  return null;
}

describe('SQLiteSyncProvider integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    } as any);

    (NetInfo.addEventListener as jest.Mock).mockImplementation(() => jest.fn());
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    (executeSync as jest.Mock).mockResolvedValue(0);
    (initializeSyncExtension as jest.Mock).mockResolvedValue(undefined);
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
      data: 'ExponentPushToken[test]',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (NetInfo as any).__clearListeners?.();
  });

  it('uses polling defaults when adaptivePolling is omitted', async () => {
    const writeDb = createMockDB();
    const readDb = createMockDB();
    let latestStatus: any;

    (createDatabase as jest.Mock)
      .mockResolvedValueOnce(writeDb)
      .mockResolvedValueOnce(readDb);

    render(
      <SQLiteSyncProvider
        databaseId="db_test"
        databaseName="test.db"
        apiKey="api-key"
        syncMode="polling"
        tablesToBeSynced={[
          {
            name: 'users',
            createTableSql: 'CREATE TABLE IF NOT EXISTS users (id TEXT)',
          },
        ]}
      >
        <CaptureStatus onChange={(value) => (latestStatus = value)} />
      </SQLiteSyncProvider>
    );

    await act(async () => {});

    expect(latestStatus.syncMode).toBe('polling');
    expect(latestStatus.currentSyncInterval).toBe(5000);
  });

  it('defaults push mode to foreground notification listening', async () => {
    const writeDb = createMockDB();
    const readDb = createMockDB();

    writeDb.execute = jest
      .fn()
      .mockResolvedValue({ rows: [{ 'cloudsync_siteid()': 'site-123' }] });
    (createDatabase as jest.Mock)
      .mockResolvedValueOnce(writeDb)
      .mockResolvedValueOnce(readDb);

    render(
      <SQLiteSyncProvider
        databaseId="db_test"
        databaseName="test.db"
        apiKey="api-key"
        syncMode="push"
        tablesToBeSynced={[
          {
            name: 'users',
            createTableSql: 'CREATE TABLE IF NOT EXISTS users (id TEXT)',
          },
        ]}
      >
        <CaptureStatus onChange={() => {}} />
      </SQLiteSyncProvider>
    );

    await act(async () => {});

    expect(
      mockExpoNotifications.addNotificationReceivedListener
    ).toHaveBeenCalled();
  });

  it('falls back from push mode to polling when permissions are denied', async () => {
    const writeDb = createMockDB();
    const readDb = createMockDB();
    let latestStatus: any;

    (createDatabase as jest.Mock)
      .mockResolvedValueOnce(writeDb)
      .mockResolvedValueOnce(readDb);
    mockExpoNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'denied',
    });
    mockExpoNotifications.requestPermissionsAsync.mockResolvedValue({
      status: 'denied',
    });

    render(
      <SQLiteSyncProvider
        databaseId="db_test"
        databaseName="test.db"
        apiKey="api-key"
        syncMode="push"
        tablesToBeSynced={[
          {
            name: 'users',
            createTableSql: 'CREATE TABLE IF NOT EXISTS users (id TEXT)',
          },
        ]}
      >
        <CaptureStatus onChange={(value) => (latestStatus = value)} />
      </SQLiteSyncProvider>
    );

    await act(async () => {});
    await act(async () => {});

    expect(latestStatus.syncMode).toBe('polling');
    expect(latestStatus.currentSyncInterval).toBe(5000);
  });

  it('reinitializes and closes old databases when accessToken changes', async () => {
    const writeDb1 = createMockDB();
    const readDb1 = createMockDB();
    const writeDb2 = createMockDB();
    const readDb2 = createMockDB();

    (createDatabase as jest.Mock)
      .mockResolvedValueOnce(writeDb1)
      .mockResolvedValueOnce(readDb1)
      .mockResolvedValueOnce(writeDb2)
      .mockResolvedValueOnce(readDb2);

    const { rerender } = render(
      <SQLiteSyncProvider
        databaseId="db_test"
        databaseName="test.db"
        accessToken="token-a"
        syncMode="polling"
        tablesToBeSynced={[
          {
            name: 'users',
            createTableSql: 'CREATE TABLE IF NOT EXISTS users (id TEXT)',
          },
        ]}
      >
        <CaptureStatus onChange={() => {}} />
      </SQLiteSyncProvider>
    );

    await act(async () => {});

    rerender(
      <SQLiteSyncProvider
        databaseId="db_test"
        databaseName="test.db"
        accessToken="token-b"
        syncMode="polling"
        tablesToBeSynced={[
          {
            name: 'users',
            createTableSql: 'CREATE TABLE IF NOT EXISTS users (id TEXT)',
          },
        ]}
      >
        <CaptureStatus onChange={() => {}} />
      </SQLiteSyncProvider>
    );

    await act(async () => {});

    expect(writeDb1.close).toHaveBeenCalled();
    expect(readDb1.close).toHaveBeenCalled();
    expect(initializeSyncExtension).toHaveBeenCalledWith(
      writeDb2,
      expect.objectContaining({ accessToken: 'token-b' }),
      expect.anything()
    );
  });

  it('reinitializes when apiKey changes', async () => {
    const writeDb1 = createMockDB();
    const readDb1 = createMockDB();
    const writeDb2 = createMockDB();
    const readDb2 = createMockDB();

    (createDatabase as jest.Mock)
      .mockResolvedValueOnce(writeDb1)
      .mockResolvedValueOnce(readDb1)
      .mockResolvedValueOnce(writeDb2)
      .mockResolvedValueOnce(readDb2);

    const { rerender } = render(
      <SQLiteSyncProvider
        databaseId="db_test"
        databaseName="test.db"
        apiKey="key-a"
        syncMode="polling"
        tablesToBeSynced={[
          {
            name: 'users',
            createTableSql: 'CREATE TABLE IF NOT EXISTS users (id TEXT)',
          },
        ]}
      >
        <CaptureStatus onChange={() => {}} />
      </SQLiteSyncProvider>
    );

    await act(async () => {});

    rerender(
      <SQLiteSyncProvider
        databaseId="db_test"
        databaseName="test.db"
        apiKey="key-b"
        syncMode="polling"
        tablesToBeSynced={[
          {
            name: 'users',
            createTableSql: 'CREATE TABLE IF NOT EXISTS users (id TEXT)',
          },
        ]}
      >
        <CaptureStatus onChange={() => {}} />
      </SQLiteSyncProvider>
    );

    await act(async () => {});

    expect(writeDb1.close).toHaveBeenCalled();
    expect(readDb1.close).toHaveBeenCalled();
    expect(initializeSyncExtension).toHaveBeenCalledWith(
      writeDb2,
      expect.objectContaining({ apiKey: 'key-b' }),
      expect.anything()
    );
  });

  it('reinitializes when databaseId changes', async () => {
    const writeDb1 = createMockDB();
    const readDb1 = createMockDB();
    const writeDb2 = createMockDB();
    const readDb2 = createMockDB();

    (createDatabase as jest.Mock)
      .mockResolvedValueOnce(writeDb1)
      .mockResolvedValueOnce(readDb1)
      .mockResolvedValueOnce(writeDb2)
      .mockResolvedValueOnce(readDb2);

    const { rerender } = render(
      <SQLiteSyncProvider
        databaseId="db_a"
        databaseName="test.db"
        apiKey="api-key"
        syncMode="polling"
        tablesToBeSynced={[
          {
            name: 'users',
            createTableSql: 'CREATE TABLE IF NOT EXISTS users (id TEXT)',
          },
        ]}
      >
        <CaptureStatus onChange={() => {}} />
      </SQLiteSyncProvider>
    );

    await act(async () => {});

    rerender(
      <SQLiteSyncProvider
        databaseId="db_b"
        databaseName="test.db"
        apiKey="api-key"
        syncMode="polling"
        tablesToBeSynced={[
          {
            name: 'users',
            createTableSql: 'CREATE TABLE IF NOT EXISTS users (id TEXT)',
          },
        ]}
      >
        <CaptureStatus onChange={() => {}} />
      </SQLiteSyncProvider>
    );

    await act(async () => {});

    expect(writeDb1.close).toHaveBeenCalled();
    expect(readDb1.close).toHaveBeenCalled();
    expect(initializeSyncExtension).toHaveBeenCalledWith(
      writeDb2,
      expect.objectContaining({ databaseId: 'db_b' }),
      expect.anything()
    );
  });

  it('reinitializes when table config changes', async () => {
    const writeDb1 = createMockDB();
    const readDb1 = createMockDB();
    const writeDb2 = createMockDB();
    const readDb2 = createMockDB();

    (createDatabase as jest.Mock)
      .mockResolvedValueOnce(writeDb1)
      .mockResolvedValueOnce(readDb1)
      .mockResolvedValueOnce(writeDb2)
      .mockResolvedValueOnce(readDb2);

    const { rerender } = render(
      <SQLiteSyncProvider
        databaseId="db_test"
        databaseName="test.db"
        apiKey="api-key"
        syncMode="polling"
        tablesToBeSynced={[
          {
            name: 'users',
            createTableSql: 'CREATE TABLE IF NOT EXISTS users (id TEXT)',
          },
        ]}
      >
        <CaptureStatus onChange={() => {}} />
      </SQLiteSyncProvider>
    );

    await act(async () => {});

    rerender(
      <SQLiteSyncProvider
        databaseId="db_test"
        databaseName="test.db"
        apiKey="api-key"
        syncMode="polling"
        tablesToBeSynced={[
          {
            name: 'users',
            createTableSql:
              'CREATE TABLE IF NOT EXISTS users (id TEXT, email TEXT)',
          },
        ]}
      >
        <CaptureStatus onChange={() => {}} />
      </SQLiteSyncProvider>
    );

    await act(async () => {});

    expect(writeDb1.close).toHaveBeenCalled();
    expect(readDb1.close).toHaveBeenCalled();
    expect(writeDb2.execute).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS users (id TEXT, email TEXT)'
    );
  });
});
