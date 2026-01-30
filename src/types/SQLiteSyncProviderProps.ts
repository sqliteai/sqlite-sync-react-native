import type { ReactNode } from 'react';
import type { TableConfig } from './TableConfig';
import type { DB } from '@op-engineering/op-sqlite';

/**
 * Sync mode determines how the provider checks for remote changes
 */
export type SyncMode = 'polling' | 'push';

/**
 * Controls when push notifications trigger sync
 */
export type NotificationListeningMode =
  | 'foreground' // Only sync when app is in foreground
  | 'always'; // Sync in foreground, background, and when app was terminated

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
   * Callback invoked after database is opened but before sync initialization.
   * Use this to run migrations or other database setup.
   *
   * @param db - The write database connection
   *
   * @example
   * ```tsx
   * onDatabaseReady={async (db) => {
   *   const { rows } = await db.execute('PRAGMA user_version');
   *   const version = rows?.[0]?.user_version ?? 0;
   *
   *   if (version < 1) {
   *     await db.execute('ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0');
   *     await db.execute('PRAGMA user_version = 1');
   *   }
   * }}
   * ```
   */
  onDatabaseReady?: (db: DB) => Promise<void>;

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

  /**
   * Not available in polling mode
   */
  notificationListening?: never;
  renderPushPermissionPrompt?: never;
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
   * Controls when push notifications trigger sync (default: 'foreground')
   * - 'foreground': Only sync when app is in foreground
   * - 'always': Sync in foreground, background, and when app was terminated
   */
  notificationListening?: NotificationListeningMode;

  /**
   * Render prop for showing a custom permission prompt before requesting push notification permissions.
   * Receives `allow` and `deny` callbacks to resolve the permission request.
   *
   * @example
   * ```tsx
   * renderPushPermissionPrompt={({ allow, deny }) => (
   *   <Modal visible animationType="fade" transparent>
   *     <View>
   *       <Text>Enable Real-time Sync?</Text>
   *       <Button title="Allow" onPress={allow} />
   *       <Button title="Deny" onPress={deny} />
   *     </View>
   *   </Modal>
   * )}
   * ```
   */
  renderPushPermissionPrompt?: (props: {
    allow: () => void;
    deny: () => void;
  }) => ReactNode;

  /**
   * Not available in push mode
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
