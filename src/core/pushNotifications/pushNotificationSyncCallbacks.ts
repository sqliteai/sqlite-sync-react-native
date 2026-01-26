import type { BackgroundSyncCallback } from '../../types/BackgroundSyncCallback';

/**
 * Callback called after background sync completes with change details.
 * Stored at module level so it persists across the app lifecycle.
 */
let backgroundSyncCallback: BackgroundSyncCallback | null = null;

/**
 * Callback for foreground sync (uses existing DB connection).
 * Stored at module level so it persists across the app lifecycle.
 */
let foregroundSyncCallback: (() => Promise<void>) | null = null;

/**
 * Register a callback to be called after background sync completes.
 * The callback receives details about what changed during sync.
 *
 * IMPORTANT: This must be called at the module level (outside any component)
 * to work when the app is terminated.
 *
 * @example
 * ```typescript
 * // In App.tsx (top level, outside component)
 * import { registerBackgroundSyncCallback } from '@sqlitecloud/sqlite-sync-react-native';
 * import * as Notifications from 'expo-notifications';
 *
 * registerBackgroundSyncCallback(async ({ changes, db }) => {
 *   const newTaskIds = changes
 *     .filter(c => c.table === 'tasks' && c.operation === 'INSERT')
 *     .map(c => c.rowId);
 *
 *   if (newTaskIds.length > 0) {
 *     const result = await db.execute(
 *       `SELECT * FROM tasks WHERE rowid IN (${newTaskIds.join(',')})`
 *     );
 *
 *     await Notifications.scheduleNotificationAsync({
 *       content: {
 *         title: `${newTaskIds.length} new task(s)`,
 *         body: result.rows?.[0]?.title,
 *       },
 *       trigger: null,
 *     });
 *   }
 * });
 * ```
 */
export function registerBackgroundSyncCallback(
  callback: BackgroundSyncCallback
): void {
  backgroundSyncCallback = callback;
}

/**
 * Get the currently registered background sync callback.
 * Used internally by executeBackgroundSync.
 */
export function getBackgroundSyncCallback(): BackgroundSyncCallback | null {
  return backgroundSyncCallback;
}

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
