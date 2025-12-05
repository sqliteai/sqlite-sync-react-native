import { createContext } from 'react';
import type { SQLiteSyncContextValue } from './types';

const defaultContextValue: SQLiteSyncContextValue = {
  isInitialized: false,
  isSyncing: false,
  lastSyncTime: null,
  error: null,
};

export const SQLiteSyncContext =
  createContext<SQLiteSyncContextValue>(defaultContextValue);
