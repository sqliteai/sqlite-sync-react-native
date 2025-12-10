/**
 * Table configuration for sync
 */
export interface TableConfig {
  /**
   * Table name (must match the table name in your SQLite Cloud database)
   */
  name: string;

  /**
   * CREATE TABLE SQL statement (must include IF NOT EXISTS)
   *
   * This SQL statement is executed locally to create the table structure.
   * It must match your remote table schema exactly.
   *
   * @example
   * ```sql
   * CREATE TABLE IF NOT EXISTS users (
   *   id TEXT PRIMARY KEY,
   *   name TEXT,
   *   email TEXT UNIQUE,
   *   created_at TEXT DEFAULT CURRENT_TIMESTAMP
   * )
   * ```
   */
  createTableSql: string;
}
