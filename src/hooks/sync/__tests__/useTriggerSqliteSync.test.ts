import { renderHook } from '@testing-library/react-native';
import { useTriggerSqliteSync } from '../useTriggerSqliteSync';
import { createTestWrapper } from '../../../testUtils';

describe('useTriggerSqliteSync', () => {
  it('returns triggerSync from context', () => {
    const triggerSync = jest.fn().mockResolvedValue(undefined);
    const wrapper = createTestWrapper({ actions: { triggerSync } });

    const { result } = renderHook(() => useTriggerSqliteSync(), { wrapper });

    expect(result.current.triggerSync).toBe(triggerSync);
  });

  it('calls through to context triggerSync', async () => {
    const triggerSync = jest.fn().mockResolvedValue(undefined);
    const wrapper = createTestWrapper({ actions: { triggerSync } });

    const { result } = renderHook(() => useTriggerSqliteSync(), { wrapper });

    await result.current.triggerSync();
    expect(triggerSync).toHaveBeenCalledTimes(1);
  });
});
