# @sqliteai/sqlite-sync-react-native

[![Status: Beta](https://img.shields.io/badge/status-in%20development-yellow)](https://github.com/sqliteai/sqlite-sync-react-native)
[![npm version](https://img.shields.io/npm/v/@sqliteai/sqlite-sync-react-native.svg)](https://www.npmjs.com/package/@sqliteai/sqlite-sync-react-native)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Offline-first React Native sync for SQLite Cloud. This library gives you a local SQLite database on-device, keeps it usable offline, and synchronizes changes with SQLite Cloud when connectivity is available.

Powered by [SQLite Sync](https://github.com/sqliteai/sqlite-sync) and [OP-SQLite](https://github.com/OP-Engineering/op-sqlite).

## Table of Contents

- [Compatibility](#compatibility)
- [Choose Your Auth Model](#choose-your-auth-model)
- [Choose Your Sync Mode](#choose-your-sync-mode)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Sync Behavior](#sync-behavior)
- [API Reference](#api-reference)
- [Error Handling](#error-handling)
- [Debug Logging](#debug-logging)
- [Known Issues & Improvements](#known-issues--improvements)
- [Examples](#examples)
- [Links](#links)

## Compatibility

| Requirement    | Status / Minimum                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| React Native   | Native projects and Expo development builds                                                                 |
| iOS            | 13.0+                                                                                                       |
| Android        | API 26+                                                                                                     |
| Web            | Not supported                                                                                               |
| Expo Go        | Not supported                                                                                               |
| SQLite engine  | [`@op-engineering/op-sqlite`](https://github.com/OP-Engineering/op-sqlite) `^15.1.14`                       |
| Network status | [`@react-native-community/netinfo`](https://github.com/react-native-netinfo/react-native-netinfo) `^11.0.0` |
| Cloud backend  | [SQLite Cloud](https://sqlitecloud.io/)                                                                     |

Optional Expo dependencies for push mode:

- [`expo-notifications`](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [`expo-constants`](https://docs.expo.dev/versions/latest/sdk/constants/)
- [`expo-application`](https://docs.expo.dev/versions/latest/sdk/application/)
- [`expo-secure-store`](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [`expo-task-manager`](https://docs.expo.dev/versions/latest/sdk/task-manager/)

Notes:

- `expo-notifications`, `expo-constants`, and `expo-application` are needed for push token registration.
- `expo-task-manager` and `expo-secure-store` are additionally required for `notificationListening="always"`.
- Testing push notifications require a real device. Simulators and emulators are not enough for a full push flow.

## Choose Your Auth Model

| Auth prop     | Use when                                       | Notes                            |
| ------------- | ---------------------------------------------- | -------------------------------- |
| `apiKey`      | Your app uses database-level access            | Simpler setup                    |
| `accessToken` | Your app uses SQLite Cloud access tokens / RLS | Use this for signed-in user auth |

## Choose Your Sync Mode

| Mode      | Best for                                       | Requirements                    | Tradeoffs                                |
| --------- | ---------------------------------------------- | ------------------------------- | ---------------------------------------- |
| `polling` | Most apps, easiest setup, predictable behavior | No Expo push packages required  | Checks periodically instead of instantly |
| `push`    | Apps that need near real-time sync triggers    | Expo push setup and permissions | More setup, may fall back to polling     |

## Installation

### 1. Install Required Dependencies

```bash
npm install @sqliteai/sqlite-sync-react-native @op-engineering/op-sqlite @react-native-community/netinfo
# or
yarn add @sqliteai/sqlite-sync-react-native @op-engineering/op-sqlite @react-native-community/netinfo
```

Optional Expo packages for push mode:

```bash
npx expo install expo-notifications expo-constants expo-application expo-secure-store expo-task-manager
```

### 2. Platform Setup

#### Expo

If you use Expo, you must use development builds. Expo Go is not supported because this library depends on native modules.

Set Android `minSdkVersion` to `26`:

```bash
npx expo install expo-build-properties
```

Add this plugin to `app.json` or `app.config.js`:

```json
["expo-build-properties", { "android": { "minSdkVersion": 26 } }]
```

## Quick Start

### 1. Set Up SQLite Cloud

1. Create an account at the [SQLite Cloud Dashboard](https://dashboard.sqlitecloud.io/).
2. Create a database by following the [database creation guide](https://docs.sqlitecloud.io/docs/create-database).
3. Create your tables in SQLite Cloud.
4. Enable OffSync by following the [OffSync setup guide](https://docs.sqlitecloud.io/docs/offsync#:~:text=in%20the%20cloud.-,Configuring%20OffSync,-You%20can%20enable).
5. Copy your `databaseId` and either your `apiKey` or plan to provide the current signed-in user's `accessToken`.

Schema requirements matter:

- Your local table schema must exactly match the cloud table schema.
- For SQLite Sync schema best practices, see [SQLite Sync Best Practices](https://docs.sqlitecloud.io/docs/sqlite-sync-best-practices).

### 2. Wrap Your App

The provider needs a `createTableSql` statement for every table you want synchronized. That SQL is executed locally before sync initialization.

```typescript
import { SQLiteSyncProvider } from '@sqliteai/sqlite-sync-react-native';

export default function App() {
  return (
    <SQLiteSyncProvider
      databaseId="db_xxxxxxxxxxxxxxxxxxxxxxxx"
      databaseName="myapp.db"
      apiKey="your-api-key"
      syncMode="polling"
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

### 3. Read Data Reactively

Use `useSqliteSyncQuery` for UI reads that should automatically update when data changes locally or from sync.

```typescript
import { useSqliteSyncQuery } from '@sqliteai/sqlite-sync-react-native';

interface Task {
  id: string;
  title: string;
  completed: number;
}

function TaskList() {
  const {
    data: tasks,
    isLoading,
    error,
  } = useSqliteSyncQuery<Task>({
    query: 'SELECT * FROM tasks ORDER BY created_at DESC',
    arguments: [],
    fireOn: [{ table: 'tasks' }],
  });

  if (isLoading) return <Text>Loading...</Text>;
  if (error) return <Text>Error: {error.message}</Text>;

  return (
    <FlatList
      data={tasks}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <Text>{item.title}</Text>}
    />
  );
}
```

### 4. Write Data With Transactions

Use `useSqliteTransaction` for app writes that should trigger reactive queries.

```typescript
import { useSqliteTransaction } from '@sqliteai/sqlite-sync-react-native';

function AddTaskButton() {
  const { executeTransaction } = useSqliteTransaction();

  const addTask = async (title: string) => {
    await executeTransaction(async (tx) => {
      await tx.execute(
        'INSERT INTO tasks (id, title) VALUES (cloudsync_uuid(), ?);',
        [title]
      );
    });
  };

  return <Button title="Add Task" onPress={() => addTask('New Task')} />;
}
```

### 5. Show Sync Status And Manual Sync

Use `useTriggerSqliteSync` for manual sync and `useSyncStatus` to render status.

```typescript
import {
  useTriggerSqliteSync,
  useSyncStatus,
} from '@sqliteai/sqlite-sync-react-native';

function SyncControls() {
  const { triggerSync } = useTriggerSqliteSync();
  const { isSyncing, lastSyncTime, syncError, syncMode } = useSyncStatus();

  return (
    <View>
      <Text>Mode: {syncMode}</Text>
      <Button
        title={isSyncing ? 'Syncing...' : 'Sync Now'}
        onPress={triggerSync}
        disabled={isSyncing}
      />
      {lastSyncTime && (
        <Text>Last sync: {new Date(lastSyncTime).toLocaleTimeString()}</Text>
      )}
      {syncError && <Text>Sync error: {syncError.message}</Text>}
    </View>
  );
}
```

## Sync Behavior

The library provides lifecycle-aware synchronization that adapts to app state, network availability, and previous sync activity.

### Sync Triggers

Primary triggers:

- App start -> immediate sync
- App resume from background -> immediate sync, debounced to 5 seconds
- Network reconnection -> immediate sync

Secondary triggers:

- Polling mode: Periodic polling while app is foregrounded
- Push mode: Push notification from SQLite Cloud triggers sync when server changes are available

### Adaptive Polling Algorithm

In polling mode, the sync interval changes based on activity:

1. Default state: use `baseInterval` (default `5000`)
2. Idle backoff: after `emptyThreshold` consecutive empty syncs (default `5`), the interval increases gradually based on `idleBackoffMultiplier`
3. Error backoff: on sync failures, the interval increases more aggressively based on `errorBackoffMultiplier`
4. Reset on activity: any sync with changes resets the interval to `baseInterval`
5. Foreground priority: resuming the app triggers an immediate sync and resets the interval

Example idle progression:

```text
5s -> 7.5s -> 11.25s -> ...
```

Example error progression:

```text
5s -> 10s -> 20s -> 40s -> ...
```

Example timeline:

```text
App Start:        Sync (0 changes) -> Next in 5s
5s later:         Sync (0 changes) -> Next in 5s
10s later:        Sync (0 changes) -> Next in 5s
15s later:        Sync (0 changes) -> Next in 5s
20s later:        Sync (0 changes) -> Next in 5s
25s later:        Sync (0 changes) -> Next in 7.5s
32.5s later:      Sync (0 changes) -> Next in 11.25s
43.75s later:     Sync (5 changes) -> Next in 5s
App backgrounded: Polling paused
App foregrounded: Sync immediately -> Next in 5s
```

### Push Mode

Push notifications from SQLite Cloud trigger sync when there are changes to fetch. Sync still happens on app start, foreground, and network reconnect for reliability.

Requirements:

- `expo-notifications` for push notification handling
- `expo-constants` for EAS project ID lookup
- `expo-application` for device ID during push token registration
- `expo-task-manager` for background/terminated notification handling when `notificationListening="always"`
- `expo-secure-store` for persisted background sync config when `notificationListening="always"`

Setup:

1. Install the Expo packages listed above:

```bash
npx expo install expo-notifications expo-constants expo-application expo-secure-store expo-task-manager
```

2. If you use `notificationListening="always"`, configure background notifications in `app.json` / `app.config.js`:

```json
{
  "expo": {
    "plugins": [
      ["expo-notifications", { "enableBackgroundRemoteNotifications": true }]
    ],
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    }
  }
}
```

3. Configure push credentials by following the [Expo Push Notifications setup guide](https://docs.expo.dev/push-notifications/push-notifications-setup/).

- iOS: use a paid Apple Developer account, register the physical iOS device you want to test on, and let EAS set up push notifications and generate an APNs key for the app during your first development build
- Android: create a Firebase project, add an Android app in Firebase with the same package name as your Expo app, set up FCM V1 credentials, then place the generated `google-services.json` in your project and connect those credentials to Expo

4. If you use [Expo enhanced security](https://docs.expo.dev/push-notifications/sending-notifications/#additional-security), configure your Expo access token in SQLite Cloud Dashboard > OffSync > Configuration. The Expo access token is optional unless enhanced security is enabled.

### `notificationListening` Modes

| App State  | `notificationListening="foreground"`                     | `notificationListening="always"`                                                                                       |
| ---------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Foreground | Notification triggers sync on the existing DB connection | Same behavior                                                                                                          |
| Background | Notification ignored                                     | Background task opens a DB connection, syncs, then calls `registerBackgroundSyncCallback` if registered                |
| Terminated | Notification ignored                                     | Background task wakes the app, opens a DB connection, syncs, then calls `registerBackgroundSyncCallback` if registered |

> Note: If push mode cannot be used because required Expo packages are missing, notification permissions are denied, or push token retrieval fails, the provider logs a warning and falls back to polling mode.

## API Reference

### `SQLiteSyncProvider`

Main provider component that enables sync functionality.

#### Props

| Prop                         | Type                                                            | Required      | Description                                           |
| ---------------------------- | --------------------------------------------------------------- | ------------- | ----------------------------------------------------- |
| `databaseId`                 | `string`                                                        | Yes           | SQLite Sync database ID used by runtime sync APIs     |
| `databaseName`               | `string`                                                        | Yes           | Local database file name                              |
| `tablesToBeSynced`           | `TableConfig[]`                                                 | Yes           | Array of tables to sync                               |
| `apiKey`                     | `string`                                                        | Conditionally | API key authentication                                |
| `accessToken`                | `string`                                                        | Conditionally | Signed-in user access token authentication            |
| `syncMode`                   | `'polling' \| 'push'`                                           | Yes           | Sync mode                                             |
| `adaptivePolling`            | `AdaptivePollingConfig`                                         | No            | Polling configuration; defaults are used when omitted |
| `notificationListening`      | `'foreground' \| 'always'`                                      | No            | Push listening behavior                               |
| `renderPushPermissionPrompt` | `(props: { allow: () => void; deny: () => void }) => ReactNode` | No            | Custom pre-permission UI for push mode                |
| `onDatabaseReady`            | `(db: DB) => Promise<void>`                                     | No            | Called after DB opens and before sync init            |
| `debug`                      | `boolean`                                                       | No            | Enable debug logs                                     |
| `children`                   | `ReactNode`                                                     | Yes           | App content                                           |

#### Sync Modes

```typescript
// Polling mode with runtime defaults
<SQLiteSyncProvider
  databaseId="db_xxxxxxxxxxxxxxxxxxxxxxxx"
  databaseName="myapp.db"
  apiKey="your-api-key"
  tablesToBeSynced={[...]}
  syncMode="polling"
>

// Polling mode with custom intervals
<SQLiteSyncProvider
  databaseId="db_xxxxxxxxxxxxxxxxxxxxxxxx"
  databaseName="myapp.db"
  apiKey="your-api-key"
  tablesToBeSynced={[...]}
  syncMode="polling"
  adaptivePolling={{
    baseInterval: 3000,
    maxInterval: 60000,
    emptyThreshold: 3
  }}
>

// Push mode - foreground only
<SQLiteSyncProvider
  databaseId="db_xxxxxxxxxxxxxxxxxxxxxxxx"
  databaseName="myapp.db"
  apiKey="your-api-key"
  tablesToBeSynced={[...]}
  syncMode="push"
  notificationListening="foreground"
>

// Push mode - foreground + background + terminated
<SQLiteSyncProvider
  databaseId="db_xxxxxxxxxxxxxxxxxxxxxxxx"
  databaseName="myapp.db"
  apiKey="your-api-key"
  tablesToBeSynced={[...]}
  syncMode="push"
  notificationListening="always"
  renderPushPermissionPrompt={({ allow, deny }) => (
    <YourCustomPermissionDialog onAllow={allow} onDeny={deny} />
  )}
>
```

#### Background Sync Callback

When using push mode with `notificationListening="always"`, you can register a callback that runs after a background sync completes.

```typescript
import { registerBackgroundSyncCallback } from '@sqliteai/sqlite-sync-react-native';
import * as Notifications from 'expo-notifications';

registerBackgroundSyncCallback(async ({ changes, db }) => {
  const newItems = changes.filter(
    (c) => c.table === 'tasks' && c.operation === 'INSERT'
  );

  if (newItems.length === 0) return;

  const result = await db.execute(
    `SELECT * FROM tasks WHERE rowid IN (${newItems
      .map((c) => c.rowId)
      .join(',')})`
  );

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${newItems.length} new tasks synced`,
      body: result.rows?.[0]?.title || 'New data available',
    },
    trigger: null,
  });
});
```

#### Database Migrations With `onDatabaseReady`

Use `onDatabaseReady` to run migrations or setup after the database opens and before sync initialization.

```typescript
<SQLiteSyncProvider
  databaseId="db_xxxxxxxxxxxxxxxxxxxxxxxx"
  databaseName="myapp.db"
  apiKey="..."
  tablesToBeSynced={[...]}
  onDatabaseReady={async (db) => {
    const { rows } = await db.execute('PRAGMA user_version');
    const version = rows?.[0]?.user_version ?? 0;

    if (version < 1) {
      await db.execute('ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0');
      await db.execute('PRAGMA user_version = 1');
    }
  }}
>
```

#### Custom Push Permission UI With `renderPushPermissionPrompt`

Use `renderPushPermissionPrompt` to show your own UI before the system notification permission prompt appears.

```tsx
<SQLiteSyncProvider
  databaseId="db_xxxxxxxxxxxxxxxxxxxxxxxx"
  databaseName="myapp.db"
  apiKey="your-api-key"
  tablesToBeSynced={[...]}
  syncMode="push"
  renderPushPermissionPrompt={({ allow, deny }) => (
    <Modal visible animationType="fade" transparent>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text>Enable notifications for real-time sync?</Text>
        <TouchableOpacity onPress={allow}>
          <Text>Enable</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={deny}>
          <Text>Not Now</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )}
>
  <YourApp />
</SQLiteSyncProvider>
```

#### `AdaptivePollingConfig`

```typescript
interface AdaptivePollingConfig {
  baseInterval?: number;
  maxInterval?: number;
  emptyThreshold?: number;
  idleBackoffMultiplier?: number;
  errorBackoffMultiplier?: number;
}
```

Defaults:

- `baseInterval`: `5000`
- `maxInterval`: `300000`
- `emptyThreshold`: `5`
- `idleBackoffMultiplier`: `1.5`
- `errorBackoffMultiplier`: `2.0`

#### `TableConfig`

```typescript
interface TableConfig {
  name: string;
  createTableSql: string;
}
```

Example:

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

Important:

- Include `IF NOT EXISTS`
- Match the remote schema exactly
- The library executes this SQL during initialization before SQLite Sync setup

#### `ReactiveQueryConfig`

```typescript
interface ReactiveQueryConfig {
  query: string;
  arguments?: any[];
  fireOn: Array<{
    table: string;
    operation?: 'INSERT' | 'UPDATE' | 'DELETE';
  }>;
}
```

#### `TableUpdateData<T>`

```typescript
interface TableUpdateData<T = any> {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  rowId: number;
  row: T | null;
}
```

Notes:

- `rowId` is SQLite's internal `rowid`, not your application primary key
- For `DELETE`, `row` is `null`

#### `TableUpdateConfig<T>`

```typescript
interface TableUpdateConfig<T = any> {
  tables: string[];
  onUpdate: (data: TableUpdateData<T>) => void;
}
```

### Contexts

The library exposes three React contexts.

#### `SQLiteDbContext`

Provides database connections and fatal initialization errors. This context changes rarely.

Dual-connection architecture:

- `writeDb`: write connection used for sync operations, reactive subscriptions, update hooks, and writes
- `readDb`: read-only connection for read-only queries

Both connections target the same database file and use WAL mode for concurrent access.

```typescript
import { useContext } from 'react';
import { SQLiteDbContext } from '@sqliteai/sqlite-sync-react-native';

const { writeDb, readDb, initError } = useContext(SQLiteDbContext);
```

| Property    | Type            | Description                                                                                               |
| ----------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| `writeDb`   | `DB \| null`    | Write [op-sqlite](https://op-engineering.github.io/op-sqlite/docs/api) connection with SQLite Sync loaded |
| `readDb`    | `DB \| null`    | Read-only [op-sqlite](https://op-engineering.github.io/op-sqlite/docs/api) connection                     |
| `initError` | `Error \| null` | Fatal database initialization error                                                                       |

#### `SQLiteSyncStatusContext`

Provides sync status information. This context changes frequently.

```typescript
import { useContext } from 'react';
import { SQLiteSyncStatusContext } from '@sqliteai/sqlite-sync-react-native';

const { isSyncing, lastSyncTime, syncError, syncMode, currentSyncInterval } =
  useContext(SQLiteSyncStatusContext);
```

| Property                | Type                  | Description                                      |
| ----------------------- | --------------------- | ------------------------------------------------ |
| `syncMode`              | `'polling' \| 'push'` | Effective runtime sync mode                      |
| `isSyncReady`           | `boolean`             | Whether sync is configured and ready             |
| `isSyncing`             | `boolean`             | Whether sync is in progress                      |
| `lastSyncTime`          | `number \| null`      | Timestamp of last successful sync                |
| `lastSyncChanges`       | `number`              | Number of changes in last sync                   |
| `syncError`             | `Error \| null`       | Recoverable sync error                           |
| `currentSyncInterval`   | `number \| null`      | Current polling interval, or `null` in push mode |
| `consecutiveEmptySyncs` | `number`              | Consecutive syncs with no changes                |
| `consecutiveSyncErrors` | `number`              | Consecutive sync errors                          |
| `isAppInBackground`     | `boolean`             | Whether the app is currently backgrounded        |
| `isNetworkAvailable`    | `boolean`             | Whether network connectivity is available        |

#### `SQLiteSyncActionsContext`

Provides stable sync action functions.

```typescript
import { useContext } from 'react';
import { SQLiteSyncActionsContext } from '@sqliteai/sqlite-sync-react-native';

const { triggerSync } = useContext(SQLiteSyncActionsContext);
```

| Property      | Type                  | Description             |
| ------------- | --------------------- | ----------------------- |
| `triggerSync` | `() => Promise<void>` | Manually trigger a sync |

Most applications should prefer the specialized hooks instead of consuming contexts directly.

### Hooks

#### `useSqliteDb()`

Access the database connections and initialization errors without subscribing to sync status updates.

```typescript
useSqliteDb(): {
  writeDb: DB | null;
  readDb: DB | null;
  initError: Error | null;
}
```

```typescript
const { writeDb, readDb, initError } = useSqliteDb();
```

Returns:

- `writeDb`: write database connection
- `readDb`: read-only database connection
- `initError`: fatal initialization error

Use this when:

- You need direct DB access
- You do not want re-renders on sync state changes

> Note: `writeDb` and `readDb` are `DB` instances from [`@op-engineering/op-sqlite`](https://op-engineering.github.io/op-sqlite/docs/api). The `writeDb` connection has SQLite Sync loaded, so you can call standard OP-SQLite APIs and SQLite Sync functions such as `cloudsync_uuid()` or `cloudsync_changes()`.

#### `useSyncStatus()`

Access sync status information for UI state.

```typescript
useSyncStatus(): {
  syncMode: 'polling' | 'push';
  isSyncReady: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  lastSyncChanges: number;
  syncError: Error | null;
  currentSyncInterval: number | null;
  consecutiveEmptySyncs: number;
  consecutiveSyncErrors: number;
  isAppInBackground: boolean;
  isNetworkAvailable: boolean;
}
```

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

Use this when:

- You need to render sync state
- You want to inspect the effective runtime `syncMode`

#### `useSqliteSync()`

Convenience hook that combines DB access, sync status, and actions.

```typescript
useSqliteSync(): {
  writeDb: DB | null;
  readDb: DB | null;
  initError: Error | null;
  syncMode: 'polling' | 'push';
  isSyncReady: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  lastSyncChanges: number;
  syncError: Error | null;
  currentSyncInterval: number | null;
  consecutiveEmptySyncs: number;
  consecutiveSyncErrors: number;
  isAppInBackground: boolean;
  isNetworkAvailable: boolean;
  triggerSync: () => Promise<void>;
}
```

```typescript
const { writeDb, initError, isSyncing, lastSyncTime, triggerSync } =
  useSqliteSync();

return (
  <View>
    <Text>Database: {writeDb ? 'Ready' : 'Loading'}</Text>
    <Button onPress={triggerSync} disabled={isSyncing} />
  </View>
);
```

Use this when:

- You want one hook for everything
- You accept more frequent re-renders

#### `useTriggerSqliteSync()`

Manually trigger a sync operation.

```typescript
useTriggerSqliteSync(): {
  triggerSync: () => Promise<void>;
}
```

```typescript
const { triggerSync } = useTriggerSqliteSync();
const { isSyncing } = useSyncStatus();

<Button
  onPress={triggerSync}
  disabled={isSyncing}
  title={isSyncing ? 'Syncing...' : 'Sync Now'}
/>;
```

#### `useSqliteSyncQuery(config)`

Execute a reactive query using OP-SQLite's `reactiveExecute`.

How it works:

- Performs the initial fetch with `readDb` when available
- Installs the reactive subscription on `writeDb`
- Re-runs the query when watched tables change

```typescript
interface ReactiveQueryConfig {
  query: string;
  arguments?: any[];
  fireOn: Array<{
    table: string;
    operation?: 'INSERT' | 'UPDATE' | 'DELETE';
  }>;
}
```

```typescript
useSqliteSyncQuery<T = any>(config: ReactiveQueryConfig): {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  unsubscribe: () => void;
}
```

Example:

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

Important:

- Reactive queries fire on committed transactions
- Use `useSqliteTransaction()` for writes that should invalidate reactive queries

```typescript
const { execute } = useSqliteExecute();
const { executeTransaction } = useSqliteTransaction();

// Triggers reactive queries
await executeTransaction(async (tx) => {
  await tx.execute('INSERT INTO tasks (id, title) VALUES (?, ?)', [id, title]);
});

// Does not trigger reactive queries
await execute('INSERT INTO tasks (id, title) VALUES (?, ?)', [id, title]);
```

Sync operations are already wrapped in transactions internally, so cloud-driven changes will update reactive queries.

#### `useOnTableUpdate(config)`

Listen for row-level `INSERT`, `UPDATE`, and `DELETE` events using OP-SQLite's `updateHook`.

```typescript
interface TableUpdateConfig<T = any> {
  tables: string[];
  onUpdate: (data: TableUpdateData<T>) => void;
}

interface TableUpdateData<T = any> {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  rowId: number;
  row: T | null;
}
```

```typescript
useOnTableUpdate<T = any>(config: TableUpdateConfig<T>): void
```

Example:

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
      Toast.show(
        `Task "${data.row.title}" was ${data.operation.toLowerCase()}d`
      );

      analytics.track('task_modified', {
        operation: data.operation,
        taskId: data.row.id,
      });
    } else {
      console.log('Row was deleted');
    }
  },
});
```

Note:

- For `DELETE`, `row` is `null`
- `rowId` is SQLite internal state, not your domain ID

#### `useSqliteExecute()`

Execute SQL imperatively with configurable connection selection.

Connection selection:

- Default: `writeDb`
- Pass `{ readOnly: true }` to use `readDb`

```typescript
interface SqliteExecuteOptions {
  readOnly?: boolean;
  autoSync?: boolean;
}
```

```typescript
useSqliteExecute(): {
  execute: (
    sql: string,
    params?: any[],
    options?: SqliteExecuteOptions
  ) => Promise<QueryResult | undefined>;
  isExecuting: boolean;
  error: Error | null;
}
```

Example:

```typescript
import { useSqliteExecute } from '@sqliteai/sqlite-sync-react-native';

function TaskManager() {
  const { execute, isExecuting, error } = useSqliteExecute();

  const addTask = async (title: string) => {
    try {
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

Important:

- Direct `execute()` writes do not trigger reactive queries
- Use `useSqliteTransaction()` when you need reactive invalidation

This hook automatically sends local write changes to the cloud unless you disable it:

```typescript
await execute(
  'INSERT INTO local_cache (key, value) VALUES (?, ?)',
  [key, value],
  { autoSync: false }
);
```

If you call `db.execute()` directly through OP-SQLite, automatic cloud send does not happen for you.

#### `useSqliteTransaction()`

Execute SQL commands within a transaction for atomic writes.

```typescript
useSqliteTransaction(): {
  executeTransaction: (
    fn: (tx: Transaction) => Promise<void>,
    options?: { autoSync?: boolean }
  ) => Promise<void>;
  isExecuting: boolean;
  error: Error | null;
}
```

Example:

```typescript
import { useSqliteTransaction } from '@sqliteai/sqlite-sync-react-native';

function TaskManager() {
  const { executeTransaction, isExecuting } = useSqliteTransaction();

  const addTaskWithLog = async (title: string) => {
    try {
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

  const addLocalOnlyTask = async (title: string) => {
    await executeTransaction(
      async (tx) => {
        await tx.execute('INSERT INTO tasks (id, title) VALUES (?, ?)', [
          'local-id',
          title,
        ]);
      },
      { autoSync: false }
    );
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

Important:

- Transactions trigger reactive queries on successful commit
- This is the recommended write path for data displayed with `useSqliteSyncQuery`
- The hook auto-sends changes to the cloud after commit unless `autoSync` is `false`

To skip automatic sync:

```typescript
await executeTransaction(
  async (tx) => {
    await tx.execute('INSERT INTO local_cache (key, value) VALUES (?, ?)', [
      key,
      value,
    ]);
  },
  { autoSync: false }
);
```

> Note: If you use `db.transaction()` directly through OP-SQLite, automatic cloud send does not happen for you.

## Error Handling

The library separates fatal database errors from recoverable sync errors so the app can continue to work offline whenever possible.

### Database Errors (`initError`)

These are fatal. The database is unavailable.

```typescript
const { initError, writeDb } = useSqliteDb();

if (initError) {
  return <ErrorScreen message="Database unavailable" />;
}
```

Common causes:

- Unsupported platform
- Missing database name
- Failed to open the database file
- Failed to create tables

When this happens:

- `writeDb` is `null`
- `readDb` is `null`
- The app cannot operate offline or online

### Sync Errors (`syncError`)

These are recoverable. The local database still works.

```typescript
const { writeDb } = useSqliteDb();
const { syncError } = useSyncStatus();

if (writeDb) {
  await writeDb.execute('INSERT INTO tasks ...');
}

{
  syncError && <Banner warning={syncError.message} />;
}
```

Common causes:

- Invalid `databaseId`
- Invalid `apiKey` or `accessToken`
- SQLite Sync extension failed to load
- Network initialization failed
- Temporary network connectivity issues

When this happens:

- `writeDb` and `readDb` remain available
- The app still works offline
- Sync retries later when conditions improve

Sync errors clear automatically after the next successful sync.

## Debug Logging

Enable verbose development logging with the `debug` prop:

```typescript
<SQLiteSyncProvider
  databaseId="db_xxxxxxxxxxxxxxxxxxxxxxxx"
  databaseName="myapp.db"
  apiKey="your-api-key"
  tablesToBeSynced={[...]}
  syncMode="polling"
  debug={__DEV__}
>
```

When enabled, logs include:

- Database initialization steps
- Extension loading
- Table creation
- Network setup
- Sync operations
- Change counts

## Known Issues & Improvements

### Reactive Queries And Write Connection Contention

Issue:

`useSqliteSyncQuery` uses `writeDb` with OP-SQLite's `reactiveExecute` so queries see sync changes immediately. Under heavy write or sync activity, the write connection can become a bottleneck.

Potential improvement:

Have `cloudsync_network_sync()` return updated table names so reactive queries could read from `readDb` and invalidate manually.

### Optimistic Updates And Sync Blocking

Issue:

In push-heavy scenarios, sync can occupy `writeDb` frequently enough that local writes may feel delayed.

Potential improvement:

Introduce optimistic UI updates independent of sync completion, with conflict-resolution rules when sync finishes.

### First Install Empty State

Issue:

On first install, the initial sync may not immediately return data, so the app can briefly render an empty state before a later sync populates it.

Potential improvement:

Keep showing a loader until the first successful sync with data, or until a timeout expires.

## Examples

See the [`examples`](./examples) directory:

- [`examples/sync-demo-expo`](./examples/sync-demo-expo): Expo development build using push notifications
- [`examples/sync-demo-bare`](./examples/sync-demo-bare): Bare React Native example using polling

## Links

- [SQLite Sync - Library Documentation](https://docs.sqlitecloud.io/docs/sqlite-sync-introduction)
- [SQLite Sync - Dashboard Documentation](https://docs.sqlitecloud.io/docs/offsync)
- [SQLite Cloud Dashboard](https://dashboard.sqlitecloud.io/)
- [SQLite Sync Best Practices](https://docs.sqlitecloud.io/docs/sqlite-sync-best-practices)
- [SQLite Cloud Access Tokens](https://docs.sqlitecloud.io/docs/access-tokens)
- [SQLite Cloud RLS](https://docs.sqlitecloud.io/docs/rls)
- [OP-SQLite API Reference](https://op-engineering.github.io/op-sqlite/docs/api)
