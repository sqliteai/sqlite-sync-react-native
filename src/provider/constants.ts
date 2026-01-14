/**
 * Default base interval for adaptive polling (10 seconds)
 * Used when app is active and no special conditions apply
 */
export const DEFAULT_BASE_INTERVAL = 10000;

/**
 * Error backoff multiplier for exponential backoff
 * Each consecutive error multiplies the interval by this factor (2x)
 */
export const ERROR_BACKOFF_MULTIPLIER = 2;

/**
 * Foreground debounce time in milliseconds
 * Prevents rapid foreground transitions from triggering excessive syncs (2 seconds)
 */
export const FOREGROUND_DEBOUNCE_MS = 2000;
