import { useContext } from 'react';
import { SQLiteSyncContext } from '../SQLiteSyncContext';

/**
 * Convenience hook to trigger a manual sync operation.
 *
 * This hook wraps the functionality exposed by SQLiteSyncContext.
 * The actual sync logic lives in the Provider to ensure that
 * `isSyncing`, `lastSyncTime`, and `lastSyncChanges` state are
 * updated correctly, allowing all hooks (useOnSqliteSync, useSqliteSyncQuery)
 * to react properly.
 *
 * @returns Object containing triggerSync function and current syncing state
 *
 * @example
 * ```typescript
 * const { triggerSync, isSyncing } = useTriggerSqliteSync();
 *
 * return (
 *   <Button
 *     onPress={triggerSync}
 *     disabled={isSyncing}
 *     title={isSyncing ? 'Syncing...' : 'Sync Now'}
 *   />
 * );
 * ```
 */
export function useTriggerSqliteSync() {
  const { triggerSync, isSyncing } = useContext(SQLiteSyncContext);

  return { triggerSync, isSyncing };
}
