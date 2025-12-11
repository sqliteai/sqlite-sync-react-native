import { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { SQLiteDbContext } from '../SQLiteDbContext';
import { SQLiteSyncActionsContext } from '../SQLiteSyncActionsContext';

/**
 * Hook that executes a SQL query and automatically re-runs it whenever a cloud sync completes.
 *
 * Offline-First: Runs immediately when the database is available, regardless of sync status.
 * This ensures data loads from the local database even when offline.
 *
 * Auto-Refresh: Re-runs the query automatically when cloud changes arrive via sync.
 * Uses a subscription pattern to avoid unnecessary re-renders - only re-renders when data changes.
 *
 * Loading States:
 * - `isLoading`: True only during initial load (when there's no data yet)
 * - `isRefreshing`: True during background updates (sync updates, manual refresh)
 *
 * @param sql - The SQL query to execute
 *
 * @returns Object containing data, loading states, error, and a manual refresh function
 *
 * @example
 * ```typescript
 * const { data, isLoading, isRefreshing, error, refresh } = useSqliteSyncQuery<Task>(
 *   'SELECT * FROM tasks ORDER BY created_at DESC'
 * );
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 *
 * return (
 *   <>
 *     {isRefreshing && <TopBarSpinner />}
 *     <TaskList tasks={data} />
 *   </>
 * );
 * ```
 */
export function useSqliteSyncQuery<T = any>(sql: string) {
  const { db } = useContext(SQLiteDbContext);
  const { subscribe } = useContext(SQLiteSyncActionsContext);

  // Default to empty array to prevent undefined errors on .map()
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedRef = useRef(false);
  const isExecutingRef = useRef(false);

  const executeQuery = useCallback(async () => {
    // Early return if DB isn't available yet
    // We do NOT check isSyncReady here because we want local data immediately (offline-first)
    if (!db) {
      return;
    }

    // Prevent concurrent executions to avoid race conditions
    if (isExecutingRef.current) {
      return;
    }

    try {
      isExecutingRef.current = true;

      // Set isLoading only on first load, isRefreshing for subsequent loads
      // This keeps content visible during background updates
      if (hasLoadedRef.current) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const result = await db.execute(sql);
      setData(result.rows as T[]);

      // Mark as loaded after first successful query
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Query failed'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      isExecutingRef.current = false;
    }
  }, [db, sql]);

  // 1. Initial Load Effect
  // Runs as soon as the DB is available (Mounts & Offline support)
  useEffect(() => {
    if (db) {
      executeQuery();
    }
  }, [db, executeQuery]);

  // 2. Sync Update Effect (Subscription Pattern)
  // Subscribes to sync events without causing re-renders
  // Only re-renders when executeQuery updates data state
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
