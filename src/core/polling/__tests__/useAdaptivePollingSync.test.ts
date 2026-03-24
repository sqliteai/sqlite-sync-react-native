import { renderHook, act } from '@testing-library/react-native';
import { useAdaptivePollingSync } from '../useAdaptivePollingSync';
import type { AdaptivePollingParams } from '../useAdaptivePollingSync';

jest.useFakeTimers();

const createDefaultParams = (overrides?: Partial<AdaptivePollingParams>): AdaptivePollingParams => ({
  isSyncReady: true,
  appState: 'active',
  performSyncRef: { current: jest.fn().mockResolvedValue(undefined) },
  currentIntervalRef: { current: 5000 },
  syncMode: 'polling',
  ...overrides,
});

describe('useAdaptivePollingSync', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  it('does not poll when not sync ready', async () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      isSyncReady: false,
      performSyncRef: { current: performSync },
    });

    renderHook(() => useAdaptivePollingSync(params));

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(performSync).not.toHaveBeenCalled();
  });

  it('does not poll when syncMode is push', async () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      syncMode: 'push',
      performSyncRef: { current: performSync },
    });

    renderHook(() => useAdaptivePollingSync(params));

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(performSync).not.toHaveBeenCalled();
  });

  it('does not poll when interval is null', async () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      currentIntervalRef: { current: null },
      performSyncRef: { current: performSync },
    });

    renderHook(() => useAdaptivePollingSync(params));

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(performSync).not.toHaveBeenCalled();
  });

  it('polls at current interval', async () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      currentIntervalRef: { current: 5000 },
      performSyncRef: { current: performSync },
    });

    renderHook(() => useAdaptivePollingSync(params));

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('reschedules after sync completes', async () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      currentIntervalRef: { current: 5000 },
      performSyncRef: { current: performSync },
    });

    renderHook(() => useAdaptivePollingSync(params));

    // First poll fires
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(performSync).toHaveBeenCalledTimes(1);

    // Second poll fires after sync completes and next interval elapses
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(performSync).toHaveBeenCalledTimes(2);
  });

  it('pauses when app goes to background', async () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      currentIntervalRef: { current: 5000 },
      performSyncRef: { current: performSync },
    });

    const { rerender } = renderHook(
      (props: AdaptivePollingParams) => useAdaptivePollingSync(props),
      { initialProps: params }
    );

    // Let first poll fire while active
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(performSync).toHaveBeenCalledTimes(1);

    // App goes to background
    rerender({ ...params, appState: 'background' });

    // Advance timers — no more calls should happen
    await act(async () => {
      jest.advanceTimersByTime(15000);
    });

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('resumes when app returns to foreground', async () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      currentIntervalRef: { current: 5000 },
      performSyncRef: { current: performSync },
    });

    const { rerender } = renderHook(
      (props: AdaptivePollingParams) => useAdaptivePollingSync(props),
      { initialProps: params }
    );

    // Go to background immediately (before any poll)
    rerender({ ...params, appState: 'background' });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(performSync).not.toHaveBeenCalled();

    // Return to foreground
    rerender({ ...params, appState: 'active' });

    // Polling should resume
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('stops scheduling when interval becomes null mid-loop', async () => {
    const intervalRef = { current: 5000 as number | null };
    // Make performSync set interval to null when called
    const performSync = jest.fn().mockImplementation(async () => {
      intervalRef.current = null;
    });
    const params = createDefaultParams({
      currentIntervalRef: intervalRef,
      performSyncRef: { current: performSync },
    });

    renderHook(() => useAdaptivePollingSync(params));

    // First poll fires — performSync sets interval to null
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(performSync).toHaveBeenCalledTimes(1);

    // Advance — no more polls should happen since interval is null
    await act(async () => {
      jest.advanceTimersByTime(15000);
    });

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('uses updated interval value for the next scheduled sync', async () => {
    const intervalRef = { current: 5000 as number | null };
    const performSync = jest.fn().mockImplementation(async () => {
      intervalRef.current = 1000;
    });
    const params = createDefaultParams({
      currentIntervalRef: intervalRef,
      performSyncRef: { current: performSync },
    });

    renderHook(() => useAdaptivePollingSync(params));

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(performSync).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(999);
    });
    expect(performSync).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(performSync).toHaveBeenCalledTimes(2);
  });

  it('cleans up timer on unmount', async () => {
    const performSync = jest.fn().mockResolvedValue(undefined);
    const params = createDefaultParams({
      currentIntervalRef: { current: 5000 },
      performSyncRef: { current: performSync },
    });

    const { unmount } = renderHook(() => useAdaptivePollingSync(params));

    unmount();

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(performSync).not.toHaveBeenCalled();
  });
});
