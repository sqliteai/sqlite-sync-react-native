import { renderHook, act } from '@testing-library/react-native';
import { createLogger } from '../../common/logger';
import { FOREGROUND_DEBOUNCE_MS } from '../../constants';

const mockRemove = jest.fn();
let appStateHandler: ((state: string) => void) | null = null;

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn((_event: string, handler: any) => {
      appStateHandler = handler;
      return { remove: mockRemove };
    }),
  },
}));

import { AppState } from 'react-native';
import { useAppLifecycle } from '../useAppLifecycle';

const createDefaultParams = (overrides?: Partial<any>) => ({
  isSyncReady: true,
  performSyncRef: { current: jest.fn().mockResolvedValue(undefined) },
  setConsecutiveEmptySyncs: jest.fn(),
  currentIntervalRef: { current: 5000 },
  setCurrentInterval: jest.fn(),
  adaptiveConfig: {
    baseInterval: 5000,
    maxInterval: 60000,
    emptyThreshold: 5,
    idleBackoffMultiplier: 1.5,
    errorBackoffMultiplier: 2.0,
  },
  syncMode: 'polling' as const,
  logger: createLogger(false),
  ...overrides,
});

describe('useAppLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateHandler = null;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns active state initially', () => {
    const params = createDefaultParams();
    const { result } = renderHook(() => useAppLifecycle(params));

    expect(result.current.appState).toBe('active');
    expect(result.current.isInBackground).toBe(false);
  });

  it('registers AppState listener when sync ready', () => {
    const params = createDefaultParams({ isSyncReady: true });
    renderHook(() => useAppLifecycle(params));

    expect(AppState.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
  });

  it('does not register listener when not sync ready', () => {
    const params = createDefaultParams({ isSyncReady: false });
    renderHook(() => useAppLifecycle(params));

    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });

  it('triggers performSync on foreground transition', () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      performSyncRef: { current: performSync },
    });

    renderHook(() => useAppLifecycle(params));

    act(() => {
      appStateHandler?.('background');
    });

    act(() => {
      appStateHandler?.('active');
    });

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('debounces rapid foreground transitions', () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      performSyncRef: { current: performSync },
    });

    renderHook(() => useAppLifecycle(params));

    // First background → active transition
    act(() => {
      appStateHandler?.('background');
    });
    act(() => {
      appStateHandler?.('active');
    });

    // Second rapid background → active transition (within debounce window)
    act(() => {
      appStateHandler?.('background');
    });
    act(() => {
      appStateHandler?.('active');
    });

    // performSync should only be called once due to debouncing
    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('resets interval to base on foreground (polling mode)', () => {
    const setConsecutiveEmptySyncs = jest.fn();
    const setCurrentInterval = jest.fn();
    const currentIntervalRef = { current: 30000 };
    const adaptiveConfig = {
      baseInterval: 5000,
      maxInterval: 60000,
      emptyThreshold: 5,
      idleBackoffMultiplier: 1.5,
      errorBackoffMultiplier: 2.0,
    };
    const params = createDefaultParams({
      setConsecutiveEmptySyncs,
      setCurrentInterval,
      currentIntervalRef,
      adaptiveConfig,
      syncMode: 'polling',
    });

    renderHook(() => useAppLifecycle(params));

    act(() => {
      appStateHandler?.('background');
    });
    act(() => {
      appStateHandler?.('active');
    });

    expect(setConsecutiveEmptySyncs).toHaveBeenCalledWith(0);
    expect(currentIntervalRef.current).toBe(adaptiveConfig.baseInterval);
    expect(setCurrentInterval).toHaveBeenCalledWith(
      adaptiveConfig.baseInterval
    );
  });

  it('does not reset interval in push mode', () => {
    const setConsecutiveEmptySyncs = jest.fn();
    const setCurrentInterval = jest.fn();
    const params = createDefaultParams({
      setConsecutiveEmptySyncs,
      setCurrentInterval,
      syncMode: 'push',
    });

    renderHook(() => useAppLifecycle(params));

    act(() => {
      appStateHandler?.('background');
    });
    act(() => {
      appStateHandler?.('active');
    });

    expect(setConsecutiveEmptySyncs).not.toHaveBeenCalled();
    expect(setCurrentInterval).not.toHaveBeenCalled();
  });

  it('removes listener on unmount', () => {
    const params = createDefaultParams();
    const { unmount } = renderHook(() => useAppLifecycle(params));

    unmount();

    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('updates appState and isInBackground on background transition', () => {
    const params = createDefaultParams();
    const { result } = renderHook(() => useAppLifecycle(params));

    act(() => {
      appStateHandler?.('background');
    });

    expect(result.current.appState).toBe('background');
    expect(result.current.isInBackground).toBe(true);
  });

  it('does not trigger sync on active to active transition', () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      performSyncRef: { current: performSync },
    });

    renderHook(() => useAppLifecycle(params));

    act(() => {
      appStateHandler?.('active');
    });

    expect(performSync).not.toHaveBeenCalled();
  });

  it('triggers sync on inactive to active transition', () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      performSyncRef: { current: performSync },
    });

    renderHook(() => useAppLifecycle(params));

    act(() => {
      appStateHandler?.('inactive');
    });
    act(() => {
      appStateHandler?.('active');
    });

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('debounce allows foreground sync after FOREGROUND_DEBOUNCE_MS has elapsed', () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      performSyncRef: { current: performSync },
    });

    jest.useFakeTimers();

    renderHook(() => useAppLifecycle(params));

    // First foreground transition
    act(() => {
      appStateHandler?.('background');
    });
    act(() => {
      appStateHandler?.('active');
    });

    // Advance time past debounce window
    act(() => {
      jest.advanceTimersByTime(FOREGROUND_DEBOUNCE_MS + 1);
    });

    // Second foreground transition after debounce
    act(() => {
      appStateHandler?.('background');
    });
    act(() => {
      appStateHandler?.('active');
    });

    expect(performSync).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });
});
