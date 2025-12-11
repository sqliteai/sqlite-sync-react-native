import type { DB } from '@op-engineering/op-sqlite';

/**
 * Database context value - rarely changes (only on init/error)
 */
export interface SQLiteDbContextValue {
  /**
   * Database instance for local operations
   * Check `db !== null` to verify database is ready
   */
  db: DB | null;

  /**
   * Initialization error (fatal - prevents database from working)
   * Occurs during database setup (platform check, database open, table creation)
   */
  initError: Error | null;
}
