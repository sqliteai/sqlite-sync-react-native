import { createDatabase } from '../createDatabase';
import { open } from '@op-engineering/op-sqlite';

jest.mock('@op-engineering/op-sqlite');

describe('createDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens database with given name', async () => {
    await createDatabase('app.db', 'write');
    expect(open).toHaveBeenCalledWith({ name: 'app.db' });
  });

  it('sets WAL journal mode', async () => {
    const db = await createDatabase('app.db', 'write');
    expect(db.execute).toHaveBeenCalledWith('PRAGMA journal_mode = WAL');
  });

  it('sets synchronous NORMAL in write mode', async () => {
    const db = await createDatabase('app.db', 'write');
    expect(db.execute).toHaveBeenCalledWith('PRAGMA synchronous = NORMAL');
  });

  it('sets locking_mode NORMAL in write mode', async () => {
    const db = await createDatabase('app.db', 'write');
    expect(db.execute).toHaveBeenCalledWith('PRAGMA locking_mode = NORMAL');
  });

  it('sets query_only in read mode', async () => {
    const db = await createDatabase('app.db', 'read');
    expect(db.execute).toHaveBeenCalledWith('PRAGMA query_only = true');
  });

  it('does NOT set synchronous in read mode', async () => {
    const db = await createDatabase('app.db', 'read');
    const calls = (db.execute as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    expect(calls).not.toContain('PRAGMA synchronous = NORMAL');
  });

  it('returns the DB instance', async () => {
    const db = await createDatabase('app.db', 'write');
    expect(db).toBeDefined();
    expect(db.execute).toBeDefined();
    expect(db.close).toBeDefined();
  });

  it('propagates error if open() throws', async () => {
    (open as jest.Mock).mockImplementationOnce(() => {
      throw new Error('open failed');
    });
    await expect(createDatabase('app.db', 'write')).rejects.toThrow('open failed');
  });

  it('propagates error if PRAGMA fails', async () => {
    (open as jest.Mock).mockReturnValueOnce({
      execute: jest.fn().mockRejectedValue(new Error('PRAGMA failed')),
      close: jest.fn(),
      loadExtension: jest.fn(),
      updateHook: jest.fn(),
      transaction: jest.fn(),
      reactiveExecute: jest.fn(),
    });
    await expect(createDatabase('app.db', 'write')).rejects.toThrow('PRAGMA failed');
  });
});
