// Side-effect import: defines background task at module level
// This ensures the task is defined when app is terminated
import './core/backgroundSyncTask';

export { SQLiteSyncProvider } from './provider/SQLiteSyncProvider';

// Background sync handler registration
export { registerBackgroundSyncHandler } from './core/backgroundSyncHandler';

// Contexts
export { SQLiteDbContext } from './contexts/SQLiteDbContext';
export { SQLiteSyncStatusContext } from './contexts/SQLiteSyncStatusContext';
export { SQLiteSyncActionsContext } from './contexts/SQLiteSyncActionsContext';

// Context hooks
export { useSqliteDb } from './hooks/context/useSqliteDb';
export { useSyncStatus } from './hooks/context/useSyncStatus';
export { useSqliteSync } from './hooks/context/useSqliteSync';

// SQLite hooks
export { useOnTableUpdate } from './hooks/sqlite/useOnTableUpdate';
export { useSqliteExecute } from './hooks/sqlite/useSqliteExecute';
export { useSqliteTransaction } from './hooks/sqlite/useSqliteTransaction';

// Sync hooks
export { useTriggerSqliteSync } from './hooks/sync/useTriggerSqliteSync';
export { useSqliteSyncQuery } from './hooks/sync/useSqliteSyncQuery';

// Types
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
export type { ExecuteOptions } from './types/ExecuteOptions';
export type {
  ChangeRecord,
  BackgroundSyncResult,
  BackgroundSyncHandler,
} from './types/BackgroundSyncHandler';
