import {
  ExpoSecureStore,
  ExpoApplication,
} from '../common/optionalDependencies';
import type { Logger } from '../common/logger';

const TOKEN_REGISTERED_KEY = 'sqlite_sync_push_token_registered';
const CLOUDSYNC_BASE_URL = 'https://cloudsync-staging.fly.dev/v2';

async function getDeviceId(): Promise<string> {
  if (!ExpoApplication) {
    throw new Error(
      'expo-application is required for push notification token registration. Install it with: npx expo install expo-application'
    );
  }

  const { Platform } = require('react-native');
  if (Platform.OS === 'ios') {
    return await ExpoApplication.getIosIdForVendorAsync();
  }
  // Android
  return ExpoApplication.getAndroidId();
}

interface RegisterPushTokenParams {
  expoToken: string;
  databaseName: string;
  siteId?: string;
  platform: string;
  connectionString: string;
  apiKey?: string;
  accessToken?: string;
  logger: Logger;
}

/**
 * Register an Expo push token with the SQLite Cloud backend.
 * Only sends the token once per installation (persisted via SecureStore).
 */
export async function registerPushToken(
  params: RegisterPushTokenParams
): Promise<void> {
  const {
    expoToken,
    databaseName,
    siteId,
    platform,
    connectionString,
    apiKey,
    accessToken,
    logger,
  } = params;

  // Check if token was already registered
  if (ExpoSecureStore) {
    try {
      const registered = await ExpoSecureStore.getItemAsync(
        TOKEN_REGISTERED_KEY
      );
      if (registered === expoToken) {
        logger.info('📱 Push token already registered, skipping');
        return;
      }
    } catch {
      // Continue with registration
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (apiKey) {
    headers.Authorization = `Bearer ${connectionString}?apikey=${apiKey}`;
  }

  const deviceId = await getDeviceId();

  const body = {
    expoToken,
    deviceId,
    database: databaseName,
    siteId: siteId ?? '',
    platform,
  };

  const url = `${CLOUDSYNC_BASE_URL}/cloudsync/notifications/tokens`;
  logger.info(
    '📱 Registering push token with backend...',
    url,
    JSON.stringify(body)
  );

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Failed to register push token: ${response.status} ${text}`
    );
  }

  logger.info('📱 Push token registered successfully');

  // Persist that this token has been registered
  if (ExpoSecureStore) {
    try {
      await ExpoSecureStore.setItemAsync(TOKEN_REGISTERED_KEY, expoToken);
    } catch {
      // Non-critical
    }
  }
}
