import { renderHook, act } from '@testing-library/react-native';
import { useOnTableUpdate } from '../useOnTableUpdate';
import { createTestWrapper, createMockDB } from '../../../testUtils';

describe('useOnTableUpdate', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers updateHook on writeDb', () => {
    const mockDb = createMockDB();
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });

    renderHook(
      () => useOnTableUpdate({ tables: ['users'], onUpdate: jest.fn() }),
      { wrapper }
    );

    expect(mockDb.updateHook).toHaveBeenCalledWith(expect.any(Function));
  });

  it('removes updateHook on unmount', () => {
    const mockDb = createMockDB();
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });

    const { unmount } = renderHook(
      () => useOnTableUpdate({ tables: ['users'], onUpdate: jest.fn() }),
      { wrapper }
    );

    unmount();
    expect(mockDb.updateHook).toHaveBeenCalledWith(null);
  });

  it('uses updated table config after rerender without re-registering the hook', async () => {
    const mockDb = createMockDB();
    let hookHandler: any;
    (mockDb.updateHook as jest.Mock).mockImplementation((fn: any) => {
      if (typeof fn === 'function') hookHandler = fn;
    });
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });
    const onUpdate = jest.fn();

    const { rerender } = renderHook(
      ({ tables }: { tables: string[] }) =>
        useOnTableUpdate({ tables, onUpdate }),
      { wrapper, initialProps: { tables: ['users'] } }
    );

    rerender({ tables: ['orders'] });

    await act(async () => {
      await hookHandler({ operation: 'INSERT', table: 'users', rowId: 1 });
      await hookHandler({ operation: 'INSERT', table: 'orders', rowId: 2 });
    });

    expect(mockDb.updateHook).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ table: 'orders', rowId: 2 })
    );
  });

  it('calls callback for watched table', async () => {
    const mockDb = createMockDB();
    let hookHandler: any;
    (mockDb.updateHook as jest.Mock).mockImplementation((fn: any) => {
      if (typeof fn === 'function') hookHandler = fn;
    });
    (mockDb.execute as jest.Mock).mockResolvedValue({
      rows: [{ id: '1', name: 'Alice' }],
    });

    const onUpdate = jest.fn();
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });

    renderHook(() => useOnTableUpdate({ tables: ['users'], onUpdate }), {
      wrapper,
    });

    await act(async () => {
      await hookHandler({ operation: 'INSERT', table: 'users', rowId: 1 });
    });

    expect(onUpdate).toHaveBeenCalledWith({
      table: 'users',
      operation: 'INSERT',
      rowId: 1,
      row: { id: '1', name: 'Alice' },
    });
  });

  it('ignores unwatched table', async () => {
    const mockDb = createMockDB();
    let hookHandler: any;
    (mockDb.updateHook as jest.Mock).mockImplementation((fn: any) => {
      if (typeof fn === 'function') hookHandler = fn;
    });

    const onUpdate = jest.fn();
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });

    renderHook(() => useOnTableUpdate({ tables: ['users'], onUpdate }), {
      wrapper,
    });

    await act(async () => {
      await hookHandler({ operation: 'INSERT', table: 'orders', rowId: 1 });
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('provides null row for DELETE', async () => {
    const mockDb = createMockDB();
    let hookHandler: any;
    (mockDb.updateHook as jest.Mock).mockImplementation((fn: any) => {
      if (typeof fn === 'function') hookHandler = fn;
    });

    const onUpdate = jest.fn();
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });

    renderHook(() => useOnTableUpdate({ tables: ['users'], onUpdate }), {
      wrapper,
    });

    await act(async () => {
      await hookHandler({ operation: 'DELETE', table: 'users', rowId: 1 });
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ row: null, operation: 'DELETE' })
    );
  });

  it('handles fetch error gracefully', async () => {
    const mockDb = createMockDB();
    let hookHandler: any;
    (mockDb.updateHook as jest.Mock).mockImplementation((fn: any) => {
      if (typeof fn === 'function') hookHandler = fn;
    });
    (mockDb.execute as jest.Mock).mockRejectedValue(new Error('fetch fail'));

    const onUpdate = jest.fn();
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });

    renderHook(() => useOnTableUpdate({ tables: ['users'], onUpdate }), {
      wrapper,
    });

    await act(async () => {
      await hookHandler({ operation: 'INSERT', table: 'users', rowId: 1 });
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ row: null })
    );
  });

  it('provides null row when query returns empty rows', async () => {
    const mockDb = createMockDB();
    let hookHandler: any;
    (mockDb.updateHook as jest.Mock).mockImplementation((fn: any) => {
      if (typeof fn === 'function') hookHandler = fn;
    });
    (mockDb.execute as jest.Mock).mockResolvedValue({ rows: [] });

    const onUpdate = jest.fn();
    const wrapper = createTestWrapper({ db: { writeDb: mockDb as any } });

    renderHook(() => useOnTableUpdate({ tables: ['users'], onUpdate }), {
      wrapper,
    });

    await act(async () => {
      await hookHandler({ operation: 'UPDATE', table: 'users', rowId: 99 });
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ row: null, operation: 'UPDATE' })
    );
  });

  it('no-ops when writeDb is null', () => {
    const wrapper = createTestWrapper();

    renderHook(
      () => useOnTableUpdate({ tables: ['users'], onUpdate: jest.fn() }),
      { wrapper }
    );

    // No crash, no updateHook call
  });
});
