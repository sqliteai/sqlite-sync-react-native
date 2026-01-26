import { createContext } from 'react';
import type { Logger } from '../core/logger';
import { createLogger } from '../core/logger';

/**
 * Internal context value for SQLiteSync implementation details
 * NOT exposed to developers - used only by internal hooks
 */
export interface SQLiteInternalContextValue {
  /**
   * Logger instance respecting the debug prop from SQLiteSyncProvider
   */
  logger: Logger;
}

/**
 * Default context value used before SQLiteSyncProvider initializes
 */
const defaultContextValue: SQLiteInternalContextValue = {
  logger: createLogger(false), // Disabled logger for default context
};

/**
 * Internal React Context for SQLiteSync implementation details
 *
 * This context is NOT part of the public API and should only be used
 * by internal hooks that need access to implementation details like logging.
 *
 * @internal
 */
export const SQLiteInternalContext =
  createContext<SQLiteInternalContextValue>(defaultContextValue);
