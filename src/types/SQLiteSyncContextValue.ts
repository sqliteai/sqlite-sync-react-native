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
   * Initialization error (fatal - prevents app from working)
   * Occurs during database setup, extension loading, or network initialization
   */
  initError: Error | null;

  /**
   * Sync error (recoverable - app still works offline)
   * Occurs during periodic sync operations
   */
  syncError: Error | null;

  /**
   * Database instance for manual operations
   */
  db: any | null;
}
