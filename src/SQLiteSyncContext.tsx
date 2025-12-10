import { createContext } from 'react';
import type { SQLiteSyncContextValue } from './types/SQLiteSyncContextValue';

/**
 * Default context value used before SQLiteSyncProvider initializes
 */
const defaultContextValue: SQLiteSyncContextValue = {
  db: null,
  isSyncReady: false,
  isSyncing: false,
  lastSyncTime: null,
  lastSyncChanges: 0,
  initError: null,
  syncError: null,
};

/**
 * React Context for SQLite Sync
 *
 * Provides access to:
 * - db: Direct access to the op-sqlite database instance (null until ready)
 * - isSyncReady: Whether CloudSync is configured and ready for syncing
 * - isSyncing: Whether a sync operation is currently in progress
 * - lastSyncTime: Timestamp of the last successful sync
 * - lastSyncChanges: Number of changes synced in the last operation
 * - initError: Fatal initialization errors (database cannot be used)
 * - syncError: Recoverable sync errors (database works offline-only)
 */
export const SQLiteSyncContext =
  createContext<SQLiteSyncContextValue>(defaultContextValue);
