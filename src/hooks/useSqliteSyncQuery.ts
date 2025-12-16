import { useContext, useEffect, useState, useRef, useCallback } from 'react';
import { SQLiteDbContext } from '../SQLiteDbContext';
import type { ReactiveQueryConfig } from '../types/ReactiveQueryConfig';

/**
 * Hook that executes a SQL query using op-sqlite's reactive queries for table-level granularity.
 *
 * This hook uses op-sqlite's `reactiveExecute` which automatically re-runs the query
 * when any of the specified tables change. Changes are detected at the transaction level.
 *
 * Key Features:
 * - **Table-level granularity**: Only re-runs when specified tables are modified
 * - **Transaction-based**: Updates fire only on committed transactions
 * - **Automatic sync updates**: Works seamlessly with cloud sync (sync operations use transactions)
 * - **No manual refresh needed**: Reactive queries eliminate the need for manual refresh
 *
 * @param config - Configuration object with query, arguments, and tables to monitor
 *
 * @returns Object containing data, loading state, error, and unsubscribe function
 *
 * @example
 * ```typescript
 * const { data, isLoading, error, unsubscribe } = useSqliteSyncQuery<Task>({
 *   query: 'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
 *   arguments: [userId],
 *   fireOn: [{ table: 'tasks' }],
 * });
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 *
 * Optional: Manually unsubscribe (normally handled automatically on unmount)
 * unsubscribe();
 *
 * return <TaskList tasks={data} />;
 * ```
 *
 * @remarks
 * Reactive queries only fire on transactions. When writing data:
 *
 * ```typescript
 * ✅ This will trigger reactive queries
 * await db.transaction(async (tx) => {
 *   await tx.execute('INSERT INTO tasks (id, title) VALUES (?, ?);', [id, title]);
 * });
 *
 * ❌ This will NOT trigger reactive queries
 * await db.execute('INSERT INTO tasks (id, title) VALUES (?, ?);', [id, title]);
 * ```
 *
 * The library automatically wraps sync operations in transactions, so reactive queries
 * will fire when cloud changes arrive.
 */
export function useSqliteSyncQuery<T = any>(config: ReactiveQueryConfig) {
  const { db } = useContext(SQLiteDbContext);

  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  const serializedArgs = JSON.stringify(config.arguments);
  const serializedFireOn = JSON.stringify(config.fireOn);

  useEffect(() => {
    if (!db) return;

    setIsLoading(true);
    setError(null);

    db.execute(config.query, config.arguments || [])
      .then((result) => {
        setData((result.rows || []) as T[]);
        setIsLoading(false);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error('Query failed'));
        setIsLoading(false);
      });

    const unsubscribe = db.reactiveExecute({
      query: config.query,
      arguments: config.arguments || [],
      fireOn: config.fireOn,
      callback: (result) => {
        setData((result.rows || []) as T[]);
      },
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
      unsubscribeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, config.query, serializedArgs, serializedFireOn]);

  const unsubscribe = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  return {
    data,
    isLoading,
    error,
    unsubscribe,
  };
}
