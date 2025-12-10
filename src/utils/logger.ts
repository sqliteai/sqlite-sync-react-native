/**
 * Simple logger utility that respects the debug flag
 * Only logs when debug mode is enabled, except for errors which always log
 */

const PREFIX = '[SQLiteSync]';

export const createLogger = (debug: boolean = false) => ({
  /**
   * Log informational messages (only in debug mode)
   */
  info: (...args: any[]) => {
    if (debug) {
      console.log(PREFIX, ...args);
    }
  },

  /**
   * Log warning messages (only in debug mode)
   */
  warn: (...args: any[]) => {
    if (debug) {
      console.warn(PREFIX, ...args);
    }
  },

  /**
   * Log error messages (always logged, regardless of debug mode)
   */
  error: (...args: any[]) => {
    console.error(PREFIX, ...args);
  },
});

export type Logger = ReturnType<typeof createLogger>;
