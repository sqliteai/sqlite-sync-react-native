import { open, type DB } from '@op-engineering/op-sqlite';

/**
 * Opens and configures a database connection with the specified mode
 *
 * @param name - Database file name
 * @param mode - 'write' for read-write connection, 'read' for query-only connection
 * @param onOpen - Optional callback invoked synchronously after open(), before any awaited PRAGMAs.
 *                 Use this to register ownership of the raw connection before any async gap.
 * @returns Configured database instance
 *
 * @example
 * ```typescript
 * const writeDb = await createDatabase('app.db', 'write');
 * const readDb = await createDatabase('app.db', 'read');
 * ```
 */
export async function createDatabase(
  name: string,
  mode: 'write' | 'read',
  onOpen?: (db: DB) => void
): Promise<DB> {
  /** OPEN DATABASE */
  const db = open({ name });
  onOpen?.(db);

  /** CONFIGURE BUSY TIMEOUT */
  // Cross-process fallback: if another process holds a lock (e.g. Android background task),
  // retry for up to 10s before giving up
  await db.execute('PRAGMA busy_timeout = 10000');

  /** CONFIGURE WAL MODE */
  // WAL mode enables concurrent reads and writes
  await db.execute('PRAGMA journal_mode = WAL');

  /** CONFIGURE CONNECTION MODE */
  if (mode === 'write') {
    await db.execute('PRAGMA synchronous = NORMAL');
    await db.execute('PRAGMA locking_mode = NORMAL');
  } else {
    await db.execute('PRAGMA query_only = true');
  }

  return db;
}
