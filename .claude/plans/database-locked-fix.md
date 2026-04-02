# Plan: Fix "Database is Locked" After Background Sync on App Open

**Date:** 2026-04-02  
**Status:** Implemented

---

## Problem Statement

When a push notification arrives while the app is **terminated**, the background task (`executeBackgroundSync`) opens a write connection to the SQLite database and runs `cloudsync_network_sync()`. If the user opens the app while this task is running — or after it was interrupted — the foreground hits a **"database is locked"** (`SQLITE_BUSY`) error.

---

## Process Model — Why This Is Hard

**Both iOS and Android use the same process for background tasks:**
- **iOS**: launches app in background mode, promotes that same process to foreground when user opens the app
- **Android**: uses Android "Headless JS" — the JS runtime runs in the existing app process without a mounted component tree (same process, no component tree)

This is confirmed by `pushNotificationSyncCallbacks.ts` already using module-level state that background tasks read — a pattern that only works in a shared process.

**The key difference is how tasks get killed:**

| | iOS | Android |
|---|---|---|
| Task killed | iOS terminates the *task*, **keeps the process alive** | Android typically kills the *entire process* |
| Lock released after kill? | ❌ No — orphaned connection stays open in same process | ✅ Yes — POSIX releases all locks on process death |

**The critical failure path (both platforms, task killed in same process):**

```
1. Background task opens write DB connection
2. cloudsync_network_sync() starts (native, off JS thread)
3. TaskManager hits background task time limit
   → Expo kills the *task*, process stays alive (iOS)
   → OR background task is interrupted before finally runs (Android)
   → The JS finally { db.close() } never executes
4. User opens app → same process → foreground init runs
5. Foreground tries to open write connection
   → Same process still holds an open, unclosed write connection
   → SQLITE_BUSY
6. busy_timeout waits... but the lock holder (orphaned connection in same process)
   never releases → user is stuck
```

**Why `busy_timeout` alone is not enough for the same-process case:**
SQLite's busy_timeout retries until the lock is released. If the lock is held by an orphaned open connection in the same process that nobody will ever close, the lock is held **indefinitely**. The timeout expires and the user cannot open the database.

**When `busy_timeout` alone IS sufficient (Android process-death case):**
If Android kills the entire app process (e.g. very aggressive task termination), POSIX releases all file locks automatically on process death. The foreground app starts fresh in a new process, finds no orphaned connections in module state, and `busy_timeout` covers the brief window before the lock is fully released.

---

## Root Cause

The background task opens a DB connection but there is no mechanism for the foreground to know about or clean up that connection if the task is interrupted. The connection becomes an **orphan**: still open, holding a write lock, with no code path that will ever call `db.close()` on it.

---

## Solution: Module-level DB reference + forceful cleanup

Since the background task and foreground run in the same process, module-level state is shared. The fix is to store the background task's DB connection in a module-level variable **before the first `await`**. The foreground checks this variable on startup and forcibly closes any orphaned connection before opening its own.

```
Background:
  db = createDatabase(...)
  setActiveBackgroundDb(db)   ← store reference immediately, synchronously
  ... sync (may get interrupted here) ...
  finally:
    clearActiveBackgroundDb()
    db.close()

Foreground initialization:
  staleDb = consumeActiveBackgroundDb()
  if (staleDb) {
    staleDb.close()  ← forcibly release the lock, regardless of whether
  }                     background is done or still running
  // Now safe to open own connection
  db = createDatabase(...)
```

**Why forceful close is safe:**
- If the background task was already done: this is a no-op (reference was already cleared by the task's `finally` block)
- If the background task is interrupted/stuck: closing the connection rolls back any uncommitted write transaction and releases the lock. SQLite guarantees the database stays consistent after a connection is closed mid-transaction. The partial sync data is lost, but that is acceptable — the next foreground sync will re-download it
- If the native `cloudsync_network_sync()` call is still running when we close: OP-SQLite will return an error on the native side, the background task's `catch` block handles it, and the `finally` tries to close an already-closed connection — which we catch and ignore

**For Android / true cross-process scenarios:**
Module-level state is not shared. However, when a separate background process is killed by the OS, POSIX guarantees all file locks are released (all file descriptors are closed on SIGKILL). `PRAGMA busy_timeout` handles the wait window here. This is a secondary defense for Android, not the primary fix for iOS.

---

## Implementation Plan

### Phase 1 — New module: `activeBackgroundDb.ts`

**New file:** `src/core/background/activeBackgroundDb.ts`

Manages the module-level reference to the background sync's DB connection.

```typescript
import type { DB } from '@op-engineering/op-sqlite';

let _db: DB | null = null;

/** Called by executeBackgroundSync before first await — sets reference synchronously */
export function setActiveBackgroundDb(db: DB): void {
  _db = db;
}

/**
 * Called by useDatabaseInitialization on startup.
 * Returns and clears the reference so the caller owns the connection.
 * Returns null if no background sync connection exists.
 */
export function consumeActiveBackgroundDb(): DB | null {
  const db = _db;
  _db = null;
  return db;
}

/** Called in background task's finally block to clear reference after normal close */
export function clearActiveBackgroundDb(): void {
  _db = null;
}
```

---

### Phase 2 — Update `executeBackgroundSync.ts`

Set the module-level reference **before the first `await`** (synchronously), so it's visible to any foreground code that runs concurrently. Clear it and close in the `finally` block — but only if the foreground hasn't already consumed and closed it.

Key changes:
- Pass `setActiveBackgroundDb` as `onOpen` callback to `createDatabase` (see Phase 4 amendment) — this fires synchronously after `open()` before any awaited PRAGMAs, closing the kill-window gap
- In `finally`: call `clearActiveBackgroundDb()` before `db.close()`
- Handle the case where `db.close()` throws because foreground already closed it (already caught by existing try/catch in `finally`)

> **Amendment (post-review):** Originally called `setActiveBackgroundDb(db)` after `await createDatabase(...)` returned, which still left a window between `open()` and the first PRAGMA await. Fixed by using the `onOpen` callback in `createDatabase` (see Phase 4 amendment).

---

### Phase 3 — Update `useDatabaseInitialization.ts`

At the very start of the `initialize()` function, before opening any connections, check for and close any orphaned background connection.

```typescript
import { consumeActiveBackgroundDb } from '../background/activeBackgroundDb';

const initialize = async () => {
  /** CLEANUP ORPHANED BACKGROUND CONNECTION */
  const orphanedDb = consumeActiveBackgroundDb();
  if (orphanedDb) {
    logger.warn('⚠️ Found orphaned background sync connection — closing to release write lock');
    try {
      orphanedDb.updateHook(null);
      orphanedDb.close();
      logger.info('✅ Orphaned connection closed');
    } catch (closeErr) {
      logger.warn('⚠️ Could not close orphaned connection (may already be closed):', closeErr);
      // Best effort — proceed regardless
    }
  }

  // ... rest of existing initialize() code unchanged
};
```

---

### Phase 4 — Update `createDatabase.ts`

Two changes:

**1. Add `PRAGMA busy_timeout`** as a cross-process fallback (Android) and general-purpose defense.

```typescript
const db = open({ name });
await db.execute('PRAGMA busy_timeout = 10000');  // 10s fallback for cross-process
await db.execute('PRAGMA journal_mode = WAL');
```

10 seconds is sufficient for Android's cross-process scenario — when the background process is killed, POSIX releases the lock within milliseconds. 10s covers any OS-level delay.

**2. Add `onOpen?: (db: DB) => void` callback parameter** (amendment, see Phase 2 note).

```typescript
export async function createDatabase(
  name: string,
  mode: 'write' | 'read',
  onOpen?: (db: DB) => void
): Promise<DB> {
  const db = open({ name });
  onOpen?.(db);  // ← fires synchronously before any await
  await db.execute('PRAGMA busy_timeout = 10000');
  ...
}
```

This allows callers to register ownership of the raw connection before any async gap. Background sync passes `setActiveBackgroundDb` here. Normal callers (foreground, read connections) pass nothing.

---

### Phase 5 — Tests

**New:** `src/core/background/__tests__/activeBackgroundDb.test.ts`
- `setActiveBackgroundDb` makes connection available
- `consumeActiveBackgroundDb` returns and clears the reference
- `clearActiveBackgroundDb` clears without returning

**Update:** `src/core/background/__tests__/executeBackgroundSync.test.ts`
- Verify `createDatabase` is called with an `onOpen` callback (function arg in position 3)
- Verify that `onOpen` callback calls `setActiveBackgroundDb` with the DB
- Verify `clearActiveBackgroundDb` is called in the `finally` block (both success and error paths)
- Verify `db.close()` error after foreground already closed it is handled gracefully

**Update:** `src/core/database/__tests__/useDatabaseInitialization.test.ts`
- When `consumeActiveBackgroundDb` returns a mock DB, verify `db.close()` is called on it before initialization proceeds
- When `consumeActiveBackgroundDb` returns `null`, verify normal initialization path

**Update:** `src/core/database/__tests__/createDatabase.test.ts`
- Verify `PRAGMA busy_timeout = 10000` is executed
- Verify `busy_timeout` is set before `journal_mode` (ordering matters)
- Verify `onOpen` callback is called synchronously before any PRAGMA (pragma call count is 0 when `onOpen` fires)

---

## File Impact

| File | Change | Risk |
|------|--------|------|
| `src/core/background/activeBackgroundDb.ts` | New file, ~20 lines | None |
| `src/core/background/executeBackgroundSync.ts` | Pass `setActiveBackgroundDb` as `onOpen` to `createDatabase`; `clearActiveBackgroundDb()` in `finally` | Low |
| `src/core/database/useDatabaseInitialization.ts` | Add cleanup block at start of `initialize()` | Low |
| `src/core/database/createDatabase.ts` | Add `onOpen?` callback param + `PRAGMA busy_timeout = 10000` | Very Low |
| Test files | New + updated test cases (51 tests total) | None |

---

## Failure Scenarios Covered

| Scenario | Covered by |
|----------|-----------|
| Background task completes normally, user opens app immediately after | Phase 4 (`busy_timeout`) — lock released naturally, brief wait |
| Background task interrupted (iOS time limit), same process | Phase 1-3 — foreground forcibly closes orphaned connection |
| Background task stuck (CloudSync network timeout), same process | Phase 1-3 — foreground forcibly closes orphaned connection |
| Background process killed by OS (Android / cross-process) | Phase 4 — POSIX releases lock on process death, `busy_timeout` covers the window |
| No background sync running | `consumeActiveBackgroundDb()` returns null, zero overhead |

---

## What This Does NOT Cover

- If the CloudSync native library (`cloudsync_network_sync`) holds the lock for longer than `busy_timeout` in a cross-process scenario AND the process is not killed yet — this would require aborting the CloudSync native call, which is outside this library's control. In practice, iOS kills background processes well within 30s.

---

## Verification Criteria

- [x] `setActiveBackgroundDb(db)` is called synchronously via `onOpen` callback inside `createDatabase`, before any PRAGMA await
- [x] `clearActiveBackgroundDb()` is called in the `finally` block of `executeBackgroundSync`
- [x] `useDatabaseInitialization` calls `consumeActiveBackgroundDb()` and closes the returned connection before opening its own
- [x] If `consumeActiveBackgroundDb()` returns null, zero behavior change vs. current code
- [x] `PRAGMA busy_timeout = 10000` is first PRAGMA after `open()` in `createDatabase`
- [x] All existing tests pass
- [x] New `activeBackgroundDb` tests pass (51 tests total, all passing)
- [ ] Manual test: terminate app → trigger background sync → open app during sync → no locked error, app loads cleanly
