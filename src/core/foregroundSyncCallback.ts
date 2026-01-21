/**
 * Callback for foreground sync (uses existing DB connection).
 * Stored at module level so it persists across the app lifecycle.
 */
let foregroundSyncCallback: (() => Promise<void>) | null = null;

/**
 * Set the callback to use for foreground sync.
 * This allows the background task to use the existing DB connection when app is in foreground.
 */
export function setForegroundSyncCallback(
  callback: (() => Promise<void>) | null
): void {
  foregroundSyncCallback = callback;
}

/**
 * Get the current foreground sync callback.
 * Used internally by the background task.
 */
export function getForegroundSyncCallback(): (() => Promise<void>) | null {
  return foregroundSyncCallback;
}
