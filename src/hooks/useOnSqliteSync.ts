import { useContext, useEffect, useRef } from 'react';
import { SQLiteSyncContext } from '../SQLiteSyncContext';

/**
 * Hook that executes a callback ONLY when a sync completes with changes.
 *
 * This is an event listener pattern - it does NOT run on initial mount.
 * Perfect for UI notifications (toasts, badges) or side effects that should
 * only occur when cloud data arrives.
 *
 * For initial data loading, use a separate useEffect or useSqliteSyncQuery.
 *
 * @param callback - Function to call when sync completes with changes
 *
 * @example
 * ```typescript
 *
 * useEffect(() => {
 *   if (db) loadData();
 * }, [db]);
 *
 * useOnSqliteSync(() => {
 *   Toast.show('New data synced!');
 *   loadData();
 * });
 * ```
 */
export function useOnSqliteSync(callback: () => void) {
  const { lastSyncTime, lastSyncChanges } = useContext(SQLiteSyncContext);

  // Store callback in ref to allow inline functions without causing infinite loops
  const savedCallback = useRef(callback);

  // 1. Callback Sync Effect
  // Updates the ref whenever the callback changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // 2. Sync Event Listener Effect
  // Fires ONLY when a sync completes and brings new changes
  useEffect(() => {
    if (lastSyncTime !== null && lastSyncChanges > 0) {
      savedCallback.current();
    }
  }, [lastSyncTime, lastSyncChanges]);
}
