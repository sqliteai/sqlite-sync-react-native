import { createContext } from 'react';
import type { SQLiteSyncStatusContextValue } from './types/SQLiteSyncStatusContextValue';

/**
 * Default context value used before SQLiteSyncProvider initializes
 */
const defaultContextValue: SQLiteSyncStatusContextValue = {
  isSyncReady: false,
  isSyncing: false,
  lastSyncTime: null,
  lastSyncChanges: 0,
  syncError: null,
};

/**
 * React Context for SQLite Sync Status
 *
 * Provides access to sync state that changes frequently (on every sync).
 * Components that need to display sync status should use this context.
 */
export const SQLiteSyncStatusContext =
  createContext<SQLiteSyncStatusContextValue>(defaultContextValue);
