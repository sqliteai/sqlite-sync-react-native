import { createMockDB } from '../../../__mocks__/@op-engineering/op-sqlite';
import { createLogger } from '../../common/logger';
import { executeSync } from '../executeSync';

const logger = createLogger(false);

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const syncResult = (rowsReceived: number) => ({
  rows: [
    {
      'cloudsync_network_sync()': JSON.stringify({
        send: {
          status: 'synced',
          localVersion: 5,
          serverVersion: 5,
        },
        receive: { rows: rowsReceived, tables: ['users'] },
      }),
    },
  ],
});

const noChangesResult = () => syncResult(0);

describe('JS retry', () => {
  it('returns 0 when no changes', async () => {
    const db = createMockDB();
    db.execute.mockResolvedValue(noChangesResult());

    const promise = executeSync(db as any, logger, { maxAttempts: 1 });
    // Advance past any delays
    await jest.runAllTimersAsync();
    const changes = await promise;

    expect(changes).toBe(0);
  });

  it('returns count from JSON result', async () => {
    const db = createMockDB();
    db.execute.mockResolvedValue(syncResult(3));

    const promise = executeSync(db as any, logger, { maxAttempts: 1 });
    await jest.runAllTimersAsync();
    const changes = await promise;

    expect(changes).toBe(3);
  });

  it('stops retrying on changes found', async () => {
    const db = createMockDB();
    db.execute
      .mockResolvedValueOnce(noChangesResult())
      .mockResolvedValueOnce(syncResult(5));

    const promise = executeSync(db as any, logger, {
      maxAttempts: 4,
      attemptDelay: 1000,
    });
    await jest.runAllTimersAsync();
    const changes = await promise;

    expect(changes).toBe(5);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it('retries up to maxAttempts', async () => {
    const db = createMockDB();
    db.execute.mockResolvedValue(noChangesResult());

    const promise = executeSync(db as any, logger, {
      maxAttempts: 4,
      attemptDelay: 1000,
    });
    await jest.runAllTimersAsync();
    const changes = await promise;

    expect(changes).toBe(0);
    expect(db.execute).toHaveBeenCalledTimes(4);
  });

  it('custom maxAttempts honored', async () => {
    const db = createMockDB();
    db.execute.mockResolvedValue(noChangesResult());

    const promise = executeSync(db as any, logger, {
      maxAttempts: 2,
      attemptDelay: 1000,
    });
    await jest.runAllTimersAsync();
    const changes = await promise;

    expect(changes).toBe(0);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it('uses transaction when useTransaction=true', async () => {
    const db = createMockDB();
    const txExecute = jest.fn().mockResolvedValue(syncResult(2));
    db.transaction.mockImplementation(async (fn: any) => {
      const tx = { execute: txExecute };
      await fn(tx);
      return tx;
    });

    const promise = executeSync(db as any, logger, {
      useTransaction: true,
      maxAttempts: 1,
    });
    await jest.runAllTimersAsync();
    const changes = await promise;

    expect(changes).toBe(2);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(txExecute).toHaveBeenCalledWith('SELECT cloudsync_network_sync();');
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('no transaction when useTransaction=false (default)', async () => {
    const db = createMockDB();
    db.execute.mockResolvedValue(syncResult(1));

    const promise = executeSync(db as any, logger, { maxAttempts: 1 });
    await jest.runAllTimersAsync();
    const changes = await promise;

    expect(changes).toBe(1);
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('handles malformed JSON gracefully (returns 0)', async () => {
    const db = createMockDB();
    db.execute.mockResolvedValue({
      rows: [{ 'cloudsync_network_sync()': 'not-valid-json' }],
    });

    const promise = executeSync(db as any, logger, { maxAttempts: 1 });
    await jest.runAllTimersAsync();
    const changes = await promise;

    expect(changes).toBe(0);
  });

  it('handles missing rows (returns 0)', async () => {
    const db = createMockDB();
    db.execute.mockResolvedValue({ rows: [] });

    const promise = executeSync(db as any, logger, { maxAttempts: 1 });
    await jest.runAllTimersAsync();
    const changes = await promise;

    expect(changes).toBe(0);
  });

  it('handles non-string values (returns 0)', async () => {
    const db = createMockDB();
    db.execute.mockResolvedValue({
      rows: [{ 'cloudsync_network_sync()': 42 }],
    });

    const promise = executeSync(db as any, logger, { maxAttempts: 1 });
    await jest.runAllTimersAsync();
    const changes = await promise;

    expect(changes).toBe(0);
  });

  it('delays between attempts', async () => {
    const db = createMockDB();
    db.execute.mockResolvedValue(noChangesResult());

    const promise = executeSync(db as any, logger, {
      maxAttempts: 3,
      attemptDelay: 2000,
    });

    // First attempt runs immediately
    await jest.advanceTimersByTimeAsync(0);
    expect(db.execute).toHaveBeenCalledTimes(1);

    // After 2000ms delay, second attempt
    await jest.advanceTimersByTimeAsync(2000);
    expect(db.execute).toHaveBeenCalledTimes(2);

    // After another 2000ms delay, third attempt
    await jest.advanceTimersByTimeAsync(2000);
    expect(db.execute).toHaveBeenCalledTimes(3);

    await promise;
  });
});

describe('Native retry', () => {
  it('passes params to cloudsync_network_sync', async () => {
    const db = createMockDB();
    db.execute.mockResolvedValue(noChangesResult());

    const promise = executeSync(db as any, logger, {
      useNativeRetry: true,
      maxAttempts: 5,
      attemptDelay: 2000,
    });
    await jest.runAllTimersAsync();
    await promise;

    expect(db.execute).toHaveBeenCalledWith(
      'SELECT cloudsync_network_sync(?, ?);',
      [2000, 5]
    );
  });

  it('returns changes from result', async () => {
    const db = createMockDB();
    db.execute.mockResolvedValue(syncResult(7));

    const promise = executeSync(db as any, logger, { useNativeRetry: true });
    await jest.runAllTimersAsync();
    const changes = await promise;

    expect(changes).toBe(7);
  });

  it('returns 0 for empty result', async () => {
    const db = createMockDB();
    db.execute.mockResolvedValue({ rows: [] });

    const promise = executeSync(db as any, logger, { useNativeRetry: true });
    await jest.runAllTimersAsync();
    const changes = await promise;

    expect(changes).toBe(0);
  });
});
