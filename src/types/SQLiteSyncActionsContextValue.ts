/**
 * Sync actions context value - never changes (stable function references)
 */
export interface SQLiteSyncActionsContextValue {
  /**
   * Manually trigger a sync operation
   * This function updates isSyncing, lastSyncTime, and lastSyncChanges
   * so all hooks (useOnSqliteSync, useSqliteSyncQuery) react properly
   */
  triggerSync: () => Promise<void>;

  /**
   * Subscribe to sync events without causing re-renders
   * Returns an unsubscribe function
   * Callback is called when sync completes with changes (changes > 0)
   */
  subscribeToSync: (callback: () => void) => () => void;
}
