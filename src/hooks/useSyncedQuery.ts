import { useContext, useEffect, useState, useCallback } from 'react';
import { SQLiteSyncContext } from '../SQLiteSyncContext';

/**
 * Hook that re-runs a query whenever sync completes with changes
 *
 * @param sql - The SQL query to execute
 *
 * @returns Query result data and loading state
 */
export function useSyncedQuery<T = any>(sql: string) {
  const { db, lastSyncTime, lastSyncChanges, isInitialized } =
    useContext(SQLiteSyncContext);
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const executeQuery = useCallback(async () => {
    if (!db || !isInitialized) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const result = await db.execute(sql);
      setData(result.rows as T[]);
    } catch (err) {
      console.error('Query failed:', err);
      setError(err instanceof Error ? err : new Error('Query failed'));
    } finally {
      setIsLoading(false);
    }
  }, [db, sql, isInitialized]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (lastSyncTime === null || lastSyncChanges > 0) {
      executeQuery();
    }
  }, [executeQuery, lastSyncTime, lastSyncChanges, isInitialized]);

  return { data, isLoading, error, refetch: executeQuery };
}
