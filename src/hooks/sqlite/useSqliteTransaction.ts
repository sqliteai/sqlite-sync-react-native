import { useContext, useState, useCallback } from 'react';
import type { Transaction } from '@op-engineering/op-sqlite';
import { SQLiteDbContext } from '../../contexts/SQLiteDbContext';
import { useInternalLogger } from '../../core/common/useInternalLogger';

/**
 * Options for transaction execution
 */
export interface TransactionOptions {
  /**
   * Whether to automatically sync local changes to the cloud after transaction commits.
   * - `true` (default): Calls cloudsync_network_send_changes() after successful commit
   * - `false`: Skip auto-sync (useful for bulk operations or local-only tables)
   */
  autoSync?: boolean;
}

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
 * Execute multiple writes atomically (auto-syncs by default after commit)
 * await executeTransaction(async (tx) => {
 *   await tx.execute('INSERT INTO users (name) VALUES (?)', ['Alice']);
 *   await tx.execute('INSERT INTO logs (action) VALUES (?)', ['User created']);
 * });
 *
 * Bulk operation without auto-sync
 * await executeTransaction(async (tx) => {
 *   for (let i = 0; i < 1000; i++) {
 *     await tx.execute('INSERT INTO items (name) VALUES (?)', [`Item ${i}`]);
 *   }
 * }, { autoSync: false });
 * // Manually sync once after
 * await execute('SELECT cloudsync_network_send_changes();');
 * ```
 */
export function useSqliteTransaction() {
  const { writeDb } = useContext(SQLiteDbContext);
  const logger = useInternalLogger();

  /** STATE */
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Executes a function within a database transaction.
   *
   * @param fn - Function that receives a Transaction object and performs operations
   * @param options - Optional transaction configuration (autoSync)
   *
   * @returns Promise resolving to the return value of the transaction function
   *
   * @throws Error if transaction fails (allows for try/catch in UI handler)
   */
  const executeTransaction = useCallback(
    async (
      fn: (tx: Transaction) => Promise<void>,
      options?: TransactionOptions
    ): Promise<void> => {
      if (!writeDb) {
        return undefined;
      }

      setIsExecuting(true);
      setError(null);

      try {
        /** EXECUTE TRANSACTION */
        await writeDb.transaction(fn);

        /** AUTO-SYNC */
        // Only sync if auto-sync is not explicitly disabled
        const shouldAutoSync = options?.autoSync !== false;

        if (shouldAutoSync) {
          try {
            await writeDb.execute('SELECT cloudsync_network_send_changes();');
          } catch (syncErr) {
            // Don't fail the transaction if sync fails
            // The changes are still local and will sync later
            logger.warn('⚠️ Failed to auto-sync changes:', syncErr);
          }
        }
      } catch (err) {
        /** HANDLE ERROR */
        const errorObj =
          err instanceof Error ? err : new Error('Transaction failed');

        setError(errorObj);

        throw errorObj;
      } finally {
        setIsExecuting(false);
      }
    },
    [writeDb, logger]
  );

  return {
    executeTransaction,
    isExecuting,
    error,
  };
}
