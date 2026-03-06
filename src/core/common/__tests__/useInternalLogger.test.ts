import { renderHook } from '@testing-library/react-native';
import { useInternalLogger } from '../useInternalLogger';
import { createTestWrapper } from '../../../testUtils';
import { createLogger } from '../logger';

describe('useInternalLogger', () => {
  it('returns logger from context', () => {
    const logger = createLogger(true);
    const wrapper = createTestWrapper({ logger });

    const { result } = renderHook(() => useInternalLogger(), { wrapper });

    expect(result.current).toBe(logger);
  });

  it('logger has info, warn, error methods', () => {
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useInternalLogger(), { wrapper });

    expect(typeof result.current.info).toBe('function');
    expect(typeof result.current.warn).toBe('function');
    expect(typeof result.current.error).toBe('function');
  });
});
