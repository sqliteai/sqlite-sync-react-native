import type { DB } from '@op-engineering/op-sqlite';

/**
 * Database context value - rarely changes (only on init/error)
 */
export interface SQLiteDbContextValue {
  /**
   * Write database connection
   * Used for: sync operations, reactive queries, update hooks, and write operations
   * Configured with WAL mode and NORMAL synchronous
   */
  writeDb: DB | null;

  /**
   * Read database connection
   * Used for: read-only queries that don't need to see sync changes immediately
   * Configured with WAL mode and query_only
   */
  readDb: DB | null;

  /**
   * Initialization error (fatal - prevents database from working)
   * Occurs during database setup (platform check, database open, table creation)
   */
  initError: Error | null;
}
