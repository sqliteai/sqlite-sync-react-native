import { useState, useEffect, useRef, useMemo } from 'react';
import type { DB } from '@op-engineering/op-sqlite';
import type { TableConfig } from '../../types/TableConfig';
import type { Logger } from '../common/logger';
import { createDatabase } from './createDatabase';
import { initializeSyncExtension } from '../sync/initializeSyncExtension';
import { consumeActiveBackgroundDb } from '../background/activeBackgroundDb';

/**
 * Parameters for useDatabaseInitialization hook
 */
export interface DatabaseInitializationParams {
  /**
   * CloudSync database ID used by runtime sync APIs
   */
  databaseId: string;

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

  /**
   * Callback invoked after database is opened but before sync initialization.
   * Use this to run migrations or other database setup.
   */
  onDatabaseReady?: (db: DB) => Promise<void>;
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
 *   databaseId: 'db_xxxxxxxxxxxxxxxxxxxxxxxx',
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
    databaseId,
    databaseName,
    tablesToBeSynced,
    apiKey,
    accessToken,
    logger,
    onDatabaseReady,
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
  const onDatabaseReadyRef = useRef(onDatabaseReady);

  useEffect(() => {
    onDatabaseReadyRef.current = onDatabaseReady;
  }, [onDatabaseReady]);

  /** SERIALIZED CONFIG - Prevents unnecessary re-initialization */
  const serializedConfig = useMemo(
    () =>
      JSON.stringify({
        databaseId,
        databaseName,
        tables: tablesToBeSynced,
        apiKey,
        accessToken,
      }),
    [databaseId, databaseName, tablesToBeSynced, apiKey, accessToken]
  );

  /** INITIALIZATION EFFECT */
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        /** CLEANUP ORPHANED BACKGROUND CONNECTION */
        const orphanedDb = consumeActiveBackgroundDb();
        if (orphanedDb) {
          logger.warn(
            '⚠️ Found orphaned background sync connection — closing to release write lock'
          );
          try {
            orphanedDb.updateHook(null);
            orphanedDb.close();
            logger.info('✅ Orphaned connection closed');
          } catch (closeErr) {
            // Best effort — proceed regardless
            logger.warn(
              '⚠️ Could not close orphaned connection (may already be closed):',
              closeErr
            );
          }
        }

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

        /** RUN onDatabaseReady CALLBACK (e.g., migrations) */
        if (onDatabaseReadyRef.current) {
          logger.info('🔄 Running onDatabaseReady callback...');
          try {
            await onDatabaseReadyRef.current(localWriteDb);
            logger.info('✅ onDatabaseReady callback completed');
          } catch (err) {
            logger.error('❌ onDatabaseReady callback failed:', err);
            throw new Error(
              `onDatabaseReady callback failed: ${
                err instanceof Error ? err.message : err
              }`
            );
          }
        }

        /** EXPOSE DATABASE CONNECTIONS - only after tables are created */
        if (isMounted) {
          setWriteDb(localWriteDb);
          setReadDb(localReadDb);
          setInitError(null);
        }

        /** PHASE 2: SYNC INITIALIZATION */
        try {
          logger.info('🔄 Starting sync initialization...');

          await initializeSyncExtension(
            localWriteDb,
            {
              databaseId,
              databaseName,
              tablesToBeSynced,
              apiKey,
              accessToken,
            },
            logger
          );

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
        if (writeDbRef.current) {
          try {
            writeDbRef.current.close();
            logger.info('Write database closed after initialization failure');
          } catch (closeErr) {
            logger.error(
              '❌ Error closing write database after initialization failure:',
              closeErr
            );
          } finally {
            writeDbRef.current = null;
          }
        }
        if (readDbRef.current) {
          try {
            readDbRef.current.close();
            logger.info('Read database closed after initialization failure');
          } catch (closeErr) {
            logger.error(
              '❌ Error closing read database after initialization failure:',
              closeErr
            );
          } finally {
            readDbRef.current = null;
          }
        }
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
  }, [serializedConfig]);

  return {
    writeDb,
    readDb,
    writeDbRef,
    isSyncReady,
    initError,
    syncError,
  };
}
