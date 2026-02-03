import { useContext, useState, useCallback } from 'react';
import type { QueryResult } from '@op-engineering/op-sqlite';
import { SQLiteDbContext } from '../../contexts/SQLiteDbContext';
import { useInternalLogger } from '../../core/common/useInternalLogger';
import type { SqliteExecuteOptions } from '../../types/SqliteExecuteOptions';

/**
 * Hook for executing SQL commands with configurable connection selection.
 *
 * @returns Object containing the execute function and execution state
 *
 * @example
 * ```typescript
 * const { execute, isExecuting, error } = useSqliteExecute();
 *
 * Write operation (uses writeDb, auto-syncs by default)
 * await execute('INSERT INTO todos (text) VALUES (?)', ['New Item']);
 *
 * Read operation (explicitly use readDb)
 * await execute('SELECT * FROM todos WHERE id = ?', [id], { readOnly: true });
 *
 * Write without auto-sync (for local-only tables)
 * await execute('INSERT INTO _cache (key, value) VALUES (?, ?)', [key, val], { autoSync: false });
 * ```
 */
export function useSqliteExecute() {
  const { writeDb, readDb } = useContext(SQLiteDbContext);
  const logger = useInternalLogger();

  /** STATE */
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
      options?: SqliteExecuteOptions
    ): Promise<QueryResult | undefined> => {
      /** SELECT CONNECTION */
      const db = options?.readOnly ? readDb : writeDb;

      if (!db) {
        return undefined;
      }

      setIsExecuting(true);
      setError(null);

      try {
        /** EXECUTE SQL */
        const result = await db.execute(sql, params);

        /** AUTO-SYNC */
        // Only sync if it's a write operation and auto-sync is not explicitly disabled
        const shouldAutoSync =
          !options?.readOnly && options?.autoSync !== false;

        if (shouldAutoSync) {
          try {
            await db.execute('SELECT cloudsync_network_send_changes();');
          } catch (syncErr) {
            // Don't fail the original operation if sync fails
            // The changes are still local and will sync later
            logger.warn('⚠️ Failed to auto-sync changes:', syncErr);
          }
        }

        return result;
      } catch (err) {
        /** HANDLE ERROR */
        const errorObj =
          err instanceof Error ? err : new Error('Execution failed');

        setError(errorObj);

        throw errorObj;
      } finally {
        setIsExecuting(false);
      }
    },
    [writeDb, readDb, logger]
  );

  return {
    execute,
    isExecuting,
    error,
  };
}
