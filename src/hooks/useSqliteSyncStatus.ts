import { useContext } from 'react';
import { SQLiteSyncStatusContext } from '../SQLiteSyncStatusContext';

/**
 * Hook to access sync status information.
 *
 * This hook subscribes to frequently-changing sync state (isSyncing, lastSyncTime, etc.).
 * Use this when you need to display sync status in your UI.
 *
 * @returns Object containing sync status properties
 *
 * @example
 * ```typescript
 * function SyncStatus() {
 *   const { isSyncing, lastSyncTime, syncError } = useSqliteSyncStatus();
 *
 *   return (
 *     <View>
 *       <Text>{isSyncing ? 'Syncing...' : 'Idle'}</Text>
 *       {lastSyncTime && (
 *         <Text>Last sync: {new Date(lastSyncTime).toLocaleTimeString()}</Text>
 *       )}
 *       {syncError && <Text>Error: {syncError.message}</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
export function useSqliteSyncStatus() {
  return useContext(SQLiteSyncStatusContext);
}
