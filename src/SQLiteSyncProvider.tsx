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
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
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
        const db = open({ name: databaseName });
        dbRef.current = db;

        console.log('📦 Database opened:', databaseName);

        // Load CloudSync extension
        try {
          let extensionPath: string;

          if (Platform.OS === 'ios') {
            extensionPath = getDylibPath('ai.sqlite.cloudsync', 'CloudSync');
          } else {
            extensionPath = 'cloudsync';
          }

          db.loadExtension(extensionPath);

          console.log('✅ CloudSync extension loaded from:', extensionPath);
        } catch (loadErr) {
          console.error('Failed to load cloudsync extension:', loadErr);
          throw new Error(
            'Failed to load CloudSync extension. Make sure the native module is properly linked.'
          );
        }

        // Verify CloudSync extension is loaded
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

        // Create tables if they don't exist and initialize CloudSync
        for (const table of tablesToBeSynced) {
          try {
            console.log(`📋 Creating table: ${table.name}...`);
            await db.execute(table.schema);
            console.log(`✅ Table created: ${table.name}`);
          } catch (createErr) {
            console.error(`Failed to create table ${table.name}:`, createErr);
            throw new Error(`Failed to create table: ${table.name}`);
          }

          try {
            console.log(
              `🔄 Initializing CloudSync for table: ${table.name}...`
            );
            const initResult = await db.execute(
              `SELECT cloudsync_init('${table.name}');`
            );

            // Accept both null and hex string (site_id) as success
            const firstRow = initResult.rows?.[0];
            const result = firstRow ? Object.values(firstRow)[0] : undefined;

            console.log(
              `✅ CloudSync initialized for table: ${table.name}${
                result ? ` (site_id: ${result})` : ''
              }`
            );
          } catch (initErr) {
            console.error(
              `Failed to initialize CloudSync for table ${table.name}:`,
              initErr
            );
            throw new Error(
              `Failed to initialize CloudSync for table: ${table.name}`
            );
          }
        }

        // Initialize network connection
        try {
          console.log('🌐 Initializing network with:', connectionString);
          await db.execute(
            `SELECT cloudsync_network_init('${connectionString}');`
          );
          console.log('✅ Network initialized');
        } catch (networkErr) {
          console.error('Network initialization failed:', networkErr);
          throw new Error('Failed to initialize network connection');
        }

        // Set authentication
        try {
          if (apiKey) {
            console.log('🔑 Setting API key...');
            await db.execute(
              `SELECT cloudsync_network_set_apikey('${apiKey}');`
            );
            console.log('✅ API key set');
          } else if (accessToken) {
            console.log('🔑 Setting access token...');
            await db.execute(
              `SELECT cloudsync_network_set_token('${accessToken}');`
            );
            console.log('✅ Access token set');
          } else {
            console.warn('⚠️ No authentication credentials provided');
          }
        } catch (authErr) {
          console.error('Authentication setup failed:', authErr);
          throw new Error('Failed to set authentication credentials');
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
  }, [connectionString, databaseName, tablesToBeSynced, apiKey, accessToken]);

  // Sync on interval
  useEffect(() => {
    if (!isInitialized || !dbRef.current) {
      return;
    }

    const performSync = async () => {
      if (isSyncing) {
        return;
      }

      try {
        setIsSyncing(true);

        const syncResult = await dbRef.current!.execute(
          'SELECT cloudsync_network_sync();'
        );

        const firstRow = syncResult.rows?.[0];
        const result = firstRow ? Object.values(firstRow)[0] : 0;

        const changes = typeof result === 'number' ? result : 0;

        console.log(`✅ Sync completed: ${changes} changes synced`);

        setLastSyncTime(Date.now());
      } catch (err) {
        console.error('❌ Sync failed:', err);
        setError(err instanceof Error ? err : new Error('Sync failed'));
      } finally {
        setIsSyncing(false);
      }
    };

    // Run initial sync
    performSync();

    // Set up interval
    const intervalId = setInterval(performSync, syncInterval);

    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, syncInterval]);

  const contextValue = useMemo<SQLiteSyncContextValue>(
    () => ({
      isInitialized,
      isSyncing,
      lastSyncTime,
      error,
      db: dbRef.current,
    }),
    [isInitialized, isSyncing, lastSyncTime, error]
  );

  return (
    <SQLiteSyncContext.Provider value={contextValue}>
      {children}
    </SQLiteSyncContext.Provider>
  );
}
