/** SQLITE CLOUD ARTIFACT URI */
const ARTIFACT_URI = 'https://sqlite.ai';

/**
 * Check if a foreground Expo Notification is from SQLite Cloud.
 * Foreground notifications use the Expo Notification object structure:
 * `notification.request.content.data.artifactURI`
 */
export const isForegroundSqliteCloudNotification = (
  notification: any
): boolean => {
  const artifactURI = notification?.request?.content?.data?.artifactURI;
  return artifactURI === ARTIFACT_URI;
};

/**
 * Check if background/terminated task data is from SQLite Cloud.
 * Handles platform differences:
 * - iOS: `data.body` is an object with `artifactURI`
 * - Android: `data.body` or `data.dataString` is a JSON string containing `artifactURI`
 * Also checks the foreground structure as a fallback.
 */
export const isSqliteCloudNotification = (notification: any): boolean => {
  const body = notification?.data?.body;

  /** CHECK IOS BACKGROUND FORMAT */
  if (body && typeof body === 'object' && body.artifactURI === ARTIFACT_URI) {
    return true;
  }

  /** CHECK ANDROID BACKGROUND FORMAT */
  const bodyString =
    typeof body === 'string' ? body : notification?.data?.dataString;
  if (typeof bodyString === 'string') {
    try {
      const parsed = JSON.parse(bodyString);
      if (parsed?.artifactURI === ARTIFACT_URI) {
        return true;
      }
    } catch {
      // Not valid JSON
    }
  }

  /** CHECK FOREGROUND FORMAT */
  return isForegroundSqliteCloudNotification(notification);
};
