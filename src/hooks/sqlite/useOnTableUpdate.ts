import { useContext, useEffect, useRef } from 'react';
import { SQLiteDbContext } from '../../contexts/SQLiteDbContext';
import type { TableUpdateConfig } from '../../types/TableUpdateConfig';

/**
 * Hook that listens for row-level updates on specified tables using op-sqlite's updateHook.
 *
 * **Always uses the WRITE connection** to ensure update hooks see sync changes immediately.
 *
 * This hook provides fine-grained, row-level notifications when data changes in specified tables.
 * Unlike reactive queries which re-run the entire query, this hook receives individual update events
 * with the complete row data automatically fetched for you.
 *
 * Key Features:
 * - **Row-level granularity**: Callback fires for each individual row change
 * - **Operation details**: Know exactly what operation (INSERT/UPDATE/DELETE) occurred
 * - **Automatic row fetching**: Row data is queried and provided in the callback
 * - **Lightweight**: No full query re-execution, just individual row updates
 * - **Real-time sync updates**: Automatically notified when cloud sync modifies data
 * - **Uses write connection**: Sees all changes including sync operations
 *
 * @template T - The type of the row data
 * @param config - Configuration with tables to monitor and callback function
 *
 * @example
 * ```typescript
 * interface Task {
 *   id: string;
 *   title: string;
 *   completed: boolean;
 * }
 *
 * useOnTableUpdate<Task>({
 *   tables: ['tasks'],
 *   onUpdate: (data) => {
 *     console.log(`Table ${data.table} updated`);
 *     console.log(`Operation: ${data.operation}`);
 *
 *     Row data is automatically provided and typed
 *     if (data.row) {
 *       console.log('Updated row:', data.row);
 *       Toast.show(`Task "${data.row.title}" was updated`);
 *     } else {
 *       console.log('Row was deleted');
 *     }
 *   },
 * });
 * ```
 *
 * @remarks
 *
 * The callback fires for ALL changes including:
 * - Local changes (both transaction and direct execute)
 * - Cloud sync updates (automatically wrapped in transactions)
 *
 * The hook automatically fetches row data using SQLite's internal rowid.
 * For DELETE operations, `row` will be `null` since the row no longer exists.
 */
export function useOnTableUpdate<T = any>(config: TableUpdateConfig<T>) {
  const { writeDb } = useContext(SQLiteDbContext);

  // Store callback in ref to allow inline functions without causing infinite loops
  const savedCallback = useRef(config.onUpdate);
  const savedTables = useRef(config.tables);

  // Update refs when callback or tables change
  useEffect(() => {
    savedCallback.current = config.onUpdate;
    savedTables.current = config.tables;
  }, [config.onUpdate, config.tables]);

  useEffect(() => {
    if (!writeDb) return;

    // Subscribe to update hook - fires on every row change
    writeDb.updateHook(async (hookData) => {
      // Only fire callback if the updated table is in our watch list
      if (!savedTables.current.includes(hookData.table)) {
        return;
      }

      // Fetch the row data using SQLite's internal rowid
      let row: T | null = null;

      // For DELETE operations, the row no longer exists, so row will be null
      // For INSERT and UPDATE, we can fetch the row data
      if (hookData.operation !== 'DELETE') {
        try {
          const result = await writeDb.execute(
            `SELECT * FROM ${hookData.table} WHERE rowid = ?`,
            [hookData.rowId]
          );
          row = (result.rows?.[0] as T) || null;
        } catch {
          row = null;
        }
      }

      // Call the user's callback with enriched data including the row
      savedCallback.current({
        table: hookData.table,
        operation: hookData.operation,
        rowId: hookData.rowId,
        row,
      });
    });

    // Cleanup: Remove the hook on unmount by passing null
    return () => {
      writeDb.updateHook(null);
    };
  }, [writeDb]);
}
