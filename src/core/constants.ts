/**
 * Foreground debounce time in milliseconds
 * Prevents rapid foreground transitions from triggering excessive syncs (2 seconds)
 */
export const FOREGROUND_DEBOUNCE_MS = 2000;

/**
 * Task name for background notification handling.
 * Exported for use in registration functions.
 */
export const BACKGROUND_SYNC_TASK_NAME = 'SQLITE_SYNC_BACKGROUND_TASK';
