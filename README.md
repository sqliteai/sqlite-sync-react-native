# @sqliteai/sqlite-sync-react-native

[![Status: Beta](https://img.shields.io/badge/status-in%20development-yellow)](https://github.com/sqliteai/sqlite-sync-react-native)
[![npm version](https://img.shields.io/npm/v/@sqliteai/sqlite-sync-react-native.svg)](https://www.npmjs.com/package/@sqliteai/sqlite-sync-react-native)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Build real-time, collaborative mobile apps that work seamlessly offline and automatically sync when online. Powered by [SQLite Sync](https://github.com/sqliteai/sqlite-sync).

## ✨ Features

- 🧩 **Offline-First, Automatic Sync**  
  Wrap your app with `SQLiteSyncProvider` to get a local database with automatic, bi-directional cloud synchronization. Your app works fully offline, and all local changes are synced seamlessly when online.

- 🪝 **React Hooks with Reactive Queries**
  Use `useSqliteSyncQuery` for table-level reactivity and `useOnTableUpdate` for row-level notifications. Your UI automatically updates when data changes, locally or from the cloud — no manual refresh needed.

- 🔧 **Zero-Configuration Extension Loading**  
  The SQLite Sync extension is automatically loaded and configured for you.
  No manual setup required — just access the full [SQLite Sync API](https://github.com/sqliteai/sqlite-sync/blob/main/API.md) directly through the `writeDb` / `readDb` instances.

- 📱 **Native-Only, Ultra-Fast**  
  Under the hood, we use OP-SQLite — a low-level, JSI-enabled SQLite engine for React Native With OP-SQLite, database operations run at near-native speed on iOS and Android.

## 📚 Table of Contents

- [Requirements](#-requirements)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [API Reference](#-api-reference)
  - [SQLiteSyncProvider](#sqlitesyncprovider)
  - [Contexts](#contexts)
    - [SQLiteDbContext](#sqlitedbcontext)
    - [SQLiteSyncStatusContext](#sqlitesyncstatuscontext)
    - [SQLiteSyncActionsContext](#sqlitesyncactionscontext)
  - [Hooks](#hooks)
    - [useSqliteDb](#usesqlitedb)
    - [useSyncStatus](#usesyncstatus)
    - [useSqliteSync](#usesqlitesync)
    - [useTriggerSqliteSync](#usetriggersqlitesync)
    - [useOnSqliteSync](#useonsqlitesync)
    - [useSqliteSyncQuery](#usesqlitesyncquery)
    - [useOnTableUpdate](#useontableupdate)
    - [useSqliteExecute](#usesqliteexecute)
    - [useSqliteTransaction](#usesqlitetransaction)
  - [Types](#types)
- [Error Handling](#-error-handling)
- [Debug Logging](#-debug-logging)
- [Examples](#-examples)
- [Links](#-links)

## 📋 Requirements

- iOS **13.0+**
- Android **API 26+**
- [`@op-engineering/op-sqlite`](https://github.com/OP-Engineering/op-sqlite) **^15.1.14**
- [`@react-native-community/netinfo`](https://github.com/react-native-netinfo/react-native-netinfo) **^11.0.0**
- [SQLite Cloud](https://sqlitecloud.io/) account

> **⚠️ Note:** This library is **native-only** (iOS/Android).

## 📦 Installation

### 1. Install Dependencies

```bash
npm install @sqliteai/sqlite-sync-react-native @op-engineering/op-sqlite @react-native-community/netinfo
# or
yarn add @sqliteai/sqlite-sync-react-native @op-engineering/op-sqlite @react-native-community/netinfo
```

### 2. Platform Setup

#### iOS

```bash
cd ios && pod install
```

#### Android

No additional setup required. Native modules are linked automatically.

#### Expo

If using Expo, you must use **development builds** (Expo Go is not supported):

```bash
# Generate native directories
npx expo prebuild

# Run on iOS/Android
npx expo run:ios
# or
npx expo run:android
```

## 🚀 Quick Start

### 1. Set Up SQLite Cloud

1. **Create an account**  
   Sign up at the [SQLite Cloud Dashboard](https://dashboard.sqlitecloud.io/).

2. **Create a database**  
   Follow the [database creation guide](https://docs.sqlitecloud.io/docs/create-database).

   > Ensure your tables have identical schemas in both local and cloud databases.

3. **Enable OffSync**  
   Configure OffSync by following the [OffSync setup guide](https://docs.sqlitecloud.io/docs/offsync#:~:text=in%20the%20cloud.-,Configuring%20OffSync,-You%20can%20enable).

4. **Get credentials**  
   Copy your **connection string** and **API key** from the dashboard.
   - Alternatively, you can use [access tokens](https://docs.sqlitecloud.io/docs/access-tokens) for [Row-Level Security](https://docs.sqlitecloud.io/docs/rls).

### 2. Wrap Your App

The `SQLiteSyncProvider` needs a `createTableSql` statement for each table you want to sync. This is required because tables must exist before SQLiteSync initialization.

```typescript
import { SQLiteSyncProvider } from '@sqliteai/sqlite-sync-react-native';

export default function App() {
  return (
    <SQLiteSyncProvider
      connectionString="sqlitecloud://your-host.sqlite.cloud:8860/your-database"
      databaseName="myapp.db"
      apiKey="your-api-key"
      syncInterval={5000}
      tablesToBeSynced={[
        {
          name: 'tasks',
          createTableSql: `
            CREATE TABLE IF NOT EXISTS tasks (
              id TEXT PRIMARY KEY NOT NULL,
              title TEXT,
              completed INTEGER DEFAULT 0,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
          `,
        },
      ]}
    >
      <YourApp />
    </SQLiteSyncProvider>
  );
}
```

### 3. Use the Hooks

The library provides specialized hooks to simplify querying, syncing, and state management.

```typescript
import { useCallback } from 'react';
import {
  useSqliteSyncQuery,
  useOnTableUpdate,
  useTriggerSqliteSync,
  useOnSqliteSync,
  useSqliteTransaction,
} from '@sqliteai/sqlite-sync-react-native';

interface Task {
  id: string;
  title: string;
  completed: number;
}

function TaskList() {
  // 1. REACTIVE QUERY: Automatically updates when table changes (via transactions)
  const {
    data: tasks,
    isLoading,
    error,
  } = useSqliteSyncQuery<Task>({
    query: 'SELECT * FROM tasks ORDER BY created_at DESC',
    arguments: [],
    fireOn: [{ table: 'tasks' }],
  });

  // 2. ROW-LEVEL NOTIFICATIONS: Get notified of individual INSERT/UPDATE/DELETE
  useOnTableUpdate<Task>({
    tables: ['tasks'],
    onUpdate: (data) => {
      console.log(`Row ${data.operation}:`, data.row);
    },
  });

  // 3. SYNC COMPLETION: React to cloud sync events
  useOnSqliteSync(() => {
    console.log('✨ New data synced from cloud!');
  });

  // 4. WRITING DATA: Use transactions to trigger reactive queries
  const { executeTransaction } = useSqliteTransaction();
  const { triggerSync, isSyncing } = useTriggerSqliteSync();

  const addTask = useCallback(
    async (title: string) => {
      // Use transaction to trigger reactive query update
      // Uses writeDb by default (no need to specify readOnly: false)
      await executeTransaction(async (tx) => {
        await tx.execute(
          'INSERT INTO tasks (id, title) VALUES (cloudsync_uuid(), ?);',
          [title]
        );
      });
      // Optional: Push changes to cloud immediately
      triggerSync();
    },
    [executeTransaction, triggerSync]
  );

  if (isLoading) return <Text>Loading local DB...</Text>;
  if (error) return <Text>Error: {error.message}</Text>;

  return (
    <View>
      <Button
        title={isSyncing ? 'Syncing...' : 'Sync Now'}
        onPress={triggerSync}
        disabled={isSyncing}
      />

      {tasks.map((task) => (
        <Text key={task.id}>{task.title}</Text>
      ))}

      <Button title="Add Task" onPress={() => addTask('New Task')} />
    </View>
  );
}
```

## 🎯 API Reference

### `SQLiteSyncProvider`

Main provider component that enables sync functionality.

#### Props

| Prop               | Type            | Required | Description                             |
| ------------------ | --------------- | -------- | --------------------------------------- |
| `connectionString` | `string`        | ✅       | SQLite Cloud connection string          |
| `databaseName`     | `string`        | ✅       | Local database file name                |
| `tablesToBeSynced` | `TableConfig[]` | ✅       | Array of tables to sync                 |
| `syncInterval`     | `number`        | ✅       | Sync interval in milliseconds           |
| `apiKey`           | `string`        | \*       | API key for authentication              |
| `accessToken`      | `string`        | \*       | Access token for RLS authentication     |
| `debug`            | `boolean`       | ❌       | Enable debug logging (default: `false`) |
| `children`         | `ReactNode`     | ✅       | Child components                        |

\* Either `apiKey` or `accessToken` is required

#### `TableConfig`

```typescript
interface TableConfig {
  name: string; // Table name (must match cloud table)
  createTableSql: string; // CREATE TABLE SQL statement
}
```

**Example:**

```typescript
{
  name: 'users',
  createTableSql: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT,
      email TEXT UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `
}
```

**Important:**

- Always include `IF NOT EXISTS` to prevent errors if the table already exists
- The table schema must match exactly to your remote table schema in SQLite Cloud
- The library executes this SQL during initialization, before SQLiteSync setup

#### `ReactiveQueryConfig`

Configuration for reactive queries with table-level granularity.

```typescript
interface ReactiveQueryConfig {
  /**
   * The SQL query to execute
   */
  query: string;

  /**
   * Query parameters/arguments (optional)
   */
  arguments?: any[];

  /**
   * Tables to monitor for changes
   */
  fireOn: Array<{
    /** Table name to monitor */
    table: string;
    /** Optional: specific operation to monitor (INSERT, UPDATE, or DELETE) */
    operation?: 'INSERT' | 'UPDATE' | 'DELETE';
  }>;
}
```

#### `TableUpdateData<T>`

Row-level update event data from op-sqlite's updateHook.

```typescript
interface TableUpdateData<T = any> {
  /**
   * The table that was modified
   */
  table: string;

  /**
   * The type of operation that occurred
   *
   * Possible values:
   * - 'DELETE' - Row was deleted
   * - 'INSERT' - Row was inserted
   * - 'UPDATE' - Row was updated
   */
  operation: 'INSERT' | 'UPDATE' | 'DELETE';

  /**
   * SQLite's internal rowid (NOT your table's primary key)
   */
  rowId: number;

  /**
   * The row data retrieved from the database
   *
   * The hook automatically queries the database to fetch the row data.
   * For DELETE operations, this will be null since the row no longer exists.
   */
  row: T | null;
}
```

#### `TableUpdateConfig<T>`

Configuration for row-level table update listeners.

```typescript
interface TableUpdateConfig<T = any> {
  /**
   * List of table names to monitor for changes
   */
  tables: string[];

  /**
   * Callback function executed when a monitored table is updated
   *
   * Receives detailed information about the row-level change
   * including the operation type (INSERT/UPDATE/DELETE) and row data
   */
  onUpdate: (data: TableUpdateData<T>) => void;
}
```

### Contexts

The library provides three separate React Contexts for optimized re-renders:

#### `SQLiteDbContext`

Provides database connections and initialization errors. **Rarely changes** (only on init/error).

**Dual Connection Architecture:**
The library opens **two connections** to the same database file for optimal performance:

- **writeDb** - Write connection for sync operations, reactive queries, update hooks, and write operations
- **readDb** - Read-only connection for read-only queries (optional for performance)

Both connections use SQLite's WAL (Write-Ahead Logging) mode to enable concurrent read/write access without blocking.

```typescript
import { useContext } from 'react';
import { SQLiteDbContext } from '@sqliteai/sqlite-sync-react-native';

const { writeDb, readDb, initError } = useContext(SQLiteDbContext);
```

**Values:**

| Property    | Type            | Description                                                                                                            |
| ----------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `writeDb`   | `DB \| null`    | Write [op-sqlite](https://op-engineering.github.io/op-sqlite/docs/api) connection with SQLite Sync extension loaded    |
| `readDb`    | `DB \| null`    | Read-only [op-sqlite](https://op-engineering.github.io/op-sqlite/docs/api) connection for read-only queries (optional) |
| `initError` | `Error \| null` | Fatal database error (connections unavailable)                                                                         |

#### `SQLiteSyncStatusContext`

Provides sync status information. **Changes frequently** (on every sync).

```typescript
import { useContext } from 'react';
import { SQLiteSyncStatusContext } from '@sqliteai/sqlite-sync-react-native';

const { isSyncing, lastSyncTime, syncError } = useContext(
  SQLiteSyncStatusContext
);
```

**Values:**

| Property          | Type             | Description                                    |
| ----------------- | ---------------- | ---------------------------------------------- |
| `isSyncReady`     | `boolean`        | Whether sync is configured and ready           |
| `isSyncing`       | `boolean`        | Whether sync is currently in progress          |
| `lastSyncTime`    | `number \| null` | Timestamp of last successful sync              |
| `lastSyncChanges` | `number`         | Number of changes in last sync                 |
| `syncError`       | `Error \| null`  | Recoverable sync error (db works offline-only) |

#### `SQLiteSyncActionsContext`

Provides stable sync action functions. **Never changes**.

```typescript
import { useContext } from 'react';
import { SQLiteSyncActionsContext } from '@sqliteai/sqlite-sync-react-native';

const { triggerSync } = useContext(SQLiteSyncActionsContext);
```

**Values:**

| Property      | Type                                   | Description                                                               |
| ------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| `triggerSync` | `() => Promise<void>`                  | Function to manually trigger a sync operation                             |
| `subscribe`   | `(callback: () => void) => () => void` | Subscribe to sync events without re-renders. Returns unsubscribe function |

**Note:** Most users should use the [specialized hooks](#hooks) instead of accessing contexts directly.

### Hooks

The library provides specialized hooks for different use cases. Choose the right hook based on what data your component needs to avoid unnecessary re-renders.

#### `useSqliteDb()`

Access the database connections and initialization errors **without subscribing to sync updates**. This hook is optimized for components that only need database access and won't re-render on every sync.

```typescript
const { writeDb, readDb, initError } = useSqliteDb();
```

**Returns:**

- `writeDb`: Write database connection
- `readDb`: Read-only database connection
- `initError`: Fatal initialization error

**Best for:** Components that need database access but don't need sync status.

**Note:** In most cases, you should use the specialized hooks (`useSqliteExecute`, `useSqliteTransaction`, `useSqliteSyncQuery`) instead of accessing database connections directly.

**About the database connections:**

Both `writeDb` and `readDb` are `DB` instances from [`@op-engineering/op-sqlite`](https://op-engineering.github.io/op-sqlite/docs/api). The `writeDb` connection has the **SQLite Sync extension loaded**. This means you can:

- Use the full [op-sqlite API](https://op-engineering.github.io/op-sqlite/docs/api) for standard database operations
- Use any [SQLite Sync functions](https://github.com/sqliteai/sqlite-sync/blob/main/API.md) like `cloudsync_uuid()`, `cloudsync_changes()`, etc.
- Use `writeDb` for all sync operations, reactive queries, and writes
- Use `readDb` for read-only queries (optional performance optimization)

#### `useSyncStatus()`

Access sync status information, use this when you need to display sync state in your UI.

```typescript
const { isSyncing, lastSyncTime, syncError, isSyncReady, lastSyncChanges } =
  useSyncStatus();

return (
  <View>
    <Text>{isSyncing ? 'Syncing...' : 'Idle'}</Text>
    {lastSyncTime && (
      <Text>Last sync: {new Date(lastSyncTime).toLocaleTimeString()}</Text>
    )}
    {syncError && <Text>Sync error: {syncError.message}</Text>}
  </View>
);
```

**Returns:**

- `isSyncReady`: Whether sync is configured
- `isSyncing`: Whether sync is in progress
- `lastSyncTime`: Last successful sync timestamp
- `lastSyncChanges`: Number of changes in last sync
- `syncError`: Recoverable sync error

**Best for:** Status displays, sync indicators, monitoring components.

#### `useSqliteSync()`

Access all sync functionality (database + status + actions). This is a convenience hook that combines all contexts.

**Note:** This hook will re-render on every sync operation. If you only need `db`/`initError`, use `useSqliteDb()` instead.

```typescript
const { db, initError, isSyncing, lastSyncTime, triggerSync } = useSqliteSync();

return (
  <View>
    <Text>Database: {db ? 'Ready' : 'Loading'}</Text>
    <Button onPress={triggerSync} disabled={isSyncing} />
  </View>
);
```

**Returns:** All properties from `useSqliteDb()` + `useSyncStatus()` + `triggerSync` function

**Best for:** Components that need access to everything (use sparingly to avoid unnecessary re-renders).

#### `useTriggerSqliteSync()`

Manually trigger a sync operation.

**How it works:** This hook is a convenience wrapper that exposes the `triggerSync` function from the Provider. The actual sync logic lives in `SQLiteSyncProvider` to ensure that `isSyncing`, `lastSyncTime`, and `lastSyncChanges` state are updated correctly, allowing all hooks (`useOnSqliteSync`, `useSqliteSyncQuery`) to react properly.

```typescript
const { triggerSync, isSyncing } = useTriggerSqliteSync();

// Trigger sync on button press
<Button
  onPress={triggerSync}
  disabled={isSyncing}
  title={isSyncing ? 'Syncing...' : 'Sync Now'}
/>;
```

#### `useOnSqliteSync(callback)`

Execute a callback when sync completes with changes.

**Important:**

- This hook does NOT run on initial mount - it's an event listener for sync updates only. For initial data loading, use a separate `useEffect` or `useSqliteSyncQuery`
- This hook uses a subscription pattern that does NOT cause re-renders when sync completes without changes

```typescript
import { useEffect, useCallback } from 'react';

const loadData = useCallback(async () => {
  const result = await db?.execute('SELECT * FROM tasks;');
  setTasks(result?.rows || []);
}, [db]);

// 1. Initial Load (Run once when DB is ready)
useEffect(() => {
  if (db) loadData();
}, [db, loadData]);

// 2. Sync Updates (Run only when cloud data arrives)
useOnSqliteSync(loadData);
```

#### `useSqliteSyncQuery(config)`

Execute a reactive query with table-level granularity using op-sqlite's `reactiveExecute`.

**How it works:** This hook uses [op-sqlite's reactive queries](https://op-engineering.github.io/op-sqlite/docs/reactive_queries) to automatically re-run the query when specified tables are modified via transactions. Always uses **writeDb** to ensure queries see sync changes immediately.

**Key Features:**

- **Automatic updates:** Query re-runs when monitored tables change
- **Initial data loading:** Executes query immediately when database is ready

**Parameters:**

```typescript
interface ReactiveQueryConfig {
  query: string; // SQL query to execute
  arguments?: any[]; // Query parameters (optional)
  fireOn: Array<{
    // Tables to monitor
    table: string;
    operation?: 'INSERT' | 'UPDATE' | 'DELETE'; // Optional: specific operation
  }>;
}
```

**Returns:**

```typescript
{
  data: T[];              // Query results
  isLoading: boolean;     // True during initial load
  error: Error | null;    // Query error
  unsubscribe: () => void; // Manually unsubscribe (auto-cleanup on unmount)
}
```

**Example:**

```typescript
const { data, isLoading, error } = useSqliteSyncQuery<Task>({
  query: 'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
  arguments: [userId],
  fireOn: [{ table: 'tasks' }, { table: 'task_assignments' }],
});

if (isLoading) return <Spinner />;
if (error) return <Error message={error.message} />;

return (
  <FlatList data={data} renderItem={({ item }) => <TaskItem task={item} />} />
);
```

**Important: Use Transactions for Writes**

Reactive queries **only fire on committed transactions**. When writing data, always use transactions:

```typescript
// ✅ This will trigger reactive queries
await db.transaction(async (tx) => {
  await tx.execute('INSERT INTO tasks (id, title) VALUES (?, ?);', [id, title]);
});

// ❌ This will NOT trigger reactive queries
await db.execute('INSERT INTO tasks (id, title) VALUES (?, ?);', [id, title]);
```

The library automatically wraps sync operations in transactions, so reactive queries update when cloud changes arrive.

#### `useOnTableUpdate(config)`

Listen for row-level changes (INSERT, UPDATE, DELETE) on specified tables using op-sqlite's `updateHook`.

**How it works:** This hook uses op-sqlite's `updateHook` to receive individual row change notifications. Unlike reactive queries which re-run the entire query, this hook fires for each row modification and automatically fetches the complete row data for you. Always uses **writeDb** to ensure update hooks see sync changes immediately.

**Key Features:**

- **Row-level granularity:** Callback fires for each individual row change
- **Operation details:** Know exactly what operation (INSERT/UPDATE/DELETE) occurred
- **Automatic row fetching:** Row data is queried and provided in the callback

**Parameters:**

```typescript
interface TableUpdateConfig<T = any> {
  tables: string[]; // Tables to monitor
  onUpdate: (data: TableUpdateData<T>) => void; // Callback function
}

interface TableUpdateData<T = any> {
  table: string; // Table that was modified
  operation: 'INSERT' | 'UPDATE' | 'DELETE'; // Operation type
  rowId: number; // SQLite internal rowid (not your primary key)
  row: T | null; // Row data (null for DELETE operations)
}
```

**Example:**

```typescript
interface Task {
  id: string;
  title: string;
  completed: boolean;
}

useOnTableUpdate<Task>({
  tables: ['tasks', 'notes'],
  onUpdate: (data) => {
    console.log(`Table: ${data.table}`);
    console.log(`Operation: ${data.operation}`);

    if (data.row) {
      // Row data is automatically fetched and typed
      Toast.show(
        `Task "${data.row.title}" was ${data.operation.toLowerCase()}d`
      );

      // Update analytics
      analytics.track('task_modified', {
        operation: data.operation,
        taskId: data.row.id,
      });
    } else {
      // DELETE operations have null row
      console.log('Row was deleted');
    }
  },
});
```

**Note:** For DELETE operations, `row` will be `null` since the row no longer exists in the database.

#### `useSqliteExecute()`

Execute SQL commands with configurable connection selection (write or read-only).

**How it works:** This hook provides an imperative way to execute SQL commands. Unlike `useSqliteSyncQuery` (which is declarative and reactive), this hook ensures all requests are processed by SQLite in the order they're called.

**Connection Selection:**

- By default, uses **writeDb** (sees sync changes, can write)
- Pass `{ readOnly: true }` to use **readDb** (read-only queries)

**Parameters:**

```typescript
interface ExecuteOptions {
  readOnly?: boolean; // Use read-only connection (default: false)
}
```

**Returns:**

```typescript
{
  execute: (sql: string, params?: any[], options?: ExecuteOptions) =>
    Promise<QueryResult | undefined>;
  isExecuting: boolean; // True while executing
  error: Error | null; // Execution error
}
```

**Example:**

```typescript
import { useSqliteExecute } from '@sqliteai/sqlite-sync-react-native';

function TaskManager() {
  const { execute, isExecuting, error } = useSqliteExecute();

  const addTask = async (title: string) => {
    try {
      // Write operation (uses writeDb by default)
      const result = await execute(
        'INSERT INTO tasks (id, title) VALUES (cloudsync_uuid(), ?)',
        [title]
      );
      console.log('Inserted row ID:', result?.insertId);
    } catch (err) {
      console.error('Failed to insert:', err);
    }
  };

  const getTask = async (id: string) => {
    try {
      // Read operation (explicitly use readDb for performance)
      const result = await execute('SELECT * FROM tasks WHERE id = ?', [id], {
        readOnly: true,
      });
      return result?.rows?.[0];
    } catch (err) {
      console.error('Failed to fetch:', err);
    }
  };

  return (
    <View>
      <Button
        title="Add Task"
        onPress={() => addTask('New Task')}
        disabled={isExecuting}
      />
      {error && <Text>Error: {error.message}</Text>}
    </View>
  );
}
```

**Important:** Direct `execute()` calls do NOT trigger reactive queries. To trigger reactive queries, use `useSqliteTransaction()` instead.

#### `useSqliteTransaction()`

Execute SQL commands within a transaction for atomic write operations.

**Returns:**

```typescript
{
  executeTransaction: (fn: (tx: Transaction) => Promise<void>) => Promise<void>;
  isExecuting: boolean; // True while executing
  error: Error | null; // Transaction error
}
```

**Example:**

```typescript
import { useSqliteTransaction } from '@sqliteai/sqlite-sync-react-native';

function TaskManager() {
  const { executeTransaction, isExecuting } = useSqliteTransaction();

  const addTaskWithLog = async (title: string) => {
    try {
      // Execute multiple writes atomically
      // This will trigger reactive queries when it commits
      await executeTransaction(async (tx) => {
        await tx.execute(
          'INSERT INTO tasks (id, title) VALUES (cloudsync_uuid(), ?)',
          [title]
        );
        await tx.execute('INSERT INTO logs (action, timestamp) VALUES (?, ?)', [
          'task_created',
          Date.now(),
        ]);
      });
      console.log('Task and log inserted successfully');
    } catch (err) {
      console.error('Transaction failed:', err);
    }
  };

  return (
    <Button
      title="Add Task"
      onPress={() => addTaskWithLog('New Task')}
      disabled={isExecuting}
    />
  );
}
```

**Important:** Transactions automatically trigger reactive queries when they commit successfully. This is the recommended way to write data when using `useSqliteSyncQuery`.

## 🚨 Error Handling

The library separates **fatal database errors** from **recoverable sync errors** to enable true offline-first operation.

### Database Errors (`initError`)

**Fatal errors** that prevent the database from working at all. The app cannot function when these occur.

```typescript
const { initError, db } = useSqliteDb();

if (initError) {
  return <ErrorScreen message="Database unavailable" />;
}
```

**Common causes:**

- Unsupported platform (web, Windows, etc.)
- Missing database name
- Failed to open database file
- Failed to create tables

**When this happens:** The `db` instance will be `null` and the app cannot work offline or online.

### Sync Errors (`syncError`)

**Recoverable errors** that prevent syncing but allow full offline database access.

```typescript
const { db } = useSqliteDb();
const { syncError } = useSyncStatus();

// Database still works offline even with syncError!
if (db) {
  await db.execute('INSERT INTO tasks ...');
}

// Show non-blocking warning
{
  syncError && <Banner warning={syncError.message} />;
}
```

**Common causes:**

- Missing or invalid connection string
- Missing or invalid API key/access token
- SQLiteSync extension failed to load
- Network initialization failed
- Temporary network connectivity issues

**When this happens:** The `db` instance is available and fully functional for local-only operations. Sync will be retried on the next interval or when credentials are provided.

**Important:** Sync errors automatically clear on the next successful sync.

## 🐛 Debug Logging

Enable detailed logging during development:

```typescript
<SQLiteSyncProvider
  // ... other props
  debug={__DEV__} // Enable in development only
>
```

**When enabled, logs:**

- Database initialization steps
- Extension loading
- Table creation
- Network setup
- Sync operations
- Change counts

## 📖 Examples

Check out the [examples](./examples) directory for complete working examples:

- **[sync-demo](./examples/sync-demo)** - Basic sync demonstration with CRUD operations

## 🔗 Links

- [SQLite Sync Documentation](https://docs.sqlitecloud.io/docs/sqlite-sync) - Detailed sync docs with API references and best practices
- [SQLite Cloud Dashboard](https://dashboard.sqlitecloud.io/) - Manage your databases
- [OP-SQLite API Reference](https://op-engineering.github.io/op-sqlite/docs/api)
