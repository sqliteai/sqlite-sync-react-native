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

/**
 * CloudSync staging server base URL
 */
export const CLOUDSYNC_BASE_URL = 'https://cloudsync-staging-testing.fly.dev';

/**
 * Environment variable names for overriding the native CloudSync base URL.
 * When unset, the library uses cloudsync_network_init(databaseId).
 * When set, the library uses cloudsync_network_init_custom(baseUrl, databaseId).
 */
export const CLOUDSYNC_BASE_URL_OVERRIDE_ENV_VAR =
  'SQLITE_SYNC_CLOUDSYNC_BASE_URL';
export const CLOUDSYNC_BASE_URL_OVERRIDE_EXPO_ENV_VAR =
  'EXPO_PUBLIC_SQLITE_SYNC_CLOUDSYNC_BASE_URL';

export function getCloudSyncBaseUrlOverride(): string | null {
  if (typeof process === 'undefined' || !process.env) {
    return null;
  }

  const value =
    process.env[CLOUDSYNC_BASE_URL_OVERRIDE_EXPO_ENV_VAR] ??
    process.env[CLOUDSYNC_BASE_URL_OVERRIDE_ENV_VAR];

  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
