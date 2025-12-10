import { useContext, useEffect } from 'react';
import { SQLiteSyncContext } from '../SQLiteSyncContext';

/**
 * Hook that executes a callback when changes are received from sync
 *
 * @param callback - Function to call when sync completes with changes
 */
export function useOnSqliteSync(callback: () => void) {
  const { lastSyncTime, lastSyncChanges, isSyncReady } =
    useContext(SQLiteSyncContext);

  useEffect(() => {
    if (!isSyncReady) {
      return;
    }

    if (lastSyncTime === null || lastSyncChanges > 0) {
      callback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncTime, isSyncReady, callback]);
}
