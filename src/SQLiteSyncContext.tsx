import { createContext } from 'react';
import type { SQLiteSyncContextValue } from './types';

/**
 * Default context value used before SQLiteSyncProvider initializes
 */
const defaultContextValue: SQLiteSyncContextValue = {
  isInitialized: false,
  isSyncing: false,
  lastSyncTime: null,
  lastSyncChanges: 0,
  error: null,
  db: null,
};

/**
 * React Context for SQLite Sync
 *
 * Provides access to:
 * - isInitialized: Whether the database and sync are ready
 * - isSyncing: Whether a sync operation is currently in progress
 * - lastSyncTime: Timestamp of the last successful sync
 * - lastSyncChanges: Number of changes synced in the last operation
 * - error: Any initialization or sync errors
 * - db: Direct access to the op-sqlite database instance for custom queries
 */
export const SQLiteSyncContext =
  createContext<SQLiteSyncContextValue>(defaultContextValue);
