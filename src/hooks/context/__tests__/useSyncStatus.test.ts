import { renderHook } from '@testing-library/react-native';
import { useSyncStatus } from '../useSyncStatus';
import { createTestWrapper } from '../../../testUtils';

describe('useSyncStatus', () => {
  it('returns all status fields from context', () => {
    const wrapper = createTestWrapper({
      status: {
        isSyncing: true,
        lastSyncTime: 12345,
        syncError: new Error('test'),
      },
    });

    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    expect(result.current.isSyncing).toBe(true);
    expect(result.current.lastSyncTime).toBe(12345);
    expect(result.current.syncError).toBeInstanceOf(Error);
  });

  it('returns default values', () => {
    const wrapper = createTestWrapper();
    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    expect(result.current.isSyncing).toBe(false);
    expect(result.current.lastSyncTime).toBeNull();
    expect(result.current.syncError).toBeNull();
    expect(result.current.syncMode).toBe('polling');
  });
});
