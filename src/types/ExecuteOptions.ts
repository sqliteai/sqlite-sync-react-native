/**
 * Options for executing SQL commands with connection selection
 */
export interface ExecuteOptions {
  /**
   * Whether to use the read-only connection.
   * - `false` (default): Uses writeDb - for writes and queries that need to see sync changes
   * - `true`: Uses readDb - for read-only queries
   */
  readOnly?: boolean;
}
