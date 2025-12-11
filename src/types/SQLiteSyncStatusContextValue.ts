/**
 * Sync status context value - changes frequently (on every sync)
 */
export interface SQLiteSyncStatusContextValue {
  /**
   * Whether sync is configured and ready
   * true = CloudSync extension loaded and network configured
   * false = Database works offline-only
   */
  isSyncReady: boolean;

  /**
   * Whether sync is currently in progress
   */
  isSyncing: boolean;

  /**
   * Last sync timestamp
   */
  lastSyncTime: number | null;

  /**
   * Number of changes synced in the last sync operation
   */
  lastSyncChanges: number;

  /**
   * Sync error (recoverable - app still works offline)
   * Occurs during sync initialization or periodic sync operations
   */
  syncError: Error | null;
}
