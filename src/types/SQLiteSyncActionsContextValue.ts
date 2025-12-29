/**
 * Sync actions context value - never changes (stable function references)
 */
export interface SQLiteSyncActionsContextValue {
  /**
   * Manually trigger a sync operation
   * This function updates isSyncing, lastSyncTime, and lastSyncChanges
   * so all hooks (useSqliteSyncQuery) react properly
   */
  triggerSync: () => Promise<void>;
}
