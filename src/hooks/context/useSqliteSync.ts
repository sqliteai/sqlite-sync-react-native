import { useContext } from 'react';
import { SQLiteDbContext } from '../../SQLiteDbContext';
import { SQLiteSyncStatusContext } from '../../SQLiteSyncStatusContext';
import { SQLiteSyncActionsContext } from '../../SQLiteSyncActionsContext';

/**
 * Hook to access all SQLite sync functionality.
 *
 * This is a convenience hook that combines all three contexts.
 * Use this when you need access to multiple sync properties.
 *
 * Note: This hook will re-render on every sync operation since it subscribes
 * to the sync status context. If you only need db/initError, use useSqliteDb()
 * instead to avoid unnecessary re-renders.
 *
 * @returns Object containing all sync properties and actions
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const {
 *     db,
 *     initError,
 *     isSyncing,
 *     lastSyncTime,
 *     triggerSync
 *   } = useSqliteSync();
 *
 *   return (
 *     <View>
 *       <Text>Database: {db ? 'Ready' : 'Loading'}</Text>
 *       <Button onPress={triggerSync} disabled={isSyncing} />
 *     </View>
 *   );
 * }
 * ```
 */
export function useSqliteSync() {
  const dbContext = useContext(SQLiteDbContext);
  const statusContext = useContext(SQLiteSyncStatusContext);
  const actionsContext = useContext(SQLiteSyncActionsContext);

  return {
    ...dbContext,
    ...statusContext,
    ...actionsContext,
  };
}
