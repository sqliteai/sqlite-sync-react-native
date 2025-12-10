import { useState, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { open, getDylibPath, type DB } from '@op-engineering/op-sqlite';
import { SQLiteSyncContext } from './SQLiteSyncContext';
import type { SQLiteSyncProviderProps } from './types/SQLiteSyncProviderProps';
import type { SQLiteSyncContextValue } from './types/SQLiteSyncContextValue';
import { createLogger } from './utils/logger';

/**
 * SQLiteSyncProvider - A React context provider that enables real-time SQLite database synchronization
 * with SQLite Cloud using the CloudSync extension.
 *
 * This provider handles:
 * - Database initialization and table creation
 * - Loading and configuring the CloudSync extension
 * - Automatic periodic synchronization with the cloud
 * - Authentication (API key or access token)
 * - Sync state management (initialized, syncing, last sync time, changes count)
 *
 * @param {SQLiteSyncProviderProps} props - Configuration props for the provider
 * @param {string} props.connectionString - SQLite Cloud connection string
 * @param {string} props.databaseName - Local database file name *
 * @param {Array<{name: string, schema: string}>} props.tablesToBeSynced - Array of tables to sync
 *   Each table requires:
 *   - `name`: Table name (must match remote table name)
 *   - `schema`: SQL CREATE TABLE statement
 * @param {number} props.syncInterval - Sync interval in milliseconds
 * @param {string} [props.apiKey] - SQLite Cloud API key for authentication
 *   Use either `apiKey` OR `accessToken`, not both
 * @param {string} [props.accessToken] - SQLite Cloud access token for authentication
 *   Use either `apiKey` OR `accessToken`, not both
 * @param {React.ReactNode} props.children - Child components that will have access to the sync context
 *
 * @returns {JSX.Element} Provider component wrapping children with SQLiteSyncContext
 */
export function SQLiteSyncProvider({
  connectionString,
  databaseName,
  tablesToBeSynced,
  syncInterval,
  debug = false,
  children,
  ...authProps
}: SQLiteSyncProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [lastSyncChanges, setLastSyncChanges] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const dbRef = useRef<DB | null>(null);

  /** EXTRACT AUTH CREDENTIALS **/
  const apiKey = 'apiKey' in authProps ? authProps.apiKey : undefined;
  const accessToken =
    'accessToken' in authProps ? authProps.accessToken : undefined;

  /** CREATE LOGGER **/
  const logger = useMemo(() => createLogger(debug), [debug]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const db = open({ name: databaseName });
        dbRef.current = db;

        logger.info('📦 Database opened:', databaseName);

        /** LOAD CLOUDSYNC EXTENSION **/
        try {
          let extensionPath: string;

          if (Platform.OS === 'ios') {
            extensionPath = getDylibPath('ai.sqlite.cloudsync', 'CloudSync');
          } else {
            extensionPath = 'cloudsync';
          }

          db.loadExtension(extensionPath);

          logger.info('✅ CloudSync extension loaded from:', extensionPath);
        } catch (loadErr) {
          logger.error('❌ Failed to load CloudSync extension:', loadErr);
          throw new Error(
            'Failed to load CloudSync extension. Make sure the native module is properly linked.'
          );
        }

        /** VERIFY CLOUDSYNC EXTENSION IS LOADED **/
        try {
          const versionResult = await db.execute('SELECT cloudsync_version();');
          const version = versionResult.rows?.[0]?.[
            'cloudsync_version()'
          ] as string;

          if (!version) {
            throw new Error('CloudSync extension not loaded properly');
          }

          logger.info('✅ CloudSync version:', version);
        } catch (versionErr) {
          logger.error('❌ CloudSync version check failed:', versionErr);
          throw versionErr;
        }

        /** CREATE TABLES AND INITIALIZE CLOUDSYNC **/
        for (const table of tablesToBeSynced) {
          try {
            logger.info(`📋 Creating table: ${table.name}...`);
            await db.execute(table.schema);
            logger.info(`✅ Table created: ${table.name}`);
          } catch (createErr) {
            logger.error(`❌ Failed to create table ${table.name}:`, createErr);
            throw new Error(`Failed to create table: ${table.name}`);
          }

          try {
            logger.info(
              `🔄 Initializing CloudSync for table: ${table.name}...`
            );
            const initResult = await db.execute(
              `SELECT cloudsync_init('${table.name}');`
            );

            const firstRow = initResult.rows?.[0];
            const result = firstRow ? Object.values(firstRow)[0] : undefined;

            logger.info(
              `✅ CloudSync initialized for table: ${table.name}${
                result ? ` (site_id: ${result})` : ''
              }`
            );
          } catch (initErr) {
            logger.error(
              `❌ Failed to initialize CloudSync for table ${table.name}:`,
              initErr
            );
            throw new Error(
              `Failed to initialize CloudSync for table: ${table.name}`
            );
          }
        }

        /** INITIALIZE NETWORK CONNECTION **/
        try {
          logger.info('🌐 Initializing network with:', connectionString);
          await db.execute(
            `SELECT cloudsync_network_init('${connectionString}');`
          );
          logger.info('✅ Network initialized');
        } catch (networkErr) {
          logger.error('❌ Network initialization failed:', networkErr);
          throw new Error('Failed to initialize network connection');
        }

        /** SET AUTHENTICATION **/
        try {
          if (apiKey) {
            logger.info('🔑 Setting API key...');
            await db.execute(
              `SELECT cloudsync_network_set_apikey('${apiKey}');`
            );
            logger.info('✅ API key set');
          } else if (accessToken) {
            logger.info('🔑 Setting access token...');
            await db.execute(
              `SELECT cloudsync_network_set_token('${accessToken}');`
            );
            logger.info('✅ Access token set');
          } else {
            logger.warn('⚠️ No authentication credentials provided');
          }
        } catch (authErr) {
          logger.error('❌ Authentication setup failed:', authErr);
          throw new Error('Failed to set authentication credentials');
        }

        if (isMounted) {
          setIsInitialized(true);
        }
      } catch (err) {
        logger.error('❌ Initialization failed:', err);
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

      /** CLEANUP - CLOSE DATABASE **/
      if (dbRef.current) {
        try {
          dbRef.current.close();
        } catch (err) {
          logger.error('❌ Error closing database:', err);
        }
      }
    };
  }, [
    connectionString,
    databaseName,
    tablesToBeSynced,
    apiKey,
    accessToken,
    logger,
  ]);

  /** SYNC ON INTERVAL **/
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

        logger.info(`✅ Sync completed: ${changes} changes synced`);

        setLastSyncChanges(changes);
        setLastSyncTime(Date.now());
      } catch (err) {
        logger.error('❌ Sync failed:', err);
        setError(err instanceof Error ? err : new Error('Sync failed'));
      } finally {
        setIsSyncing(false);
      }
    };

    performSync();

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
      lastSyncChanges,
      error,
      db: dbRef.current,
    }),
    [isInitialized, isSyncing, lastSyncTime, lastSyncChanges, error]
  );

  return (
    <SQLiteSyncContext.Provider value={contextValue}>
      {children}
    </SQLiteSyncContext.Provider>
  );
}
