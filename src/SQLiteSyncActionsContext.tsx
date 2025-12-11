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
  subscribe: () => {
    console.warn(
      '[SQLiteSync]',
      '⚠️ subscribe called before SQLiteSyncProvider is mounted'
    );
    return () => {};
  },
};

/**
 * React Context for SQLite Sync Actions
 *
 * Provides access to sync actions (like triggerSync).
 * This context never changes (stable function reference).
 */
export const SQLiteSyncActionsContext =
  createContext<SQLiteSyncActionsContextValue>(defaultContextValue);
