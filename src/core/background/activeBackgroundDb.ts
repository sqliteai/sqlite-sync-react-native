import type { DB } from '@op-engineering/op-sqlite';

let _db: DB | null = null;

/**
 * Called by executeBackgroundSync before first await — sets reference synchronously
 * so the foreground can find and close it if the task is interrupted.
 */
export function setActiveBackgroundDb(db: DB): void {
  _db = db;
}

/**
 * Called by useDatabaseInitialization on startup.
 * Returns and clears the reference so the caller owns the connection.
 * Returns null if no background sync connection exists.
 */
export function consumeActiveBackgroundDb(): DB | null {
  const db = _db;
  _db = null;
  return db;
}

/** Called in background task's finally block to clear reference after normal close */
export function clearActiveBackgroundDb(): void {
  _db = null;
}
