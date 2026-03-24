const CLOUDSYNC_EVENTS = new Set(['apply', 'check']);

const hasCloudSyncEvent = (data: any): boolean =>
  CLOUDSYNC_EVENTS.has(data?.cloudSyncEvent);

/**
 * Check if a foreground Expo Notification is from SQLite Cloud.
 * Foreground notifications use the Expo Notification object structure:
 * `notification.request.content.data.cloudSyncEvent`
 */
export const isForegroundSqliteCloudNotification = (
  notification: any
): boolean => {
  return hasCloudSyncEvent(notification?.request?.content?.data);
};

/**
 * Check if background/terminated task data is from SQLite Cloud.
 * Handles platform differences:
 * - iOS: `data.body` is an object with `cloudSyncEvent`
 * - Android: `data.body` or `data.dataString` is a JSON string containing `cloudSyncEvent`
 * Also checks the foreground structure as a fallback.
 */
export const isSqliteCloudNotification = (notification: any): boolean => {
  const body = notification?.data?.body;

  /** CHECK IOS BACKGROUND FORMAT */
  if (body && typeof body === 'object' && hasCloudSyncEvent(body)) {
    return true;
  }

  /** CHECK ANDROID BACKGROUND FORMAT */
  const androidPayloads = [
    typeof body === 'string' ? body : null,
    notification?.data?.dataString,
  ];

  for (const payload of androidPayloads) {
    if (typeof payload !== 'string') {
      continue;
    }

    try {
      const parsed = JSON.parse(payload);
      if (hasCloudSyncEvent(parsed)) {
        return true;
      }
    } catch {
      // Not valid JSON
    }
  }

  /** CHECK FOREGROUND FORMAT */
  return isForegroundSqliteCloudNotification(notification);
};
