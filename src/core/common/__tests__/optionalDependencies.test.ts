export {};

/** Helper: mock all expo modules as available */
const mockAllPresent = () => {
  jest.doMock('expo-notifications', () => ({
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    registerTaskAsync: jest.fn(),
  }));
  jest.doMock('expo-task-manager', () => ({
    defineTask: jest.fn(),
  }));
  jest.doMock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
  }));
  jest.doMock('expo-constants', () => ({
    default: { expoConfig: {} },
  }));
  jest.doMock('expo-application', () => ({
    getIosIdForVendorAsync: jest.fn(),
    getAndroidId: jest.fn(),
  }));
};

describe('optionalDependencies', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('ExpoNotifications is set when available', () => {
    jest.isolateModules(() => {
      mockAllPresent();
      const deps = require('../optionalDependencies');
      expect(deps.ExpoNotifications).not.toBeNull();
    });
  });

  it('ExpoNotifications is null when not installed', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-notifications', () => {
        throw new Error('Module not found');
      });
      jest.doMock('expo-task-manager', () => ({ defineTask: jest.fn() }));
      jest.doMock('expo-secure-store', () => ({ getItemAsync: jest.fn() }));
      jest.doMock('expo-constants', () => ({ default: {} }));
      jest.doMock('expo-application', () => ({ getAndroidId: jest.fn() }));
      const deps = require('../optionalDependencies');
      expect(deps.ExpoNotifications).toBeNull();
    });
  });

  it('ExpoTaskManager is set when available', () => {
    jest.isolateModules(() => {
      mockAllPresent();
      const deps = require('../optionalDependencies');
      expect(deps.ExpoTaskManager).not.toBeNull();
    });
  });

  it('ExpoTaskManager is null when not installed', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-notifications', () => ({
        registerTaskAsync: jest.fn(),
      }));
      jest.doMock('expo-task-manager', () => {
        throw new Error('Module not found');
      });
      jest.doMock('expo-secure-store', () => ({ getItemAsync: jest.fn() }));
      jest.doMock('expo-constants', () => ({ default: {} }));
      jest.doMock('expo-application', () => ({ getAndroidId: jest.fn() }));
      const deps = require('../optionalDependencies');
      expect(deps.ExpoTaskManager).toBeNull();
    });
  });

  it('ExpoSecureStore is set when available', () => {
    jest.isolateModules(() => {
      mockAllPresent();
      const deps = require('../optionalDependencies');
      expect(deps.ExpoSecureStore).not.toBeNull();
    });
  });

  it('ExpoConstants uses .default if present', () => {
    jest.isolateModules(() => {
      const mockDefault = { expoConfig: { name: 'test' } };
      jest.doMock('expo-notifications', () => ({
        registerTaskAsync: jest.fn(),
      }));
      jest.doMock('expo-task-manager', () => ({ defineTask: jest.fn() }));
      jest.doMock('expo-secure-store', () => ({ getItemAsync: jest.fn() }));
      jest.doMock('expo-constants', () => ({
        default: mockDefault,
        other: 'stuff',
      }));
      jest.doMock('expo-application', () => ({ getAndroidId: jest.fn() }));
      const deps = require('../optionalDependencies');
      expect(deps.ExpoConstants).toBe(mockDefault);
    });
  });

  it('ExpoConstants uses module directly if no default', () => {
    jest.isolateModules(() => {
      const mockModule = { expoConfig: { name: 'test' } };
      jest.doMock('expo-notifications', () => ({
        registerTaskAsync: jest.fn(),
      }));
      jest.doMock('expo-task-manager', () => ({ defineTask: jest.fn() }));
      jest.doMock('expo-secure-store', () => ({ getItemAsync: jest.fn() }));
      jest.doMock('expo-constants', () => mockModule);
      jest.doMock('expo-application', () => ({ getAndroidId: jest.fn() }));
      const deps = require('../optionalDependencies');
      expect(deps.ExpoConstants).toBe(mockModule);
    });
  });

  it('ExpoApplication is set when available', () => {
    jest.isolateModules(() => {
      mockAllPresent();
      const deps = require('../optionalDependencies');
      expect(deps.ExpoApplication).not.toBeNull();
    });
  });

  it('isBackgroundSyncAvailable returns true when all 3 present', () => {
    jest.isolateModules(() => {
      mockAllPresent();
      const deps = require('../optionalDependencies');
      expect(deps.isBackgroundSyncAvailable()).toBe(true);
    });
  });

  it('isBackgroundSyncAvailable returns false when any missing', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-notifications', () => {
        throw new Error('not found');
      });
      jest.doMock('expo-task-manager', () => ({ defineTask: jest.fn() }));
      jest.doMock('expo-secure-store', () => ({ getItemAsync: jest.fn() }));
      jest.doMock('expo-constants', () => ({ default: {} }));
      jest.doMock('expo-application', () => ({ getAndroidId: jest.fn() }));
      const deps = require('../optionalDependencies');
      expect(deps.isBackgroundSyncAvailable()).toBe(false);
    });
  });
});
