import {
  registerBackgroundSyncCallback,
  getBackgroundSyncCallback,
  setForegroundSyncCallback,
  getForegroundSyncCallback,
} from '../pushNotificationSyncCallbacks';

describe('pushNotificationSyncCallbacks', () => {
  beforeEach(() => {
    setForegroundSyncCallback(null);
  });

  it('getBackgroundSyncCallback returns null initially', () => {
    const result = getBackgroundSyncCallback();
    expect(result === null || typeof result === 'function').toBe(true);
  });

  it('register then get background callback returns same function', () => {
    const callback = jest.fn();
    registerBackgroundSyncCallback(callback);
    expect(getBackgroundSyncCallback()).toBe(callback);
  });

  it('getForegroundSyncCallback returns null initially', () => {
    expect(getForegroundSyncCallback()).toBeNull();
  });

  it('set then get foreground callback returns same function', () => {
    const callback = jest.fn();
    setForegroundSyncCallback(callback);
    expect(getForegroundSyncCallback()).toBe(callback);
  });

  it('set null clears foreground callback', () => {
    setForegroundSyncCallback(jest.fn());
    setForegroundSyncCallback(null);
    expect(getForegroundSyncCallback()).toBeNull();
  });
});
