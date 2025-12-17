import { createContext } from 'react';
import type { SQLiteSyncActionsContextValue } from './types/SQLiteSyncActionsContextValue';

/**
 * Default context value used before SQLiteSyncProvider initializes
 */
const defaultContextValue: SQLiteSyncActionsContextValue = {
  triggerSync: async () => {
    console.warn(
      '[SQLiteSync]',
      '⚠️ triggerSync called before SQLiteSyncProvider is mounted'
    );
  },
  subscribeToSync: () => {
    console.warn(
      '[SQLiteSync]',
      '⚠️ subscribeToSync called before SQLiteSyncProvider is mounted'
    );
    return () => {};
  },
};

/**
 * React Context for SQLite Sync Actions
 *
 * Provides access to sync actions.
 * This context never changes (stable function reference).
 */
export const SQLiteSyncActionsContext =
  createContext<SQLiteSyncActionsContextValue>(defaultContextValue);
