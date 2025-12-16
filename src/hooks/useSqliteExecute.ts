import { useContext, useState, useCallback } from 'react';
import type { QueryResult } from '@op-engineering/op-sqlite';
import { SQLiteDbContext } from '../SQLiteDbContext';

/**
 * Hook for executing imperative SQL commands (INSERT, UPDATE, DELETE).
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
 * const handleSave = async () => {
 *   try {
 *     await execute('INSERT INTO todos (text) VALUES (?)', ['New Item']);
 *     navigation.goBack();
 *   } catch (e) {
 *     Alert.alert('Error', 'Could not save todo');
 *   }
 * };
 * ```
 */
export function useSqliteExecute() {
  const { db } = useContext(SQLiteDbContext);

  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Executes a SQL command against the local database.
   *
   * @param sql - The SQL statement to execute
   * @param params - Optional array of parameters to bind to the query
   * @returns Promise resolving to the QueryResult (rowsAffected, insertId, etc.)
   * @throws Error if execution fails (allows for try/catch in UI handler)
   */
  const execute = useCallback(
    async (
      sql: string,
      params: any[] = []
    ): Promise<QueryResult | undefined> => {
      // Safety check: if DB isn't ready, we throw.
      // Usually buttons should be disabled if app is initializing, but this protects logic.
      if (!db) {
        console.warn('[useSqliteExecute] Database is not open yet.');
        return undefined;
      }

      setIsExecuting(true);
      setError(null);

      try {
        // We await the result. SQLite (via op-sqlite) handles the serialization
        // of concurrent writes thanks to WAL mode.
        const result = await db.execute(sql, params);
        return result;
      } catch (err) {
        const errorObj =
          err instanceof Error ? err : new Error('Execution failed');

        // Update local state for UI rendering
        setError(errorObj);

        // Re-throw the error so the caller can handle it (e.g. show Alert/Toast)
        throw errorObj;
      } finally {
        setIsExecuting(false);
      }
    },
    [db]
  );

  return {
    execute,
    isExecuting,
    error,
  };
}
