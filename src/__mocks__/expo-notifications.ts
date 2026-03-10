export const getPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
export const requestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
export const getExpoPushTokenAsync = jest.fn().mockResolvedValue({ data: 'ExponentPushToken[mock]' });
export const getDevicePushTokenAsync = jest.fn().mockResolvedValue({ data: 'mock-device-token' });
export const addNotificationReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
export const registerTaskAsync = jest.fn().mockResolvedValue(undefined);
export const unregisterTaskAsync = jest.fn().mockResolvedValue(undefined);
