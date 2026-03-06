import { renderHook } from '@testing-library/react-native';
import { useInitialSync } from '../useInitialSync';
import { createLogger } from '../../common/logger';

jest.useFakeTimers();

describe('useInitialSync', () => {
  const logger = createLogger(false);

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  it('triggers sync after 1500ms when ready', () => {
    const performSync = jest.fn();
    const performSyncRef = { current: performSync };

    renderHook(() =>
      useInitialSync({ isSyncReady: true, performSyncRef, logger })
    );

    expect(performSync).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1500);
    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('does not trigger when not ready', () => {
    const performSync = jest.fn();
    const performSyncRef = { current: performSync };

    renderHook(() =>
      useInitialSync({ isSyncReady: false, performSyncRef, logger })
    );

    jest.advanceTimersByTime(5000);
    expect(performSync).not.toHaveBeenCalled();
  });

  it('only triggers once', () => {
    const performSync = jest.fn();
    const performSyncRef = { current: performSync };

    const { rerender } = renderHook(
      ({ ready }) =>
        useInitialSync({ isSyncReady: ready, performSyncRef, logger }),
      { initialProps: { ready: true } }
    );

    jest.advanceTimersByTime(1500);
    expect(performSync).toHaveBeenCalledTimes(1);

    rerender({ ready: true });
    jest.advanceTimersByTime(1500);
    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('clears timeout on unmount', () => {
    const performSync = jest.fn();
    const performSyncRef = { current: performSync };

    const { unmount } = renderHook(() =>
      useInitialSync({ isSyncReady: true, performSyncRef, logger })
    );

    unmount();
    jest.advanceTimersByTime(2000);
    expect(performSync).not.toHaveBeenCalled();
  });
});
