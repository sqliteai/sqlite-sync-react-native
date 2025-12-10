import { createContext } from 'react';
import type { SQLiteSyncContextValue } from './types/SQLiteSyncContextValue';

/**
 * Default context value used before SQLiteSyncProvider initializes
 */
const defaultContextValue: SQLiteSyncContextValue = {
  isInitialized: false,
  isSyncing: false,
  lastSyncTime: null,
  lastSyncChanges: 0,
  initError: null,
  syncError: null,
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
 * - initError: Fatal initialization errors (prevents app from working)
 * - syncError: Recoverable sync errors (app still works offline)
 * - db: Direct access to the op-sqlite database instance for custom queries
 */
export const SQLiteSyncContext =
  createContext<SQLiteSyncContextValue>(defaultContextValue);
