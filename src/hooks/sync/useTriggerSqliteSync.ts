import { useContext } from 'react';
import { SQLiteSyncActionsContext } from '../../SQLiteSyncActionsContext';

/**
 * Convenience hook to trigger a manual sync operation.
 *
 * This hook wraps the functionality exposed by split contexts.
 * The actual sync logic lives in the Provider to ensure that
 * `isSyncing`, `lastSyncTime`, and `lastSyncChanges` state are
 * updated correctly, allowing all hooks (useSqliteSyncQuery)
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
  const { triggerSync } = useContext(SQLiteSyncActionsContext);

  return { triggerSync };
}
