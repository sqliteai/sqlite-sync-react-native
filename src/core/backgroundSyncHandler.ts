import type { BackgroundSyncHandler } from '../types/BackgroundSyncHandler';

/**
 * Handler called after background sync completes with change details.
 * Stored at module level so it persists across the app lifecycle.
 */
let backgroundSyncHandler: BackgroundSyncHandler | null = null;

/**
 * Register a handler to be called after background sync completes.
 * The handler receives details about what changed during sync.
 *
 * IMPORTANT: This must be called at the module level (outside any component)
 * to work when the app is terminated.
 *
 * @example
 * ```typescript
 * In App.tsx (top level, outside component)
 * import { registerBackgroundSyncHandler } from '@sqlitecloud/sqlite-sync-react-native';
 * import * as Notifications from 'expo-notifications';
 *
 * registerBackgroundSyncHandler(async ({ changes, db }) => {
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
export function registerBackgroundSyncHandler(
  handler: BackgroundSyncHandler
): void {
  backgroundSyncHandler = handler;
}

/**
 * Get the currently registered background sync handler.
 * Used internally by runBackgroundSync.
 */
export function getBackgroundSyncHandler(): BackgroundSyncHandler | null {
  return backgroundSyncHandler;
}
