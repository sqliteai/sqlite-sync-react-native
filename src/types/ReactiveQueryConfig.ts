/**
 * Configuration for reactive queries with table-level granularity
 *
 * Used by `useSqliteSyncQuery` to define which tables to monitor for changes.
 * Reactive queries automatically re-execute when any of the specified tables are modified.
 */
export interface ReactiveQueryConfig {
  /**
   * The SQL query to execute
   */
  query: string;

  /**
   * Query parameters/arguments (optional)
   */
  arguments?: any[];

  /**
   * Tables to monitor for changes
   */
  fireOn: Array<{
    /** Table name to monitor */
    table: string;
    /** Optional: specific operation to monitor (INSERT, UPDATE, or DELETE) */
    operation?: 'INSERT' | 'UPDATE' | 'DELETE';
  }>;
}
