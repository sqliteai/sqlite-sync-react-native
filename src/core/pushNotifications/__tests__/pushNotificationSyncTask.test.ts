jest.mock('react-native', () => ({
  AppState: { currentState: 'active' },
}));
jest.mock('../../common/optionalDependencies', () => ({
  ExpoTaskManager: { defineTask: jest.fn() },
}));
jest.mock('../../common/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));
jest.mock('../../background/backgroundSyncConfig');
jest.mock('../../background/executeBackgroundSync');
jest.mock('../pushNotificationSyncCallbacks');
jest.mock('../isSqliteCloudNotification');

import { AppState } from 'react-native';
import { ExpoTaskManager } from '../../common/optionalDependencies';
import { getPersistedConfig } from '../../background/backgroundSyncConfig';
import { executeBackgroundSync } from '../../background/executeBackgroundSync';
import { getForegroundSyncCallback } from '../pushNotificationSyncCallbacks';
import { isSqliteCloudNotification } from '../isSqliteCloudNotification';
import { BACKGROUND_SYNC_TASK_NAME } from '../../constants';

const mockDefineTask = (ExpoTaskManager as any).defineTask as jest.Mock;

/** Import the module to trigger the top-level side effect */
require('../pushNotificationSyncTask');

/** Capture the handler ONCE before any mocks are cleared */
const handler = mockDefineTask.mock.calls[0]![1] as (args: {
  data: any;
  error: any;
}) => Promise<void>;

describe('pushNotificationSyncTask', () => {
  beforeEach(() => {
    // Clear all mocks EXCEPT the initial defineTask call we already captured
    (getPersistedConfig as jest.Mock).mockReset();
    (executeBackgroundSync as jest.Mock).mockReset();
    (getForegroundSyncCallback as jest.Mock).mockReset();
    (isSqliteCloudNotification as jest.Mock).mockReset();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    (AppState as any).currentState = 'active';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defines task when ExpoTaskManager is available', () => {
    expect(mockDefineTask).toHaveBeenCalledWith(
      BACKGROUND_SYNC_TASK_NAME,
      expect.any(Function)
    );
  });

  it('defineTask is only called once (not on re-import)', () => {
    // The module-level if(ExpoTaskManager) runs once on first import.
    // We verify it was called exactly once (from the initial require above).
    expect(mockDefineTask).toHaveBeenCalledTimes(1);
  });

  it('calls executeBackgroundSync for valid SQLite Cloud notification', async () => {
    const fakeConfig = {
      debug: false,
      databaseId: 'db_test_database_id',
      databaseName: 'test.db',
      tablesToBeSynced: [],
    };
    (getPersistedConfig as jest.Mock).mockResolvedValue(fakeConfig);
    (isSqliteCloudNotification as jest.Mock).mockReturnValue(true);
    (getForegroundSyncCallback as jest.Mock).mockReturnValue(null);
    (AppState as any).currentState = 'background';

    await handler({
      data: { body: { artifactURI: 'https://sqlite.ai' } },
      error: null,
    });

    expect(executeBackgroundSync).toHaveBeenCalledWith(fakeConfig);
  });

  it('skips non-SQLite Cloud notification', async () => {
    (getPersistedConfig as jest.Mock).mockResolvedValue({ debug: false });
    (isSqliteCloudNotification as jest.Mock).mockReturnValue(false);

    await handler({
      data: { body: { artifactURI: 'https://other.com' } },
      error: null,
    });

    expect(executeBackgroundSync).not.toHaveBeenCalled();
  });

  it('uses foreground callback when app is active', async () => {
    const foregroundCallback = jest.fn().mockResolvedValue(undefined);
    (getPersistedConfig as jest.Mock).mockResolvedValue({ debug: false });
    (isSqliteCloudNotification as jest.Mock).mockReturnValue(true);
    (getForegroundSyncCallback as jest.Mock).mockReturnValue(
      foregroundCallback
    );
    (AppState as any).currentState = 'active';

    await handler({
      data: { body: { artifactURI: 'https://sqlite.ai' } },
      error: null,
    });

    expect(foregroundCallback).toHaveBeenCalled();
    expect(executeBackgroundSync).not.toHaveBeenCalled();
  });

  it('handles foreground sync error gracefully', async () => {
    const foregroundCallback = jest
      .fn()
      .mockRejectedValue(new Error('sync failed'));
    (getPersistedConfig as jest.Mock).mockResolvedValue({ debug: false });
    (isSqliteCloudNotification as jest.Mock).mockReturnValue(true);
    (getForegroundSyncCallback as jest.Mock).mockReturnValue(
      foregroundCallback
    );
    (AppState as any).currentState = 'active';

    await expect(handler({ data: {}, error: null })).resolves.toBeUndefined();
  });

  it('skips background sync without config', async () => {
    (getPersistedConfig as jest.Mock).mockResolvedValue(null);
    (isSqliteCloudNotification as jest.Mock).mockReturnValue(true);
    (getForegroundSyncCallback as jest.Mock).mockReturnValue(null);
    (AppState as any).currentState = 'background';

    await handler({ data: {}, error: null });

    expect(executeBackgroundSync).not.toHaveBeenCalled();
  });

  it('skips background sync when persisted config is invalid', async () => {
    (getPersistedConfig as jest.Mock).mockResolvedValue(null);
    (isSqliteCloudNotification as jest.Mock).mockReturnValue(true);
    (getForegroundSyncCallback as jest.Mock).mockReturnValue(null);
    (AppState as any).currentState = 'background';

    await handler({
      data: { body: { artifactURI: 'https://sqlite.ai' } },
      error: null,
    });

    expect(executeBackgroundSync).not.toHaveBeenCalled();
  });

  it('handles task error by logging and returning', async () => {
    (getPersistedConfig as jest.Mock).mockResolvedValue({ debug: false });

    await handler({ data: null, error: new Error('task error') });

    expect(isSqliteCloudNotification).not.toHaveBeenCalled();
    expect(executeBackgroundSync).not.toHaveBeenCalled();
  });
});
