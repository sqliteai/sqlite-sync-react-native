import type { DB } from '@op-engineering/op-sqlite';

/**
 * Record of a single database change captured during sync
 */
export interface ChangeRecord {
  /**
   * Type of operation: INSERT, UPDATE, or DELETE
   */
  operation: 'INSERT' | 'UPDATE' | 'DELETE';

  /**
   * Name of the table that was modified
   */
  table: string;

  /**
   * The rowid of the affected row
   */
  rowId: number;
}

/**
 * Result passed to the background sync handler
 */
export interface BackgroundSyncResult {
  /**
   * Array of all changes that occurred during sync
   */
  changes: ChangeRecord[];

  /**
   * Database instance for querying the synced data
   * Note: This connection will be closed after the handler completes
   */
  db: DB;
}

/**
 * Handler function called after background sync completes
 */
export type BackgroundSyncHandler = (
  result: BackgroundSyncResult
) => Promise<void>;
