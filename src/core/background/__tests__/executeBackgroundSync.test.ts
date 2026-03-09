import { executeBackgroundSync } from '../executeBackgroundSync';
import { createDatabase } from '../../database/createDatabase';
import { initializeSyncExtension } from '../../sync/initializeSyncExtension';
import { executeSync } from '../../sync/executeSync';
import { getBackgroundSyncCallback } from '../../pushNotifications/pushNotificationSyncCallbacks';

jest.mock('../../database/createDatabase');
jest.mock('../../sync/initializeSyncExtension');
jest.mock('../../sync/executeSync');
jest.mock('../../pushNotifications/pushNotificationSyncCallbacks');

const mockDb = {
  execute: jest.fn().mockResolvedValue({ rows: [] }),
  transaction: jest.fn(),
  close: jest.fn(),
  loadExtension: jest.fn(),
  updateHook: jest.fn(),
  reactiveExecute: jest.fn(),
};

const testConfig = {
  connectionString: 'sqlitecloud://host:port/db',
  databaseName: 'test.db',
  tablesToBeSynced: [{ name: 'users', createTableSql: 'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY)' }],
  apiKey: 'test-key',
  debug: false,
};

describe('executeBackgroundSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    (createDatabase as jest.Mock).mockResolvedValue(mockDb);
    (initializeSyncExtension as jest.Mock).mockResolvedValue(undefined);
    (executeSync as jest.Mock).mockResolvedValue(0);
    (getBackgroundSyncCallback as jest.Mock).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens DB with config.databaseName', async () => {
    await executeBackgroundSync(testConfig);

    expect(createDatabase).toHaveBeenCalledWith('test.db', 'write');
  });

  it('calls initializeSyncExtension', async () => {
    await executeBackgroundSync(testConfig);

    expect(initializeSyncExtension).toHaveBeenCalledWith(
      mockDb,
      {
        connectionString: testConfig.connectionString,
        tablesToBeSynced: testConfig.tablesToBeSynced,
        apiKey: testConfig.apiKey,
        accessToken: undefined,
      },
      expect.anything()
    );
  });

  it('calls executeSync with native retry options', async () => {
    await executeBackgroundSync(testConfig);

    expect(executeSync).toHaveBeenCalledWith(mockDb, expect.anything(), {
      useNativeRetry: true,
      maxAttempts: 3,
      attemptDelay: 500,
    });
  });

  it('registers updateHook when callback exists', async () => {
    const mockCallback = jest.fn().mockResolvedValue(undefined);
    (getBackgroundSyncCallback as jest.Mock).mockReturnValue(mockCallback);

    await executeBackgroundSync(testConfig);

    expect(mockDb.updateHook).toHaveBeenCalledWith(expect.any(Function));
  });

  it('collects changes from updateHook', async () => {
    const mockCallback = jest.fn().mockResolvedValue(undefined);
    (getBackgroundSyncCallback as jest.Mock).mockReturnValue(mockCallback);

    mockDb.updateHook.mockImplementation((handler: unknown) => {
      if (typeof handler === 'function') {
        handler({ operation: 'INSERT', table: 'users', rowId: 1 });
        handler({ operation: 'UPDATE', table: 'users', rowId: 2 });
      }
    });

    await executeBackgroundSync(testConfig);

    expect(mockCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [
          { operation: 'INSERT', table: 'users', rowId: 1 },
          { operation: 'UPDATE', table: 'users', rowId: 2 },
        ],
      })
    );
  });

  it('invokes callback with changes and db', async () => {
    const mockCallback = jest.fn().mockResolvedValue(undefined);
    (getBackgroundSyncCallback as jest.Mock).mockReturnValue(mockCallback);

    await executeBackgroundSync(testConfig);

    expect(mockCallback).toHaveBeenCalledWith({
      changes: expect.any(Array),
      db: mockDb,
    });
  });

  it('removes hook before calling callback', async () => {
    const callOrder: string[] = [];
    const mockCallback = jest.fn().mockImplementation(() => {
      callOrder.push('callback');
      return Promise.resolve();
    });
    (getBackgroundSyncCallback as jest.Mock).mockReturnValue(mockCallback);

    mockDb.updateHook.mockImplementation((handler: unknown) => {
      if (handler === null) {
        callOrder.push('updateHook(null)');
      }
    });

    await executeBackgroundSync(testConfig);

    const firstNullIndex = callOrder.indexOf('updateHook(null)');
    const callbackIndex = callOrder.indexOf('callback');
    expect(firstNullIndex).toBeLessThan(callbackIndex);
  });

  it('handles callback error without throwing', async () => {
    const mockCallback = jest.fn().mockRejectedValue(new Error('callback failed'));
    (getBackgroundSyncCallback as jest.Mock).mockReturnValue(mockCallback);

    await expect(executeBackgroundSync(testConfig)).resolves.toBeUndefined();
  });

  it('closes DB in finally block', async () => {
    await executeBackgroundSync(testConfig);

    expect(mockDb.close).toHaveBeenCalled();
  });

  it('closes DB when sync fails', async () => {
    (executeSync as jest.Mock).mockRejectedValue(new Error('sync error'));

    await expect(executeBackgroundSync(testConfig)).rejects.toThrow('sync error');
    expect(mockDb.close).toHaveBeenCalled();
  });

  it('rethrows sync errors', async () => {
    const syncError = new Error('network failure');
    (executeSync as jest.Mock).mockRejectedValue(syncError);

    await expect(executeBackgroundSync(testConfig)).rejects.toThrow('network failure');
  });

  it('skips callback when none registered and does not call updateHook', async () => {
    (getBackgroundSyncCallback as jest.Mock).mockReturnValue(null);

    await executeBackgroundSync(testConfig);

    // updateHook should only be called in finally to clear (null), not to register a handler
    const hookCalls = mockDb.updateHook.mock.calls;
    for (const call of hookCalls) {
      expect(call[0]).toBeNull();
    }
  });

  it('handles close error gracefully', async () => {
    mockDb.close.mockImplementation(() => {
      throw new Error('close failed');
    });

    await expect(executeBackgroundSync(testConfig)).resolves.toBeUndefined();
  });
});
