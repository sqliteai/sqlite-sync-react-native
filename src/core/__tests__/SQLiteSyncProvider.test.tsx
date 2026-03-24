jest.mock('../database/useDatabaseInitialization');
jest.mock('../sync/useSyncManager');
jest.mock('../sync/useInitialSync');
jest.mock('../lifecycle/useAppLifecycle');
jest.mock('../lifecycle/useNetworkListener');
jest.mock('../polling/useAdaptivePollingSync');
jest.mock('../pushNotifications/usePushNotificationSync');

import React, { useContext } from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { SQLiteSyncProvider } from '../SQLiteSyncProvider';
import { SQLiteDbContext } from '../../contexts/SQLiteDbContext';
import { SQLiteSyncStatusContext } from '../../contexts/SQLiteSyncStatusContext';
import { SQLiteSyncActionsContext } from '../../contexts/SQLiteSyncActionsContext';
import { SQLiteInternalContext } from '../../contexts/SQLiteInternalContext';
import { useDatabaseInitialization } from '../database/useDatabaseInitialization';
import { useSyncManager } from '../sync/useSyncManager';
import { useInitialSync } from '../sync/useInitialSync';
import { useAppLifecycle } from '../lifecycle/useAppLifecycle';
import { useNetworkListener } from '../lifecycle/useNetworkListener';
import { useAdaptivePollingSync } from '../polling/useAdaptivePollingSync';
import { usePushNotificationSync } from '../pushNotifications/usePushNotificationSync';

const mockPerformSync = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'warn').mockImplementation();
  jest.spyOn(console, 'error').mockImplementation();

  (useDatabaseInitialization as jest.Mock).mockReturnValue({
    writeDb: { execute: jest.fn() },
    readDb: { execute: jest.fn() },
    writeDbRef: { current: null },
    isSyncReady: true,
    initError: null,
    syncError: null,
  });

  (useSyncManager as jest.Mock).mockReturnValue({
    performSync: mockPerformSync,
    performSyncRef: { current: mockPerformSync },
    isSyncing: false,
    lastSyncTime: null,
    lastSyncChanges: 0,
    consecutiveEmptySyncs: 0,
    consecutiveSyncErrors: 0,
    syncError: null,
    setConsecutiveEmptySyncs: jest.fn(),
  });

  (useInitialSync as jest.Mock).mockReturnValue(undefined);
  (useAppLifecycle as jest.Mock).mockReturnValue({
    appState: 'active',
    isInBackground: false,
  });
  (useNetworkListener as jest.Mock).mockReturnValue({
    isNetworkAvailable: true,
  });
  (useAdaptivePollingSync as jest.Mock).mockReturnValue(undefined);
  (usePushNotificationSync as jest.Mock).mockReturnValue({
    permissionPromptNode: null,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const defaultProps = {
  databaseId: 'db_test_database_id',
  databaseName: 'test.db',
  tablesToBeSynced: [
    {
      name: 'users',
      createTableSql: 'CREATE TABLE IF NOT EXISTS users (id TEXT)',
    },
  ],
  apiKey: 'test-key',
};

const createWrapper = (props?: Partial<typeof defaultProps>) => {
  const mergedProps = { ...defaultProps, ...props } as any;
  return ({ children }: { children: React.ReactNode }) => (
    <SQLiteSyncProvider {...mergedProps}>{children}</SQLiteSyncProvider>
  );
};

describe('SQLiteSyncProvider', () => {
  it('provides db context with writeDb and readDb', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useContext(SQLiteDbContext), {
      wrapper,
    });

    expect(result.current.writeDb).not.toBeNull();
    expect(result.current.readDb).not.toBeNull();
    expect(result.current.initError).toBeNull();
  });

  it('provides sync status context', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useContext(SQLiteSyncStatusContext), {
      wrapper,
    });

    expect(result.current.isSyncReady).toBe(true);
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.syncMode).toBe('polling');
    expect(result.current.isNetworkAvailable).toBe(true);
    expect(result.current.isAppInBackground).toBe(false);
  });

  it('provides sync actions context with triggerSync', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useContext(SQLiteSyncActionsContext), {
      wrapper,
    });

    expect(typeof result.current.triggerSync).toBe('function');
  });

  it('provides internal context with logger', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useContext(SQLiteInternalContext), {
      wrapper,
    });

    expect(result.current.logger).toBeDefined();
    expect(typeof result.current.logger.info).toBe('function');
  });

  it('passes database sync metadata to useDatabaseInitialization', () => {
    const wrapper = createWrapper();
    renderHook(() => useContext(SQLiteDbContext), { wrapper });

    expect(useDatabaseInitialization).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseId: 'db_test_database_id',
        databaseName: 'test.db',
      })
    );
  });

  it('passes syncMode polling to useAdaptivePollingSync', () => {
    const wrapper = createWrapper();
    renderHook(() => useContext(SQLiteDbContext), { wrapper });

    expect(useAdaptivePollingSync).toHaveBeenCalledWith(
      expect.objectContaining({ syncMode: 'polling' })
    );
  });

  it('passes isSyncReady to sub-hooks', () => {
    const wrapper = createWrapper();
    renderHook(() => useContext(SQLiteDbContext), { wrapper });

    expect(useSyncManager).toHaveBeenCalledWith(
      expect.objectContaining({ isSyncReady: true })
    );
    expect(useInitialSync).toHaveBeenCalledWith(
      expect.objectContaining({ isSyncReady: true })
    );
  });

  it('exposes initError from database initialization', () => {
    const initError = new Error('db failed');
    (useDatabaseInitialization as jest.Mock).mockReturnValue({
      writeDb: null,
      readDb: null,
      writeDbRef: { current: null },
      isSyncReady: false,
      initError,
      syncError: null,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useContext(SQLiteDbContext), {
      wrapper,
    });

    expect(result.current.initError?.message).toBe('db failed');
  });

  it('merges syncError from init and sync manager', () => {
    const syncError = new Error('sync failed');
    (useDatabaseInitialization as jest.Mock).mockReturnValue({
      writeDb: null,
      readDb: null,
      writeDbRef: { current: null },
      isSyncReady: false,
      initError: null,
      syncError,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useContext(SQLiteSyncStatusContext), {
      wrapper,
    });

    expect(result.current.syncError?.message).toBe('sync failed');
  });

  it('passes push mode to usePushNotificationSync', () => {
    const pushWrapper = ({ children }: { children: React.ReactNode }) => (
      <SQLiteSyncProvider {...defaultProps} syncMode="push" apiKey="test-key">
        {children}
      </SQLiteSyncProvider>
    );
    renderHook(() => useContext(SQLiteDbContext), { wrapper: pushWrapper });

    expect(usePushNotificationSync).toHaveBeenCalledWith(
      expect.objectContaining({
        syncMode: 'push',
        databaseId: 'db_test_database_id',
      })
    );
  });

  it('falls back to polling when push permissions denied', () => {
    // Capture the onPermissionsDenied callback
    let capturedOnPermissionsDenied: (() => void) | undefined;
    (usePushNotificationSync as jest.Mock).mockImplementation((params: any) => {
      capturedOnPermissionsDenied = params.onPermissionsDenied;
      return { permissionPromptNode: null };
    });

    const pushWrapper = ({ children }: { children: React.ReactNode }) => (
      <SQLiteSyncProvider {...defaultProps} syncMode="push" apiKey="test-key">
        {children}
      </SQLiteSyncProvider>
    );
    renderHook(() => useContext(SQLiteSyncStatusContext), {
      wrapper: pushWrapper,
    });

    // Trigger permission denied callback inside act to trigger re-render
    expect(capturedOnPermissionsDenied).toBeDefined();
    act(() => {
      capturedOnPermissionsDenied!();
    });

    // After re-render, the effective sync mode should be polling
    // Check that at least one call after the permission denied had syncMode: 'polling'
    const calls = (usePushNotificationSync as jest.Mock).mock.calls;
    const lastPollingCall = calls.find(
      (call: any) => call[0].syncMode === 'polling'
    );
    expect(lastPollingCall).toBeDefined();
  });

  it('sets null interval in push mode', () => {
    const pushWrapper = ({ children }: { children: React.ReactNode }) => (
      <SQLiteSyncProvider {...defaultProps} syncMode="push" apiKey="test-key">
        {children}
      </SQLiteSyncProvider>
    );
    const { result } = renderHook(() => useContext(SQLiteSyncStatusContext), {
      wrapper: pushWrapper,
    });

    expect(result.current.currentSyncInterval).toBeNull();
  });

  it('uses accessToken auth when provided', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SQLiteSyncProvider
        databaseId="db_test_database_id"
        databaseName="test.db"
        tablesToBeSynced={defaultProps.tablesToBeSynced}
        accessToken="my-token"
        syncMode="polling"
        adaptivePolling={{}}
      >
        {children}
      </SQLiteSyncProvider>
    );
    renderHook(() => useContext(SQLiteDbContext), { wrapper });

    expect(useDatabaseInitialization).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'my-token' })
    );
  });

  it('applies custom adaptivePolling config', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SQLiteSyncProvider
        {...defaultProps}
        syncMode="polling"
        adaptivePolling={{ baseInterval: 10000, maxInterval: 120000 }}
      >
        {children}
      </SQLiteSyncProvider>
    );
    renderHook(() => useContext(SQLiteDbContext), { wrapper });

    expect(useSyncManager).toHaveBeenCalledWith(
      expect.objectContaining({
        adaptiveConfig: expect.objectContaining({
          baseInterval: 10000,
          maxInterval: 120000,
        }),
      })
    );
  });
});
