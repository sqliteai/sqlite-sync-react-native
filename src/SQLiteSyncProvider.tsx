import { useState, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { open, getDylibPath, type DB } from '@op-engineering/op-sqlite';
import { SQLiteSyncContext } from './SQLiteSyncContext';
import type { SQLiteSyncProviderProps, SQLiteSyncContextValue } from './types';

export function SQLiteSyncProvider({
  connectionString,
  databaseName,
  tablesToBeSynced,
  syncInterval,
  children,
  ...authProps
}: SQLiteSyncProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, _setIsSyncing] = useState(false);
  const [lastSyncTime, _setLastSyncTime] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const dbRef = useRef<DB | null>(null);

  // Extract auth credentials
  const apiKey = 'apiKey' in authProps ? authProps.apiKey : undefined;
  const accessToken =
    'accessToken' in authProps ? authProps.accessToken : undefined;

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Open the database
        const db = open({ name: databaseName });
        dbRef.current = db;

        console.log('📦 Database opened:', databaseName);

        // Load cloudsync extension
        try {
          // Get platform-specific extension path
          let extensionPath: string;

          if (Platform.OS === 'ios') {
            // iOS: Use getDylibPath to get the framework path
            extensionPath = getDylibPath('ai.sqlite.cloudsync', 'CloudSync');
          } else {
            // Android: Use library name directly (Maven provides libcloudsync.so)
            extensionPath = 'cloudsync';
          }

          // Load the extension using op-sqlite's API
          db.loadExtension(extensionPath);

          console.log('✅ CloudSync extension loaded from:', extensionPath);
        } catch (loadErr) {
          console.error('Failed to load cloudsync extension:', loadErr);
          throw new Error(
            'Failed to load CloudSync extension. Make sure the native module is properly linked.'
          );
        }

        // Verify extension loaded by checking version
        try {
          const versionResult = await db.execute('SELECT cloudsync_version();');
          const version = versionResult.rows?.[0]?.[
            'cloudsync_version()'
          ] as string;

          if (!version) {
            throw new Error('CloudSync extension not loaded properly');
          }

          console.log('✅ CloudSync version:', version);
        } catch (versionErr) {
          console.error('CloudSync version check failed:', versionErr);
          throw versionErr;
        }

        if (isMounted) {
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('❌ Initialization failed:', err);
        if (isMounted) {
          setError(
            err instanceof Error ? err : new Error('Initialization failed')
          );
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
      // Cleanup - close database
      if (dbRef.current) {
        try {
          dbRef.current.close();
        } catch (err) {
          console.error('Error closing database:', err);
        }
      }
    };
  }, [
    connectionString,
    databaseName,
    tablesToBeSynced,
    syncInterval,
    apiKey,
    accessToken,
  ]);

  const contextValue = useMemo<SQLiteSyncContextValue>(
    () => ({
      isInitialized,
      isSyncing,
      lastSyncTime,
      error,
    }),
    [isInitialized, isSyncing, lastSyncTime, error]
  );

  return (
    <SQLiteSyncContext.Provider value={contextValue}>
      {children}
    </SQLiteSyncContext.Provider>
  );
}
