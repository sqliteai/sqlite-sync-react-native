import { renderHook } from '@testing-library/react-native';
import { useSqliteSync } from '../useSqliteSync';
import { createTestWrapper, createMockDB } from '../../../testUtils';

describe('useSqliteSync', () => {
  it('returns merged contexts', () => {
    const mockDb = createMockDB();
    const triggerSync = jest.fn().mockResolvedValue(undefined);
    const wrapper = createTestWrapper({
      db: { writeDb: mockDb as any },
      status: { isSyncing: true },
      actions: { triggerSync },
    });

    const { result } = renderHook(() => useSqliteSync(), { wrapper });

    expect(result.current.writeDb).toBe(mockDb);
    expect(result.current.isSyncing).toBe(true);
    expect(result.current.triggerSync).toBe(triggerSync);
  });

  it('triggerSync is callable', async () => {
    const triggerSync = jest.fn().mockResolvedValue(undefined);
    const wrapper = createTestWrapper({ actions: { triggerSync } });

    const { result } = renderHook(() => useSqliteSync(), { wrapper });

    await result.current.triggerSync();
    expect(triggerSync).toHaveBeenCalled();
  });
});
