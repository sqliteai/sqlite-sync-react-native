import { useContext } from 'react';
import { SQLiteInternalContext } from '../../contexts/SQLiteInternalContext';
import type { Logger } from '../../utils/logger';

/**
 * Internal hook to access the configured logger
 *
 * This hook is NOT part of the public API and should only be used
 * by internal implementation hooks that need logging capabilities
 * while respecting the debug prop from SQLiteSyncProvider.
 *
 * @internal
 * @returns Logger instance
 */
export function useInternalLogger(): Logger {
  const { logger } = useContext(SQLiteInternalContext);
  return logger;
}
