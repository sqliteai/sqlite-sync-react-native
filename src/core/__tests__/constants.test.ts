import {
  FOREGROUND_DEBOUNCE_MS,
  BACKGROUND_SYNC_TASK_NAME,
} from '../constants';

describe('constants', () => {
  it('FOREGROUND_DEBOUNCE_MS is 2000', () => {
    expect(FOREGROUND_DEBOUNCE_MS).toBe(2000);
  });

  it('BACKGROUND_SYNC_TASK_NAME is a non-empty string', () => {
    expect(typeof BACKGROUND_SYNC_TASK_NAME).toBe('string');
    expect(BACKGROUND_SYNC_TASK_NAME.length).toBeGreaterThan(0);
  });
});
