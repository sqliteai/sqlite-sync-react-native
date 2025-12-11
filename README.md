# @sqliteai/sqlite-sync-react-native

[![Status: Beta](https://img.shields.io/badge/status-in%20development-yellow)](https://github.com/sqliteai/sqlite-sync-react-native)
[![npm version](https://img.shields.io/npm/v/@sqliteai/sqlite-sync-react-native.svg)](https://www.npmjs.com/package/@sqliteai/sqlite-sync-react-native)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Build real-time, collaborative mobile apps that work seamlessly offline and automatically sync when online. Powered by [SQLite Sync](https://github.com/sqliteai/sqlite-sync).

## ✨ Features

- 🧩 **Offline-First, Automatic Sync**  
  Wrap your app with `SQLiteSyncProvider` to get a local database with automatic, bi-directional cloud synchronization. Your app works fully offline, and all local changes are synced seamlessly when online.
- 🪝 **React Hooks Designed for Sync-Aware Data**
  Use hooks like `useSqliteSyncQuery` and `useOnSqliteSync` to automatically refresh your UI when changes are synced from the cloud, keeping your app up-to-date without boilerplate code.
- 📱 **Native‑Only, Ultra‑Fast**  
  Under the hood, we use OP‑SQLite — a low‑level, JSI‑enabled SQLite engine for React Native. With OP‑SQLite, database operations run at near-native speed on iOS and Android.

## 📋 Requirements

- Android **API 26+**
- [`@op-engineering/op-sqlite`](https://github.com/OP-Engineering/op-sqlite) **^15.0.0**
- [SQLite Cloud](https://sqlitecloud.io/) account

> **⚠️ Note:** This library is **native-only** (iOS/Android).

## 📦 Installation

### 1. Install Dependencies

```bash
npm install @sqliteai/sqlite-sync-react-native @op-engineering/op-sqlite
# or
yarn add @sqliteai/sqlite-sync-react-native @op-engineering/op-sqlite
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

```typescript
import { useContext, useState, useCallback } from 'react';
import {
  SQLiteSyncContext,
  useOnSqliteSync,
} from '@sqliteai/sqlite-sync-react-native';

function TaskList() {
  const { db, isSyncing } = useContext(SQLiteSyncContext);
  const [tasks, setTasks] = useState([]);

  const loadTasks = useCallback(async () => {
    if (!db) return;
    const result = await db.execute('SELECT * FROM tasks;');
    setTasks(result?.rows || []);
  }, [db]);

  // Auto-refresh tasks when sync completes
  useOnSqliteSync(loadTasks);

  const addTask = useCallback(
    async (title: string) => {
      if (!db) return;
      await db.execute(
        'INSERT INTO tasks (id, title) VALUES (cloudsync_uuid(), ?);',
        [title]
      );
      loadTasks(); // Refresh immediately after insert
    },
    [db, loadTasks]
  );

  return (
    <View>
      <Text>{isSyncing ? '🔄 Syncing...' : '✓ Synced'}</Text>
      {tasks.map((task) => (
        <Text key={task.id}>{task.title}</Text>
      ))}
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

### Context: `SQLiteSyncContext`

Access sync state and database instance.

```typescript
const context = useContext(SQLiteSyncContext);
```

#### Context Values

| Property          | Type             | Description                                                                                                                         |
| ----------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `db`              | `DB \| null`     | [op-sqlite](https://op-engineering.github.io/op-sqlite/docs/api) database instance. Check `db !== null` to verify database is ready |
| `isSyncReady`     | `boolean`        | `true` when sync is configured and ready. `false` means offline-only mode                                                           |
| `isSyncing`       | `boolean`        | `true` during sync operations                                                                                                       |
| `lastSyncTime`    | `number \| null` | Timestamp of last successful sync                                                                                                   |
| `lastSyncChanges` | `number`         | Number of changes in last sync                                                                                                      |
| `initError`       | `Error \| null`  | Fatal database error (db unavailable)                                                                                               |
| `syncError`       | `Error \| null`  | Recoverable sync error (db works offline-only)                                                                                      |

**Note:** The `db` property is a `DB` instance from [`@op-engineering/op-sqlite`](https://op-engineering.github.io/op-sqlite/docs/api). You can use the full op-sqlite API for queries, transactions, and other database operations.

### Hooks

#### `useTriggerSqliteSync()`

Manually trigger a sync operation.

```typescript
const { triggerSync } = useTriggerSqliteSync();

// Trigger sync on button press
<Button onPress={triggerSync} title="Sync Now" />;
```

#### `useOnSqliteSync(callback)`

Execute a callback when sync completes with changes.

**Important:** Wrap your callback in `useCallback` to avoid unnecessary re-renders.

```typescript
import { useCallback } from 'react';

const loadData = useCallback(async () => {
  const result = await db?.execute('SELECT * FROM tasks;');
  setTasks(result?.rows || []);
}, [db]);

useOnSqliteSync(loadData);
```

#### `useSqliteSyncQuery(query)`

Execute a query and automatically re-run when sync updates.

```typescript
const { data, loading, error } = useSqliteSyncQuery<Task>(
  'SELECT * FROM tasks ORDER BY created_at DESC'
);

return (
  <FlatList data={data} renderItem={({ item }) => <TaskItem task={item} />} />
);
```

## 🚨 Error Handling

The library separates **fatal database errors** from **recoverable sync errors** to enable true offline-first operation.

### Database Errors (`initError`)

**Fatal errors** that prevent the database from working at all. The app cannot function when these occur.

```typescript
const { initError, db } = useContext(SQLiteSyncContext);

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
const { syncError, db } = useContext(SQLiteSyncContext);

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
- [GitHub Issues](https://github.com/sqliteai/sqlite-sync-react-native/issues) - Report bugs
