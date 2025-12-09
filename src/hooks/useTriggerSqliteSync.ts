import { useContext, useCallback } from 'react';
import { SQLiteSyncContext } from '../SQLiteSyncContext';

/**
 * Hook to trigger a manual sync operation
 *
 * @returns A function to trigger sync and the current syncing state
 */
export function useTriggerSqliteSync() {
  const { db, isSyncing } = useContext(SQLiteSyncContext);

  const triggerSync = useCallback(async () => {
    if (!db || isSyncing) {
      return;
    }

    try {
      const syncResult = await db.execute('SELECT cloudsync_network_sync();');
      const firstRow = syncResult.rows?.[0];
      const result = firstRow ? Object.values(firstRow)[0] : 0;
      const changes = typeof result === 'number' ? result : 0;

      if (changes > 0) {
        console.log(`✅ Manual sync completed: ${changes} changes synced`);
      }

      return changes;
    } catch (err) {
      console.error('❌ Manual sync failed:', err);
      throw err;
    }
  }, [db, isSyncing]);

  return { triggerSync, isSyncing };
}
