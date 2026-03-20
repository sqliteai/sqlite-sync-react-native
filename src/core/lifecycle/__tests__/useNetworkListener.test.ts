import NetInfo from '@react-native-community/netinfo';
import { renderHook, act } from '@testing-library/react-native';
import { createLogger } from '../../common/logger';
import { useNetworkListener } from '../useNetworkListener';

// ─── Helpers ────────────────────────────────────────────────────────────────

const createDefaultParams = (overrides?: Partial<any>) => ({
  isSyncReady: true,
  performSyncRef: { current: jest.fn().mockResolvedValue(undefined) },
  appState: 'active',
  logger: createLogger(false),
  ...overrides,
});

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  (NetInfo as any).__clearListeners();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useNetworkListener', () => {
  it('returns network available initially', () => {
    const { result } = renderHook(() =>
      useNetworkListener(createDefaultParams())
    );

    expect(result.current.isNetworkAvailable).toBe(true);
  });

  it('registers NetInfo listener when sync ready', () => {
    renderHook(() => useNetworkListener(createDefaultParams()));

    expect(NetInfo.addEventListener).toHaveBeenCalled();
  });

  it('does not register when not sync ready', () => {
    (NetInfo.addEventListener as jest.Mock).mockClear();

    renderHook(() =>
      useNetworkListener(createDefaultParams({ isSyncReady: false }))
    );

    expect(NetInfo.addEventListener).not.toHaveBeenCalled();
  });

  it('triggers sync on reconnection when app active', () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      performSyncRef: { current: performSync },
      appState: 'active',
    });

    renderHook(() => useNetworkListener(params));

    // Go offline first so wasOffline becomes true
    act(() => {
      (NetInfo as any).__simulateChange({
        isConnected: false,
        isInternetReachable: false,
      });
    });

    // Come back online — should trigger sync
    act(() => {
      (NetInfo as any).__simulateChange({
        isConnected: true,
        isInternetReachable: true,
      });
    });

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('does not trigger sync on reconnection when app in background', () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      performSyncRef: { current: performSync },
      appState: 'background',
    });

    renderHook(() => useNetworkListener(params));

    // Go offline
    act(() => {
      (NetInfo as any).__simulateChange({
        isConnected: false,
        isInternetReachable: false,
      });
    });

    // Come back online while in background
    act(() => {
      (NetInfo as any).__simulateChange({
        isConnected: true,
        isInternetReachable: true,
      });
    });

    expect(performSync).not.toHaveBeenCalled();
  });

  it('does not trigger sync when going from online to online', () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      performSyncRef: { current: performSync },
      appState: 'active',
    });

    renderHook(() => useNetworkListener(params));

    // Simulate online → online (wasOffline was false the whole time)
    act(() => {
      (NetInfo as any).__simulateChange({
        isConnected: true,
        isInternetReachable: true,
      });
    });

    expect(performSync).not.toHaveBeenCalled();
  });

  it('updates isNetworkAvailable to false when going offline', () => {
    const { result } = renderHook(() =>
      useNetworkListener(createDefaultParams())
    );

    act(() => {
      (NetInfo as any).__simulateChange({
        isConnected: false,
        isInternetReachable: false,
      });
    });

    expect(result.current.isNetworkAvailable).toBe(false);
  });

  it('treats null isInternetReachable as online (true)', () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      performSyncRef: { current: performSync },
      appState: 'active',
    });

    const { result } = renderHook(() => useNetworkListener(params));

    // Go offline first
    act(() => {
      (NetInfo as any).__simulateChange({
        isConnected: false,
        isInternetReachable: false,
      });
    });

    expect(result.current.isNetworkAvailable).toBe(false);

    // Come back with isInternetReachable = null (should be treated as true)
    act(() => {
      (NetInfo as any).__simulateChange({
        isConnected: true,
        isInternetReachable: null,
      });
    });

    expect(result.current.isNetworkAvailable).toBe(true);
    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('treats null isConnected as offline (false)', () => {
    const { result } = renderHook(() =>
      useNetworkListener(createDefaultParams())
    );

    act(() => {
      (NetInfo as any).__simulateChange({
        isConnected: null,
        isInternetReachable: true,
      });
    });

    expect(result.current.isNetworkAvailable).toBe(false);
  });

  it('does not retrigger sync for repeated online events without going offline again', () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      performSyncRef: { current: performSync },
      appState: 'active',
    });

    renderHook(() => useNetworkListener(params));

    act(() => {
      (NetInfo as any).__simulateChange({
        isConnected: false,
        isInternetReachable: false,
      });
    });
    act(() => {
      (NetInfo as any).__simulateChange({
        isConnected: true,
        isInternetReachable: true,
      });
    });
    act(() => {
      (NetInfo as any).__simulateChange({
        isConnected: true,
        isInternetReachable: true,
      });
    });

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on cleanup', () => {
    // Capture the unsubscribe mock returned by addEventListener
    let capturedUnsubscribe: jest.Mock | undefined;
    (NetInfo.addEventListener as jest.Mock).mockImplementationOnce(
      (_callback: any) => {
        capturedUnsubscribe = jest.fn(() => {
          (NetInfo as any).__clearListeners();
        });
        // Still register so __simulateChange works if needed
        (NetInfo as any).__simulateChange; // no-op reference to avoid lint
        return capturedUnsubscribe;
      }
    );

    const { unmount } = renderHook(() =>
      useNetworkListener(createDefaultParams())
    );

    unmount();

    expect(capturedUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
