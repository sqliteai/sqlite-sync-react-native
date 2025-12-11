import { useContext, useEffect, useRef } from 'react';
import { SQLiteSyncActionsContext } from '../SQLiteSyncActionsContext';

/**
 * Hook that executes a callback ONLY when a sync completes with changes.
 *
 * This is an event listener pattern - it does NOT run on initial mount.
 * Perfect for UI notifications (toasts, badges) or side effects that should
 * only occur when cloud data arrives.
 *
 * This hook uses a subscription pattern and will NOT cause re-renders when
 * sync completes. The component only re-renders if other hooks/state change.
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
  const { subscribe } = useContext(SQLiteSyncActionsContext);

  // Store callback in ref to allow inline functions without causing infinite loops
  const savedCallback = useRef(callback);

  // 1. Callback Sync Effect
  // Updates the ref whenever the callback changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // 2. Subscribe to sync events
  // This does NOT cause re-renders - it's a pure subscription
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      savedCallback.current();
    });

    return unsubscribe;
  }, [subscribe]);
}
