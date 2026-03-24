# Test Suite

**Status:** Implemented
**Last updated:** 2026-03-20
**Total:** 33 test files, 305 tests

## How to Run

```bash
# Run all tests
yarn test

# Run with coverage report
yarn test:coverage

# Open HTML coverage report
open coverage/lcov-report/index.html
```

## Stack

- **Runner:** Jest (react-native preset)
- **Hooks:** `renderHook` from `@testing-library/react-native`
- **Mocks:** Co-located `__mocks__/` directories for native modules
- **Coverage thresholds:** statements 95, branches 85, functions 95, lines 95

## Architecture

Tests are co-located next to source files in `__tests__/` directories, organized in 5 layers:

1. **Pure functions** — no mocks needed
2. **Core logic** — mocked native modules (op-sqlite, NetInfo, Expo)
3. **Context consumer hooks** — wrapped in test providers
4. **Complex hooks** — renderHook with mocked dependencies
5. **Integration** — SQLiteSyncProvider rendering

## Shared Mocks

Located in `src/__mocks__/`:

| Mock | What it provides |
|------|-----------------|
| `@op-engineering/op-sqlite` | `createMockDB()`, `open()`, `getDylibPath()` |
| `@react-native-community/netinfo` | `addEventListener`, `fetch`, `__emit()` |
| `react-native` | `AppState`, `Platform` |
| `expo-notifications` | Token, permissions, listeners |
| `expo-secure-store` | `getItemAsync`, `setItemAsync`, `deleteItemAsync` |
| `expo-task-manager` | `defineTask`, `isTaskRegisteredAsync` |
| `expo-constants` | `expoConfig.extra` |
| `expo-application` | `getIosIdForVendorAsync`, `getAndroidId` |

Test utilities in `src/testUtils.tsx` provide `createTestWrapper` for provider-wrapped hook tests.

## Test Files (33 files, 305 tests)

### Layer 1: Pure Functions (39 tests)

| Test file | Source | Tests | What's tested |
|-----------|--------|------:|---------------|
| `core/polling/__tests__/calculateAdaptiveSyncInterval.test.ts` | calculateAdaptiveSyncInterval | 10 | Base interval, idle backoff at threshold, exponential error backoff, caps at maxInterval, error priority over idle |
| `core/pushNotifications/__tests__/isSqliteCloudNotification.test.ts` | isSqliteCloudNotification | 13 | Foreground valid/invalid URI, iOS background body, Android JSON string body, Android dataString fallback, invalid JSON, wrong URI, empty data |
| `core/common/__tests__/logger.test.ts` | logger | 9 | debug=true logs info/warn, debug=false suppresses, error always logs, [SQLiteSync] prefix, ISO timestamp, default debug=false |
| `core/pushNotifications/__tests__/pushNotificationSyncCallbacks.test.ts` | pushNotificationSyncCallbacks | 5 | Register/get background callback, null default, set/get/clear foreground callback |
| `core/__tests__/constants.test.ts` | constants | 2 | FOREGROUND_DEBOUNCE_MS value, BACKGROUND_SYNC_TASK_NAME non-empty |

### Layer 2: Core Logic (97 tests)

| Test file | Source | Tests | What's tested |
|-----------|--------|------:|---------------|
| `core/database/__tests__/createDatabase.test.ts` | createDatabase | 9 | Opens DB, WAL journal mode, write mode pragmas, read mode pragmas, returns DB, propagates open/pragma errors |
| `core/sync/__tests__/initializeSyncExtension.test.ts` | initializeSyncExtension | 14 | Missing connectionString/auth validation, iOS/Android extension paths, version check, cloudsync_init per table, network_init, API key/accessToken auth, siteId logging |
| `core/sync/__tests__/executeSync.test.ts` | executeSync | 14 | JS retry loop (returns 0/count, stops on changes, max attempts, transaction wrapping, malformed JSON), native retry passthrough |
| `core/background/__tests__/backgroundSyncConfig.test.ts` | backgroundSyncConfig | 10 | Persist/get/clear config, null without SecureStore, parse errors, warn/error handling |
| `core/background/__tests__/backgroundSyncRegistry.test.ts` | backgroundSyncRegistry | 7 | Register (persist + task), unregister (task + clear), warns when unavailable, error handling |
| `core/background/__tests__/executeBackgroundSync.test.ts` | executeBackgroundSync | 13 | Opens DB, inits sync, executes with native retry, updateHook callback, changes collection, DB close in finally, error rethrow, close error handling |
| `core/pushNotifications/__tests__/registerPushToken.test.ts` | registerPushToken | 12 | Skip duplicate, correct URL, accessToken/apiKey auth headers, body fields, iOS/Android device ID, non-ok response, persist after success, SecureStore read/write errors, missing expo-application |
| `core/pushNotifications/__tests__/pushNotificationSyncTask.test.ts` | pushNotificationSyncTask | 8 | Task definition with/without ExpoTaskManager, handler routes to background sync, skips non-SQLite notification, foreground callback when app active, error handling, skip without config |
| `core/common/__tests__/optionalDependencies.test.ts` | optionalDependencies | 10 | Each Expo module available/null, ExpoConstants .default fallback, isBackgroundSyncAvailable (all present vs any missing) |

### Layer 3: Context Consumer Hooks (10 tests)

| Test file | Source | Tests | What's tested |
|-----------|--------|------:|---------------|
| `hooks/context/__tests__/useSqliteDb.test.ts` | useSqliteDb | 2 | Returns writeDb/readDb/initError from context, null defaults |
| `hooks/context/__tests__/useSyncStatus.test.ts` | useSyncStatus | 2 | Returns all status fields, default values |
| `hooks/context/__tests__/useSqliteSync.test.ts` | useSqliteSync | 2 | Returns merged contexts, triggerSync callable |
| `core/common/__tests__/useInternalLogger.test.ts` | useInternalLogger | 2 | Returns logger from context, has info/warn/error methods |
| `hooks/sync/__tests__/useTriggerSqliteSync.test.ts` | useTriggerSqliteSync | 2 | Returns triggerSync, calls through to context |

### Layer 4: Complex Hooks (112 tests)

_Includes useDatabaseInitialization which spans init + lifecycle._

| Test file | Source | Tests | What's tested |
|-----------|--------|------:|---------------|
| `hooks/sqlite/__tests__/useSqliteExecute.test.ts` | useSqliteExecute | 10 | Undefined when no db, execute on writeDb/readDb, error state, clears error, auto-sync after write, skip on readOnly/autoSync=false, non-Error wrapping |
| `hooks/sqlite/__tests__/useSqliteTransaction.test.ts` | useSqliteTransaction | 8 | Undefined when no writeDb, calls transaction, error state, clears error, auto-sync after commit, skip autoSync=false, non-Error wrapping |
| `hooks/sqlite/__tests__/useOnTableUpdate.test.ts` | useOnTableUpdate | 8 | Register/remove updateHook, table filtering, null row for DELETE, empty rows, fetch error, no-op when null |
| `hooks/sync/__tests__/useSqliteSyncQuery.test.ts` | useSqliteSyncQuery | 10 | Loading state, initial read, error, reactive subscription after debounce, callback updates, unmount cleanup, debounce clearing, stale subscription skip, unsubscribe |
| `core/sync/__tests__/useSyncManager.test.ts` | useSyncManager | 16 | Null db/not ready guards, sync lifecycle, empty sync counters, error state, interval recalculation (polling vs push), concurrent sync prevention, Android network check, error backoff |
| `core/sync/__tests__/useInitialSync.test.ts` | useInitialSync | 4 | Delayed trigger after 1500ms, not ready guard, once-only, cleanup on unmount |
| `core/lifecycle/__tests__/useAppLifecycle.test.ts` | useAppLifecycle | 10 | Register/remove AppState listener, foreground sync trigger, interval reset (polling only), debounce, background state tracking |
| `core/lifecycle/__tests__/useNetworkListener.test.ts` | useNetworkListener | 10 | Register/unsubscribe NetInfo, sync on reconnect, no sync online→online, background guard, isNetworkAvailable state, null isInternetReachable/isConnected handling |
| `core/polling/__tests__/useAdaptivePollingSync.test.ts` | useAdaptivePollingSync | 9 | Start/stop polling, no start in push/not ready, pause on background, resume, dynamic interval, cleanup |
| `core/pushNotifications/__tests__/usePushNotificationSync.test.ts` | usePushNotificationSync | 15 | Permission request, skip in polling, token registration, siteId retrieval, denied callback, foreground listener, sync trigger, ignore non-SQLite notification, background registration, fallback, unregister on mode switch, cleanup, handle failures |
| `core/database/__tests__/useDatabaseInitialization.test.ts` | useDatabaseInitialization | 12 | Creates write/read DBs, initializes sync extension, onDatabaseReady callback, re-init on config change, error handling, empty name/tables validation, close errors on unmount |

### Layer 5: Integration And Public Surface (19 tests)

| Test file | Source | Tests | What's tested |
|-----------|--------|------:|---------------|
| `core/__tests__/SQLiteSyncProvider.test.tsx` | SQLiteSyncProvider | 14 | Renders children, provides writeDb/readDb, initError/syncError, onDatabaseReady, default status, syncMode, triggerSync, adaptive config, re-init triggers, mode fallback, cleanup |
| `core/__tests__/SQLiteSyncProvider.integration.test.tsx` | SQLiteSyncProvider | 7 | Polling defaults without adaptivePolling, push foreground default, push fallback to polling, reinit on accessToken/apiKey/databaseId/table config changes |
| `core/__tests__/publicExports.test.ts` | public API surface | 2 | Root exports smoke test, `./backgroundSync` subpath export smoke test |
