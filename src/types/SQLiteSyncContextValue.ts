/**
 * The context value provided by SQLiteSyncProvider
 * */
export interface SQLiteSyncContextValue {
  /**
   * Whether the provider is initialized
   */
  isInitialized: boolean;

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
   * Error if any occurred during initialization or sync
   */
  error: Error | null;

  /**
   * Database instance for manual operations
   */
  db: any | null;
}
