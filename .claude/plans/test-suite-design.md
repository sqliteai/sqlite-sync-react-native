# Test Suite Design for sqlite-sync-react-native

**Date:** 2026-03-06
**Status:** Approved

## Overview

Full test coverage for the library using Jest + @testing-library/react-native.
Co-located test files (Approach A) with shared mocks.

## Dependencies to Add

- `@testing-library/react-native`
- `@testing-library/jest-native` (optional, extended matchers)
- `react-test-renderer` (peer dep)

## Shared Mock Structure

```
src/__mocks__/
  @op-engineering/
    op-sqlite.ts          -- Mock DB, open(), getDylibPath()
  @react-native-community/
    netinfo.ts             -- Mock addEventListener, fetch
  react-native.ts          -- Mock AppState, Platform
  expo-notifications.ts
  expo-secure-store.ts
  expo-task-manager.ts
  expo-constants.ts
  expo-application.ts
```

### op-sqlite mock (core)

Factory `createMockDB()` returning: execute, transaction, close, loadExtension, updateHook, reactiveExecute.
Each test overrides via `mockResolvedValueOnce`.

### Test utilities

`src/__tests__/testUtils.ts` with `createTestWrapper` for provider-wrapped hook tests.

## Test Files (30 total, ~272 test cases)

### Layer 1: Pure Functions

| # | Test file | Source |
|---|-----------|--------|
| 1 | `core/polling/__tests__/calculateAdaptiveSyncInterval.test.ts` | calculateAdaptiveSyncInterval.ts |
| 2 | `core/pushNotifications/__tests__/isSqliteCloudNotification.test.ts` | isSqliteCloudNotification.ts |
| 3 | `core/common/__tests__/logger.test.ts` | logger.ts |
| 4 | `core/pushNotifications/__tests__/pushNotificationSyncCallbacks.test.ts` | pushNotificationSyncCallbacks.ts |
| 5 | `core/__tests__/constants.test.ts` | constants.ts |

### Layer 2: Core Logic (mocked native modules)

| # | Test file | Source |
|---|-----------|--------|
| 6 | `core/database/__tests__/createDatabase.test.ts` | createDatabase.ts |
| 7 | `core/sync/__tests__/initializeSyncExtension.test.ts` | initializeSyncExtension.ts |
| 8 | `core/sync/__tests__/executeSync.test.ts` | executeSync.ts |
| 9 | `core/background/__tests__/backgroundSyncConfig.test.ts` | backgroundSyncConfig.ts |
| 10 | `core/background/__tests__/backgroundSyncRegistry.test.ts` | backgroundSyncRegistry.ts |
| 11 | `core/background/__tests__/executeBackgroundSync.test.ts` | executeBackgroundSync.ts |
| 12 | `core/pushNotifications/__tests__/registerPushToken.test.ts` | registerPushToken.ts |
| 13 | `core/pushNotifications/__tests__/pushNotificationSyncTask.test.ts` | pushNotificationSyncTask.ts |
| 14 | `core/common/__tests__/optionalDependencies.test.ts` | optionalDependencies.ts |

### Layer 3: Context Consumer Hooks

| # | Test file | Source |
|---|-----------|--------|
| 15 | `hooks/context/__tests__/useSqliteDb.test.ts` | useSqliteDb.ts |
| 16 | `hooks/context/__tests__/useSyncStatus.test.ts` | useSyncStatus.ts |
| 17 | `hooks/context/__tests__/useSqliteSync.test.ts` | useSqliteSync.ts |
| 18 | `hooks/context/__tests__/useInternalLogger.test.ts` | useInternalLogger.ts |
| 19 | `hooks/sync/__tests__/useTriggerSqliteSync.test.ts` | useTriggerSqliteSync.ts |

### Layer 4: Complex Hooks

| # | Test file | Source |
|---|-----------|--------|
| 20 | `hooks/sqlite/__tests__/useSqliteExecute.test.ts` | useSqliteExecute.ts |
| 21 | `hooks/sqlite/__tests__/useSqliteTransaction.test.ts` | useSqliteTransaction.ts |
| 22 | `hooks/sqlite/__tests__/useOnTableUpdate.test.ts` | useOnTableUpdate.ts |
| 23 | `hooks/sync/__tests__/useSqliteSyncQuery.test.ts` | useSqliteSyncQuery.ts |
| 24 | `core/sync/__tests__/useSyncManager.test.ts` | useSyncManager.ts |
| 25 | `core/sync/__tests__/useInitialSync.test.ts` | useInitialSync.ts |
| 26 | `core/lifecycle/__tests__/useAppLifecycle.test.ts` | useAppLifecycle.ts |
| 27 | `core/lifecycle/__tests__/useNetworkListener.test.ts` | useNetworkListener.ts |
| 28 | `core/polling/__tests__/useAdaptivePollingSync.test.ts` | useAdaptivePollingSync.ts |
| 29 | `core/pushNotifications/__tests__/usePushNotificationSync.test.ts` | usePushNotificationSync.ts |

### Layer 5: Integration

| # | Test file | Source |
|---|-----------|--------|
| 30 | `core/__tests__/SQLiteSyncProvider.test.tsx` | SQLiteSyncProvider.tsx |

## Implementation Order

1. Shared mocks (`src/__mocks__/`)
2. Test utilities (`src/__tests__/testUtils.ts`)
3. Pure functions (#1-5)
4. Core logic (#6-14)
5. Context hooks (#15-19)
6. Complex hooks (#20-29)
7. Provider integration (#30)

## Test Cases Per File

### calculateAdaptiveSyncInterval (10 tests)

- Returns baseInterval when no errors, no idle
- Returns baseInterval when below emptyThreshold
- Idle backoff at exactly emptyThreshold
- Idle backoff increases with consecutive empty
- Idle backoff caps at maxInterval
- Error backoff (exponential)
- Error backoff caps at maxInterval
- Error takes priority over idle
- Single error
- Custom config values

### isSqliteCloudNotification (11 tests)

- isForegroundSqliteCloudNotification: true for valid, false for wrong URI, false for missing data, false for null
- isSqliteCloudNotification: iOS background object body, Android JSON string body, Android dataString fallback, invalid JSON, falls through to foreground, wrong URI, empty data

### logger (8 tests)

- debug=true: info calls console.log, warn calls console.warn
- debug=false: info/warn suppressed
- error always logs regardless of debug flag
- Output includes [SQLiteSync] prefix
- Output includes ISO timestamp

### pushNotificationSyncCallbacks (5 tests)

- register/get background callback round-trip
- get returns null initially
- set/get foreground callback round-trip
- get foreground returns null initially
- set null clears foreground callback

### constants (2 tests)

- FOREGROUND_DEBOUNCE_MS is 2000
- BACKGROUND_SYNC_TASK_NAME is non-empty string

### createDatabase (9 tests)

- Opens database with given name
- Sets WAL journal mode
- Write mode: synchronous NORMAL, locking_mode NORMAL
- Read mode: query_only true, no synchronous
- Returns DB instance
- Propagates open() error
- Propagates PRAGMA error

### initializeSyncExtension (11 tests)

- Throws if connectionString missing
- Throws if neither apiKey nor accessToken
- iOS extension path via getDylibPath
- Android extension path 'cloudsync'
- Verifies via cloudsync_version()
- Throws if version empty
- cloudsync_init for each table
- cloudsync_network_init with connectionString
- Sets API key / access token
- Prefers apiKey over accessToken

### executeSync (14 tests)

- JS retry: returns 0 when no changes, returns count from JSON, stops on changes, retries to max, custom maxAttempts, transaction wrapping, no transaction, malformed JSON, missing rows, non-string values, delay between attempts
- Native retry: passes params, returns changes

### backgroundSyncConfig (10 tests)

- getPersistedConfig: null without SecureStore, null without stored value, returns parsed, null on parse error
- persistConfig: saves JSON, warns without SecureStore, handles error
- clearPersistedConfig: deletes key, no-ops without SecureStore, handles error

### backgroundSyncRegistry (7 tests)

- register: persists config, registers task, warns when unavailable
- unregister: unregisters task, clears config, no-ops without Notifications, handles error

### executeBackgroundSync (13 tests)

- Opens DB, inits sync, executes with native retry
- Registers updateHook when callback exists, collects changes
- Invokes callback with changes+db, removes hook before callback
- Handles callback error, closes DB in finally
- Closes DB when sync fails, rethrows sync errors
- Skips callback when none registered, handles close error

### registerPushToken (12 tests)

- Skips if already registered, correct URL, auth headers (accessToken vs apiKey)
- Correct body fields, iOS vs Android device ID
- Throws on non-ok response, persists after success
- Handles SecureStore read/write errors, throws when expo-application missing

### pushNotificationSyncTask (8 tests)

- Defines task when ExpoTaskManager available, skips when null
- Handler calls executeBackgroundSync for valid notification
- Skips non-SQLite Cloud notification
- Uses foreground callback when app active
- Handles foreground sync error, skips without config, handles task error

### optionalDependencies (10 tests)

- Each Expo module: set when available, null when not installed
- ExpoConstants: uses .default or module directly
- isBackgroundSyncAvailable: true when all 3 present, false when any missing

### useSqliteDb (4 tests)

- Returns writeDb, readDb, initError from context, null values

### useSyncStatus (2 tests)

- Returns all status fields, default values

### useSqliteSync (2 tests)

- Returns merged contexts, triggerSync callable

### useInternalLogger (2 tests)

- Returns logger, has info/warn/error

### useTriggerSqliteSync (2 tests)

- Returns triggerSync, calls through

### useSqliteExecute (15 tests)

- Undefined when no db, executes on writeDb/readDb, returns result
- isExecuting lifecycle, error state, throws, clears error
- Auto-sync after write, skip on readOnly/autoSync=false
- Auto-sync failure non-fatal, logs warning

### useSqliteTransaction (10 tests)

- Undefined when no writeDb, calls transaction, isExecuting lifecycle
- Error state, throws, clears error
- Auto-sync after commit, skip on autoSync=false
- Auto-sync failure non-fatal, logs warning

### useOnTableUpdate (11 tests)

- Registers/removes updateHook, calls for watched table, ignores unwatched
- Fetches row for INSERT/UPDATE, null for DELETE
- Handles fetch error, callback ref updates, tables ref updates, no-ops when null

### useSqliteSyncQuery (15 tests)

- isLoading initially, initial read on readDb, sets data, sets error
- Reactive subscription after debounce, config matches, updates on callback
- Unsubscribes on unmount, debounces rapid changes, skips stale
- Returns unsubscribe, no-ops when null, skips in background

### useSyncManager (20 tests)

- Guards: null db, not ready, concurrent, Android network check, offline skip, iOS skip
- State: isSyncing lifecycle, lastSyncTime, lastSyncChanges
- Counters: reset/increment empty syncs, reset/increment errors
- Error: sets/clears syncError
- Interval: recalculates in polling, skips in push, error backoff
- Ref stays in sync

### useInitialSync (4 tests)

- Triggers after 1500ms, no trigger when not ready, only once, clears on unmount

### useAppLifecycle (12 tests)

- Registers/removes listener, foreground sync trigger, interval reset (polling)
- Resets empty syncs, no reset in push, debounces, allows after debounce
- isInBackground states, logs background

### useNetworkListener (8 tests)

- Registers/unsubscribes, sync on reconnect, no sync online->online
- No sync when backgrounded, updates state, isInternetReachable null handling

### useAdaptivePollingSync (10 tests)

- Starts polling, no start in push/not ready, pauses on background, resumes
- Dynamic interval, prevents multiple loops, stops on null, cleanup, reschedules

### usePushNotificationSync (18 tests)

- Permissions: request, skip polling, guard, existing, request when needed, denied fallback
- Custom prompt: shows, allow, deny
- Token: get token, get siteId, register, handle failure
- Listeners: foreground, triggers sync, ignores other, background registration
- Foreground callback, fallback, cleanup
- Mode transitions: unregister, reset, missing expo warning

---

## Tier 1 Coverage Gap Tests (14 tests — targeting ~90% branch coverage)

### useDatabaseInitialization (+2 tests)

| # | Test case | Setup | Assertion |
|---|-----------|-------|-----------|
| 1 | throws when databaseName is empty | `databaseName: ''` | `initError.message` contains "Database name is required" |
| 2 | warns when tablesToBeSynced is empty | `tablesToBeSynced: []` | Logger warns "No tables configured", db still opens |

### initializeSyncExtension (+1 test)

| # | Test case | Setup | Assertion |
|---|-----------|-------|-----------|
| 3 | sets accessToken when apiKey absent | `apiKey: undefined, accessToken: 'token'` | Calls `cloudsync_network_set_token` |

> Note: Already covered by existing test "sets access token when accessToken is provided". Replaced with:

| # | Test case | Setup | Assertion |
|---|-----------|-------|-----------|
| 3 | logs siteId when cloudsync_init returns result | Default config | Logger called with `site_id: site-id-123` |

### useSqliteExecute (+1 test)

| # | Test case | Setup | Assertion |
|---|-----------|-------|-----------|
| 4 | wraps non-Error thrown value | `db.execute` throws string `'raw'` | `error.message` is "Execution failed" |

### useSqliteTransaction (+1 test)

| # | Test case | Setup | Assertion |
|---|-----------|-------|-----------|
| 5 | wraps non-Error thrown value | `db.transaction` throws string `'raw'` | `error.message` is "Transaction failed" |

### useSqliteSyncQuery (+2 tests)

| # | Test case | Setup | Assertion |
|---|-----------|-------|-----------|
| 6 | clears debounce timer on query change | Render, change query before 1000ms | No stale `reactiveExecute` call |
| 7 | skips stale subscription signature | Change query during debounce | Only latest query subscribed |

### usePushNotificationSync (+2 tests)

| # | Test case | Setup | Assertion |
|---|-----------|-------|-----------|
| 8 | handles registerPushToken failure gracefully | `registerPushToken` rejects | No crash, listener still set up |
| 9 | warns when ExpoNotifications null | Mock ExpoNotifications = null | Logger warns about missing module |

### isSqliteCloudNotification (+1 test)

| # | Test case | Setup | Assertion |
|---|-----------|-------|-----------|
| 10 | detects Android dataString with wrong URI | `data: { dataString: '{"artifactURI":"https://wrong.com"}' }` | Returns false |

### useSyncManager (+1 test)

| # | Test case | Setup | Assertion |
|---|-----------|-------|-----------|
| 11 | does not recalculate interval on error in push mode | `syncMode: 'push'`, executeSync rejects | `calculateAdaptiveSyncInterval` not called |

### useDatabaseInitialization (+2 tests, close errors)

| # | Test case | Setup | Assertion |
|---|-----------|-------|-----------|
| 12 | handles write db close error on unmount | `writeDb.close` throws | Logger error called, no crash |
| 13 | handles read db close error on unmount | `readDb.close` throws | Logger error called, no crash |

### SQLiteSyncProvider (18 tests)

- Init: renders children, provides writeDb/readDb, initError, syncError, onDatabaseReady, table creation
- Contexts: default status, syncMode, triggerSync
- Config: default adaptive, custom merge, null interval in push
- Re-init: connectionString, apiKey, tablesToBeSynced changes, not on children
- Mode: fallback to polling, reset interval, reset empty syncs
- Cleanup: closes both DBs, handles close error
