import type { UpdateHookOperation } from '@op-engineering/op-sqlite';

/**
 * Row-level update event data from op-sqlite's updateHook
 *
 * Provides details about individual row changes (INSERT, UPDATE, DELETE)
 * for fine-grained change tracking and notifications.
 *
 * The hook automatically queries for the row data using SQLite's internal rowid,
 * so you receive the complete row object in the callback.
 *
 * @template T - The type of the row data
 */
export interface TableUpdateData<T = any> {
  /**
   * The table that was modified
   */
  table: string;

  /**
   * The type of operation that occurred
   *
   * Possible values:
   * - `'DELETE'` - Row was deleted
   * - `'INSERT'` - Row was inserted
   * - `'UPDATE'` - Row was updated
   */
  operation: UpdateHookOperation;

  /**
   * SQLite's internal rowid (NOT your table's primary key)
   */
  rowId: number;

  /**
   * The row data retrieved from the database
   *
   * The hook automatically queries the database to fetch the row data.
   * For DELETE operations, this will be `null` since the row no longer exists.
   */
  row: T | null;
}

/**
 * Configuration for row-level table update listeners
 *
 * Used by `useOnTableUpdate` to subscribe to individual row changes
 * on specific tables for notifications, cache invalidation, and analytics.
 *
 * @template T - The type of the row data
 */
export interface TableUpdateConfig<T = any> {
  /**
   * List of table names to monitor for changes
   */
  tables: string[];

  /**
   * Callback function executed when a monitored table is updated
   *
   * Receives detailed information about the row-level change
   * including the operation type (INSERT/UPDATE/DELETE) and row ID
   *
   * @param data - Row update event data
   *
   * @example
   * ```typescript
   * onUpdate: (data) => {
   *   if (data.operation === 18) {
   *     Toast.show(`New ${data.table} added!`);
   *   }
   * }
   * ```
   */
  onUpdate: (data: TableUpdateData<T>) => void;
}
