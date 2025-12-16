import { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { SQLiteDbContext } from '../SQLiteDbContext';
import { SQLiteSyncActionsContext } from '../SQLiteSyncActionsContext';

/**
 * Hook that executes a SQL query and automatically re-runs it whenever a cloud sync completes.
 *
 * Offline-First Strategy:
 * - Runs immediately when the database is available.
 * - DOES NOT block concurrent executions. Instead, it uses a "Last Request Wins" strategy.
 *   If multiple queries are triggered rapidly (e.g. user typing), all are executed,
 *   but the UI only updates with the result of the most recent request.
 *
 * Auto-Refresh:
 * - Re-runs the query automatically when cloud changes arrive via sync.
 * - Uses a subscription pattern to avoid unnecessary re-renders.
 *
 * Loading States:
 * - `isLoading`: True only during initial load (when there's no data yet)
 * - `isRefreshing`: True during background updates (sync updates, manual refresh)
 *
 * @param sql - The SQL query to execute
 *
 * @returns Object containing data, loading states, error, and a manual refresh function
 */
export function useSqliteSyncQuery<T = any>(sql: string) {
  console.log('NEW useSqliteSyncQuery called with SQL:', sql);
  const { db } = useContext(SQLiteDbContext);
  const { subscribe } = useContext(SQLiteSyncActionsContext);

  // Default to empty array to prevent undefined errors on .map()
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs for concurrency management
  const lastQueryIdRef = useRef(0); // Tracks the sequence ID of the requests
  const hasLoadedRef = useRef(false); // Tracks if initial load is complete

  const executeQuery = useCallback(async () => {
    // Early return if DB isn't available yet (App startup safety)
    if (!db) {
      return;
    }

    // 1. Concurrency Management: "Last Request Wins"
    // We increment the ID for this specific execution.
    // We capture this value in a local variable (closure).
    const currentQueryId = ++lastQueryIdRef.current;

    try {
      // 2. Optimistic UI Updates
      // We don't block. We update loading state immediately.
      if (hasLoadedRef.current) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // 3. Execution
      // We let the query run. Even if previous queries are still running,
      // SQLite handles them efficiently. We don't want to drop user intent.
      const result = await db.execute(sql);

      // 4. Stale Data Protection
      // Before updating the state, we check: "Is this still the latest request?"
      // If lastQueryIdRef has incremented while we were awaiting, it means
      // a newer query started. We discard this result to prevent UI flickering with old data.
      if (currentQueryId === lastQueryIdRef.current) {
        setData(result.rows as T[]);

        if (!hasLoadedRef.current) {
          hasLoadedRef.current = true;
        }
      }
    } catch (err) {
      // Only set error if this was the latest request
      if (currentQueryId === lastQueryIdRef.current) {
        setError(err instanceof Error ? err : new Error('Query failed'));
      }
    } finally {
      // Only turn off loading if this was the latest request
      if (currentQueryId === lastQueryIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [db, sql]);

  // 1. Initial Load & SQL Change Effect
  // Runs as soon as the DB is available OR if the SQL string changes (e.g. search filter)
  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  // 2. Sync Update Effect (Subscription Pattern)
  // Subscribes to sync events without causing re-renders
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      executeQuery();
    });

    return unsubscribe;
  }, [subscribe, executeQuery]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refresh: executeQuery,
  };
}
