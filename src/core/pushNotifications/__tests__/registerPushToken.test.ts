import { registerPushToken } from '../registerPushToken';
import { createLogger } from '../../common/logger';
import {
  ExpoSecureStore,
  ExpoApplication,
} from '../../common/optionalDependencies';

jest.mock('../../common/optionalDependencies', () => ({
  ExpoSecureStore: {
    getItemAsync: jest.fn().mockResolvedValue(null),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
  },
  ExpoApplication: {
    getIosIdForVendorAsync: jest.fn().mockResolvedValue('mock-ios-vendor-id'),
    getAndroidId: jest.fn().mockReturnValue('mock-android-id'),
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  text: jest.fn().mockResolvedValue(''),
});
global.fetch = mockFetch;

const logger = createLogger(false);

const baseParams = {
  expoToken: 'ExponentPushToken[abc123]',
  databaseId: 'db_test_database_id',
  siteId: 'site-1',
  platform: 'ios',
  apiKey: 'my-api-key',
  logger,
};

describe('registerPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(''),
    });

    const { Platform } = require('react-native');
    Platform.OS = 'ios';
  });

  it('skips registration if token is already registered', async () => {
    (ExpoSecureStore!.getItemAsync as jest.Mock).mockResolvedValueOnce(
      'ExponentPushToken[abc123]'
    );

    await registerPushToken(baseParams);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends request to the correct URL', async () => {
    await registerPushToken(baseParams);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://cloudsync.sqlite.ai/v2/cloudsync/databases/db_test_database_id/notifications/tokens',
      expect.objectContaining({
        method: 'PUT',
      })
    );
  });

  it('uses accessToken in Authorization header when provided', async () => {
    await registerPushToken({
      ...baseParams,
      accessToken: 'my-access-token',
    });

    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers.Authorization).toBe('Bearer my-access-token');
  });

  it('uses apiKey in Authorization header when no accessToken', async () => {
    await registerPushToken({
      ...baseParams,
      apiKey: 'my-api-key',
    });

    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers.Authorization).toBe('Bearer my-api-key');
  });

  it('sends correct body fields', async () => {
    await registerPushToken({
      ...baseParams,
      siteId: 'site-42',
    });

    const callArgs = mockFetch.mock.calls[0][1];
    const body = JSON.parse(callArgs.body);

    expect(body).toEqual({
      expoToken: 'ExponentPushToken[abc123]',
      deviceId: 'mock-ios-vendor-id',
      siteId: 'site-42',
      platform: 'ios',
    });
  });

  it('uses iOS device ID on iOS', async () => {
    await registerPushToken(baseParams);

    expect(ExpoApplication!.getIosIdForVendorAsync).toHaveBeenCalled();
    expect(ExpoApplication!.getAndroidId).not.toHaveBeenCalled();
  });

  it('uses Android device ID on Android', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';

    await registerPushToken({ ...baseParams, platform: 'android' });

    expect(ExpoApplication!.getAndroidId).toHaveBeenCalled();
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal Server Error'),
    });

    await expect(registerPushToken(baseParams)).rejects.toThrow(
      'Failed to register push token: 500 Internal Server Error'
    );
  });

  it('persists token after successful registration', async () => {
    await registerPushToken(baseParams);

    expect(ExpoSecureStore!.setItemAsync).toHaveBeenCalledWith(
      'sqlite_sync_push_token_registered',
      'ExponentPushToken[abc123]'
    );
  });

  it('handles SecureStore read errors gracefully', async () => {
    (ExpoSecureStore!.getItemAsync as jest.Mock).mockRejectedValueOnce(
      new Error('SecureStore read failed')
    );

    await expect(registerPushToken(baseParams)).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalled();
  });

  it('handles SecureStore write errors gracefully', async () => {
    (ExpoSecureStore!.setItemAsync as jest.Mock).mockRejectedValueOnce(
      new Error('SecureStore write failed')
    );

    await expect(registerPushToken(baseParams)).resolves.toBeUndefined();
  });

  it('throws when ExpoApplication is null', async () => {
    const deps = require('../../common/optionalDependencies');
    const originalExpoApplication = deps.ExpoApplication;
    deps.ExpoApplication = null;

    try {
      await expect(registerPushToken(baseParams)).rejects.toThrow(
        'expo-application is required'
      );
    } finally {
      deps.ExpoApplication = originalExpoApplication;
    }
  });

  it('throws when neither apiKey nor accessToken is provided', async () => {
    await expect(
      registerPushToken({ ...baseParams, apiKey: undefined, accessToken: undefined })
    ).rejects.toThrow(
      'Push token registration requires either apiKey or accessToken'
    );
  });
});
