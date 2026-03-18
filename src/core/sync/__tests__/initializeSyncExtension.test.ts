jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@op-engineering/op-sqlite');

import { Platform } from 'react-native';
import { getDylibPath } from '@op-engineering/op-sqlite';
import { createMockDB } from '../../../__mocks__/@op-engineering/op-sqlite';
import { createLogger } from '../../common/logger';
import {
  CLOUDSYNC_BASE_URL,
  CLOUDSYNC_BASE_URL_OVERRIDE_ENV_VAR,
} from '../../constants';
import {
  initializeSyncExtension,
  type SyncInitConfig,
} from '../initializeSyncExtension';

const logger = createLogger(false);

function makeConfig(overrides: Partial<SyncInitConfig> = {}): SyncInitConfig {
  return {
    databaseId: 'db_test_database_id',
    databaseName: 'test.db',
    tablesToBeSynced: [
      {
        name: 'users',
        createTableSql:
          'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY)',
      },
    ],
    apiKey: 'test-api-key',
    ...overrides,
  };
}

function makeMockDB(
  versionResult: any = { rows: [{ 'cloudsync_version()': '1.0.0' }] }
) {
  const db = createMockDB();
  db.execute.mockImplementation(async (sql: string) => {
    if (sql.includes('cloudsync_version')) return versionResult;
    if (sql.includes('cloudsync_init'))
      return { rows: [{ 'cloudsync_init(?)': 'site-id-123' }] };
    return { rows: [] };
  });
  return db;
}

describe('initializeSyncExtension', () => {
  const originalBaseUrlOverride =
    process.env[CLOUDSYNC_BASE_URL_OVERRIDE_ENV_VAR];

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
    delete process.env[CLOUDSYNC_BASE_URL_OVERRIDE_ENV_VAR];
  });

  afterAll(() => {
    if (originalBaseUrlOverride === undefined) {
      delete process.env[CLOUDSYNC_BASE_URL_OVERRIDE_ENV_VAR];
    } else {
      process.env[CLOUDSYNC_BASE_URL_OVERRIDE_ENV_VAR] =
        originalBaseUrlOverride;
    }
  });

  it('throws if databaseId is missing', async () => {
    const db = makeMockDB();
    const config = makeConfig({ databaseId: '' });

    await expect(
      initializeSyncExtension(db as any, config, logger)
    ).rejects.toThrow('Sync configuration incomplete');
  });

  it('throws if databaseName is missing', async () => {
    const db = makeMockDB();
    const config = makeConfig({ databaseName: '' });

    await expect(
      initializeSyncExtension(db as any, config, logger)
    ).rejects.toThrow('Sync configuration incomplete');
  });

  it('throws if neither apiKey nor accessToken is provided', async () => {
    const db = makeMockDB();
    const config = makeConfig({ apiKey: undefined, accessToken: undefined });

    await expect(
      initializeSyncExtension(db as any, config, logger)
    ).rejects.toThrow('Sync configuration incomplete');
  });

  it('uses getDylibPath for iOS extension path', async () => {
    (Platform as any).OS = 'ios';
    const db = makeMockDB();
    const config = makeConfig();

    await initializeSyncExtension(db as any, config, logger);

    expect(getDylibPath).toHaveBeenCalledWith(
      'ai.sqlite.cloudsync',
      'CloudSync'
    );
    expect(db.loadExtension).toHaveBeenCalledWith('/mock/path/CloudSync');
  });

  it('uses "cloudsync" for Android extension path', async () => {
    (Platform as any).OS = 'android';
    const db = makeMockDB();
    const config = makeConfig();

    await initializeSyncExtension(db as any, config, logger);

    expect(db.loadExtension).toHaveBeenCalledWith('cloudsync');
  });

  it('verifies extension via cloudsync_version()', async () => {
    const db = makeMockDB();
    const config = makeConfig();

    await initializeSyncExtension(db as any, config, logger);

    expect(db.execute).toHaveBeenCalledWith('SELECT cloudsync_version();');
  });

  it('throws if cloudsync_version returns empty result', async () => {
    const db = makeMockDB({ rows: [{}] });
    const config = makeConfig();

    await expect(
      initializeSyncExtension(db as any, config, logger)
    ).rejects.toThrow('CloudSync extension not loaded properly');
  });

  it('calls cloudsync_init for each table', async () => {
    const db = makeMockDB();
    const config = makeConfig({
      tablesToBeSynced: [
        {
          name: 'users',
          createTableSql:
            'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY)',
        },
        {
          name: 'posts',
          createTableSql:
            'CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY)',
        },
        {
          name: 'comments',
          createTableSql:
            'CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY)',
        },
      ],
    });

    await initializeSyncExtension(db as any, config, logger);

    expect(db.execute).toHaveBeenCalledWith('SELECT cloudsync_init(?);', [
      'users',
    ]);
    expect(db.execute).toHaveBeenCalledWith('SELECT cloudsync_init(?);', [
      'posts',
    ]);
    expect(db.execute).toHaveBeenCalledWith('SELECT cloudsync_init(?);', [
      'comments',
    ]);
  });

  it('calls cloudsync_network_init by default', async () => {
    const db = makeMockDB();
    const config = makeConfig();

    await initializeSyncExtension(db as any, config, logger);

    expect(db.execute).toHaveBeenCalledWith(
      'SELECT cloudsync_network_init(?);',
      ['db_test_database_id']
    );
  });

  it('calls cloudsync_network_init_custom when override env var is set', async () => {
    process.env[CLOUDSYNC_BASE_URL_OVERRIDE_ENV_VAR] = CLOUDSYNC_BASE_URL;

    const db = makeMockDB();
    const config = makeConfig();

    await initializeSyncExtension(db as any, config, logger);

    expect(db.execute).toHaveBeenCalledWith(
      'SELECT cloudsync_network_init_custom(?, ?);',
      [CLOUDSYNC_BASE_URL, 'db_test_database_id']
    );
  });

  it('sets API key when apiKey is provided', async () => {
    const db = makeMockDB();
    const config = makeConfig({ apiKey: 'my-api-key', accessToken: undefined });

    await initializeSyncExtension(db as any, config, logger);

    expect(db.execute).toHaveBeenCalledWith(
      'SELECT cloudsync_network_set_apikey(?);',
      ['my-api-key']
    );
  });

  it('sets access token when accessToken is provided', async () => {
    const db = makeMockDB();
    const config = makeConfig({ apiKey: undefined, accessToken: 'my-token' });

    await initializeSyncExtension(db as any, config, logger);

    expect(db.execute).toHaveBeenCalledWith(
      'SELECT cloudsync_network_set_token(?);',
      ['my-token']
    );
    expect(db.execute).not.toHaveBeenCalledWith(
      'SELECT cloudsync_network_set_apikey(?);',
      expect.anything()
    );
  });

  it('throws if cloudsync_version returns no rows', async () => {
    const db = makeMockDB({ rows: [] });
    const config = makeConfig();

    await expect(
      initializeSyncExtension(db as any, config, logger)
    ).rejects.toThrow('CloudSync extension not loaded properly');
  });

  it('logs initialization for each table', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    const debugLogger = createLogger(true);
    const db = makeMockDB();
    const config = makeConfig();

    await initializeSyncExtension(db as any, config, debugLogger);

    expect(logSpy).toHaveBeenCalledWith(
      expect.any(String),
      '[SQLiteSync]',
      expect.stringContaining('CloudSync initialized for table: users')
    );
    logSpy.mockRestore();
  });

  it('does not depend on a return value from cloudsync_init', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    const debugLogger = createLogger(true);
    const db = createMockDB();
    db.execute.mockImplementation(async (sql: string) => {
      if (sql.includes('cloudsync_version'))
        return { rows: [{ 'cloudsync_version()': '1.0.0' }] };
      if (sql.includes('cloudsync_init')) return { rows: [{}] };
      return { rows: [] };
    });
    const config = makeConfig();

    await initializeSyncExtension(db as any, config, debugLogger);

    expect(logSpy).toHaveBeenCalledWith(
      expect.any(String),
      '[SQLiteSync]',
      expect.stringContaining('CloudSync initialized for table: users')
    );
    logSpy.mockRestore();
  });

  it('prefers apiKey over accessToken when both are provided', async () => {
    const db = makeMockDB();
    const config = makeConfig({
      apiKey: 'my-api-key',
      accessToken: 'my-token',
    });

    await initializeSyncExtension(db as any, config, logger);

    expect(db.execute).toHaveBeenCalledWith(
      'SELECT cloudsync_network_set_apikey(?);',
      ['my-api-key']
    );
    expect(db.execute).not.toHaveBeenCalledWith(
      'SELECT cloudsync_network_set_token(?);',
      expect.anything()
    );
  });
});
