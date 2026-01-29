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
  Under the hood, we use OP-SQLite — a low-level, JSI-enabled SQLite engine for React Native. With OP-SQLite, database operations run at near-native speed on iOS and Android.

## 📚 Table of Contents

- [Requirements](#-requirements)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Sync Behavior](#-sync-behavior)
- [API Reference](#-api-reference)
  - [SQLiteSyncProvider](#sqlitesyncprovider)
  - [Contexts](#contexts)
  - [Hooks](#hooks)
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
- **Optional (for push mode):**
  - [`expo-notifications`](https://docs.expo.dev/versions/latest/sdk/notifications/)
  - [`expo-constants`](https://docs.expo.dev/versions/latest/sdk/constants/)

> **⚠️ Note:** This library is **native-only** (iOS/Android).

## 📦 Installation

### 1. Install Dependencies

```bash
npm install @sqliteai/sqlite-sync-react-native @op-engineering/op-sqlite @react-native-community/netinfo
# or
yarn add @sqliteai/sqlite-sync-react-native @op-engineering/op-sqlite @react-native-community/netinfo
```

**Optional: For push mode (Expo projects only)**

```bash
npx expo install expo-notifications expo-constants
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
      syncMode="polling"
      adaptivePolling={{ baseInterval: 5000 }}
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

  // 3. WRITING DATA: Use transactions to trigger reactive queries
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

## 🔄 Sync Behavior

The library provides intelligent, lifecycle-aware synchronization that adapts to app state, network conditions, and sync activity.

### Sync Triggers

Synchronization happens automatically in response to meaningful events:

**Primary Triggers:**

- **App start** → immediate sync
- **App resume from background** → immediate sync (debounced to 5s)
- **Network reconnection** → immediate sync

**Secondary Triggers:**

_Polling Mode:_

- **Periodic polling while foreground** → interval adapts based on activity
- **No polling when backgrounded**

_Push Mode (Expo only):_

- **Push notification from SQLite Cloud** → immediate sync when changes detected on server

### Adaptive Polling Algorithm

In polling mode, the sync interval intelligently adjusts based on activity:

1. **Default State:** Uses `baseInterval` (default: 5s)
2. **Idle Backoff:** After `emptyThreshold` consecutive empty syncs (default: 5), interval increases gradually
   - Example: 5s → 7.5s → 11.25s → ... (capped at `maxInterval`)
3. **Error Backoff:** On sync failures, interval doubles exponentially
   - Example: 5s → 10s → 20s → 40s → ... (capped at `maxInterval`)
4. **Reset on Activity:** Any sync with changes resets interval to `baseInterval`
5. **Foreground Priority:** App resume triggers immediate sync and resets interval

**Example Timeline:**

```
App Start:        Sync (0 changes) → Next in 5s
5s later:         Sync (0 changes) → Next in 5s
10s later:        Sync (0 changes) → Next in 5s
15s later:        Sync (0 changes) → Next in 5s
20s later:        Sync (0 changes) → Next in 5s
25s later:        Sync (0 changes) → Next in 7.5s (idle backoff started)
32.5s later:      Sync (0 changes) → Next in 11.25s
43.75s later:     Sync (5 changes) → Next in 5s (reset to base)
App backgrounded: Polling paused
App foregrounded: Sync immediately → Next in 5s
```

### Push Mode (Expo Only)

Push notifications from SQLite Cloud trigger sync when there are changes to be synced. Sync still happens on foreground/network reconnect for reliability.

**Requirements:**

- `expo-notifications` - for push notification handling
- `expo-constants` - for EAS project ID required by push tokens

**Graceful Degradation:**

- If packages not installed → warning logged, push mode disabled
- If permissions denied → automatic fallback to polling mode
- If token retrieval fails → automatic fallback to polling mode

## 🎯 API Reference

### `SQLiteSyncProvider`

Main provider component that enables sync functionality.

#### Props

| Prop                            | Type                        | Required | Description                                                |
| ------------------------------- | --------------------------- | -------- | ---------------------------------------------------------- |
| `connectionString`              | `string`                    | ✅       | SQLite Cloud connection string                             |
| `databaseName`                  | `string`                    | ✅       | Local database file name                                   |
| `tablesToBeSynced`              | `TableConfig[]`             | ✅       | Array of tables to sync                                    |
| `apiKey`                        | `string`                    | \*       | API key for authentication                                 |
| `accessToken`                   | `string`                    | \*       | Access token for RLS authentication                        |
| `syncMode`                      | `'polling' \| 'push'`       | ❌       | Sync mode (default: `'polling'`)                           |
| `adaptivePolling`               | `AdaptivePollingConfig`     | ❌       | Adaptive polling configuration (polling mode only)         |
| `notificationListening`         | `'foreground' \| 'always'`  | ❌       | When to listen for push notifications (push mode only)     |
| `onBeforePushPermissionRequest` | `() => Promise<boolean>`    | ❌       | Custom UI before system permission prompt (push mode only) |
| `onDatabaseReady`               | `(db: DB) => Promise<void>` | ❌       | Callback after DB opens, before sync init (for migrations) |
| `debug`                         | `boolean`                   | ❌       | Enable debug logging (default: `false`)                    |
| `children`                      | `ReactNode`                 | ✅       | Child components                                           |

\* Either `apiKey` or `accessToken` is required

#### Sync Modes

The library supports two sync modes:

**Polling Mode (Default)**
Adaptive polling with intelligent interval adjustments:

- Syncs on app foreground, network reconnect
- Backs off when idle (no changes detected)
- Exponential backoff on errors
- Pauses when app is backgrounded

**Push Mode (Expo only)**
Uses push notifications from SQLite Cloud:

- Automatically falls back to polling if permissions denied
- Still syncs on foreground/network reconnect for reliability

**Example configurations:**

```typescript
// Polling mode with default settings (recommended)
<SQLiteSyncProvider
  syncMode="polling"
  // Uses defaults: baseInterval=5s, maxInterval=5min, emptyThreshold=5
>

// Polling mode with custom intervals
<SQLiteSyncProvider
  syncMode="polling"
  adaptivePolling={{
    baseInterval: 3000,    // 3s base interval
    maxInterval: 60000,    // 1min maximum backoff
    emptyThreshold: 3      // Back off after 3 empty syncs
  }}
>

// Push mode (requires expo-notifications)
<SQLiteSyncProvider
  syncMode="push"
  // Automatically falls back to polling if permissions denied
>
```

#### Background Sync Callback (Push Mode)

When using push mode with `notificationListening: 'always'`, you can register a callback that runs after background sync completes. This is useful for showing local notifications about new data:

```typescript
import { registerBackgroundSyncCallback } from '@sqliteai/sqlite-sync-react-native';
import * as Notifications from 'expo-notifications';

// Register at module level (outside components)
registerBackgroundSyncCallback(async ({ changes, db }) => {
  // Find new inserts in your table
  const newItems = changes.filter(
    (c) => c.table === 'tasks' && c.operation === 'INSERT'
  );

  if (newItems.length === 0) return;

  // Query the synced data
  const result = await db.execute(
    `SELECT * FROM tasks WHERE rowid IN (${newItems.map((c) => c.rowId).join(',')})`
  );

  // Show a local notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${newItems.length} new tasks synced`,
      body: result.rows?.[0]?.title || 'New data available',
    },
    trigger: null,
  });
});
```

#### Database Migrations with `onDatabaseReady`

Use `onDatabaseReady` to run migrations or other setup after the database opens but before sync initialization:

```typescript
<SQLiteSyncProvider
  connectionString="..."
  databaseName="myapp.db"
  apiKey="..."
  tablesToBeSynced={[...]}
  onDatabaseReady={async (db) => {
    // Check current schema version
    const { rows } = await db.execute('PRAGMA user_version');
    const version = rows?.[0]?.user_version ?? 0;

    // Run migrations
    if (version < 1) {
      await db.execute('ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0');
      await db.execute('PRAGMA user_version = 1');
    }
  }}
>
```

#### `AdaptivePollingConfig`

Configuration for adaptive polling behavior (polling mode only).

```typescript
interface AdaptivePollingConfig {
  /**
   * Base sync interval in milliseconds
   * Default: 5000 (5 seconds)
   */
  baseInterval?: number;

  /**
   * Maximum interval during backoff in milliseconds
   * Default: 300000 (5 minutes)
   */
  maxInterval?: number;

  /**
   * Number of consecutive empty syncs before backing off
   * Default: 5
   */
  emptyThreshold?: number;

  /**
   * Multiplier for idle backoff (when no changes detected)
   * Default: 1.5 (gentle backoff)
   */
  idleBackoffMultiplier?: number;

  /**
   * Multiplier for error backoff (when sync fails)
   * Default: 2.0 (aggressive backoff)
   */
  errorBackoffMultiplier?: number;
}
```

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

const { isSyncing, lastSyncTime, syncError, syncMode, currentSyncInterval } =
  useContext(SQLiteSyncStatusContext);
```

**Values:**

| Property                | Type                  | Description                                                          |
| ----------------------- | --------------------- | -------------------------------------------------------------------- |
| `syncMode`              | `'polling' \| 'push'` | Current sync mode (may differ from prop if push fallback to polling) |
| `isSyncReady`           | `boolean`             | Whether sync is configured and ready                                 |
| `isSyncing`             | `boolean`             | Whether sync is currently in progress                                |
| `lastSyncTime`          | `number \| null`      | Timestamp of last successful sync                                    |
| `lastSyncChanges`       | `number`              | Number of changes in last sync                                       |
| `syncError`             | `Error \| null`       | Recoverable sync error (db works offline-only)                       |
| `currentSyncInterval`   | `number \| null`      | Current polling interval in ms (null in push mode)                   |
| `consecutiveEmptySyncs` | `number`              | Number of consecutive syncs with no changes                          |
| `consecutiveSyncErrors` | `number`              | Number of consecutive sync errors                                    |
| `isAppInBackground`     | `boolean`             | Whether app is currently in background                               |
| `isNetworkAvailable`    | `boolean`             | Whether network connection is available                              |

#### `SQLiteSyncActionsContext`

Provides stable sync action functions. **Never changes**.

```typescript
import { useContext } from 'react';
import { SQLiteSyncActionsContext } from '@sqliteai/sqlite-sync-react-native';

const { triggerSync } = useContext(SQLiteSyncActionsContext);
```

**Values:**

| Property      | Type                  | Description                                   |
| ------------- | --------------------- | --------------------------------------------- |
| `triggerSync` | `() => Promise<void>` | Function to manually trigger a sync operation |

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
const { syncMode, isSyncing, lastSyncTime, syncError, currentSyncInterval } =
  useSyncStatus();

return (
  <View>
    <Text>Mode: {syncMode}</Text>
    <Text>{isSyncing ? 'Syncing...' : 'Idle'}</Text>
    {lastSyncTime && (
      <Text>Last sync: {new Date(lastSyncTime).toLocaleTimeString()}</Text>
    )}
    {currentSyncInterval && (
      <Text>Next sync: {currentSyncInterval / 1000}s</Text>
    )}
    {syncError && <Text>Sync error: {syncError.message}</Text>}
  </View>
);
```

**Returns:**

- `syncMode`: Current sync mode (`'polling'` or `'push'`)
- `isSyncReady`: Whether sync is configured
- `isSyncing`: Whether sync is in progress
- `lastSyncTime`: Last successful sync timestamp
- `lastSyncChanges`: Number of changes in last sync
- `syncError`: Recoverable sync error
- `currentSyncInterval`: Current polling interval (null in push mode)
- `consecutiveEmptySyncs`: Number of consecutive syncs with no changes
- `consecutiveSyncErrors`: Number of consecutive sync errors
- `isAppInBackground`: Whether app is in background
- `isNetworkAvailable`: Whether network is available

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

**How it works:** This hook is a convenience wrapper that exposes the `triggerSync` function from the Provider. The actual sync logic lives in `SQLiteSyncProvider` to ensure that `isSyncing`, `lastSyncTime`, and `lastSyncChanges` state are updated correctly, allowing all hooks (`useSqliteSyncQuery`) to react properly.

```typescript
const { triggerSync, isSyncing } = useTriggerSqliteSync();

// Trigger sync on button press
<Button
  onPress={triggerSync}
  disabled={isSyncing}
  title={isSyncing ? 'Syncing...' : 'Sync Now'}
/>;
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
const { execute } = useSqliteExecute();
const { executeTransaction } = useSqliteTransaction();

// ✅ This will trigger reactive queries
await executeTransaction(async (tx) => {
  await tx.execute('INSERT INTO tasks (id, title) VALUES (?, ?)', [id, title]);
});

// ❌ This will NOT trigger reactive queries
await execute('INSERT INTO tasks (id, title) VALUES (?, ?)', [id, title]);
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
interface SqliteExecuteOptions {
  readOnly?: boolean; // Use read-only connection (default: false)
}
```

**Returns:**

```typescript
{
  execute: (sql: string, params?: any[], options?: SqliteExecuteOptions) =>
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

> **Note:** This hook automatically syncs changes to the cloud after each write, so your data is pushed immediately. If you use op-sqlite's `db.execute()` directly instead, changes will **not** be synced automatically — you would need to call `db.execute('SELECT cloudsync_network_send_changes()')` manually.

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

> **Note:** This hook automatically syncs changes to the cloud after each transaction commits, so your data is pushed immediately. If you use op-sqlite's `db.transaction()` directly instead, changes will **not** be synced automatically — you would need to call `db.execute('SELECT cloudsync_network_send_changes()')` manually.

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

- **[sync-demo-expo](./examples/sync-demo-expo)** - Expo development build with sync demonstration using push notifications
- **[sync-demo-bare](./examples/sync-demo-bare)** - Bare React Native project with sync demonstration using polling

## 🔗 Links

- [SQLite Sync Documentation](https://docs.sqlitecloud.io/docs/sqlite-sync-introduction) - Detailed sync docs with API references and best practices
- [SQLite Cloud Dashboard](https://dashboard.sqlitecloud.io/) - Manage your databases
- [OP-SQLite API Reference](https://op-engineering.github.io/op-sqlite/docs/api)
