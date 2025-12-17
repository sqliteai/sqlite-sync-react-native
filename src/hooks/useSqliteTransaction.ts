import { useContext, useState, useCallback } from 'react';
import type { Transaction } from '@op-engineering/op-sqlite';
import { SQLiteDbContext } from '../SQLiteDbContext';

/**
 * Hook for executing database transactions.
 *
 * Transactions are essential for:
 * - Ensuring multiple operations succeed or fail together (atomicity)
 * - Triggering reactive queries (only fire on committed transactions)
 * - Better performance for bulk operations
 *
 * **Important:** Reactive queries (useSqliteSyncQuery) only update when transactions commit.
 * Always use transactions for write operations to ensure reactive queries update.
 *
 * @returns Object containing the transaction function and execution state
 *
 * @example
 * ```typescript
 * const { executeTransaction, isExecuting, error } = useSqliteTransaction();
 *
 * const handleSave = async () => {
 *   try {
 *     await executeTransaction(async (tx) => {
 *       await tx.execute('INSERT INTO todos (id, text) VALUES (?, ?)', [id, 'New Item']);
 *       await tx.execute('UPDATE counters SET count = count + 1 WHERE type = ?', ['todos']);
 *     });
 *     navigation.goBack();
 *   } catch (e) {
 *     Alert.alert('Error', 'Could not save todo');
 *   }
 * };
 * ```
 */
export function useSqliteTransaction() {
  const { writeDb } = useContext(SQLiteDbContext);

  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Executes a transaction against the local database.
   *
   * @param callback - Async function that receives the transaction object
   *
   * @returns Promise resolving when transaction commits
   *
   * @throws Error if transaction fails (allows for try/catch in UI handler)
   */
  const executeTransaction = useCallback(
    async (callback: (tx: Transaction) => Promise<void>): Promise<void> => {
      if (!writeDb) {
        throw new Error('Database not initialized');
      }

      setIsExecuting(true);
      setError(null);

      try {
        await writeDb.transaction(callback);
      } catch (err) {
        const errorObj =
          err instanceof Error ? err : new Error('Transaction failed');

        setError(errorObj);

        throw errorObj;
      } finally {
        setIsExecuting(false);
      }
    },
    [writeDb]
  );

  return {
    executeTransaction,
    isExecuting,
    error,
  };
}
