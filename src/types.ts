interface BaseSQLiteSyncProviderProps {
  /**
   * SQLite Cloud connection string
   */
  connectionString: string;

  /**
   * Name of the local database file
   */
  databaseName: string;

  /**
   * Array of table names to be synced with SQLite Cloud
   */
  tablesToBeSynced: string[];

  /**
   * Sync interval in milliseconds
   */
  syncInterval: number;

  /**
   * Children components
   */
  children: React.ReactNode;
}

/**
 * Provider props with API key authentication (for apps without RLS)
 */
interface SQLiteSyncProviderPropsWithApiKey
  extends BaseSQLiteSyncProviderProps {
  /**
   * API key for simple authentication (if not using RLS)
   */
  apiKey: string;
  accessToken?: never;
}

/**
 * Provider props with access token authentication (for apps with RLS)
 */
interface SQLiteSyncProviderPropsWithAccessToken
  extends BaseSQLiteSyncProviderProps {
  /**
   * Access token for user-level authentication (when using RLS)
   */
  accessToken: string;
  apiKey?: never;
}

/**
 * SQLiteSyncProvider accepts either apiKey or accessToken for authentication
 */
export type SQLiteSyncProviderProps =
  | SQLiteSyncProviderPropsWithApiKey
  | SQLiteSyncProviderPropsWithAccessToken;

export interface SQLiteSyncContextValue {
  /**
   * Whether the provider is initialized
   */
  isInitialized: boolean;

  /**
   * Whether sync is currently in progress
   */
  isSyncing: boolean;

  /**
   * Last sync timestamp
   */
  lastSyncTime: number | null;

  /**
   * Error if any occurred during initialization or sync
   */
  error: Error | null;
}
