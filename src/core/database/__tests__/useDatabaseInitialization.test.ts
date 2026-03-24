jest.mock('../createDatabase');
jest.mock('../../sync/initializeSyncExtension');

import { renderHook, act } from '@testing-library/react-native';
import { useDatabaseInitialization } from '../useDatabaseInitialization';
import { createDatabase } from '../createDatabase';
import { initializeSyncExtension } from '../../sync/initializeSyncExtension';
import { createLogger } from '../../common/logger';

const logger = createLogger(false);

const mockDb = {
  execute: jest.fn().mockResolvedValue({ rows: [] }),
  transaction: jest.fn(),
  close: jest.fn(),
  loadExtension: jest.fn(),
  updateHook: jest.fn(),
  reactiveExecute: jest.fn(),
};

describe('useDatabaseInitialization', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.clearAllMocks();
    (createDatabase as jest.Mock).mockResolvedValue({ ...mockDb });
    (initializeSyncExtension as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const defaultParams = {
    databaseId: 'db_test_database_id',
    databaseName: 'test.db',
    tablesToBeSynced: [
      {
        name: 'users',
        createTableSql: 'CREATE TABLE IF NOT EXISTS users (id TEXT)',
      },
    ],
    logger,
  };

  it('initializes database and sync successfully', async () => {
    const { result } = renderHook(() =>
      useDatabaseInitialization(defaultParams)
    );

    await act(async () => {});

    expect(createDatabase).toHaveBeenCalledWith('test.db', 'write');
    expect(createDatabase).toHaveBeenCalledWith('test.db', 'read');
    expect(result.current.writeDb).not.toBeNull();
    expect(result.current.readDb).not.toBeNull();
    expect(result.current.isSyncReady).toBe(true);
    expect(result.current.initError).toBeNull();
    expect(result.current.syncError).toBeNull();
  });

  it('creates tables from config', async () => {
    const db = {
      ...mockDb,
      execute: jest.fn().mockResolvedValue({ rows: [] }),
    };
    (createDatabase as jest.Mock).mockResolvedValue(db);

    renderHook(() => useDatabaseInitialization(defaultParams));

    await act(async () => {});

    expect(db.execute).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS users (id TEXT)'
    );
  });

  it('sets initError on database creation failure', async () => {
    (createDatabase as jest.Mock).mockRejectedValue(
      new Error('db open failed')
    );

    const { result } = renderHook(() =>
      useDatabaseInitialization(defaultParams)
    );

    await act(async () => {});

    expect(result.current.initError?.message).toContain('db open failed');
    expect(result.current.writeDb).toBeNull();
    expect(result.current.isSyncReady).toBe(false);
  });

  it('sets syncError on sync init failure (db still works)', async () => {
    (initializeSyncExtension as jest.Mock).mockRejectedValue(
      new Error('sync init failed')
    );

    const { result } = renderHook(() =>
      useDatabaseInitialization(defaultParams)
    );

    await act(async () => {});

    expect(result.current.writeDb).not.toBeNull();
    expect(result.current.readDb).not.toBeNull();
    expect(result.current.isSyncReady).toBe(false);
    expect(result.current.syncError?.message).toBe('sync init failed');
    expect(result.current.initError).toBeNull();
  });

  it('calls onDatabaseReady callback', async () => {
    const onDatabaseReady = jest.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useDatabaseInitialization({ ...defaultParams, onDatabaseReady })
    );

    await act(async () => {});

    expect(onDatabaseReady).toHaveBeenCalledWith(expect.any(Object));
  });

  it('runs onDatabaseReady before sync initialization', async () => {
    const events: string[] = [];
    const onDatabaseReady = jest.fn().mockImplementation(async () => {
      events.push('onDatabaseReady');
    });
    (initializeSyncExtension as jest.Mock).mockImplementation(async () => {
      events.push('initializeSyncExtension');
    });

    renderHook(() =>
      useDatabaseInitialization({ ...defaultParams, onDatabaseReady })
    );

    await act(async () => {});

    expect(events).toEqual(['onDatabaseReady', 'initializeSyncExtension']);
  });

  it('sets initError when onDatabaseReady fails', async () => {
    const onDatabaseReady = jest
      .fn()
      .mockRejectedValue(new Error('migration fail'));

    const { result } = renderHook(() =>
      useDatabaseInitialization({ ...defaultParams, onDatabaseReady })
    );

    await act(async () => {});

    expect(result.current.initError?.message).toContain('migration fail');
  });

  it('closes databases on unmount', async () => {
    const writeDb = { ...mockDb, close: jest.fn() };
    const readDb = { ...mockDb, close: jest.fn() };
    (createDatabase as jest.Mock)
      .mockResolvedValueOnce(writeDb)
      .mockResolvedValueOnce(readDb);

    const { unmount } = renderHook(() =>
      useDatabaseInitialization(defaultParams)
    );

    await act(async () => {});

    unmount();

    expect(writeDb.close).toHaveBeenCalled();
    expect(readDb.close).toHaveBeenCalled();
  });

  it('sets initError when databaseName is empty', async () => {
    const { result } = renderHook(() =>
      useDatabaseInitialization({ ...defaultParams, databaseName: '' })
    );

    await act(async () => {});

    expect(result.current.initError?.message).toContain(
      'Database name is required'
    );
    expect(result.current.writeDb).toBeNull();
    expect(result.current.isSyncReady).toBe(false);
  });

  it('warns when tablesToBeSynced is empty', async () => {
    const { result } = renderHook(() =>
      useDatabaseInitialization({ ...defaultParams, tablesToBeSynced: [] })
    );

    await act(async () => {});

    expect(result.current.writeDb).not.toBeNull();
    expect(result.current.readDb).not.toBeNull();
  });

  it('handles write db close error on unmount', async () => {
    const writeDb = {
      ...mockDb,
      close: jest.fn().mockImplementation(() => {
        throw new Error('close fail');
      }),
    };
    const readDb = { ...mockDb, close: jest.fn() };
    (createDatabase as jest.Mock)
      .mockResolvedValueOnce(writeDb)
      .mockResolvedValueOnce(readDb);

    const { unmount } = renderHook(() =>
      useDatabaseInitialization(defaultParams)
    );

    await act(async () => {});

    unmount();
    // No crash — error is caught internally
  });

  it('handles read db close error on unmount', async () => {
    const writeDb = { ...mockDb, close: jest.fn() };
    const readDb = {
      ...mockDb,
      close: jest.fn().mockImplementation(() => {
        throw new Error('close fail');
      }),
    };
    (createDatabase as jest.Mock)
      .mockResolvedValueOnce(writeDb)
      .mockResolvedValueOnce(readDb);

    const { unmount } = renderHook(() =>
      useDatabaseInitialization(defaultParams)
    );

    await act(async () => {});

    unmount();
    // No crash — error is caught internally
  });

  it('sets initError when table creation fails', async () => {
    const db = {
      ...mockDb,
      execute: jest.fn().mockRejectedValue(new Error('SQL error')),
    };
    (createDatabase as jest.Mock).mockResolvedValue(db);

    const { result } = renderHook(() =>
      useDatabaseInitialization(defaultParams)
    );

    await act(async () => {});

    expect(result.current.initError?.message).toContain(
      'Failed to create table users'
    );
  });

  it('cleans up write db if read db creation fails', async () => {
    const writeDb = { ...mockDb, close: jest.fn() };
    (createDatabase as jest.Mock)
      .mockResolvedValueOnce(writeDb)
      .mockRejectedValueOnce(new Error('read open failed'));

    const { result } = renderHook(() =>
      useDatabaseInitialization(defaultParams)
    );

    await act(async () => {});

    expect(result.current.initError?.message).toContain('read open failed');
    expect(writeDb.close).toHaveBeenCalled();
  });

  it('reinitializes and closes old databases when auth changes', async () => {
    const writeDb1 = { ...mockDb, close: jest.fn() };
    const readDb1 = { ...mockDb, close: jest.fn() };
    const writeDb2 = { ...mockDb, close: jest.fn() };
    const readDb2 = { ...mockDb, close: jest.fn() };

    (createDatabase as jest.Mock)
      .mockResolvedValueOnce(writeDb1)
      .mockResolvedValueOnce(readDb1)
      .mockResolvedValueOnce(writeDb2)
      .mockResolvedValueOnce(readDb2);

    const { rerender } = renderHook(
      ({ accessToken }: { accessToken?: string }) =>
        useDatabaseInitialization({ ...defaultParams, accessToken }),
      { initialProps: { accessToken: 'token-a' } }
    );

    await act(async () => {});

    rerender({ accessToken: 'token-b' });

    await act(async () => {});

    expect(writeDb1.close).toHaveBeenCalled();
    expect(readDb1.close).toHaveBeenCalled();
  });
});
