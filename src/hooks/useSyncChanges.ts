import { useContext, useEffect } from 'react';
import { SQLiteSyncContext } from '../SQLiteSyncContext';

/**
 * Hook that executes a callback when changes are received from sync
 *
 * @param callback - Function to call when sync completes with changes
 */
export function useSyncChanges(callback: () => void) {
  const { lastSyncTime, lastSyncChanges, isInitialized } =
    useContext(SQLiteSyncContext);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (lastSyncTime === null || lastSyncChanges > 0) {
      callback();
    }
  }, [lastSyncTime, lastSyncChanges, isInitialized, callback]);
}
