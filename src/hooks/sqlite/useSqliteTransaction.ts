import { useContext, useState, useCallback } from 'react';
import type { Transaction } from '@op-engineering/op-sqlite';
import { SQLiteDbContext } from '../../contexts/SQLiteDbContext';

/**
 * Hook for executing SQL commands within a transaction.
 *
 * Important: Transactions automatically trigger reactive queries when they commit
 *
 * @returns Object containing the executeTransaction function and execution state
 *
 * @example
 * ```typescript
 * const { executeTransaction, isExecuting } = useSqliteTransaction();
 *
 * // Execute multiple writes atomically
 * await executeTransaction(async (tx) => {
 *   await tx.execute('INSERT INTO users (name) VALUES (?)', ['Alice']);
 *   await tx.execute('INSERT INTO logs (action) VALUES (?)', ['User created']);
 * });
 * ```
 */
export function useSqliteTransaction() {
  const { writeDb } = useContext(SQLiteDbContext);

  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Executes a function within a database transaction.
   *
   * @param fn - Function that receives a Transaction object and performs operations
   *
   * @returns Promise resolving to the return value of the transaction function
   *
   * @throws Error if transaction fails (allows for try/catch in UI handler)
   */
  const executeTransaction = useCallback(
    async (fn: (tx: Transaction) => Promise<void>): Promise<void> => {
      if (!writeDb) {
        return undefined;
      }

      setIsExecuting(true);
      setError(null);

      try {
        await writeDb.transaction(fn);
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
