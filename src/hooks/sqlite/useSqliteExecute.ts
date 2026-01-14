import { useContext, useState, useCallback } from 'react';
import type { QueryResult } from '@op-engineering/op-sqlite';
import { SQLiteDbContext } from '../../contexts/SQLiteDbContext';
import type { ExecuteOptions } from '../../types/ExecuteOptions';

/**
 * Hook for executing SQL commands with configurable connection selection.
 *
 * **Connection Selection:**
 * - By default, uses the WRITE connection (sees sync changes, can write)
 * - Pass `{ readOnly: true }` to use the READ connection (read-only queries)
 *
 * Unlike useSqliteSyncQuery (which is declarative and "Last Request Wins"),
 * this hook is imperative and ensures ALL requests are processed by SQLite.
 *
 * Concurrency Strategy:
 * - "Queue/Serial": We send requests to SQLite immediately.
 * - We do NOT debounce or cancel requests. If the user clicks "Save" 3 times,
 *   we execute 3 INSERTs (SQLite handles the ACID serialization internally).
 * - For high-frequency inputs (e.g. typing), debouncing should be handled
 *   at the UI component level before calling this hook.
 *
 * @returns Object containing the execute function and execution state
 *
 * @example
 * ```typescript
 * const { execute, isExecuting, error } = useSqliteExecute();
 *
 * // Write operation (uses writeDb by default)
 * await execute('INSERT INTO todos (text) VALUES (?)', ['New Item']);
 *
 * // Read operation (explicitly use readDb)
 * await execute('SELECT * FROM todos WHERE id = ?', [id], { readOnly: true });
 * ```
 */
export function useSqliteExecute() {
  const { writeDb, readDb } = useContext(SQLiteDbContext);

  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Executes a SQL command against the local database.
   *
   * @param sql - The SQL statement to execute
   * @param params - Optional array of parameters to bind to the query
   * @param options - Optional configuration (readOnly flag)
   *
   * @returns Promise resolving to the QueryResult (rowsAffected, insertId, etc.)
   *
   * @throws Error if execution fails (allows for try/catch in UI handler)
   */
  const execute = useCallback(
    async (
      sql: string,
      params: any[] = [],
      options?: ExecuteOptions
    ): Promise<QueryResult | undefined> => {
      const db = options?.readOnly ? readDb : writeDb;

      if (!db) {
        return undefined;
      }

      setIsExecuting(true);
      setError(null);

      try {
        const result = await db.execute(sql, params);
        return result;
      } catch (err) {
        const errorObj =
          err instanceof Error ? err : new Error('Execution failed');

        setError(errorObj);

        throw errorObj;
      } finally {
        setIsExecuting(false);
      }
    },
    [writeDb, readDb]
  );

  return {
    execute,
    isExecuting,
    error,
  };
}
