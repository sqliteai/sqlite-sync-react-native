import { useContext } from 'react';
import { SQLiteDbContext } from '../../SQLiteDbContext';

/**
 * Hook to access the SQLite database instance and initialization errors.
 *
 * This hook only subscribes to database-related state (db, initError),
 * so components won't re-render on every sync operation.
 *
 * @returns Object containing db and initError
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { db, initError } = useSqliteDb();
 *
 *   if (initError) {
 *     return <Text>Error: {initError.message}</Text>;
 *   }
 *
 *   if (!db) {
 *     return <Text>Loading...</Text>;
 *   }
 *
 *   return <Text>Database ready!</Text>;
 * }
 * ```
 */
export function useSqliteDb() {
  return useContext(SQLiteDbContext);
}
