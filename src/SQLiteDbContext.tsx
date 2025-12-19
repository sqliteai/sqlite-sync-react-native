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
 * Provides access to write and read database connections.
 * - writeDb: For sync, reactive queries, update hooks, and writes
 * - readDb: For read-only queries
 *
 * This context rarely changes (only on init/error), so components
 * that only need database access won't re-render on every sync.
 */
export const SQLiteDbContext =
  createContext<SQLiteDbContextValue>(defaultContextValue);
