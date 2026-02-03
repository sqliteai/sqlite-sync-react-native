/**
 * Simple logger utility that respects the debug flag
 * Only logs when debug mode is enabled, except for errors which always log
 */

/** CONSTANTS */
const PREFIX = '[SQLiteSync]';

/** HELPERS */
const getTimestamp = () => new Date().toISOString();

/**
 * Create a logger instance with debug mode control
 *
 * @param debug - Enable debug logging (info/warn messages)
 * @returns Logger instance with info, warn, and error methods
 */
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

/** TYPE EXPORT */
export type Logger = ReturnType<typeof createLogger>;
