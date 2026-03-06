import { calculateAdaptiveSyncInterval } from '../calculateAdaptiveSyncInterval';

const defaultConfig = {
  baseInterval: 5000,
  maxInterval: 300000,
  emptyThreshold: 5,
  idleBackoffMultiplier: 1.5,
  errorBackoffMultiplier: 2.0,
};

describe('calculateAdaptiveSyncInterval', () => {
  it('returns baseInterval when no errors, no idle', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 5, consecutiveEmptySyncs: 0, consecutiveSyncErrors: 0 },
      defaultConfig
    );
    expect(result).toBe(5000);
  });

  it('returns baseInterval when below emptyThreshold', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 4, consecutiveSyncErrors: 0 },
      defaultConfig
    );
    expect(result).toBe(5000);
  });

  it('applies idle backoff at exactly emptyThreshold', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 5, consecutiveSyncErrors: 0 },
      defaultConfig
    );
    expect(result).toBe(7500);
  });

  it('increases idle backoff with consecutive empty syncs', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 7, consecutiveSyncErrors: 0 },
      defaultConfig
    );
    expect(result).toBe(5000 * Math.pow(1.5, 3));
  });

  it('caps idle backoff at maxInterval', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 100, consecutiveSyncErrors: 0 },
      defaultConfig
    );
    expect(result).toBe(300000);
  });

  it('applies error backoff exponentially', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 0, consecutiveSyncErrors: 3 },
      defaultConfig
    );
    expect(result).toBe(40000);
  });

  it('caps error backoff at maxInterval', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 0, consecutiveSyncErrors: 100 },
      defaultConfig
    );
    expect(result).toBe(300000);
  });

  it('gives error priority over idle backoff', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 10, consecutiveSyncErrors: 2 },
      defaultConfig
    );
    expect(result).toBe(5000 * Math.pow(2.0, 2));
  });

  it('handles single error', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 0, consecutiveSyncErrors: 1 },
      defaultConfig
    );
    expect(result).toBe(10000);
  });

  it('works with custom config values', () => {
    const config = {
      baseInterval: 1000,
      maxInterval: 10000,
      emptyThreshold: 2,
      idleBackoffMultiplier: 2,
      errorBackoffMultiplier: 3,
    };
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 3, consecutiveSyncErrors: 0 },
      config
    );
    expect(result).toBe(1000 * Math.pow(2, 2));
  });
});
