import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { getDylibPath, type DB } from '@op-engineering/op-sqlite';
import type { TableConfig } from '../../types/TableConfig';
import type { Logger } from '../../utils/logger';
import { createDatabase } from '../utils/createDatabase';

/**
 * Parameters for useDatabaseInitialization hook
 */
export interface DatabaseInitializationParams {
  /**
   * SQLite Cloud connection string
   */
  connectionString: string;

  /**
   * Local database file name
   */
  databaseName: string;

  /**
   * Array of tables to be synced
   */
  tablesToBeSynced: TableConfig[];

  /**
   * API key for authentication (mutually exclusive with accessToken)
   */
  apiKey?: string;

  /**
   * Access token for authentication (mutually exclusive with apiKey)
   */
  accessToken?: string;

  /**
   * Logger instance for logging
   */
  logger: Logger;
}

/**
 * Return type for useDatabaseInitialization hook
 */
export interface DatabaseInitializationResult {
  /**
   * Write database instance
   */
  writeDb: DB | null;

  /**
   * Read database instance
   */
  readDb: DB | null;

  /**
   * Ref to write database (for async operations)
   */
  writeDbRef: React.RefObject<DB | null>;

  /**
   * Whether sync is ready and configured
   */
  isSyncReady: boolean;

  /**
   * Fatal initialization error (database cannot be used)
   */
  initError: Error | null;

  /**
   * Sync initialization error (database works offline-only)
   */
  syncError: Error | null;
}

/**
 * Custom hook for database initialization
 *
 * Handles two-phase initialization:
 * 1. **Phase 1 (Database)**: Opens local database connections and creates tables
 * 2. **Phase 2 (Sync)**: Loads CloudSync extension and configures network sync
 *
 * @param params - Initialization parameters
 *
 * @returns Database instances, refs, and error states
 *
 * @example
 * ```typescript
 * const { writeDb, readDb, isSyncReady, initError } = useDatabaseInitialization({
 *   connectionString: 'sqlitecloud://...',
 *   databaseName: 'app.db',
 *   tablesToBeSynced: [{ name: 'users', createTableSql: '...' }],
 *   apiKey: 'your-api-key',
 *   logger
 * });
 * ```
 */
export function useDatabaseInitialization(
  params: DatabaseInitializationParams
): DatabaseInitializationResult {
  const {
    connectionString,
    databaseName,
    tablesToBeSynced,
    apiKey,
    accessToken,
    logger,
  } = params;

  /** PUBLIC STATE */
  const [writeDb, setWriteDb] = useState<DB | null>(null);
  const [readDb, setReadDb] = useState<DB | null>(null);
  const [isSyncReady, setIsSyncReady] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);

  /** REFS */
  const writeDbRef = useRef<DB | null>(null);
  const readDbRef = useRef<DB | null>(null);

  /** SERIALIZED CONFIG - Prevents unnecessary re-initialization */
  const serializedConfig = JSON.stringify({
    connectionString,
    databaseName,
    tables: tablesToBeSynced,
    apiKey,
    accessToken,
  });

  /** INITIALIZATION EFFECT */
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        /** PHASE 1: DATABASE INITIALIZATION (must succeed) */
        logger.info('📦 Starting database initialization...');

        if (!databaseName) {
          throw new Error('Database name is required');
        }

        /** OPEN DATABASE CONNECTIONS */
        logger.info('📂 Opening write connection...');
        const localWriteDb = await createDatabase(databaseName, 'write');
        writeDbRef.current = localWriteDb;
        logger.info('✅ Write connection opened and configured');

        logger.info('📂 Opening read connection...');
        const localReadDb = await createDatabase(databaseName, 'read');
        readDbRef.current = localReadDb;
        logger.info('✅ Read connection opened and configured (query_only)');

        /** CREATE TABLES (using write connection) */
        if (tablesToBeSynced.length === 0) {
          logger.warn('⚠️ No tables configured for sync');
        } else {
          for (const table of tablesToBeSynced) {
            try {
              await localWriteDb.execute(table.createTableSql);
              logger.info(`✅ Table created: ${table.name}`);
            } catch (createErr) {
              logger.error(
                `❌ Failed to create table ${table.name}:`,
                createErr
              );
              throw new Error(
                `Failed to create table ${table.name}: ${createErr}`
              );
            }
          }
        }

        logger.info('✅ Databases ready for local use');

        /** EXPOSE DATABASE CONNECTIONS - only after tables are created */
        if (isMounted) {
          setWriteDb(localWriteDb);
          setReadDb(localReadDb);
          setInitError(null);
        }

        /** PHASE 2: SYNC INITIALIZATION */
        try {
          logger.info('🔄 Starting sync initialization...');

          /** CHECK SYNC CONFIGURATION */
          if (!connectionString || (!apiKey && !accessToken)) {
            throw new Error(
              'Sync configuration incomplete. Database works offline-only.'
            );
          }

          /** LOAD CLOUDSYNC EXTENSION */
          let extensionPath: string;
          if (Platform.OS === 'ios') {
            extensionPath = getDylibPath('ai.sqlite.cloudsync', 'CloudSync');
          } else {
            extensionPath = 'cloudsync';
          }

          localWriteDb.loadExtension(extensionPath);
          logger.info('✅ CloudSync extension loaded');

          /** VERIFY CLOUDSYNC EXTENSION */
          const versionResult = await localWriteDb.execute(
            'SELECT cloudsync_version();'
          );
          const version = versionResult.rows?.[0]?.['cloudsync_version()'];

          if (!version) {
            throw new Error('CloudSync extension not loaded properly');
          }
          logger.info('✅ CloudSync version:', version);

          /** INITIALIZE CLOUDSYNC FOR TABLES */
          for (const table of tablesToBeSynced) {
            const initResult = await localWriteDb.execute(
              'SELECT cloudsync_init(?);',
              [table.name]
            );

            const firstRow = initResult.rows?.[0];
            const result = firstRow ? Object.values(firstRow)[0] : undefined;

            logger.info(
              `✅ CloudSync initialized for table: ${table.name}${
                result ? ` (site_id: ${result})` : ''
              }`
            );
          }

          /** INITIALIZE NETWORK CONNECTION */
          await localWriteDb.execute('SELECT cloudsync_network_init(?);', [
            connectionString,
          ]);
          logger.info('✅ Network initialized');

          /** SET AUTHENTICATION */
          if (apiKey) {
            await localWriteDb.execute(
              'SELECT cloudsync_network_set_apikey(?);',
              [apiKey]
            );
            logger.info('✅ API key set');
          } else if (accessToken) {
            await localWriteDb.execute(
              'SELECT cloudsync_network_set_token(?);',
              [accessToken]
            );
            logger.info('✅ Access token set');
          }

          logger.info('✅ Sync initialization complete');

          if (isMounted) {
            setIsSyncReady(true);
            setSyncError(null);
          }
        } catch (err) {
          /** NON-FATAL ERROR - database works, but sync doesn't */
          logger.warn(
            '⚠️ Sync initialization failed. Database works in offline-only mode:',
            err
          );
          if (isMounted) {
            setIsSyncReady(false);
            setSyncError(
              err instanceof Error
                ? err
                : new Error('Sync initialization failed')
            );
          }
        }
      } catch (err) {
        /** FATAL ERROR - database can not be used */
        logger.error('❌ Database initialization failed:', err);
        if (isMounted) {
          setInitError(
            err instanceof Error
              ? err
              : new Error('Database initialization failed')
          );
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;

      /** CLEANUP - close both database connections */
      const closingWriteDb = writeDbRef.current;
      const closingReadDb = readDbRef.current;
      writeDbRef.current = null;
      readDbRef.current = null;

      if (closingWriteDb) {
        try {
          closingWriteDb.close();
          logger.info('Write database closed');
        } catch (err) {
          logger.error('❌ Error closing write database:', err);
        }
      }

      if (closingReadDb) {
        try {
          closingReadDb.close();
          logger.info('Read database closed');
        } catch (err) {
          logger.error('❌ Error closing read database:', err);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedConfig, logger]);

  return {
    writeDb,
    readDb,
    writeDbRef,
    isSyncReady,
    initError,
    syncError,
  };
}
