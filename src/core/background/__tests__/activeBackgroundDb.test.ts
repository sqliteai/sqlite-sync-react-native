import {
  setActiveBackgroundDb,
  consumeActiveBackgroundDb,
  clearActiveBackgroundDb,
} from '../activeBackgroundDb';
import type { DB } from '@op-engineering/op-sqlite';

const mockDb = {
  execute: jest.fn(),
  close: jest.fn(),
  updateHook: jest.fn(),
} as unknown as DB;

describe('activeBackgroundDb', () => {
  beforeEach(() => {
    // Ensure clean state before each test
    consumeActiveBackgroundDb();
  });

  it('setActiveBackgroundDb makes connection available via consume', () => {
    setActiveBackgroundDb(mockDb);
    expect(consumeActiveBackgroundDb()).toBe(mockDb);
  });

  it('consumeActiveBackgroundDb clears the reference', () => {
    setActiveBackgroundDb(mockDb);
    consumeActiveBackgroundDb();
    expect(consumeActiveBackgroundDb()).toBeNull();
  });

  it('consumeActiveBackgroundDb returns null when nothing was set', () => {
    expect(consumeActiveBackgroundDb()).toBeNull();
  });

  it('clearActiveBackgroundDb clears the reference without returning it', () => {
    setActiveBackgroundDb(mockDb);
    clearActiveBackgroundDb();
    expect(consumeActiveBackgroundDb()).toBeNull();
  });
});
