import { renderHook, act } from '@testing-library/react-native';
import { useSqliteTransaction } from '../useSqliteTransaction';
import { createTestWrapper, createMockDB } from '../../../testUtils';

describe('useSqliteTransaction', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns undefined when no writeDb', async () => {
    const wrapper = createTestWrapper();
    const { result } = renderHook(() => useSqliteTransaction(), { wrapper });

    let res: any;
    await act(async () => {
      res = await result.current.executeTransaction(async () => {});
    });
    expect(res).toBeUndefined();
  });

  it('calls writeDb.transaction', async () => {
    const mockDb = createMockDB();
    (mockDb.execute as jest.Mock).mockResolvedValue({ rows: [] });
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteTransaction(), { wrapper });

    const fn = jest.fn();
    await act(async () => {
      await result.current.executeTransaction(fn);
    });
    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it('sets error on failure and throws', async () => {
    const mockDb = createMockDB();
    (mockDb.transaction as jest.Mock).mockRejectedValue(new Error('tx fail'));
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteTransaction(), { wrapper });

    await act(async () => {
      await expect(
        result.current.executeTransaction(async () => {})
      ).rejects.toThrow('tx fail');
    });
    expect(result.current.error?.message).toBe('tx fail');
  });

  it('clears error on next success', async () => {
    const mockDb = createMockDB();
    (mockDb.transaction as jest.Mock)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue(undefined);
    (mockDb.execute as jest.Mock).mockResolvedValue({ rows: [] });
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteTransaction(), { wrapper });

    await act(async () => {
      try {
        await result.current.executeTransaction(async () => {});
      } catch {}
    });
    expect(result.current.error).not.toBeNull();

    await act(async () => {
      await result.current.executeTransaction(async () => {});
    });
    expect(result.current.error).toBeNull();
  });

  it('auto-syncs after commit', async () => {
    const mockDb = createMockDB();
    (mockDb.execute as jest.Mock).mockResolvedValue({ rows: [] });
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteTransaction(), { wrapper });

    await act(async () => {
      await result.current.executeTransaction(async () => {});
    });
    expect(mockDb.execute).toHaveBeenCalledWith(
      'SELECT cloudsync_network_send_changes();'
    );
  });

  it('does not auto-sync when transaction fails', async () => {
    const mockDb = createMockDB();
    (mockDb.transaction as jest.Mock).mockRejectedValue(new Error('tx fail'));
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteTransaction(), { wrapper });

    await act(async () => {
      await expect(
        result.current.executeTransaction(async () => {})
      ).rejects.toThrow('tx fail');
    });

    expect(mockDb.execute).not.toHaveBeenCalledWith(
      'SELECT cloudsync_network_send_changes();'
    );
  });

  it('skips auto-sync when autoSync=false', async () => {
    const mockDb = createMockDB();
    (mockDb.execute as jest.Mock).mockResolvedValue({ rows: [] });
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteTransaction(), { wrapper });

    await act(async () => {
      await result.current.executeTransaction(async () => {}, {
        autoSync: false,
      });
    });
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it('auto-sync failure is non-fatal', async () => {
    const mockDb = createMockDB();
    (mockDb.execute as jest.Mock).mockRejectedValue(new Error('sync fail'));
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteTransaction(), { wrapper });

    await act(async () => {
      await result.current.executeTransaction(async () => {});
    });
    // Should not throw — sync failure is caught internally
    expect(result.current.error).toBeNull();
  });

  it('wraps non-Error thrown value', async () => {
    const mockDb = createMockDB();
    (mockDb.transaction as jest.Mock).mockRejectedValue('raw string error');
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteTransaction(), { wrapper });

    await act(async () => {
      await expect(
        result.current.executeTransaction(async () => {})
      ).rejects.toThrow('Transaction failed');
    });
    expect(result.current.error?.message).toBe('Transaction failed');
  });

  it('sets isExecuting while transaction is in flight', async () => {
    let resolveTransaction: (() => void) | undefined;
    const mockDb = createMockDB();
    (mockDb.transaction as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveTransaction = resolve;
        })
    );
    (mockDb.execute as jest.Mock).mockResolvedValue({ rows: [] });
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const { result } = renderHook(() => useSqliteTransaction(), { wrapper });

    let pendingPromise: Promise<void> | undefined;
    act(() => {
      pendingPromise = result.current.executeTransaction(async () => {});
    });

    expect(result.current.isExecuting).toBe(true);

    await act(async () => {
      resolveTransaction?.();
      await pendingPromise;
    });

    expect(result.current.isExecuting).toBe(false);
  });
});
