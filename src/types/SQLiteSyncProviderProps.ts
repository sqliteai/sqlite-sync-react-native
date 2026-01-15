import type { TableConfig } from './TableConfig';

/**
 * Sync mode determines how the provider checks for remote changes
 */
export type SyncMode = 'polling' | 'push';

/**
 * Configuration for adaptive polling behavior
 */
export interface AdaptivePollingConfig {
  /**
   * Base interval for polling in milliseconds (default: 5000ms / 5s)
   * Used when app is active and no special conditions apply
   */
  baseInterval?: number;

  /**
   * Maximum interval when app is idle (default: 300000ms / 5 min)
   * Caps the backoff interval for idle periods and errors
   */
  maxInterval?: number;

  /**
   * Number of consecutive empty syncs before backing off (default: 5)
   * After this many syncs with no changes, interval will increase
   */
  emptyThreshold?: number;

  /**
   * Idle backoff multiplier for exponential backoff (default: 1.5)
   * When consecutive empty syncs exceed threshold, interval multiplies by this factor
   * Gentler backoff assumes quiet periods are temporary
   * Example: 5s → 7.5s → 11s → 17s → 25s ... (caps at maxInterval)
   */
  idleBackoffMultiplier?: number;

  /**
   * Error backoff multiplier for exponential backoff (default: 2.0)
   * When sync errors occur, interval multiplies by this factor
   * Aggressive backoff protects server and battery during persistent failures
   * Example: 5s → 10s → 20s → 40s → 80s ... (caps at maxInterval)
   */
  errorBackoffMultiplier?: number;
}

/**
 * Common properties shared across all provider configurations
 */
interface CommonProviderProps {
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
 * Authentication with API key (for apps without RLS)
 */
interface WithApiKey {
  /**
   * API key for simple authentication (if not using RLS)
   */
  apiKey: string;
  accessToken?: never;
}

/**
 * Authentication with access token (for apps with RLS)
 */
interface WithAccessToken {
  /**
   * Access token for user-level authentication (when using RLS)
   */
  accessToken: string;
  apiKey?: never;
}

/**
 * Polling mode configuration
 * Adaptive polling is required when using polling mode
 */
interface PollingMode {
  /**
   * Sync mode: polling (default)
   * Uses adaptive polling to periodically check for changes
   */
  syncMode: 'polling';

  /**
   * Adaptive polling configuration (required in polling mode)
   * Controls polling intervals and backoff behavior
   */
  adaptivePolling: AdaptivePollingConfig;
}

/**
 * Push mode configuration
 * Adaptive polling is not used in push mode
 */
interface PushMode {
  /**
   * Sync mode: push
   * Relies on push notifications from SQLite Cloud (still syncs on foreground/network)
   */
  syncMode: 'push';

  /**
   * Adaptive polling is not used in push mode
   */
  adaptivePolling?: never;
}

/**
 * SQLiteSyncProvider props
 * Combines common props with authentication and sync mode variants
 */
export type SQLiteSyncProviderProps = CommonProviderProps &
  (WithApiKey | WithAccessToken) &
  (PollingMode | PushMode);
