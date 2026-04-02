# Plan: Background-Alive Sync Path

**Date:** 2026-04-02  
**Status:** Implemented

---

## Problem Statement

When a push notification arrives while the app is **backgrounded but not terminated**, the current code falls through to `executeBackgroundSync()` and opens a second write connection even though the provider is still mounted with an existing open connection. This creates concurrent writers and relies on SQLite locking rather than single-connection ownership.

---

## Three-State Model

| App State | Connection | Behavior |
|-----------|-----------|----------|
| `active` | reuse existing | `performSync()` via `foregroundSyncCallback` |
| backgrounded + alive | reuse existing | `performSync()` via `foregroundSyncCallback` — same callback |
| terminated | open new | `executeBackgroundSync` → `registerBackgroundSyncCallback` |

Both the active and backgrounded-alive cases call the same `foregroundSyncCallback` (`() => performSyncRef.current?.() ?? Promise.resolve()`). This is correct because `performSync` already has all necessary guards built in (`isSyncingRef`, `writeDbRef`, `isSyncReady`, Android network check). React state updates (`isSyncing`, `lastSyncTime`, etc.) queued while backgrounded apply harmlessly on next render when the user returns.

The distinction between active and backgrounded-alive is only relevant at the **notification layer** in the example app (see Phase 3).

---

## Why Not a Separate `backgroundAliveSyncCallback`

The callback would be identical to `foregroundSyncCallback`. Two module-level variables holding the same function serves no purpose. `performSync` already guards against all the failure modes that would require a different implementation.

---

## Will `useOnTableUpdate` Fire When Backgrounded?

OP-SQLite's `updateHook` is a SQLite C callback that fires synchronously on the thread executing the write. When the app is backgrounded but alive, the JS runtime thread is still active and running the background task. The hook dispatch should work.

**Caveat:** Depends on whether OP-SQLite dispatches the hook synchronously on the current thread or schedules it. If scheduled, delivery may be delayed until foregrounding. Behavior is correct either way — timing may vary.

**Verification:** manually confirm `useOnTableUpdate` fires during a background-alive sync in testing.

---

## Signal: How to Detect "Provider Is Mounted"

`foregroundSyncCallback` is set by `usePushNotificationSync` inside a React hook. React hooks only run when the component tree is mounted. In a terminated → background launch there is no component tree, so the callback is never set.

Therefore: **`getForegroundSyncCallback() !== null` is a reliable proxy for "provider is mounted, `writeDbRef.current` is valid."**

---

## Implementation Plan

### Phase 1 — Update `pushNotificationSyncTask.ts` (one-line change)

Remove the `AppState.currentState === 'active'` guard. The callback's existence is sufficient — it implies the provider is mounted and the connection is live.

```typescript
// Before:
if (AppState.currentState === 'active' && foregroundCallback) {

// After:
if (foregroundCallback) {
```

Full updated task:

```typescript
const foregroundCallback = getForegroundSyncCallback();

/** FOREGROUND / BACKGROUND-ALIVE MODE */
// foregroundCallback being non-null means the provider is mounted
// (React hooks only run when the component tree is alive).
// Safe for both active and backgrounded states — performSync guards internally.
if (foregroundCallback) {
  logger.info('📲 Provider is mounted, using existing sync');
  try {
    await foregroundCallback();
    logger.info('✅ Sync completed');
  } catch (syncError) {
    logger.error('❌ Sync failed:', syncError);
  }
  return;
}

/** TERMINATED / NO PROVIDER MODE */
if (!config) {
  logger.info('📲 No config found, skipping background sync');
  return;
}

await executeBackgroundSync(config);
```

The `AppState` import can be removed from this file if it is no longer used elsewhere.

---

### Phase 2 — Tests

**Update:** `src/core/pushNotifications/__tests__/pushNotificationSyncTask.test.ts`

New cases to add:
- When `foregroundCallback` is set and `AppState === 'background'`: callback is called, `executeBackgroundSync` is NOT called
- When `foregroundCallback` is set and `AppState === 'inactive'`: callback is called, `executeBackgroundSync` is NOT called
- When `foregroundCallback` is set and `AppState === 'active'`: callback is called (existing test, now also covers removal of the AppState guard)
- When `foregroundCallback` is null and `AppState === 'background'`: `executeBackgroundSync` is called (terminated path)

---

### Phase 3 — Update Expo Example App

`registerBackgroundSyncCallback` handles the **terminated** case — no component tree, so the app must schedule a push notification to alert the user. This stays as-is.

The **background-alive** case now goes through `performSync`, which means `useOnTableUpdate` hooks fire. The example should demonstrate sending a notification from `useOnTableUpdate` when the app is backgrounded — this is how users handle the background-alive notification scenario.

**Update `examples/sync-demo-expo/src/App.tsx`:**

Add `AppState` import from `react-native`. Update the existing `useOnTableUpdate` callback to schedule a notification when the app is not active and the operation is an INSERT:

```typescript
import { ..., AppState } from 'react-native';

useOnTableUpdate<{ id: string; value: string; created_at: string }>({
  tables: [TABLE_NAME],
  onUpdate: async (data) => {
    /** BACKGROUND-ALIVE NOTIFICATION */
    // When app is backgrounded but alive, useOnTableUpdate fires normally.
    // Schedule a local notification so the user is alerted, same as the
    // terminated path handled by registerBackgroundSyncCallback.
    if (AppState.currentState !== 'active' && data.operation === 'INSERT' && data.row) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'New item synced',
          body: data.row.value || 'New data is available',
          data: { rowId: data.row.id },
        },
        trigger: null,
      });
      return;
    }

    /** FOREGROUND UI UPDATE */
    const operationName =
      data.operation === 'INSERT'
        ? 'added'
        : data.operation === 'UPDATE'
        ? 'updated'
        : 'deleted';

    if (data.row) {
      setRowNotification(
        `🔔 Row ${operationName}: "${data.row.value.substring(0, 20)}${
          data.row.value.length > 20 ? '...' : ''
        }"`
      );
    } else {
      setRowNotification(`🔔 Row ${operationName}`);
    }
    setTimeout(() => setRowNotification(null), 2000);
  },
});
```

The callback needs to be `async` — add that. Also update the JSDoc comment above the `registerBackgroundSyncCallback` block and the `useOnTableUpdate` comment to explain the two-path split:

- `registerBackgroundSyncCallback` → terminated case
- `useOnTableUpdate` with AppState check → background-alive case

---

## File Impact

| File | Change | Risk |
|------|--------|------|
| `src/core/pushNotifications/pushNotificationSyncTask.ts` | Remove `AppState.currentState === 'active' &&` guard; remove `AppState` import if unused | Very Low |
| `src/core/pushNotifications/__tests__/pushNotificationSyncTask.test.ts` | Add background/inactive AppState test cases | None |
| `examples/sync-demo-expo/src/App.tsx` | Add AppState check + notification in `useOnTableUpdate`; make callback async | Low |

No new files. No new module-level variables. No changes to `useSyncManager`, `usePushNotificationSync`, or `pushNotificationSyncCallbacks`.

---

## Failure Scenarios Covered

| Scenario | Handled by |
|----------|-----------|
| Notification while app active | `foregroundCallback` → `performSync` (unchanged) |
| Notification while app backgrounded, provider mounted | `foregroundCallback` → `performSync`; `useOnTableUpdate` fires → notification sent |
| Notification while app terminated | `executeBackgroundSync` → `registerBackgroundSyncCallback` (unchanged) |
| Concurrent sync (foreground + background-alive race) | `isSyncingRef` guard inside `performSync` |
| Provider unmounted before callback fires | `foregroundCallback` is null → falls through to `executeBackgroundSync` |

---

## Verification Criteria

- [ ] `AppState === 'background'`: `foregroundCallback` is called, `executeBackgroundSync` is NOT called
- [ ] `AppState === 'inactive'`: same as above
- [ ] `AppState === 'active'`: same behavior as before (existing tests still pass)
- [ ] `foregroundCallback` null + any AppState: `executeBackgroundSync` is called
- [ ] `useOnTableUpdate` fires during a background-alive sync (manual test)
- [ ] Example app: notification is sent when `useOnTableUpdate` fires while app is backgrounded
- [ ] Example app: UI notification still shows when app is active
- [ ] All existing tests pass
