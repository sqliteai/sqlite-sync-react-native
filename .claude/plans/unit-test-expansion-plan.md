# Unit Test Expansion Plan

**Status:** Implemented
**Last updated:** 2026-03-20
**Scope:** Expand and harden the library unit-test suite before moving on to end-to-end example app integration tests

## Goal

Increase the value of the library test suite in two ways:

1. Add missing unit and library-level integration tests for important runtime behavior
2. Improve the existing tests by reducing unnecessary internal mocks, especially around provider and push flows

This plan intentionally stops short of full end-to-end testing of the example apps. That is the next phase.

## Success Criteria

- Important public behaviors are tested directly, not only via wiring assertions
- User-scoped auth, provider reinitialization, polling defaults, and push fallback are covered
- Provider tests rely on fewer mocks and exercise more real runtime behavior
- Race conditions and cleanup behavior are tested for reactive hooks
- Public package exports and subpath exports have smoke coverage
- Coverage reporting and thresholds are introduced once the expanded suite is stable

## Current Observations

- The current suite is broad and useful, but some high-value areas are still too mock-heavy
- `SQLiteSyncProvider` tests currently mock nearly the full dependency graph, which limits real integration confidence
- Push notification tests exercise branch logic well, but still mock many internal modules at once
- There is no enforced coverage threshold in Jest config
- Full device/native integration is intentionally deferred to the next testing phase

## Workstreams

### Workstream 1: Provider And Public API

#### Add tests

1. `SQLiteSyncProvider` polling defaults integration
- Render with `syncMode="polling"` and no `adaptivePolling`
- Assert default adaptive config is passed into the real sync manager path
- Assert `currentSyncInterval` starts at `baseInterval`

2. `SQLiteSyncProvider` `notificationListening` defaulting
- Render push mode without explicit `notificationListening`
- Assert effective value is `'foreground'`

3. `SQLiteSyncProvider` auth reinitialization for `accessToken`
- Initial render with `accessToken="user-a"`
- Rerender with `accessToken="user-b"`
- Assert DB/sync init reruns with the new user token

4. `SQLiteSyncProvider` auth reinitialization for `apiKey`
- Initial render with `apiKey="key-a"`
- Rerender with `apiKey="key-b"`
- Assert DB/sync init reruns

5. `SQLiteSyncProvider` `databaseId` reinitialization
- Change `databaseId`
- Assert teardown and re-init

6. `SQLiteSyncProvider` `databaseName` reinitialization
- Change `databaseName`
- Assert old DBs are closed and new ones are opened

7. `SQLiteSyncProvider` `tablesToBeSynced` reinitialization
- Change table config content
- Assert safe re-init

8. `SQLiteSyncProvider` migration ordering
- Assert DB open happens before `onDatabaseReady`
- Assert `onDatabaseReady` completes before sync init
- Assert failed migration prevents sync init

9. `SQLiteSyncProvider` push fallback integration
- Render provider in push mode
- Simulate permission denied or token-registration failure
- Assert effective runtime mode becomes polling
- Assert polling-related behavior is active after fallback

10. Public root export smoke test
- Import public exports from `src/index.tsx`
- Assert documented runtime exports exist

11. Public subpath export smoke test
- Add coverage for `./backgroundSync` export path if it is intended to ship

#### Improve existing tests

- Refactor `src/core/__tests__/SQLiteSyncProvider.test.tsx`
- Stop mocking all internal hooks
- Mock only true external boundaries:
  - DB creation / OP-SQLite
  - sync extension/native SQL calls
  - NetInfo
  - AppState
  - Expo notifications
- Replace prop-wiring assertions with behavior assertions through contexts

### Workstream 2: Query, Execute, Transaction, And Table Update Hooks

#### Add tests

12. `useSqliteSyncQuery` no-`readDb` behavior
- Explicitly test intended behavior when `readDb` is null and `writeDb` exists

13. `useSqliteSyncQuery` subscription replacement on rerender
- Query/args/fireOn change should unsubscribe the old reactive subscription exactly once

14. `useSqliteSyncQuery` stale async result protection
- Query A resolves after query B replaces it
- Old result must not overwrite new state

15. `useSqliteSyncQuery` callback error behavior
- Reactive callback throws or returns malformed data
- Assert predictable error handling

16. `useSqliteSyncQuery` `fireOn` operation filtering
- Ensure operation-specific invalidation behaves as expected

17. `useOnTableUpdate` multiple-table filtering edge cases
- Subscribed tables trigger
- Unrelated tables do not
- DELETE keeps `row = null`

18. `useOnTableUpdate` cleanup on config change
- Changing tables or callback should remove old hook and install new one

19. `useSqliteExecute` `isExecuting` lifecycle
- True while request is active
- False after success
- False after failure

20. `useSqliteExecute` read-only without `readDb`
- Explicitly codify current behavior

21. `useSqliteExecute` preserves main result when auto-sync fails
- Assert returned result is intact
- Assert `error` remains null

22. `useSqliteTransaction` `isExecuting` lifecycle
- True while transaction is active
- False after success/failure

23. `useSqliteTransaction` callback fidelity
- Assert provided transaction object is the one used for multiple statements

24. `useSqliteTransaction` no auto-sync after failed transaction
- If transaction throws, `cloudsync_network_send_changes()` must not run

#### Improve existing tests

- Strengthen `useSqliteSyncQuery` tests to validate state transitions, not only mocked callback wiring
- Reduce duplicated mocking in execute/transaction tests by using a more realistic fake DB helper

### Workstream 3: Lifecycle, Polling, And Sync Manager

#### Add tests

25. `useAppLifecycle` transition matrix
- `inactive -> active`
- `background -> active`
- `active -> active`
- Only real resume transitions should trigger sync

26. `useNetworkListener` initial offline startup
- Start offline, then reconnect
- Assert first reconnect behavior is correct

27. `useNetworkListener` repeated online noise
- Multiple online events without a new offline phase should not retrigger sync

28. `useAdaptivePollingSync` timer replacement
- Interval changes should clear prior timer and schedule a new one

29. `useAdaptivePollingSync` cleanup robustness
- Unmount clears timer cleanly
- No duplicate timers survive rerenders

30. `useSyncManager` sync mode switching
- Behavior when params rerender from polling to push and back

31. `useSyncManager` sync error recovery
- After failures, a successful sync resets `consecutiveSyncErrors`

32. `useSyncManager` Android network edge cases
- More explicit coverage for `isConnected=true` with unusual `isInternetReachable` values

#### Improve existing tests

- Keep these tests mostly behavior-focused
- Avoid introducing extra mocks because this area is already relatively strong

### Workstream 4: Sync Initialization And Database Initialization

#### Add tests

33. `initializeSyncExtension` failure on `loadExtension`
- Clear thrown error

34. `initializeSyncExtension` failure on `cloudsync_network_init_custom`
- Clear thrown error

35. `initializeSyncExtension` failure on `cloudsync_network_set_apikey`
- Clear thrown error

36. `initializeSyncExtension` failure on `cloudsync_network_set_token`
- Clear thrown error

37. `initializeSyncExtension` auth policy test
- Decide intended runtime behavior if both `apiKey` and `accessToken` are somehow supplied
- Test the chosen policy explicitly

38. `useDatabaseInitialization` partial DB open failure
- Write DB succeeds, read DB fails
- Assert cleanup and fatal error behavior

39. `useDatabaseInitialization` parameter-driven reinit
- Changing config should close prior DBs before reopening

40. `useDatabaseInitialization` sync init should not run after fatal table creation failure
- Assert no further steps continue

41. `useDatabaseInitialization` empty tables behavior
- Clarify and codify expected behavior with assertions beyond “does not crash”

#### Improve existing tests

- Keep `createDatabase` mocked, but use more behavior-rich fake DB instances
- Replace “no crash” tests with stronger assertions when possible

### Workstream 5: Push Registration, Push Hooks, And Background Sync

#### Add tests

42. `registerPushToken` missing auth
- Assert clear error when neither `apiKey` nor `accessToken` is provided

43. `registerPushToken` token re-registration policy
- Same Expo token with different `databaseId`
- Same Expo token with different `siteId`
- Same Expo token with changed auth
- Verify intended behavior explicitly

44. `registerPushToken` Android device ID failure
- `getAndroidId()` missing or throws

45. `usePushNotificationSync` token registration failure path
- Registration fails after permissions granted
- Assert warning and fallback behavior

46. `usePushNotificationSync` custom permission prompt flow
- `renderPushPermissionPrompt`
- `allow` proceeds to permission request
- `deny` triggers fallback/denied flow

47. `usePushNotificationSync` foreground listener cleanup
- Unmount removes notification listener

48. `usePushNotificationSync` background registration cleanup
- `notificationListening="always"` unregisters on unmount or mode change

49. `usePushNotificationSync` missing optional dependency combinations
- Test missing `expo-notifications`
- Test missing `expo-constants`
- Test missing `expo-application`
- Test missing background deps for `'always'`

50. `pushNotificationSyncTask` invalid persisted config
- Missing required fields
- Corrupt serialized payload
- Fails safely without crash

51. `executeBackgroundSync` access-token configuration
- Cover `accessToken` path, not only `apiKey`

52. `executeBackgroundSync` failure before callback registration
- DB still closes
- Callback does not run

53. `executeBackgroundSync` table/init failure cleanup
- Assert `close()` still runs

#### Improve existing tests

- Refactor `usePushNotificationSync.test.ts` to mock fewer internal helpers
- Keep Expo/native boundaries mocked, but prefer real internal control flow

## Outcome

This unit-test expansion pass was implemented. The library now has:

- 33 test suites
- 305 tests
- provider integration coverage with fewer internal mocks
- public export smoke coverage
- coverage reporting with enforced thresholds
- stronger cleanup, auth, push, and reactive-hook edge-case coverage

## Recommended Implementation Order

### Phase 1: Highest-value unit tests

1. Provider defaults integration
2. Provider auth reinit
3. Provider push fallback integration
4. Query stale result + cleanup tests
5. Transaction “no auto-sync after failure”
6. Push permission prompt flow
7. Background sync `accessToken` path

### Phase 2: Provider and push mock reduction

8. Refactor `SQLiteSyncProvider.test.tsx`
9. Refactor `usePushNotificationSync.test.ts`
10. Strengthen `useDatabaseInitialization.test.ts`

### Phase 3: Remaining high-value behavior gaps

11. Export smoke tests
12. Register-push-token policy edge cases
13. Lifecycle/polling edge cases
14. Sync-init failure matrix
15. Background sync cleanup/failure matrix

### Phase 4: Coverage measurement and enforcement

16. Enable `collectCoverage`
17. Establish baseline coverage report
18. Add pragmatic thresholds by category:
- statements
- branches
- functions
- lines

Suggested approach:

- Do not add strict thresholds before the new tests are in place
- Start with thresholds that reflect current reality
- Tighten later as E2E coverage is added

## Mock Reduction Strategy

### Keep mocking

- OP-SQLite native module boundaries
- NetInfo
- AppState
- Expo native APIs
- network calls such as `fetch`

### Reduce mocking for

- `SQLiteSyncProvider` internal hook graph
- internal push helper modules when testing push hook behavior
- internal database/sync coordination inside provider-level tests

### Principle

At the library unit-test level, mock platform/native boundaries, not your own core logic, unless the test is intentionally scoped to one pure unit.

## Deliverables

1. Expanded unit-test suite covering the cases listed above
2. Refactored provider and push tests with fewer internal mocks
3. Coverage reporting in Jest
4. Updated `.claude/plans/test-suite.md` after implementation is complete

## Explicitly Deferred To Next Step

- Full end-to-end tests on `examples/sync-demo-expo`
- Full end-to-end tests on `examples/sync-demo-bare`
- Real-device push validation
- Build/install/runtime validation in CI on native targets
