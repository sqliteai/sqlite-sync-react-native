import { ExpoApplication } from '../common/optionalDependencies';
import type { Logger } from '../common/logger';
import { CLOUDSYNC_BASE_URL } from '../constants';

/**
 * Masks a secret for debug logging while keeping a small prefix/suffix visible.
 */
const maskSecret = (value: string): string => {
  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

/**
 * Resolves the platform-specific device identifier required by push token registration.
 */
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
 * Sends the token on every call to ensure the backend always has a valid token.
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

  logger.info(
    `📱 Registering device token for databaseId=${databaseId}, siteId=${siteId}, deviceId=${deviceId}`
  );

  if (accessToken) {
    logger.info(
      `🔐 Using access token for push registration: ${maskSecret(accessToken)}`
    );
  } else if (apiKey) {
    logger.info(
      `🔐 Using API key for push registration: ${maskSecret(apiKey)}`
    );
  }

  /** SEND REGISTRATION REQUEST */
  const url = `${CLOUDSYNC_BASE_URL}/v2/cloudsync/databases/${encodeURIComponent(
    databaseId
  )}/notifications/tokens`;

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
}
