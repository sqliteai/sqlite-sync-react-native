jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));
jest.mock('../executeSync');
jest.mock('../../polling/calculateAdaptiveSyncInterval');
jest.mock('@react-native-community/netinfo');

import { renderHook, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSyncManager } from '../useSyncManager';
import { executeSync } from '../executeSync';
import { calculateAdaptiveSyncInterval } from '../../polling/calculateAdaptiveSyncInterval';
import { createLogger } from '../../common/logger';

describe('useSyncManager', () => {
  const logger = createLogger(false);

  const createDefaultParams = (overrides?: Partial<any>) => ({
    writeDbRef: { current: { execute: jest.fn(), transaction: jest.fn() } },
    isSyncReady: true,
    logger,
    adaptiveConfig: {
      baseInterval: 5000,
      maxInterval: 60000,
      emptyBackoffMultiplier: 1.5,
      errorBackoffMultiplier: 2.0,
    },
    currentIntervalRef: { current: 5000 },
    setCurrentInterval: jest.fn(),
    syncMode: 'polling' as const,
    ...overrides,
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.clearAllMocks();
    (executeSync as jest.Mock).mockResolvedValue(0);
    (calculateAdaptiveSyncInterval as jest.Mock).mockReturnValue(5000);
    (Platform as any).OS = 'ios';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() =>
      useSyncManager(createDefaultParams())
    );

    expect(result.current.isSyncing).toBe(false);
    expect(result.current.lastSyncTime).toBeNull();
    expect(result.current.lastSyncChanges).toBe(0);
    expect(result.current.consecutiveEmptySyncs).toBe(0);
    expect(result.current.consecutiveSyncErrors).toBe(0);
    expect(result.current.syncError).toBeNull();
    expect(typeof result.current.performSync).toBe('function');
  });

  it('skips sync when writeDb is null', async () => {
    const { result } = renderHook(() =>
      useSyncManager(createDefaultParams({ writeDbRef: { current: null } }))
    );

    await act(async () => {
      await result.current.performSync();
    });

    expect(executeSync).not.toHaveBeenCalled();
  });

  it('skips sync when not sync ready', async () => {
    const { result } = renderHook(() =>
      useSyncManager(createDefaultParams({ isSyncReady: false }))
    );

    await act(async () => {
      await result.current.performSync();
    });

    expect(executeSync).not.toHaveBeenCalled();
  });

  it('executes sync successfully with changes', async () => {
    (executeSync as jest.Mock).mockResolvedValue(5);
    (calculateAdaptiveSyncInterval as jest.Mock).mockReturnValue(5000);

    const params = createDefaultParams();
    const { result } = renderHook(() => useSyncManager(params));

    await act(async () => {
      await result.current.performSync();
    });

    expect(executeSync).toHaveBeenCalledWith(
      params.writeDbRef.current,
      logger,
      { useTransaction: true }
    );
    expect(result.current.lastSyncChanges).toBe(5);
    expect(result.current.lastSyncTime).not.toBeNull();
    expect(result.current.syncError).toBeNull();
  });

  it('increments consecutiveEmptySyncs on zero changes', async () => {
    (executeSync as jest.Mock).mockResolvedValue(0);
    const { result } = renderHook(() => useSyncManager(createDefaultParams()));

    await act(async () => {
      await result.current.performSync();
    });

    expect(result.current.consecutiveEmptySyncs).toBe(1);
  });

  it('resets consecutiveEmptySyncs on changes', async () => {
    (executeSync as jest.Mock).mockResolvedValueOnce(0).mockResolvedValueOnce(3);
    const { result } = renderHook(() => useSyncManager(createDefaultParams()));

    await act(async () => {
      await result.current.performSync();
    });
    expect(result.current.consecutiveEmptySyncs).toBe(1);

    await act(async () => {
      await result.current.performSync();
    });
    expect(result.current.consecutiveEmptySyncs).toBe(0);
  });

  it('recalculates interval in polling mode', async () => {
    (executeSync as jest.Mock).mockResolvedValue(0);
    (calculateAdaptiveSyncInterval as jest.Mock).mockReturnValue(7500);

    const params = createDefaultParams();
    const { result } = renderHook(() => useSyncManager(params));

    await act(async () => {
      await result.current.performSync();
    });

    expect(calculateAdaptiveSyncInterval).toHaveBeenCalled();
    expect(params.currentIntervalRef.current).toBe(7500);
    expect(params.setCurrentInterval).toHaveBeenCalledWith(7500);
  });

  it('does not recalculate interval in push mode', async () => {
    (executeSync as jest.Mock).mockResolvedValue(0);
    const params = createDefaultParams({ syncMode: 'push' });
    const { result } = renderHook(() => useSyncManager(params));

    await act(async () => {
      await result.current.performSync();
    });

    expect(calculateAdaptiveSyncInterval).not.toHaveBeenCalled();
    expect(params.setCurrentInterval).not.toHaveBeenCalled();
  });

  it('handles sync error', async () => {
    (executeSync as jest.Mock).mockRejectedValue(new Error('sync fail'));
    const { result } = renderHook(() => useSyncManager(createDefaultParams()));

    await act(async () => {
      await result.current.performSync();
    });

    expect(result.current.syncError?.message).toBe('sync fail');
    expect(result.current.consecutiveSyncErrors).toBe(1);
  });

  it('recalculates interval with error backoff in polling mode', async () => {
    (executeSync as jest.Mock).mockRejectedValue(new Error('fail'));
    (calculateAdaptiveSyncInterval as jest.Mock).mockReturnValue(10000);

    const params = createDefaultParams();
    const { result } = renderHook(() => useSyncManager(params));

    await act(async () => {
      await result.current.performSync();
    });

    expect(calculateAdaptiveSyncInterval).toHaveBeenCalledWith(
      expect.objectContaining({ consecutiveSyncErrors: 1 }),
      params.adaptiveConfig
    );
    expect(params.currentIntervalRef.current).toBe(10000);
  });

  it('prevents concurrent syncs', async () => {
    let resolveSync: () => void;
    (executeSync as jest.Mock).mockImplementation(
      () => new Promise<number>((resolve) => { resolveSync = () => resolve(0); })
    );

    const { result } = renderHook(() => useSyncManager(createDefaultParams()));

    // Start first sync
    let firstDone = false;
    act(() => {
      result.current.performSync().then(() => { firstDone = true; });
    });

    // Try second sync while first is in progress
    await act(async () => {
      await result.current.performSync();
    });

    expect(executeSync).toHaveBeenCalledTimes(1);

    // Complete first sync
    await act(async () => {
      resolveSync!();
    });
  });

  it('checks network on Android before syncing', async () => {
    (Platform as any).OS = 'android';
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    const { result } = renderHook(() => useSyncManager(createDefaultParams()));

    await act(async () => {
      await result.current.performSync();
    });

    expect(NetInfo.fetch).toHaveBeenCalled();
    expect(executeSync).not.toHaveBeenCalled();
  });

  it('skips network check on iOS', async () => {
    (Platform as any).OS = 'ios';
    (executeSync as jest.Mock).mockResolvedValue(0);

    const { result } = renderHook(() => useSyncManager(createDefaultParams()));

    await act(async () => {
      await result.current.performSync();
    });

    expect(NetInfo.fetch).not.toHaveBeenCalled();
    expect(executeSync).toHaveBeenCalled();
  });

  it('does not recalculate interval on error in push mode', async () => {
    (executeSync as jest.Mock).mockRejectedValue(new Error('fail'));
    const params = createDefaultParams({ syncMode: 'push' });
    const { result } = renderHook(() => useSyncManager(params));

    await act(async () => {
      await result.current.performSync();
    });

    expect(calculateAdaptiveSyncInterval).not.toHaveBeenCalled();
    expect(params.setCurrentInterval).not.toHaveBeenCalled();
    expect(result.current.syncError?.message).toBe('fail');
  });

  it('keeps performSyncRef updated', () => {
    const { result } = renderHook(() => useSyncManager(createDefaultParams()));

    expect(result.current.performSyncRef.current).toBe(
      result.current.performSync
    );
  });
});
