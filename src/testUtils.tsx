import { type ReactNode } from 'react';
import { SQLiteDbContext } from './contexts/SQLiteDbContext';
import { SQLiteSyncStatusContext } from './contexts/SQLiteSyncStatusContext';
import { SQLiteSyncActionsContext } from './contexts/SQLiteSyncActionsContext';
import { SQLiteInternalContext } from './contexts/SQLiteInternalContext';
import { createLogger } from './core/common/logger';
import type { SQLiteDbContextValue } from './types/SQLiteDbContextValue';
import type { SQLiteSyncStatusContextValue } from './types/SQLiteSyncStatusContextValue';
import type { SQLiteSyncActionsContextValue } from './types/SQLiteSyncActionsContextValue';
import { createMockDB } from './__mocks__/@op-engineering/op-sqlite';

const defaultDbContext: SQLiteDbContextValue = {
  writeDb: null,
  readDb: null,
  initError: null,
};

const defaultStatusContext: SQLiteSyncStatusContextValue = {
  syncMode: 'polling',
  isSyncReady: false,
  isSyncing: false,
  lastSyncTime: null,
  lastSyncChanges: 0,
  syncError: null,
  currentSyncInterval: 5000,
  consecutiveEmptySyncs: 0,
  consecutiveSyncErrors: 0,
  isAppInBackground: false,
  isNetworkAvailable: true,
};

const defaultActionsContext: SQLiteSyncActionsContextValue = {
  triggerSync: jest.fn().mockResolvedValue(undefined),
};

export function createTestWrapper(overrides?: {
  db?: Partial<SQLiteDbContextValue>;
  status?: Partial<SQLiteSyncStatusContextValue>;
  actions?: Partial<SQLiteSyncActionsContextValue>;
  logger?: ReturnType<typeof createLogger>;
}) {
  const dbValue = { ...defaultDbContext, ...overrides?.db };
  const statusValue = { ...defaultStatusContext, ...overrides?.status };
  const actionsValue = { ...defaultActionsContext, ...overrides?.actions };
  const logger = overrides?.logger ?? createLogger(false);

  return function TestWrapper({ children }: { children: ReactNode }) {
    return (
      <SQLiteInternalContext.Provider value={{ logger }}>
        <SQLiteDbContext.Provider value={dbValue}>
          <SQLiteSyncStatusContext.Provider value={statusValue}>
            <SQLiteSyncActionsContext.Provider value={actionsValue}>
              {children}
            </SQLiteSyncActionsContext.Provider>
          </SQLiteSyncStatusContext.Provider>
        </SQLiteDbContext.Provider>
      </SQLiteInternalContext.Provider>
    );
  };
}

export { createMockDB };
