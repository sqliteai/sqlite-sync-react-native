import { renderHook, act } from '@testing-library/react-native';
import { useSqliteExecute } from '../useSqliteExecute';
import { createTestWrapper, createMockDB } from '../../../testUtils';

describe('useSqliteExecute', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns undefined when no db', async () => {
    const wrapper = createTestWrapper();
    const { result } = renderHook(() => useSqliteExecute(), { wrapper });

    let res: any;
    await act(async () => {
      res = await result.current.execute('SELECT 1');
    });
    expect(res).toBeUndefined();
  });

  it('executes on writeDb by default', async () => {
    const mockDb = createMockDB();
    (mockDb.execute as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }] });
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteExecute(), { wrapper });

    let res: any;
    await act(async () => {
      res = await result.current.execute('SELECT 1');
    });
    expect(mockDb.execute).toHaveBeenCalledWith('SELECT 1', []);
    expect(res).toEqual({ rows: [{ id: 1 }] });
  });

  it('executes on readDb when readOnly', async () => {
    const writeDb = createMockDB();
    const readDb = createMockDB();
    (readDb.execute as jest.Mock).mockResolvedValue({ rows: [] });
    const wrapper = createTestWrapper({
      db: { writeDb: writeDb as any, readDb: readDb as any },
    });
    const { result } = renderHook(() => useSqliteExecute(), { wrapper });

    await act(async () => {
      await result.current.execute('SELECT 1', [], { readOnly: true });
    });
    expect(readDb.execute).toHaveBeenCalled();
    expect(writeDb.execute).not.toHaveBeenCalled();
  });

  it('sets error on failure and throws', async () => {
    const mockDb = createMockDB();
    (mockDb.execute as jest.Mock).mockRejectedValue(new Error('exec fail'));
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteExecute(), { wrapper });

    await act(async () => {
      await expect(result.current.execute('BAD SQL')).rejects.toThrow('exec fail');
    });
    expect(result.current.error?.message).toBe('exec fail');
  });

  it('clears error on next successful execute', async () => {
    const mockDb = createMockDB();
    (mockDb.execute as jest.Mock)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue({ rows: [] });
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteExecute(), { wrapper });

    await act(async () => {
      try {
        await result.current.execute('BAD');
      } catch {}
    });
    expect(result.current.error).not.toBeNull();

    await act(async () => {
      await result.current.execute('GOOD');
    });
    expect(result.current.error).toBeNull();
  });

  it('auto-syncs after write', async () => {
    const mockDb = createMockDB();
    (mockDb.execute as jest.Mock).mockResolvedValue({ rows: [] });
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteExecute(), { wrapper });

    await act(async () => {
      await result.current.execute('INSERT INTO t VALUES (1)');
    });
    expect(mockDb.execute).toHaveBeenCalledWith(
      'SELECT cloudsync_network_send_changes();'
    );
  });

  it('skips auto-sync on readOnly', async () => {
    const mockDb = createMockDB();
    (mockDb.execute as jest.Mock).mockResolvedValue({ rows: [] });
    const wrapper = createTestWrapper({
      db: { writeDb: mockDb as any, readDb: mockDb as any },
    });
    const { result } = renderHook(() => useSqliteExecute(), { wrapper });

    await act(async () => {
      await result.current.execute('SELECT 1', [], { readOnly: true });
    });
    const calls = (mockDb.execute as jest.Mock).mock.calls.map((c: any) => c[0]);
    expect(calls).not.toContain('SELECT cloudsync_network_send_changes();');
  });

  it('skips auto-sync when autoSync=false', async () => {
    const mockDb = createMockDB();
    (mockDb.execute as jest.Mock).mockResolvedValue({ rows: [] });
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteExecute(), { wrapper });

    await act(async () => {
      await result.current.execute('INSERT INTO t VALUES (1)', [], {
        autoSync: false,
      });
    });
    const calls = (mockDb.execute as jest.Mock).mock.calls.map((c: any) => c[0]);
    expect(calls).not.toContain('SELECT cloudsync_network_send_changes();');
  });

  it('auto-sync failure is non-fatal', async () => {
    const mockDb = createMockDB();
    (mockDb.execute as jest.Mock)
      .mockResolvedValueOnce({ rows: [] }) // main query
      .mockRejectedValueOnce(new Error('sync fail')); // auto-sync
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteExecute(), { wrapper });

    let res: any;
    await act(async () => {
      res = await result.current.execute('INSERT INTO t VALUES (1)');
    });
    expect(res).toEqual({ rows: [] });
  });

  it('wraps non-Error thrown value', async () => {
    const mockDb = createMockDB();
    (mockDb.execute as jest.Mock).mockRejectedValue('raw string error');
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteExecute(), { wrapper });

    await act(async () => {
      await expect(result.current.execute('BAD')).rejects.toThrow(
        'Execution failed'
      );
    });
    expect(result.current.error?.message).toBe('Execution failed');
  });
});
