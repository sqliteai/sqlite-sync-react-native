import type { SyncMode } from './SQLiteSyncProviderProps';

/**
 * Sync status context value - changes frequently (on every sync)
 */
export interface SQLiteSyncStatusContextValue {
  /**
   * Current sync mode ('polling' or 'push')
   * Determines how the provider checks for remote changes
   */
  syncMode: SyncMode;

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

  /**
   * Current adaptive polling interval in milliseconds
   * Shows the currently active interval based on sync activity
   */
  currentSyncInterval: number;

  /**
   * Number of consecutive syncs that found no changes
   * Used to determine when to back off polling frequency
   */
  consecutiveEmptySyncs: number;

  /**
   * Number of consecutive sync errors
   * Used for exponential backoff on failures
   */
  consecutiveSyncErrors: number;

  /**
   * Whether the app is currently in background
   * When true, polling is paused
   */
  isAppInBackground: boolean;

  /**
   * Whether network is currently available
   * Based on NetInfo connectivity state
   */
  isNetworkAvailable: boolean;
}
