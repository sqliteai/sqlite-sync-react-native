import { useContext, useEffect, useState, useRef } from 'react';
import { SQLiteDbContext } from '../../contexts/SQLiteDbContext';
import type { ReactiveQueryConfig } from '../../types/ReactiveQueryConfig';

/**
 * Hook that executes a SQL query using op-sqlite's reactive queries for table-level granularity.
 *
 * **Always uses the WRITE connection** to ensure reactive queries see sync changes immediately.
 *
 * This hook uses op-sqlite's `reactiveExecute` which automatically re-runs the query
 * when any of the specified tables change. Changes are detected at the transaction level.
 *
 * Key Features:
 * - **Table-level granularity**: Only re-runs when specified tables are modified
 * - **Transaction-based**: Updates fire only on committed transactions
 * - **Automatic sync updates**: Works seamlessly with cloud sync (sync operations use transactions)
 * - **No manual refresh needed**: Reactive queries eliminate the need for manual refresh
 * - **Uses write connection**: Sees all changes including sync operations
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
  const { readDb, writeDb } = useContext(SQLiteDbContext);

  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [internalSubscriptionSignature, setInternalSubscriptionSignature] =
    useState('');

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const subscriptionUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeQuerySignatureRef = useRef<string>('');

  const serializedArgs = JSON.stringify(config.arguments || []);
  const serializedFireOn = JSON.stringify(config.fireOn);
  const currentSubscriptionSignature = `${config.query}-${serializedArgs}`;

  const safeUnsubscribe = (unsubscribe: (() => void) | null) => {
    if (unsubscribe) {
      setTimeout(() => unsubscribe(), 0);
    }
  };

  // Effect 1: Immediate Async Read + Debounce Trigger
  useEffect(() => {
    if (!readDb) return;

    activeQuerySignatureRef.current = currentSubscriptionSignature;
    setIsLoading(true);

    readDb
      .execute(config.query, config.arguments || [])
      .then((result) => {
        // Only update if the user hasn't already changed the query again
        if (activeQuerySignatureRef.current === currentSubscriptionSignature) {
          setData((result.rows || []) as T[]);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (activeQuerySignatureRef.current === currentSubscriptionSignature) {
          setError(err);
          setIsLoading(false);
        }
      });

    // Schedule the reactive subscription
    if (subscriptionUpdateTimerRef.current)
      clearTimeout(subscriptionUpdateTimerRef.current);

    subscriptionUpdateTimerRef.current = setTimeout(() => {
      // Trigger Effect 2 by changing the signature
      setInternalSubscriptionSignature(currentSubscriptionSignature);
    }, 1000);

    return () => {
      if (subscriptionUpdateTimerRef.current)
        clearTimeout(subscriptionUpdateTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readDb, serializedFireOn, currentSubscriptionSignature]);

  // Effect 2: Reactive Subscription logic
  useEffect(() => {
    if (!writeDb || !internalSubscriptionSignature) return;

    // Safety: If the user changed the query during the debounce, skip
    if (internalSubscriptionSignature !== activeQuerySignatureRef.current)
      return;

    const unsubscribe = writeDb.reactiveExecute({
      query: config.query,
      arguments: config.arguments || [],
      fireOn: config.fireOn,
      callback: (result) => {
        if (activeQuerySignatureRef.current === internalSubscriptionSignature) {
          setData((result.rows || []) as T[]);
        }
      },
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      const toCleanup = unsubscribeRef.current;
      unsubscribeRef.current = null;
      safeUnsubscribe(toCleanup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writeDb, internalSubscriptionSignature]);

  return {
    data,
    isLoading,
    error,
    unsubscribe: () => safeUnsubscribe(unsubscribeRef.current),
  };
}
