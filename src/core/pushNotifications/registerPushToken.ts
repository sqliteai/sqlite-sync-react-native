import {
  ExpoSecureStore,
  ExpoApplication,
} from '../common/optionalDependencies';
import type { Logger } from '../common/logger';
import { CLOUDSYNC_BASE_URL } from '../constants';

const TOKEN_REGISTERED_KEY = 'sqlite_sync_push_token_registered';

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
  databaseId: string;
  siteId: string;
  platform: string;
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
    databaseId,
    siteId,
    platform,
    apiKey,
    accessToken,
    logger,
  } = params;

  /** CHECK IF ALREADY REGISTERED */
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

  /** PREPARE REQUEST HEADERS */
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    throw new Error(
      'Push token registration requires either apiKey or accessToken'
    );
  }

  /** PREPARE REQUEST BODY */
  const deviceId = await getDeviceId();

  const body = {
    expoToken,
    deviceId,
    siteId,
    platform,
  };

  /** SEND REGISTRATION REQUEST */
  const url = `${CLOUDSYNC_BASE_URL}/v2/cloudsync/databases/${encodeURIComponent(
    databaseId
  )}/notifications/tokens`;
  logger.info(
    '📱 Registering push token with backend...',
    url,
    JSON.stringify(body)
  );

  const response = await fetch(url, {
    method: 'PUT',
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

  /** PERSIST REGISTRATION STATUS */
  if (ExpoSecureStore) {
    try {
      await ExpoSecureStore.setItemAsync(TOKEN_REGISTERED_KEY, expoToken);
    } catch {
      // Non-critical
    }
  }
}
