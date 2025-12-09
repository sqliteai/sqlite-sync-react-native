/**
 * Table configuration for sync
 */
export interface TableConfig {
  /**
   * Table name
   */
  name: string;

  /**
   * CREATE TABLE SQL statement (including IF NOT EXISTS)
   * Example: "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT)"
   */
  schema: string;
}
