import type { DB } from '@op-engineering/op-sqlite';

/**
 * The context value provided by SQLiteSyncProvider
 * */
export interface SQLiteSyncContextValue {
  /**
   * Database instance for local operations
   * Check `db !== null` to verify database is ready
   */
  db: DB | null;

  /**
   * Whether sync is configured and ready
   * true = CloudSync extension loaded and network configured
   * false = Database works offline-only
   */
  isSyncReady: boolean;

  /**
   * Whether sync is currently in progress
   */
  isSyncing: boolean;

  /**
   * Last sync timestamp
   */
  lastSyncTime: number | null;

  /**
   * Number of changes synced in the last sync operation
   */
  lastSyncChanges: number;

  /**
   * Initialization error (fatal - prevents database from working)
   * Occurs during database setup (platform check, database open, table creation)
   */
  initError: Error | null;

  /**
   * Sync error (recoverable - app still works offline)
   * Occurs during sync initialization or periodic sync operations
   */
  syncError: Error | null;

  /**
   * Manually trigger a sync operation
   * This function updates isSyncing, lastSyncTime, and lastSyncChanges
   * so all hooks (useOnSqliteSync, useSqliteSyncQuery) react properly
   */
  triggerSync: () => Promise<void>;
}
