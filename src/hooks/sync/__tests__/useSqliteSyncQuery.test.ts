jest.useFakeTimers();

import { renderHook, act } from '@testing-library/react-native';
import { useSqliteSyncQuery } from '../useSqliteSyncQuery';
import { createTestWrapper, createMockDB } from '../../../testUtils';

describe('useSqliteSyncQuery', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  const defaultConfig = {
    query: 'SELECT * FROM users',
    arguments: [],
    fireOn: [{ table: 'users' }],
  };

  it('returns loading state initially', () => {
    const readDb = createMockDB();
    (readDb.execute as jest.Mock).mockReturnValue(new Promise(() => {})); // never resolves
    const wrapper = createTestWrapper({
      db: { readDb: readDb as any, writeDb: createMockDB() as any },
    });

    const { result } = renderHook(() => useSqliteSyncQuery(defaultConfig), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('fetches data on mount using readDb', async () => {
    const readDb = createMockDB();
    const writeDb = createMockDB();
    (readDb.execute as jest.Mock).mockResolvedValue({
      rows: [{ id: 1, name: 'Alice' }],
    });

    const wrapper = createTestWrapper({
      db: { readDb: readDb as any, writeDb: writeDb as any },
    });

    const { result } = renderHook(() => useSqliteSyncQuery(defaultConfig), {
      wrapper,
    });

    await act(async () => {});

    expect(readDb.execute).toHaveBeenCalledWith('SELECT * FROM users', []);
    expect(result.current.data).toEqual([{ id: 1, name: 'Alice' }]);
    expect(result.current.isLoading).toBe(false);
  });

  it('sets error on read failure', async () => {
    const readDb = createMockDB();
    (readDb.execute as jest.Mock).mockRejectedValue(new Error('read fail'));

    const wrapper = createTestWrapper({
      db: { readDb: readDb as any, writeDb: createMockDB() as any },
    });

    const { result } = renderHook(() => useSqliteSyncQuery(defaultConfig), {
      wrapper,
    });

    await act(async () => {});

    expect(result.current.error?.message).toBe('read fail');
    expect(result.current.isLoading).toBe(false);
  });

  it('sets up reactive subscription after debounce', async () => {
    const readDb = createMockDB();
    const writeDb = createMockDB();
    (readDb.execute as jest.Mock).mockResolvedValue({ rows: [] });

    const wrapper = createTestWrapper({
      db: { readDb: readDb as any, writeDb: writeDb as any },
    });

    renderHook(() => useSqliteSyncQuery(defaultConfig), { wrapper });

    await act(async () => {});

    // Before debounce, no reactive subscription
    expect(writeDb.reactiveExecute).not.toHaveBeenCalled();

    // After debounce (1000ms)
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(writeDb.reactiveExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'SELECT * FROM users',
        arguments: [],
        fireOn: [{ table: 'users' }],
        callback: expect.any(Function),
      })
    );
  });

  it('updates data when reactive callback fires', async () => {
    const readDb = createMockDB();
    const writeDb = createMockDB();
    (readDb.execute as jest.Mock).mockResolvedValue({ rows: [] });

    let reactiveCallback: any;
    (writeDb.reactiveExecute as jest.Mock).mockImplementation((config: any) => {
      reactiveCallback = config.callback;
      return jest.fn();
    });

    const wrapper = createTestWrapper({
      db: { readDb: readDb as any, writeDb: writeDb as any },
    });

    const { result } = renderHook(() => useSqliteSyncQuery(defaultConfig), {
      wrapper,
    });

    await act(async () => {});

    // Trigger debounce to set up subscription
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // Simulate reactive update
    await act(async () => {
      reactiveCallback({ rows: [{ id: 2, name: 'Bob' }] });
    });

    expect(result.current.data).toEqual([{ id: 2, name: 'Bob' }]);
  });

  it('unsubscribes reactive query on unmount', async () => {
    const readDb = createMockDB();
    const writeDb = createMockDB();
    (readDb.execute as jest.Mock).mockResolvedValue({ rows: [] });
    const unsubscribe = jest.fn();
    (writeDb.reactiveExecute as jest.Mock).mockReturnValue(unsubscribe);

    const wrapper = createTestWrapper({
      db: { readDb: readDb as any, writeDb: writeDb as any },
    });

    const { unmount } = renderHook(() => useSqliteSyncQuery(defaultConfig), {
      wrapper,
    });

    await act(async () => {});

    // Trigger debounce
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    unmount();

    // unsubscribe is called via setTimeout(fn, 0), advance to flush
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('no-ops when readDb is null', async () => {
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useSqliteSyncQuery(defaultConfig), {
      wrapper,
    });

    await act(async () => {});

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it('clears debounce timer on query change', async () => {
    const readDb = createMockDB();
    const writeDb = createMockDB();
    (readDb.execute as jest.Mock).mockResolvedValue({ rows: [] });

    const wrapper = createTestWrapper({
      db: { readDb: readDb as any, writeDb: writeDb as any },
    });

    const { rerender } = renderHook(
      ({ query }: { query: string }) =>
        useSqliteSyncQuery({
          query,
          arguments: [],
          fireOn: [{ table: 'users' }],
        }),
      { wrapper, initialProps: { query: 'SELECT * FROM users' } }
    );

    await act(async () => {});

    // Change query before debounce fires
    rerender({ query: 'SELECT * FROM users WHERE id = 1' });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    // Old timer should be cleared — no subscription yet
    expect(writeDb.reactiveExecute).not.toHaveBeenCalled();

    // After full debounce from rerender
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(writeDb.reactiveExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'SELECT * FROM users WHERE id = 1',
      })
    );
  });

  it('skips stale subscription when signature changed during debounce', async () => {
    const readDb = createMockDB();
    const writeDb = createMockDB();
    (readDb.execute as jest.Mock).mockResolvedValue({ rows: [] });

    const wrapper = createTestWrapper({
      db: { readDb: readDb as any, writeDb: writeDb as any },
    });

    const { rerender } = renderHook(
      ({ query }: { query: string }) =>
        useSqliteSyncQuery({
          query,
          arguments: [],
          fireOn: [{ table: 'users' }],
        }),
      { wrapper, initialProps: { query: 'SELECT * FROM users' } }
    );

    await act(async () => {});

    // Let debounce almost fire for original query
    await act(async () => {
      jest.advanceTimersByTime(900);
    });

    // Change query — old debounce fires but signature is stale
    rerender({ query: 'SELECT * FROM users WHERE active = 1' });

    await act(async () => {});

    // Old debounce fires at 1000ms
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // The stale subscription should be skipped — only new query should subscribe
    // New debounce fires at 1900ms total
    await act(async () => {
      jest.advanceTimersByTime(900);
    });

    // Should only have the new query subscription
    const calls = (writeDb.reactiveExecute as jest.Mock).mock.calls;
    const queries = calls.map((c: any) => c[0].query);
    expect(queries).toContain('SELECT * FROM users WHERE active = 1');
  });

  it('provides unsubscribe function', async () => {
    const readDb = createMockDB();
    const writeDb = createMockDB();
    (readDb.execute as jest.Mock).mockResolvedValue({ rows: [] });
    const unsub = jest.fn();
    (writeDb.reactiveExecute as jest.Mock).mockReturnValue(unsub);

    const wrapper = createTestWrapper({
      db: { readDb: readDb as any, writeDb: writeDb as any },
    });

    const { result } = renderHook(() => useSqliteSyncQuery(defaultConfig), {
      wrapper,
    });

    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // Manual unsubscribe
    result.current.unsubscribe();

    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    expect(unsub).toHaveBeenCalled();
  });

  it('unsubscribes previous reactive subscription when query changes', async () => {
    const readDb = createMockDB();
    const writeDb = createMockDB();
    const unsubscribeFirst = jest.fn();
    const unsubscribeSecond = jest.fn();

    (readDb.execute as jest.Mock).mockResolvedValue({ rows: [] });
    (writeDb.reactiveExecute as jest.Mock)
      .mockReturnValueOnce(unsubscribeFirst)
      .mockReturnValueOnce(unsubscribeSecond);

    const wrapper = createTestWrapper({
      db: { readDb: readDb as any, writeDb: writeDb as any },
    });

    const { rerender } = renderHook(
      ({ query }: { query: string }) =>
        useSqliteSyncQuery({
          query,
          arguments: [],
          fireOn: [{ table: 'users' }],
        }),
      { wrapper, initialProps: { query: 'SELECT * FROM users' } }
    );

    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    rerender({ query: 'SELECT * FROM users WHERE id = 1' });

    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    expect(unsubscribeFirst).toHaveBeenCalled();
    expect(unsubscribeSecond).not.toHaveBeenCalled();
  });

  it('ignores stale read results after the query changes', async () => {
    const readDb = createMockDB();
    const writeDb = createMockDB();
    let resolveFirst: ((value: any) => void) | undefined;

    (readDb.execute as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Bob' }] });

    const wrapper = createTestWrapper({
      db: { readDb: readDb as any, writeDb: writeDb as any },
    });

    const { result, rerender } = renderHook(
      ({ args }: { args: any[] }) =>
        useSqliteSyncQuery({
          query: 'SELECT * FROM users WHERE id = ?',
          arguments: args,
          fireOn: [{ table: 'users' }],
        }),
      { wrapper, initialProps: { args: [1] } }
    );

    rerender({ args: [2] });

    await act(async () => {
      resolveFirst?.({ rows: [{ id: 1, name: 'Alice' }] });
    });

    await act(async () => {});

    expect(result.current.data).toEqual([{ id: 2, name: 'Bob' }]);
  });
});
