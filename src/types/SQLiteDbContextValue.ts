import type { DB } from '@op-engineering/op-sqlite';

/**
 * Database context value - rarely changes (only on init/error)
 *
 * Uses separate read and write connections for optimal performance:
 * - Write connection: WAL mode + NORMAL synchronous for fast writes
 * - Read connection: query_only = true to prevent blocking during writes/sync
 */
export interface SQLiteDbContextValue {
  /**
   * Write database connection for INSERT, UPDATE, DELETE, and sync operations
   * Configured with WAL mode and NORMAL synchronous for optimal write performance
   */
  writeDb: DB | null;

  /**
   * Read database connection for SELECT queries
   * Configured with query_only = true to prevent blocking during writes
   * Use this for all read operations to avoid blocking during sync
   */
  readDb: DB | null;

  /**
   * Initialization error (fatal - prevents database from working)
   * Occurs during database setup (platform check, database open, table creation)
   */
  initError: Error | null;
}
