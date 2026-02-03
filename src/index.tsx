/** SIDE-EFFECT IMPORT */
// Defines background task at module level - ensures task is defined when app is terminated
import './core/pushNotifications/pushNotificationSyncTask';

/** PROVIDER */
export { SQLiteSyncProvider } from './core/SQLiteSyncProvider';

/** BACKGROUND SYNC CALLBACK */
export { registerBackgroundSyncCallback } from './core/pushNotifications/pushNotificationSyncCallbacks';

/** CONTEXTS */
export { SQLiteDbContext } from './contexts/SQLiteDbContext';
export { SQLiteSyncStatusContext } from './contexts/SQLiteSyncStatusContext';
export { SQLiteSyncActionsContext } from './contexts/SQLiteSyncActionsContext';

/** CONTEXT HOOKS */
export { useSqliteDb } from './hooks/context/useSqliteDb';
export { useSyncStatus } from './hooks/context/useSyncStatus';
export { useSqliteSync } from './hooks/context/useSqliteSync';

/** SQLITE HOOKS */
export { useOnTableUpdate } from './hooks/sqlite/useOnTableUpdate';
export { useSqliteExecute } from './hooks/sqlite/useSqliteExecute';
export { useSqliteTransaction } from './hooks/sqlite/useSqliteTransaction';

/** SYNC HOOKS */
export { useTriggerSqliteSync } from './hooks/sync/useTriggerSqliteSync';
export { useSqliteSyncQuery } from './hooks/sync/useSqliteSyncQuery';

/** TYPES */
export type {
  SQLiteSyncProviderProps,
  SyncMode,
  NotificationListeningMode,
  AdaptivePollingConfig,
} from './types/SQLiteSyncProviderProps';
export type { SQLiteDbContextValue } from './types/SQLiteDbContextValue';
export type { SQLiteSyncStatusContextValue } from './types/SQLiteSyncStatusContextValue';
export type { SQLiteSyncActionsContextValue } from './types/SQLiteSyncActionsContextValue';
export type { TableConfig } from './types/TableConfig';
export type { ReactiveQueryConfig } from './types/ReactiveQueryConfig';
export type {
  TableUpdateData,
  TableUpdateConfig,
} from './types/TableUpdateConfig';
export type { SqliteExecuteOptions } from './types/SqliteExecuteOptions';
export type {
  ChangeRecord,
  BackgroundSyncResult,
  BackgroundSyncCallback,
} from './types/BackgroundSyncCallback';
