import { createContext } from 'react';
import type { SQLiteDbContextValue } from './types/SQLiteDbContextValue';

/**
 * Default context value used before SQLiteSyncProvider initializes
 */
const defaultContextValue: SQLiteDbContextValue = {
  writeDb: null,
  readDb: null,
  initError: null,
};

/**
 * React Context for SQLite Database
 *
 * Provides access to database instance and initialization errors.
 * This context rarely changes (only on init/error), so components
 * that only need db/initError won't re-render on every sync.
 */
export const SQLiteDbContext =
  createContext<SQLiteDbContextValue>(defaultContextValue);
