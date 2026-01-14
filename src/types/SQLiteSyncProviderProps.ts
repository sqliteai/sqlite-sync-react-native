import type { TableConfig } from './TableConfig';

/**
 * Configuration for adaptive polling behavior
 */
export interface AdaptivePollingConfig {
  /**
   * Base interval for polling in milliseconds (default: 30000ms / 30s)
   * Used when app is active and no special conditions apply
   */
  baseInterval?: number;

  /**
   * Maximum interval when app is idle (default: 300000ms / 5 min)
   * Caps the backoff interval for idle periods and errors
   */
  maxInterval?: number;

  /**
   * Number of consecutive empty syncs before backing off (default: 3)
   * After this many syncs with no changes, interval will increase
   */
  emptyThreshold?: number;
}

/**
 * The base properties required for SQLiteSyncProvider
 */
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
   * Array of tables to be synced with SQLite Cloud
   * Each table must include its schema for initial creation
   */
  tablesToBeSynced: TableConfig[];

  /**
   * Adaptive polling configuration (optional)
   * When not provided, uses sensible defaults
   */
  adaptivePolling?: AdaptivePollingConfig;

  /**
   * Enable debug logging (default: false)
   * When true, logs detailed sync operations to console
   */
  debug?: boolean;

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
