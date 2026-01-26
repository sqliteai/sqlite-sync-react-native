/**
 * Simple logger utility that respects the debug flag
 * Only logs when debug mode is enabled, except for errors which always log
 */

const PREFIX = '[SQLiteSync]';

const getTimestamp = () => new Date().toISOString();

export const createLogger = (debug: boolean = false) => ({
  /**
   * Log informational messages (only in debug mode)
   */
  info: (...args: any[]) => {
    if (debug) {
      console.log(getTimestamp(), PREFIX, ...args);
    }
  },

  /**
   * Log warning messages (only in debug mode)
   */
  warn: (...args: any[]) => {
    if (debug) {
      console.warn(getTimestamp(), PREFIX, ...args);
    }
  },

  /**
   * Log error messages (always logged, regardless of debug mode)
   */
  error: (...args: any[]) => {
    console.error(getTimestamp(), PREFIX, ...args);
  },
});

export type Logger = ReturnType<typeof createLogger>;
