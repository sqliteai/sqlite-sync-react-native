import { open, type DB } from '@op-engineering/op-sqlite';

/**
 * Opens and configures a database connection with the specified mode
 *
 * @param name - Database file name
 * @param mode - 'write' for read-write connection, 'read' for query-only connection
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
  mode: 'write' | 'read'
): Promise<DB> {
  /** OPEN DATABASE */
  const db = open({ name });

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
