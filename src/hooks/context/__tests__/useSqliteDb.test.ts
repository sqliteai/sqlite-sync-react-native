import { renderHook } from '@testing-library/react-native';
import { useSqliteDb } from '../useSqliteDb';
import { createTestWrapper, createMockDB } from '../../../testUtils';

describe('useSqliteDb', () => {
  it('returns writeDb, readDb, initError from context', () => {
    const mockDb = createMockDB();
    const wrapper = createTestWrapper({
      db: { writeDb: mockDb as any, readDb: mockDb as any, initError: null },
    });

    const { result } = renderHook(() => useSqliteDb(), { wrapper });

    expect(result.current.writeDb).toBe(mockDb);
    expect(result.current.readDb).toBe(mockDb);
    expect(result.current.initError).toBeNull();
  });

  it('returns null values by default', () => {
    const wrapper = createTestWrapper();
    const { result } = renderHook(() => useSqliteDb(), { wrapper });

    expect(result.current.writeDb).toBeNull();
    expect(result.current.readDb).toBeNull();
    expect(result.current.initError).toBeNull();
  });
});
