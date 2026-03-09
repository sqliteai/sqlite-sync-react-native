import type { BackgroundSyncConfig } from '../backgroundSyncConfig';

jest.mock('../../common/optionalDependencies', () => ({
  ExpoNotifications: {
    registerTaskAsync: jest.fn().mockResolvedValue(undefined),
    unregisterTaskAsync: jest.fn().mockResolvedValue(undefined),
  },
  isBackgroundSyncAvailable: jest.fn().mockReturnValue(true),
}));

jest.mock('../backgroundSyncConfig', () => ({
  persistConfig: jest.fn().mockResolvedValue(undefined),
  clearPersistedConfig: jest.fn().mockResolvedValue(undefined),
}));

import {
  registerBackgroundSync,
  unregisterBackgroundSync,
} from '../backgroundSyncRegistry';
import {
  ExpoNotifications,
  isBackgroundSyncAvailable,
} from '../../common/optionalDependencies';
import { persistConfig, clearPersistedConfig } from '../backgroundSyncConfig';
import { BACKGROUND_SYNC_TASK_NAME } from '../../constants';

const mockConfig: BackgroundSyncConfig = {
  connectionString: 'sqlitecloud://host:8860/db',
  databaseName: 'test.db',
  tablesToBeSynced: [],
  debug: false,
};

describe('registerBackgroundSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isBackgroundSyncAvailable as jest.Mock).mockReturnValue(true);
  });

  it('persists config', async () => {
    await registerBackgroundSync(mockConfig);

    expect(persistConfig).toHaveBeenCalledWith(mockConfig);
  });

  it('registers task with ExpoNotifications', async () => {
    await registerBackgroundSync(mockConfig);

    expect(ExpoNotifications.registerTaskAsync).toHaveBeenCalledWith(
      BACKGROUND_SYNC_TASK_NAME
    );
  });

  it('warns and returns early when dependencies unavailable', async () => {
    jest.spyOn(console, 'warn').mockImplementation();
    (isBackgroundSyncAvailable as jest.Mock).mockReturnValue(false);

    await registerBackgroundSync({ ...mockConfig, debug: true });

    expect(persistConfig).not.toHaveBeenCalled();
    expect(ExpoNotifications.registerTaskAsync).not.toHaveBeenCalled();
  });
});

describe('unregisterBackgroundSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('unregisters task', async () => {
    await unregisterBackgroundSync();

    expect(ExpoNotifications.unregisterTaskAsync).toHaveBeenCalledWith(
      BACKGROUND_SYNC_TASK_NAME
    );
  });

  it('clears persisted config', async () => {
    await unregisterBackgroundSync();

    expect(clearPersistedConfig).toHaveBeenCalled();
  });

  it('no-ops without ExpoNotifications', async () => {
    // Temporarily replace the module export with null
    const deps = require('../../common/optionalDependencies');
    const original = deps.ExpoNotifications;
    deps.ExpoNotifications = null;

    await unregisterBackgroundSync();

    expect(clearPersistedConfig).not.toHaveBeenCalled();

    // Restore
    deps.ExpoNotifications = original;
  });

  it('handles errors gracefully', async () => {
    (ExpoNotifications.unregisterTaskAsync as jest.Mock).mockRejectedValueOnce(
      new Error('not registered')
    );

    // Should not throw
    await expect(unregisterBackgroundSync()).resolves.toBeUndefined();
  });
});
