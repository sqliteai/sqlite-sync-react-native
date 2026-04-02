# Plan: Remove Retries in Push Mode

**Date:** 2026-04-02  
**Status:** Approved

---

## Problem Statement

After the database-locked fix, opening the app following a terminated-state background sync shows a gray screen for 20-30 seconds on Android.

**Root cause (from logs):**

```
13:32:39 — User taps app icon (android activity not available yet)
13:32:46 — Background sync 1 starts (apply event)   ← openDB + 3-attempt native retry
13:32:48 — Background sync 2 starts (check event)   ← openDB + 3-attempt native retry, concurrent!
13:32:51 — Both syncs complete
13:32:59 — JS thread torn down ("finished thread" errors)
13:33:02 — App finally renders                       ← 23 seconds after tap
13:33:04 — Initial foreground sync: 4 attempts × ~1.3s = ~5s of extra blocking
```

Two contributing factors:
1. **Background syncs retry (native, 3 attempts)** — both tasks hold the JS engine busy during the headless→foreground Android transition
2. **Foreground initial sync retries (JS, 4 attempts × 1s delay)** — delays UI data availability after app opens

**Why retries are unnecessary in push mode:**

The server's two-notification protocol is the retry mechanism:
- `apply` event → app syncs (may get 0 changes if artifact not ready yet)
- `check` event (with `artifactURI`) → app syncs with the actual data

If a sync attempt misses changes, the server sends the next notification. Client-side retries are redundant and actively harmful to startup performance.

---

## Why Concurrent Background Syncs Were Happening

The concurrency was a **symptom of retries**, not an independent problem:

```
t=0s   apply arrives → sync attempt 1 → 0 changes → wait 500ms → attempt 2 starts
t=2s   server sends check (artifact now ready) → second executeBackgroundSync fires
         ↑ overlaps with apply's attempt 2
```

Removing retries fixes this: the `apply` sync finishes in ~1-2s (single attempt), 
so by the time `check` arrives 2 seconds later, nothing is running. No concurrency 
guard needed.

---

## Solution

### Change 1 — `executeBackgroundSync.ts`: `maxAttempts: 1`

Background sync always runs in push mode. No retries needed — the server's `check`
notification is the retry mechanism.

```typescript
// Before
await executeSync(db, logger, {
  useNativeRetry: true,
  maxAttempts: 3,
  attemptDelay: 500,
});

// After
await executeSync(db, logger, {
  maxAttempts: 1,
});
```

---

### Change 2 — `useSyncManager.ts`: `maxAttempts: 1` in push mode

`syncMode` is already available. Pass `maxAttempts: 1` when in push mode:

```typescript
const changes = await executeSync(writeDbRef.current, logger, {
  useTransaction: true,
  maxAttempts: syncMode === 'push' ? 1 : 4,
  attemptDelay: syncMode === 'push' ? 0 : 1000,
});
```

This covers both foreground notification-triggered syncs and the initial sync on app open.

---

## File Impact

| File | Change | Risk |
|------|--------|------|
| `src/core/background/executeBackgroundSync.ts` | `maxAttempts: 1` | Very Low |
| `src/core/sync/useSyncManager.ts` | `maxAttempts: syncMode === 'push' ? 1 : 4` | Very Low |

---

## Expected Outcome

```
Before: gray screen 20-30s, two concurrent background syncs, foreground retries 4×
After:  gray screen ~5-8s (Android JS context switch overhead only, not reducible by client code)
```

The remaining gray screen time is the Android headless→foreground JS context transition itself, which is outside this library's control.

---

## Test Updates

- `executeBackgroundSync.test.ts` — verify `executeSync` is called with `maxAttempts: 1`
- `useSyncManager` tests — verify `maxAttempts: 1` when `syncMode === 'push'`, `maxAttempts: 4` when `syncMode === 'polling'`

---

## Verification Criteria

- [ ] Background sync calls `executeSync` with `maxAttempts: 1`
- [ ] `useSyncManager` uses `maxAttempts: 1` when `syncMode === 'push'`
- [ ] `useSyncManager` uses `maxAttempts: 4` when `syncMode === 'polling'` (no regression)
- [ ] All existing tests pass
- [ ] Manual: terminate app → trigger push → open app → no gray screen delay, data synced correctly
