import {
  getPersistedConfig,
  persistConfig,
  clearPersistedConfig,
} from '../backgroundSyncConfig';
import type { BackgroundSyncConfig } from '../backgroundSyncConfig';

jest.mock('../../common/optionalDependencies', () => ({
  ExpoSecureStore: {
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
  },
}));

const { ExpoSecureStore: mockSecureStore } = jest.requireMock(
  '../../common/optionalDependencies'
) as {
  ExpoSecureStore: {
    getItemAsync: jest.Mock;
    setItemAsync: jest.Mock;
    deleteItemAsync: jest.Mock;
  };
};

const SAMPLE_CONFIG: BackgroundSyncConfig = {
  projectID: 'test-project-id',
  organizationID: 'test-organization-id',
  databaseName: 'test.db',
  tablesToBeSynced: [
    {
      name: 'users',
      createTableSql: 'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY)',
    },
  ],
  debug: false,
};

describe('backgroundSyncConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** HELPER to temporarily set ExpoSecureStore to null */
  const withNullSecureStore = async (fn: () => Promise<void>) => {
    const deps = require('../../common/optionalDependencies');
    const original = deps.ExpoSecureStore;
    deps.ExpoSecureStore = null;
    try {
      await fn();
    } finally {
      deps.ExpoSecureStore = original;
    }
  };

  describe('getPersistedConfig', () => {
    it('returns null when ExpoSecureStore is not available', async () => {
      await withNullSecureStore(async () => {
        const result = await getPersistedConfig();
        expect(result).toBeNull();
      });
    });

    it('returns null when no value is stored', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const result = await getPersistedConfig();

      expect(result).toBeNull();
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        'sqlite_sync_background_config'
      );
    });

    it('returns parsed config when stored value exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(
        JSON.stringify(SAMPLE_CONFIG)
      );

      const result = await getPersistedConfig();

      expect(result).toEqual(SAMPLE_CONFIG);
    });

    it('returns null on JSON parse error', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('not-valid-json{{{');

      const result = await getPersistedConfig();

      expect(result).toBeNull();
    });
  });

  describe('persistConfig', () => {
    it('saves config as JSON string', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      await persistConfig(SAMPLE_CONFIG);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'sqlite_sync_background_config',
        JSON.stringify(SAMPLE_CONFIG)
      );
    });

    it('warns when ExpoSecureStore is not available', async () => {
      const debugConfig = { ...SAMPLE_CONFIG, debug: true };

      await withNullSecureStore(async () => {
        await persistConfig(debugConfig);
      });

      expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });

    it('handles setItemAsync error gracefully', async () => {
      mockSecureStore.setItemAsync.mockRejectedValue(new Error('storage full'));

      await persistConfig(SAMPLE_CONFIG);

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('clearPersistedConfig', () => {
    it('deletes the stored config key', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

      await clearPersistedConfig();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'sqlite_sync_background_config'
      );
    });

    it('no-ops when ExpoSecureStore is not available', async () => {
      await withNullSecureStore(async () => {
        await clearPersistedConfig();
      });

      expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });

    it('handles deleteItemAsync error gracefully', async () => {
      mockSecureStore.deleteItemAsync.mockRejectedValue(
        new Error('delete failed')
      );

      // Should not throw
      await expect(clearPersistedConfig()).resolves.toBeUndefined();
    });
  });
});
