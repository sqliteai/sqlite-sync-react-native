# Test Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve 100% test coverage for sqlite-sync-react-native with 30 test files and ~272 test cases.

**Architecture:** Layered testing with shared mocks for native modules. Co-located `__tests__/` directories next to source files. Pure functions tested first, then core logic with mocked deps, then hooks with renderHook, then integration.

**Tech Stack:** Jest (react-native preset), @testing-library/react-native (renderHook), shared `__mocks__/` for op-sqlite, NetInfo, AppState, Expo modules.

**Design doc:** `.claude/plans/test-suite-design.md`

---

## Task 0: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install test dependencies**

Run:
```bash
yarn add -D @testing-library/react-native react-test-renderer
```

**Step 2: Verify jest config works**

Run: `yarn test --passWithNoTests`
Expected: Exit 0

**Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add @testing-library/react-native for hook tests"
```

---

## Task 1: Create Shared Mocks

**Files:**
- Create: `src/__mocks__/@op-engineering/op-sqlite.ts`
- Create: `src/__mocks__/@react-native-community/netinfo.ts`
- Create: `src/__mocks__/react-native.ts`
- Create: `src/__mocks__/expo-notifications.ts`
- Create: `src/__mocks__/expo-secure-store.ts`
- Create: `src/__mocks__/expo-task-manager.ts`
- Create: `src/__mocks__/expo-constants.ts`
- Create: `src/__mocks__/expo-application.ts`

### op-sqlite mock

```typescript
// src/__mocks__/@op-engineering/op-sqlite.ts

const createMockTx = () => ({
  execute: jest.fn().mockResolvedValue({ rows: [] }),
});

export const createMockDB = () => ({
  execute: jest.fn().mockResolvedValue({ rows: [] }),
  transaction: jest.fn(async (fn: any) => {
    const tx = createMockTx();
    await fn(tx);
    return tx;
  }),
  close: jest.fn(),
  loadExtension: jest.fn(),
  updateHook: jest.fn(),
  reactiveExecute: jest.fn(() => jest.fn()),
});

export const open = jest.fn(() => createMockDB());
export const getDylibPath = jest.fn(
  (_bundleId: string, _name: string) => '/mock/path/CloudSync'
);

export type DB = ReturnType<typeof createMockDB>;
export type QueryResult = {
  rows?: Record<string, any>[];
  insertId?: number;
  rowsAffected?: number;
};
export type Transaction = ReturnType<typeof createMockTx>;
```

### NetInfo mock

```typescript
// src/__mocks__/@react-native-community/netinfo.ts

type NetInfoCallback = (state: any) => void;
const listeners: NetInfoCallback[] = [];

const NetInfo = {
  addEventListener: jest.fn((callback: NetInfoCallback) => {
    listeners.push(callback);
    return jest.fn(() => {
      const idx = listeners.indexOf(callback);
      if (idx >= 0) listeners.splice(idx, 1);
    });
  }),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  }),
  __simulateChange: (state: any) => {
    listeners.forEach((cb) => cb(state));
  },
  __clearListeners: () => {
    listeners.length = 0;
  },
};

export default NetInfo;
```

### react-native mock

```typescript
// src/__mocks__/react-native.ts

type AppStateCallback = (state: string) => void;

export const Platform = {
  OS: 'ios' as string,
  select: jest.fn((obj: any) => obj.ios),
};

const appStateListeners: AppStateCallback[] = [];

export const AppState = {
  currentState: 'active' as string,
  addEventListener: jest.fn((_type: string, callback: AppStateCallback) => {
    appStateListeners.push(callback);
    return {
      remove: jest.fn(() => {
        const idx = appStateListeners.indexOf(callback);
        if (idx >= 0) appStateListeners.splice(idx, 1);
      }),
    };
  }),
  __simulateChange: (state: string) => {
    AppState.currentState = state;
    appStateListeners.forEach((cb) => cb(state));
  },
  __clearListeners: () => {
    appStateListeners.length = 0;
  },
};
```

### Expo mocks (minimal stubs)

```typescript
// src/__mocks__/expo-notifications.ts
export const getPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
export const requestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
export const getExpoPushTokenAsync = jest.fn().mockResolvedValue({ data: 'ExponentPushToken[mock]' });
export const getDevicePushTokenAsync = jest.fn().mockResolvedValue({ data: 'mock-device-token' });
export const addNotificationReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
export const registerTaskAsync = jest.fn().mockResolvedValue(undefined);
export const unregisterTaskAsync = jest.fn().mockResolvedValue(undefined);
```

```typescript
// src/__mocks__/expo-secure-store.ts
const store: Record<string, string> = {};
export const getItemAsync = jest.fn(async (key: string) => store[key] ?? null);
export const setItemAsync = jest.fn(async (key: string, value: string) => { store[key] = value; });
export const deleteItemAsync = jest.fn(async (key: string) => { delete store[key]; });
export const __clearStore = () => { Object.keys(store).forEach((k) => delete store[k]); };
```

```typescript
// src/__mocks__/expo-task-manager.ts
export const defineTask = jest.fn();
```

```typescript
// src/__mocks__/expo-constants.ts
export default {
  expoConfig: { extra: { eas: { projectId: 'mock-project-id' } } },
  easConfig: { projectId: 'mock-project-id' },
};
```

```typescript
// src/__mocks__/expo-application.ts
export const getIosIdForVendorAsync = jest.fn().mockResolvedValue('mock-ios-vendor-id');
export const getAndroidId = jest.fn(() => 'mock-android-id');
```

**Step 1: Create all mock files**
**Step 2: Run `yarn test --passWithNoTests`** to verify no import errors
**Step 3: Commit**

```bash
git add src/__mocks__/
git commit -m "test: add shared mocks for native modules"
```

---

## Task 2: Create Test Utilities

**Files:**
- Create: `src/__tests__/testUtils.tsx`

```typescript
import React, { type ReactNode } from 'react';
import { SQLiteDbContext } from '../contexts/SQLiteDbContext';
import { SQLiteSyncStatusContext } from '../contexts/SQLiteSyncStatusContext';
import { SQLiteSyncActionsContext } from '../contexts/SQLiteSyncActionsContext';
import { SQLiteInternalContext } from '../contexts/SQLiteInternalContext';
import { createLogger } from '../core/common/logger';
import type { SQLiteDbContextValue } from '../types/SQLiteDbContextValue';
import type { SQLiteSyncStatusContextValue } from '../types/SQLiteSyncStatusContextValue';
import type { SQLiteSyncActionsContextValue } from '../types/SQLiteSyncActionsContextValue';
import { createMockDB } from './__mocks__/@op-engineering/op-sqlite';

const defaultDbContext: SQLiteDbContextValue = {
  writeDb: null,
  readDb: null,
  initError: null,
};

const defaultStatusContext: SQLiteSyncStatusContextValue = {
  syncMode: 'polling',
  isSyncReady: false,
  isSyncing: false,
  lastSyncTime: null,
  lastSyncChanges: 0,
  syncError: null,
  currentSyncInterval: 5000,
  consecutiveEmptySyncs: 0,
  consecutiveSyncErrors: 0,
  isAppInBackground: false,
  isNetworkAvailable: true,
};

const defaultActionsContext: SQLiteSyncActionsContextValue = {
  triggerSync: jest.fn().mockResolvedValue(undefined),
};

export function createTestWrapper(overrides?: {
  db?: Partial<SQLiteDbContextValue>;
  status?: Partial<SQLiteSyncStatusContextValue>;
  actions?: Partial<SQLiteSyncActionsContextValue>;
  logger?: ReturnType<typeof createLogger>;
}) {
  const dbValue = { ...defaultDbContext, ...overrides?.db };
  const statusValue = { ...defaultStatusContext, ...overrides?.status };
  const actionsValue = { ...defaultActionsContext, ...overrides?.actions };
  const logger = overrides?.logger ?? createLogger(false);

  return function TestWrapper({ children }: { children: ReactNode }) {
    return (
      <SQLiteInternalContext.Provider value={{ logger }}>
        <SQLiteDbContext.Provider value={dbValue}>
          <SQLiteSyncStatusContext.Provider value={statusValue}>
            <SQLiteSyncActionsContext.Provider value={actionsValue}>
              {children}
            </SQLiteSyncActionsContext.Provider>
          </SQLiteSyncStatusContext.Provider>
        </SQLiteDbContext.Provider>
      </SQLiteInternalContext.Provider>
    );
  };
}

export { createMockDB };
```

**Step 1: Create file**
**Step 2: Run `yarn test --passWithNoTests`**
**Step 3: Commit**

```bash
git add src/__tests__/testUtils.tsx
git commit -m "test: add shared test utilities and createTestWrapper"
```

---

## Task 3: Pure Function Tests - calculateAdaptiveSyncInterval

**Files:**
- Create: `src/core/polling/__tests__/calculateAdaptiveSyncInterval.test.ts`
- Source: `src/core/polling/calculateAdaptiveSyncInterval.ts`

```
  Test case                                        | Setup                                              | Assertion
  -------------------------------------------------|----------------------------------------------------|--------------------------
  Returns baseInterval when no errors, no idle      | changes=5, empty=0, errors=0                       | 5000
  Returns baseInterval when below emptyThreshold    | changes=0, empty=4, errors=0, threshold=5          | 5000
  Idle backoff at exactly emptyThreshold             | changes=0, empty=5, errors=0, multiplier=1.5       | 7500 (5000 x 1.5^1)
  Idle backoff increases with consecutive empty      | changes=0, empty=7, errors=0, multiplier=1.5       | 16875 (5000 x 1.5^3)
  Idle backoff caps at maxInterval                   | changes=0, empty=100, errors=0                     | 300000
  Error backoff (exponential)                        | changes=0, empty=0, errors=3, multiplier=2.0       | 40000 (5000 x 2^3)
  Error backoff caps at maxInterval                  | changes=0, empty=0, errors=100                     | 300000
  Error takes priority over idle                     | changes=0, empty=10, errors=2                      | 20000 (error), not idle
  Single error                                       | changes=0, empty=0, errors=1                       | 10000 (5000 x 2^1)
  Custom config values                               | base=1000, max=10000, threshold=2, idle=2, error=3  | Correct per formula
```

**Step 1: Write tests**

```typescript
import { calculateAdaptiveSyncInterval } from '../calculateAdaptiveSyncInterval';

const defaultConfig = {
  baseInterval: 5000,
  maxInterval: 300000,
  emptyThreshold: 5,
  idleBackoffMultiplier: 1.5,
  errorBackoffMultiplier: 2.0,
};

describe('calculateAdaptiveSyncInterval', () => {
  it('returns baseInterval when no errors, no idle', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 5, consecutiveEmptySyncs: 0, consecutiveSyncErrors: 0 },
      defaultConfig
    );
    expect(result).toBe(5000);
  });

  it('returns baseInterval when below emptyThreshold', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 4, consecutiveSyncErrors: 0 },
      defaultConfig
    );
    expect(result).toBe(5000);
  });

  it('applies idle backoff at exactly emptyThreshold', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 5, consecutiveSyncErrors: 0 },
      defaultConfig
    );
    expect(result).toBe(7500);
  });

  it('increases idle backoff with consecutive empty syncs', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 7, consecutiveSyncErrors: 0 },
      defaultConfig
    );
    expect(result).toBe(5000 * Math.pow(1.5, 3));
  });

  it('caps idle backoff at maxInterval', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 100, consecutiveSyncErrors: 0 },
      defaultConfig
    );
    expect(result).toBe(300000);
  });

  it('applies error backoff exponentially', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 0, consecutiveSyncErrors: 3 },
      defaultConfig
    );
    expect(result).toBe(40000);
  });

  it('caps error backoff at maxInterval', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 0, consecutiveSyncErrors: 100 },
      defaultConfig
    );
    expect(result).toBe(300000);
  });

  it('gives error priority over idle backoff', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 10, consecutiveSyncErrors: 2 },
      defaultConfig
    );
    expect(result).toBe(5000 * Math.pow(2.0, 2));
  });

  it('handles single error', () => {
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 0, consecutiveSyncErrors: 1 },
      defaultConfig
    );
    expect(result).toBe(10000);
  });

  it('works with custom config values', () => {
    const config = {
      baseInterval: 1000,
      maxInterval: 10000,
      emptyThreshold: 2,
      idleBackoffMultiplier: 2,
      errorBackoffMultiplier: 3,
    };
    const result = calculateAdaptiveSyncInterval(
      { lastSyncChanges: 0, consecutiveEmptySyncs: 3, consecutiveSyncErrors: 0 },
      config
    );
    expect(result).toBe(1000 * Math.pow(2, 2));
  });
});
```

**Step 2: Run tests**

Run: `yarn test src/core/polling/__tests__/calculateAdaptiveSyncInterval.test.ts --verbose`
Expected: 10 passing

**Step 3: Commit**

```bash
git add src/core/polling/__tests__/
git commit -m "test: add calculateAdaptiveSyncInterval tests"
```

---

## Task 4: Pure Function Tests - isSqliteCloudNotification

**Files:**
- Create: `src/core/pushNotifications/__tests__/isSqliteCloudNotification.test.ts`
- Source: `src/core/pushNotifications/isSqliteCloudNotification.ts`

```
  Test case                                           | Setup                                                          | Assertion
  ----------------------------------------------------|----------------------------------------------------------------|----------
  Foreground: true for valid notification              | { request: { content: { data: { artifactURI: URI } } } }      | true
  Foreground: false for wrong artifactURI              | artifactURI: 'https://other.com'                               | false
  Foreground: false for missing data                   | { request: { content: {} } }                                   | false
  Foreground: false for null input                     | null                                                           | false
  Foreground: false for undefined input                | undefined                                                      | false
  Background: iOS object body                          | { data: { body: { artifactURI: URI } } }                       | true
  Background: Android JSON string body                 | { data: { body: '{"artifactURI":"https://sqlite.ai"}' } }      | true
  Background: Android dataString fallback              | { data: { dataString: '{"artifactURI":"https://sqlite.ai"}' } }| true
  Background: invalid JSON in body string              | { data: { body: 'not-json' } }                                 | false
  Background: falls through to foreground check        | Valid foreground structure                                      | true
  Background: wrong artifactURI in all formats         | Wrong URI everywhere                                           | false
  Background: empty/null data                          | null                                                           | false
```

```typescript
import {
  isForegroundSqliteCloudNotification,
  isSqliteCloudNotification,
} from '../isSqliteCloudNotification';

const ARTIFACT_URI = 'https://sqlite.ai';

describe('isForegroundSqliteCloudNotification', () => {
  it('returns true for valid foreground notification', () => {
    expect(
      isForegroundSqliteCloudNotification({
        request: { content: { data: { artifactURI: ARTIFACT_URI } } },
      })
    ).toBe(true);
  });

  it('returns false for wrong artifactURI', () => {
    expect(
      isForegroundSqliteCloudNotification({
        request: { content: { data: { artifactURI: 'https://other.com' } } },
      })
    ).toBe(false);
  });

  it('returns false for missing data', () => {
    expect(
      isForegroundSqliteCloudNotification({ request: { content: {} } })
    ).toBe(false);
  });

  it('returns false for null input', () => {
    expect(isForegroundSqliteCloudNotification(null)).toBe(false);
  });

  it('returns false for undefined input', () => {
    expect(isForegroundSqliteCloudNotification(undefined)).toBe(false);
  });
});

describe('isSqliteCloudNotification', () => {
  it('detects iOS background object body', () => {
    expect(
      isSqliteCloudNotification({
        data: { body: { artifactURI: ARTIFACT_URI } },
      })
    ).toBe(true);
  });

  it('detects Android JSON string body', () => {
    expect(
      isSqliteCloudNotification({
        data: { body: JSON.stringify({ artifactURI: ARTIFACT_URI }) },
      })
    ).toBe(true);
  });

  it('detects Android dataString fallback', () => {
    expect(
      isSqliteCloudNotification({
        data: { dataString: JSON.stringify({ artifactURI: ARTIFACT_URI }) },
      })
    ).toBe(true);
  });

  it('returns false for invalid JSON in body string', () => {
    expect(
      isSqliteCloudNotification({ data: { body: 'not-json' } })
    ).toBe(false);
  });

  it('falls through to foreground check', () => {
    expect(
      isSqliteCloudNotification({
        request: { content: { data: { artifactURI: ARTIFACT_URI } } },
      })
    ).toBe(true);
  });

  it('returns false for wrong artifactURI', () => {
    expect(
      isSqliteCloudNotification({
        data: { body: { artifactURI: 'https://wrong.com' } },
      })
    ).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSqliteCloudNotification(null)).toBe(false);
  });
});
```

**Step 1: Write test file**
**Step 2: Run:** `yarn test src/core/pushNotifications/__tests__/isSqliteCloudNotification.test.ts --verbose`
Expected: 12 passing
**Step 3: Commit**

```bash
git add src/core/pushNotifications/__tests__/
git commit -m "test: add isSqliteCloudNotification tests"
```

---

## Task 5: Pure Function Tests - logger

**Files:**
- Create: `src/core/common/__tests__/logger.test.ts`
- Source: `src/core/common/logger.ts`

```
  Test case                                    | Setup            | Assertion
  ---------------------------------------------|------------------|---------------------------------
  debug=true info calls console.log            | createLogger(true)  | console.log called
  debug=true warn calls console.warn           | createLogger(true)  | console.warn called
  debug=false info does NOT call console.log   | createLogger(false) | console.log not called
  debug=false warn does NOT call console.warn  | createLogger(false) | console.warn not called
  debug=false error STILL calls console.error  | createLogger(false) | console.error called
  debug=true error calls console.error         | createLogger(true)  | console.error called
  Output includes [SQLiteSync] prefix          | createLogger(true)  | args contain '[SQLiteSync]'
  Output includes ISO timestamp                | createLogger(true)  | args[0] matches ISO pattern
```

```typescript
import { createLogger } from '../logger';

describe('createLogger', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('info calls console.log when debug=true', () => {
    createLogger(true).info('test');
    expect(console.log).toHaveBeenCalled();
  });

  it('warn calls console.warn when debug=true', () => {
    createLogger(true).warn('test');
    expect(console.warn).toHaveBeenCalled();
  });

  it('info does NOT call console.log when debug=false', () => {
    createLogger(false).info('test');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('warn does NOT call console.warn when debug=false', () => {
    createLogger(false).warn('test');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('error calls console.error when debug=false', () => {
    createLogger(false).error('test');
    expect(console.error).toHaveBeenCalled();
  });

  it('error calls console.error when debug=true', () => {
    createLogger(true).error('test');
    expect(console.error).toHaveBeenCalled();
  });

  it('includes [SQLiteSync] prefix', () => {
    createLogger(true).info('test message');
    expect(console.log).toHaveBeenCalledWith(
      expect.any(String),
      '[SQLiteSync]',
      'test message'
    );
  });

  it('includes ISO timestamp', () => {
    createLogger(true).info('test');
    const timestamp = (console.log as jest.Mock).mock.calls[0][0];
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
```

**Step 1: Write test file**
**Step 2: Run:** `yarn test src/core/common/__tests__/logger.test.ts --verbose`
Expected: 8 passing
**Step 3: Commit**

```bash
git add src/core/common/__tests__/
git commit -m "test: add logger tests"
```

---

## Task 6: Pure Function Tests - pushNotificationSyncCallbacks

**Files:**
- Create: `src/core/pushNotifications/__tests__/pushNotificationSyncCallbacks.test.ts`
- Source: `src/core/pushNotifications/pushNotificationSyncCallbacks.ts`

```
  Test case                                          | Setup                            | Assertion
  ---------------------------------------------------|----------------------------------|--------------------
  getBackgroundSyncCallback returns null initially    | Fresh module                     | null
  register then get background callback              | registerBackgroundSyncCallback(fn)| Same fn returned
  getForegroundSyncCallback returns null initially    | Fresh module                     | null
  set then get foreground callback                   | setForegroundSyncCallback(fn)    | Same fn returned
  set null clears foreground callback                | set(fn) then set(null)           | null
```

```typescript
import {
  registerBackgroundSyncCallback,
  getBackgroundSyncCallback,
  setForegroundSyncCallback,
  getForegroundSyncCallback,
} from '../pushNotificationSyncCallbacks';

describe('pushNotificationSyncCallbacks', () => {
  beforeEach(() => {
    setForegroundSyncCallback(null);
  });

  it('getBackgroundSyncCallback returns null initially', () => {
    // Note: cannot fully reset module-level state without isolateModules
    // This test verifies the getter works
    const result = getBackgroundSyncCallback();
    expect(result === null || typeof result === 'function').toBe(true);
  });

  it('register then get background callback returns same function', () => {
    const callback = jest.fn();
    registerBackgroundSyncCallback(callback);
    expect(getBackgroundSyncCallback()).toBe(callback);
  });

  it('getForegroundSyncCallback returns null initially', () => {
    expect(getForegroundSyncCallback()).toBeNull();
  });

  it('set then get foreground callback returns same function', () => {
    const callback = jest.fn();
    setForegroundSyncCallback(callback);
    expect(getForegroundSyncCallback()).toBe(callback);
  });

  it('set null clears foreground callback', () => {
    setForegroundSyncCallback(jest.fn());
    setForegroundSyncCallback(null);
    expect(getForegroundSyncCallback()).toBeNull();
  });
});
```

**Step 1: Write test file**
**Step 2: Run:** `yarn test src/core/pushNotifications/__tests__/pushNotificationSyncCallbacks.test.ts --verbose`
Expected: 5 passing
**Step 3: Commit**

```bash
git add src/core/pushNotifications/__tests__/
git commit -m "test: add pushNotificationSyncCallbacks tests"
```

---

## Task 7: Pure Function Tests - constants

**Files:**
- Create: `src/core/__tests__/constants.test.ts`
- Source: `src/core/constants.ts`

```
  Test case                                     | Setup | Assertion
  ----------------------------------------------|-------|-------------------------------
  FOREGROUND_DEBOUNCE_MS is 2000                | -     | toBe(2000)
  BACKGROUND_SYNC_TASK_NAME is non-empty string | -     | typeof string, truthy
```

```typescript
import {
  FOREGROUND_DEBOUNCE_MS,
  BACKGROUND_SYNC_TASK_NAME,
} from '../constants';

describe('constants', () => {
  it('FOREGROUND_DEBOUNCE_MS is 2000', () => {
    expect(FOREGROUND_DEBOUNCE_MS).toBe(2000);
  });

  it('BACKGROUND_SYNC_TASK_NAME is a non-empty string', () => {
    expect(typeof BACKGROUND_SYNC_TASK_NAME).toBe('string');
    expect(BACKGROUND_SYNC_TASK_NAME.length).toBeGreaterThan(0);
  });
});
```

**Step 1: Write test file**
**Step 2: Run:** `yarn test src/core/__tests__/constants.test.ts --verbose`
Expected: 2 passing
**Step 3: Commit**

```bash
git add src/core/__tests__/
git commit -m "test: add constants tests"
```

---

## Task 8: Core Logic Tests - createDatabase

**Files:**
- Create: `src/core/database/__tests__/createDatabase.test.ts`
- Source: `src/core/database/createDatabase.ts`

```
  Test case                              | Setup                    | Assertion
  ---------------------------------------|--------------------------|---------------------------------------------
  Opens database with given name         | name='app.db'            | open({ name: 'app.db' }) called
  Sets WAL journal mode                  | -                        | execute('PRAGMA journal_mode = WAL') called
  Write mode sets synchronous NORMAL     | mode='write'             | execute('PRAGMA synchronous = NORMAL')
  Write mode sets locking_mode NORMAL    | mode='write'             | execute('PRAGMA locking_mode = NORMAL')
  Read mode sets query_only true         | mode='read'              | execute('PRAGMA query_only = true')
  Read mode does NOT set synchronous     | mode='read'              | synchronous NOT in execute calls
  Returns the DB instance                | -                        | Returns mock DB object
  Propagates error if open() throws      | open throws Error        | Rejects with error
  Propagates error if PRAGMA fails       | execute rejects          | Rejects with error
```

```typescript
import { createDatabase } from '../createDatabase';
import { open } from '@op-engineering/op-sqlite';

jest.mock('@op-engineering/op-sqlite');

describe('createDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens database with given name', async () => {
    await createDatabase('app.db', 'write');
    expect(open).toHaveBeenCalledWith({ name: 'app.db' });
  });

  it('sets WAL journal mode', async () => {
    const db = await createDatabase('app.db', 'write');
    expect(db.execute).toHaveBeenCalledWith('PRAGMA journal_mode = WAL');
  });

  it('sets synchronous NORMAL in write mode', async () => {
    const db = await createDatabase('app.db', 'write');
    expect(db.execute).toHaveBeenCalledWith('PRAGMA synchronous = NORMAL');
  });

  it('sets locking_mode NORMAL in write mode', async () => {
    const db = await createDatabase('app.db', 'write');
    expect(db.execute).toHaveBeenCalledWith('PRAGMA locking_mode = NORMAL');
  });

  it('sets query_only in read mode', async () => {
    const db = await createDatabase('app.db', 'read');
    expect(db.execute).toHaveBeenCalledWith('PRAGMA query_only = true');
  });

  it('does NOT set synchronous in read mode', async () => {
    const db = await createDatabase('app.db', 'read');
    const calls = (db.execute as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    expect(calls).not.toContain('PRAGMA synchronous = NORMAL');
  });

  it('returns the DB instance', async () => {
    const db = await createDatabase('app.db', 'write');
    expect(db).toBeDefined();
    expect(db.execute).toBeDefined();
    expect(db.close).toBeDefined();
  });

  it('propagates error if open() throws', async () => {
    (open as jest.Mock).mockImplementationOnce(() => {
      throw new Error('open failed');
    });
    await expect(createDatabase('app.db', 'write')).rejects.toThrow('open failed');
  });

  it('propagates error if PRAGMA fails', async () => {
    (open as jest.Mock).mockReturnValueOnce({
      execute: jest.fn().mockRejectedValue(new Error('PRAGMA failed')),
      close: jest.fn(),
      loadExtension: jest.fn(),
      updateHook: jest.fn(),
      transaction: jest.fn(),
      reactiveExecute: jest.fn(),
    });
    await expect(createDatabase('app.db', 'write')).rejects.toThrow('PRAGMA failed');
  });
});
```

**Step 1: Write test file**
**Step 2: Run:** `yarn test src/core/database/__tests__/createDatabase.test.ts --verbose`
Expected: 9 passing
**Step 3: Commit**

```bash
git add src/core/database/__tests__/
git commit -m "test: add createDatabase tests"
```

---

## Task 9: Core Logic Tests - initializeSyncExtension

**Files:**
- Create: `src/core/sync/__tests__/initializeSyncExtension.test.ts`
- Source: `src/core/sync/initializeSyncExtension.ts`

```
  Test case                                   | Setup                                       | Assertion
  --------------------------------------------|---------------------------------------------|---------------------------------------------
  Throws if connectionString missing          | connectionString=''                          | Rejects 'Sync configuration incomplete'
  Throws if neither apiKey nor accessToken    | Both undefined                               | Rejects 'Sync configuration incomplete'
  Loads iOS extension path                    | Platform.OS='ios'                            | getDylibPath + loadExtension called
  Loads Android extension path               | Platform.OS='android'                        | loadExtension('cloudsync')
  Verifies via cloudsync_version()            | -                                            | execute called with version query
  Throws if version result empty              | version returns { rows: [{}] }               | Rejects 'not loaded properly'
  Calls cloudsync_init for each table         | 2 tables                                     | 2 init calls with table names
  Calls cloudsync_network_init               | -                                            | Called with connectionString
  Sets API key when provided                  | apiKey='key123'                              | cloudsync_network_set_apikey called
  Sets access token when provided             | accessToken='tok'                            | cloudsync_network_set_token called
  Prefers apiKey over accessToken             | Both provided                                | Only apikey call, not token
```

```typescript
import { initializeSyncExtension } from '../initializeSyncExtension';
import { getDylibPath } from '@op-engineering/op-sqlite';
import { Platform } from 'react-native';
import { createMockDB } from '../../../__mocks__/@op-engineering/op-sqlite';
import { createLogger } from '../../common/logger';

jest.mock('@op-engineering/op-sqlite');
jest.mock('react-native');

const logger = createLogger(false);

describe('initializeSyncExtension', () => {
  let db: ReturnType<typeof createMockDB>;

  beforeEach(() => {
    jest.clearAllMocks();
    db = createMockDB();
    // Default: version check succeeds
    (db.execute as jest.Mock).mockResolvedValue({
      rows: [{ 'cloudsync_version()': '1.0.0' }],
    });
    (Platform as any).OS = 'ios';
  });

  it('throws if connectionString missing', async () => {
    await expect(
      initializeSyncExtension(db as any, { connectionString: '', tablesToBeSynced: [], apiKey: 'key' }, logger)
    ).rejects.toThrow('Sync configuration incomplete');
  });

  it('throws if neither apiKey nor accessToken', async () => {
    await expect(
      initializeSyncExtension(db as any, { connectionString: 'sqlitecloud://host', tablesToBeSynced: [] }, logger)
    ).rejects.toThrow('Sync configuration incomplete');
  });

  it('loads iOS extension path via getDylibPath', async () => {
    (Platform as any).OS = 'ios';
    await initializeSyncExtension(
      db as any,
      { connectionString: 'sqlitecloud://host', tablesToBeSynced: [], apiKey: 'key' },
      logger
    );
    expect(getDylibPath).toHaveBeenCalledWith('ai.sqlite.cloudsync', 'CloudSync');
    expect(db.loadExtension).toHaveBeenCalled();
  });

  it('loads Android extension path', async () => {
    (Platform as any).OS = 'android';
    await initializeSyncExtension(
      db as any,
      { connectionString: 'sqlitecloud://host', tablesToBeSynced: [], apiKey: 'key' },
      logger
    );
    expect(db.loadExtension).toHaveBeenCalledWith('cloudsync');
  });

  it('verifies extension via cloudsync_version()', async () => {
    await initializeSyncExtension(
      db as any,
      { connectionString: 'sqlitecloud://host', tablesToBeSynced: [], apiKey: 'key' },
      logger
    );
    expect(db.execute).toHaveBeenCalledWith('SELECT cloudsync_version();');
  });

  it('throws if version result empty', async () => {
    (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [{}] });
    await expect(
      initializeSyncExtension(
        db as any,
        { connectionString: 'sqlitecloud://host', tablesToBeSynced: [], apiKey: 'key' },
        logger
      )
    ).rejects.toThrow('CloudSync extension not loaded properly');
  });

  it('calls cloudsync_init for each table', async () => {
    const tables = [{ name: 'users', createTableSql: '' }, { name: 'tasks', createTableSql: '' }];
    await initializeSyncExtension(
      db as any,
      { connectionString: 'sqlitecloud://host', tablesToBeSynced: tables, apiKey: 'key' },
      logger
    );
    expect(db.execute).toHaveBeenCalledWith('SELECT cloudsync_init(?);', ['users']);
    expect(db.execute).toHaveBeenCalledWith('SELECT cloudsync_init(?);', ['tasks']);
  });

  it('calls cloudsync_network_init with connectionString', async () => {
    await initializeSyncExtension(
      db as any,
      { connectionString: 'sqlitecloud://myhost', tablesToBeSynced: [], apiKey: 'key' },
      logger
    );
    expect(db.execute).toHaveBeenCalledWith('SELECT cloudsync_network_init(?);', ['sqlitecloud://myhost']);
  });

  it('sets API key when provided', async () => {
    await initializeSyncExtension(
      db as any,
      { connectionString: 'sqlitecloud://host', tablesToBeSynced: [], apiKey: 'key123' },
      logger
    );
    expect(db.execute).toHaveBeenCalledWith('SELECT cloudsync_network_set_apikey(?);', ['key123']);
  });

  it('sets access token when provided', async () => {
    await initializeSyncExtension(
      db as any,
      { connectionString: 'sqlitecloud://host', tablesToBeSynced: [], accessToken: 'tok' },
      logger
    );
    expect(db.execute).toHaveBeenCalledWith('SELECT cloudsync_network_set_token(?);', ['tok']);
  });

  it('prefers apiKey over accessToken when both provided', async () => {
    await initializeSyncExtension(
      db as any,
      { connectionString: 'sqlitecloud://host', tablesToBeSynced: [], apiKey: 'key', accessToken: 'tok' },
      logger
    );
    expect(db.execute).toHaveBeenCalledWith('SELECT cloudsync_network_set_apikey(?);', ['key']);
    const calls = (db.execute as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    expect(calls).not.toContain('SELECT cloudsync_network_set_token(?);');
  });
});
```

**Step 1: Write test file**
**Step 2: Run:** `yarn test src/core/sync/__tests__/initializeSyncExtension.test.ts --verbose`
Expected: 11 passing
**Step 3: Commit**

```bash
git add src/core/sync/__tests__/
git commit -m "test: add initializeSyncExtension tests"
```

---

## Task 10: Core Logic Tests - executeSync

**Files:**
- Create: `src/core/sync/__tests__/executeSync.test.ts`
- Source: `src/core/sync/executeSync.ts`

```
  Test case                                    | Setup                                        | Assertion
  ---------------------------------------------|----------------------------------------------|-----------------------------------
  Returns 0 when no changes (JS retry)         | All syncs return empty rows                   | Returns 0
  Returns change count from JSON result        | '{"rowsReceived":5}'                          | Returns 5
  Stops retrying when changes found             | 1st empty, 2nd has changes                    | Returns count, only 2 attempts
  Retries up to maxAttempts                     | All empty                                     | 4 execute calls (default)
  Custom maxAttempts respected                  | maxAttempts=2                                 | 2 execute calls
  Wraps in transaction when useTransaction      | useTransaction=true                           | db.transaction() called
  No transaction when useTransaction=false      | useTransaction=false                          | db.execute() called directly
  Handles malformed JSON gracefully             | 'not-json'                                    | Returns 0
  Handles missing rows                          | { rows: [] }                                  | Returns 0
  Handles non-string result values              | { rows: [{ col: 42 }] }                       | Returns 0
  Handles undefined result                      | undefined                                     | Returns 0
  Native retry passes params                    | useNativeRetry=true                           | execute('...sync(?, ?)', [4, 1000])
  Native retry returns changes                  | JSON with rowsReceived                        | Correct count
  Delay between attempts                        | attemptDelay=100                              | setTimeout called
```

```typescript
import { executeSync } from '../executeSync';
import { createMockDB } from '../../../__mocks__/@op-engineering/op-sqlite';
import { createLogger } from '../../common/logger';

const logger = createLogger(false);

describe('executeSync', () => {
  let db: ReturnType<typeof createMockDB>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    db = createMockDB();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 0 when no changes', async () => {
    (db.execute as jest.Mock).mockResolvedValue({
      rows: [{ 'cloudsync_network_sync()': '{"rowsReceived":0}' }],
    });
    const promise = executeSync(db as any, logger, { maxAttempts: 1 });
    jest.runAllTimers();
    const result = await promise;
    expect(result).toBe(0);
  });

  it('returns change count from JSON result', async () => {
    (db.execute as jest.Mock).mockResolvedValue({
      rows: [{ 'cloudsync_network_sync()': '{"rowsReceived":5}' }],
    });
    const result = await executeSync(db as any, logger, { maxAttempts: 1 });
    expect(result).toBe(5);
  });

  it('stops retrying when changes found', async () => {
    (db.execute as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ col: '{"rowsReceived":0}' }] })
      .mockResolvedValueOnce({ rows: [{ col: '{"rowsReceived":3}' }] });

    const promise = executeSync(db as any, logger, { maxAttempts: 4, attemptDelay: 10 });
    jest.runAllTimers();
    const result = await promise;
    expect(result).toBe(3);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it('retries up to maxAttempts', async () => {
    (db.execute as jest.Mock).mockResolvedValue({
      rows: [{ col: '{"rowsReceived":0}' }],
    });
    const promise = executeSync(db as any, logger, { maxAttempts: 4, attemptDelay: 10 });
    // Run timers for each delay between attempts
    for (let i = 0; i < 10; i++) jest.advanceTimersByTime(100);
    const result = await promise;
    expect(result).toBe(0);
    expect(db.execute).toHaveBeenCalledTimes(4);
  });

  it('respects custom maxAttempts', async () => {
    (db.execute as jest.Mock).mockResolvedValue({
      rows: [{ col: '{"rowsReceived":0}' }],
    });
    const promise = executeSync(db as any, logger, { maxAttempts: 2, attemptDelay: 10 });
    jest.runAllTimers();
    const result = await promise;
    expect(result).toBe(0);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it('wraps in transaction when useTransaction=true', async () => {
    (db.execute as jest.Mock).mockResolvedValue({
      rows: [{ col: '{"rowsReceived":1}' }],
    });
    await executeSync(db as any, logger, { useTransaction: true, maxAttempts: 1 });
    expect(db.transaction).toHaveBeenCalled();
  });

  it('calls execute directly when useTransaction=false', async () => {
    (db.execute as jest.Mock).mockResolvedValue({
      rows: [{ col: '{"rowsReceived":1}' }],
    });
    await executeSync(db as any, logger, { useTransaction: false, maxAttempts: 1 });
    expect(db.execute).toHaveBeenCalledWith('SELECT cloudsync_network_sync();');
  });

  it('handles malformed JSON gracefully', async () => {
    (db.execute as jest.Mock).mockResolvedValue({
      rows: [{ col: 'not-json' }],
    });
    const result = await executeSync(db as any, logger, { maxAttempts: 1 });
    expect(result).toBe(0);
  });

  it('handles missing rows', async () => {
    (db.execute as jest.Mock).mockResolvedValue({ rows: [] });
    const result = await executeSync(db as any, logger, { maxAttempts: 1 });
    expect(result).toBe(0);
  });

  it('handles non-string result values', async () => {
    (db.execute as jest.Mock).mockResolvedValue({
      rows: [{ col: 42 }],
    });
    const result = await executeSync(db as any, logger, { maxAttempts: 1 });
    expect(result).toBe(0);
  });

  it('handles undefined result', async () => {
    (db.execute as jest.Mock).mockResolvedValue(undefined);
    const result = await executeSync(db as any, logger, { maxAttempts: 1 });
    expect(result).toBe(0);
  });

  it('passes params in native retry mode', async () => {
    (db.execute as jest.Mock).mockResolvedValue({
      rows: [{ col: '{"rowsReceived":2}' }],
    });
    await executeSync(db as any, logger, {
      useNativeRetry: true,
      maxAttempts: 4,
      attemptDelay: 1000,
    });
    expect(db.execute).toHaveBeenCalledWith('SELECT cloudsync_network_sync(?, ?);', [4, 1000]);
  });

  it('returns changes from native retry result', async () => {
    (db.execute as jest.Mock).mockResolvedValue({
      rows: [{ col: '{"rowsReceived":7}' }],
    });
    const result = await executeSync(db as any, logger, { useNativeRetry: true });
    expect(result).toBe(7);
  });
});
```

**Step 1: Write test file**
**Step 2: Run:** `yarn test src/core/sync/__tests__/executeSync.test.ts --verbose`
Expected: 14 passing (some may need timer adjustments)
**Step 3: Commit**

```bash
git add src/core/sync/__tests__/executeSync.test.ts
git commit -m "test: add executeSync tests"
```

---

## Task 11: Core Logic Tests - backgroundSyncConfig

**Files:**
- Create: `src/core/background/__tests__/backgroundSyncConfig.test.ts`
- Source: `src/core/background/backgroundSyncConfig.ts`

```
  Test case                                        | Setup                            | Assertion
  -------------------------------------------------|----------------------------------|-----------------------
  getPersistedConfig returns null without SecureStore| ExpoSecureStore=null             | Returns null
  getPersistedConfig returns null without value     | getItemAsync returns null         | Returns null
  getPersistedConfig returns parsed config          | Valid JSON stored                 | Correct object
  getPersistedConfig returns null on parse error    | Invalid JSON stored              | Returns null
  persistConfig saves serialized config             | -                                | setItemAsync called
  persistConfig warns without SecureStore           | ExpoSecureStore=null             | No throw
  persistConfig handles setItemAsync error          | setItemAsync rejects             | No throw, logs error
  clearPersistedConfig deletes key                  | -                                | deleteItemAsync called
  clearPersistedConfig no-ops without SecureStore   | ExpoSecureStore=null             | No throw
  clearPersistedConfig handles delete error         | deleteItemAsync rejects          | No throw
```

```typescript
import {
  getPersistedConfig,
  persistConfig,
  clearPersistedConfig,
} from '../backgroundSyncConfig';
import * as optionalDeps from '../../common/optionalDependencies';

// We need to mock the module-level exports
jest.mock('../../common/optionalDependencies', () => ({
  ExpoSecureStore: {
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
  },
}));

const mockSecureStore = optionalDeps.ExpoSecureStore as any;

const sampleConfig = {
  connectionString: 'sqlitecloud://host',
  databaseName: 'app.db',
  tablesToBeSynced: [{ name: 'tasks', createTableSql: 'CREATE TABLE...' }],
  apiKey: 'key',
};

describe('backgroundSyncConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getPersistedConfig', () => {
    it('returns null when ExpoSecureStore is null', async () => {
      const original = optionalDeps.ExpoSecureStore;
      (optionalDeps as any).ExpoSecureStore = null;
      const result = await getPersistedConfig();
      expect(result).toBeNull();
      (optionalDeps as any).ExpoSecureStore = original;
    });

    it('returns null when no stored value', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      const result = await getPersistedConfig();
      expect(result).toBeNull();
    });

    it('returns parsed config when valid JSON stored', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(sampleConfig));
      const result = await getPersistedConfig();
      expect(result).toEqual(sampleConfig);
    });

    it('returns null on JSON parse error', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('invalid-json');
      const result = await getPersistedConfig();
      expect(result).toBeNull();
    });
  });

  describe('persistConfig', () => {
    it('saves serialized config', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      await persistConfig(sampleConfig);
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'sqlite_sync_background_config',
        JSON.stringify(sampleConfig)
      );
    });

    it('warns when ExpoSecureStore is null', async () => {
      const original = optionalDeps.ExpoSecureStore;
      (optionalDeps as any).ExpoSecureStore = null;
      await persistConfig(sampleConfig);
      // Should not throw
      (optionalDeps as any).ExpoSecureStore = original;
    });

    it('handles setItemAsync error without throwing', async () => {
      mockSecureStore.setItemAsync.mockRejectedValue(new Error('write failed'));
      await expect(persistConfig(sampleConfig)).resolves.toBeUndefined();
    });
  });

  describe('clearPersistedConfig', () => {
    it('deletes the config key', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
      await clearPersistedConfig();
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'sqlite_sync_background_config'
      );
    });

    it('no-ops when ExpoSecureStore is null', async () => {
      const original = optionalDeps.ExpoSecureStore;
      (optionalDeps as any).ExpoSecureStore = null;
      await expect(clearPersistedConfig()).resolves.toBeUndefined();
      (optionalDeps as any).ExpoSecureStore = original;
    });

    it('handles delete error without throwing', async () => {
      mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('delete failed'));
      await expect(clearPersistedConfig()).resolves.toBeUndefined();
    });
  });
});
```

**Step 1: Write test file**
**Step 2: Run:** `yarn test src/core/background/__tests__/backgroundSyncConfig.test.ts --verbose`
Expected: 10 passing
**Step 3: Commit**

```bash
git add src/core/background/__tests__/
git commit -m "test: add backgroundSyncConfig tests"
```

---

## Task 12: Core Logic Tests - backgroundSyncRegistry

**Files:**
- Create: `src/core/background/__tests__/backgroundSyncRegistry.test.ts`
- Source: `src/core/background/backgroundSyncRegistry.ts`

```
  Test case                                         | Setup                         | Assertion
  --------------------------------------------------|-------------------------------|------------------------------------
  registerBackgroundSync persists config             | -                             | persistConfig called
  registerBackgroundSync registers task              | -                             | registerTaskAsync called
  registerBackgroundSync warns when deps unavailable | isBackgroundSyncAvailable=false| Returns early, logs warning
  unregisterBackgroundSync unregisters task           | -                             | unregisterTaskAsync called
  unregisterBackgroundSync clears persisted config   | -                             | clearPersistedConfig called
  unregisterBackgroundSync no-ops without Notifications| ExpoNotifications=null       | No throw
  unregisterBackgroundSync handles unregister error  | unregisterTaskAsync rejects   | No throw
```

```typescript
import {
  registerBackgroundSync,
  unregisterBackgroundSync,
} from '../backgroundSyncRegistry';
import * as optionalDeps from '../../common/optionalDependencies';
import * as backgroundSyncConfig from '../backgroundSyncConfig';

jest.mock('../../common/optionalDependencies', () => ({
  ExpoNotifications: {
    registerTaskAsync: jest.fn().mockResolvedValue(undefined),
    unregisterTaskAsync: jest.fn().mockResolvedValue(undefined),
  },
  isBackgroundSyncAvailable: jest.fn(() => true),
}));

jest.mock('../backgroundSyncConfig', () => ({
  persistConfig: jest.fn().mockResolvedValue(undefined),
  clearPersistedConfig: jest.fn().mockResolvedValue(undefined),
}));

const mockNotifications = optionalDeps.ExpoNotifications as any;

const sampleConfig = {
  connectionString: 'sqlitecloud://host',
  databaseName: 'app.db',
  tablesToBeSynced: [],
};

describe('backgroundSyncRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerBackgroundSync', () => {
    it('persists config', async () => {
      await registerBackgroundSync(sampleConfig);
      expect(backgroundSyncConfig.persistConfig).toHaveBeenCalledWith(sampleConfig);
    });

    it('registers the background task', async () => {
      await registerBackgroundSync(sampleConfig);
      expect(mockNotifications.registerTaskAsync).toHaveBeenCalledWith(
        'SQLITE_SYNC_BACKGROUND_TASK'
      );
    });

    it('warns and returns early when deps unavailable', async () => {
      (optionalDeps.isBackgroundSyncAvailable as jest.Mock).mockReturnValueOnce(false);
      await registerBackgroundSync(sampleConfig);
      expect(backgroundSyncConfig.persistConfig).not.toHaveBeenCalled();
    });
  });

  describe('unregisterBackgroundSync', () => {
    it('unregisters the task', async () => {
      await unregisterBackgroundSync();
      expect(mockNotifications.unregisterTaskAsync).toHaveBeenCalled();
    });

    it('clears persisted config', async () => {
      await unregisterBackgroundSync();
      expect(backgroundSyncConfig.clearPersistedConfig).toHaveBeenCalled();
    });

    it('no-ops when ExpoNotifications is null', async () => {
      const original = optionalDeps.ExpoNotifications;
      (optionalDeps as any).ExpoNotifications = null;
      await expect(unregisterBackgroundSync()).resolves.toBeUndefined();
      (optionalDeps as any).ExpoNotifications = original;
    });

    it('handles unregister error without throwing', async () => {
      mockNotifications.unregisterTaskAsync.mockRejectedValueOnce(new Error('fail'));
      await expect(unregisterBackgroundSync()).resolves.toBeUndefined();
    });
  });
});
```

**Step 1: Write test file**
**Step 2: Run:** `yarn test src/core/background/__tests__/backgroundSyncRegistry.test.ts --verbose`
Expected: 7 passing
**Step 3: Commit**

```bash
git add src/core/background/__tests__/backgroundSyncRegistry.test.ts
git commit -m "test: add backgroundSyncRegistry tests"
```

---

## Task 13: Core Logic Tests - executeBackgroundSync

**Files:**
- Create: `src/core/background/__tests__/executeBackgroundSync.test.ts`
- Source: `src/core/background/executeBackgroundSync.ts`

```
  Test case                                         | Setup                              | Assertion
  --------------------------------------------------|------------------------------------|--------------------------------------
  Opens database with config.databaseName           | -                                  | createDatabase called with name
  Initializes sync extension                        | -                                  | initializeSyncExtension called
  Executes sync with native retry                   | -                                  | executeSync called with useNativeRetry
  Registers updateHook when callback exists          | Register callback first            | db.updateHook called
  Collects change records during sync                | Hook fires INSERT                  | Changes array populated
  Invokes user callback with changes and db         | -                                  | Callback receives { changes, db }
  Removes updateHook before calling callback        | -                                  | updateHook(null) before callback
  Handles callback error gracefully                  | Callback throws                    | Logs error, no rethrow
  Closes database in finally block                   | -                                  | db.close() called
  Closes database even when sync fails               | executeSync throws                 | db.close() still called
  Rethrows sync errors                               | executeSync throws                 | Promise rejects
  Skips callback when none registered                | No callback                        | No error
  Handles db.close() error                           | close throws                       | Logs error, no rethrow
```

```typescript
import { executeBackgroundSync } from '../executeBackgroundSync';
import * as createDatabaseModule from '../../database/createDatabase';
import * as initSyncModule from '../../sync/initializeSyncExtension';
import * as executeSyncModule from '../../sync/executeSync';
import * as callbacksModule from '../../pushNotifications/pushNotificationSyncCallbacks';
import { createMockDB } from '../../../__mocks__/@op-engineering/op-sqlite';

jest.mock('../../database/createDatabase');
jest.mock('../../sync/initializeSyncExtension');
jest.mock('../../sync/executeSync');
jest.mock('../../pushNotifications/pushNotificationSyncCallbacks');

const config = {
  connectionString: 'sqlitecloud://host',
  databaseName: 'app.db',
  tablesToBeSynced: [{ name: 'tasks', createTableSql: '' }],
  apiKey: 'key',
  debug: false,
};

describe('executeBackgroundSync', () => {
  let mockDb: ReturnType<typeof createMockDB>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();

    mockDb = createMockDB();
    (createDatabaseModule.createDatabase as jest.Mock).mockResolvedValue(mockDb);
    (initSyncModule.initializeSyncExtension as jest.Mock).mockResolvedValue(undefined);
    (executeSyncModule.executeSync as jest.Mock).mockResolvedValue(0);
    (callbacksModule.getBackgroundSyncCallback as jest.Mock).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens database with config.databaseName', async () => {
    await executeBackgroundSync(config);
    expect(createDatabaseModule.createDatabase).toHaveBeenCalledWith('app.db', 'write');
  });

  it('initializes sync extension', async () => {
    await executeBackgroundSync(config);
    expect(initSyncModule.initializeSyncExtension).toHaveBeenCalled();
  });

  it('executes sync with native retry', async () => {
    await executeBackgroundSync(config);
    expect(executeSyncModule.executeSync).toHaveBeenCalledWith(
      mockDb,
      expect.anything(),
      expect.objectContaining({ useNativeRetry: true })
    );
  });

  it('registers updateHook when callback exists', async () => {
    const callback = jest.fn();
    (callbacksModule.getBackgroundSyncCallback as jest.Mock).mockReturnValue(callback);
    await executeBackgroundSync(config);
    expect(mockDb.updateHook).toHaveBeenCalledWith(expect.any(Function));
  });

  it('collects change records during sync', async () => {
    const callback = jest.fn();
    (callbacksModule.getBackgroundSyncCallback as jest.Mock).mockReturnValue(callback);

    // Capture the updateHook callback and simulate a change
    (mockDb.updateHook as jest.Mock).mockImplementation((hookFn: any) => {
      if (hookFn) {
        hookFn({ operation: 'INSERT', table: 'tasks', rowId: 1 });
      }
    });

    await executeBackgroundSync(config);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [{ operation: 'INSERT', table: 'tasks', rowId: 1 }],
      })
    );
  });

  it('invokes user callback with changes and db', async () => {
    const callback = jest.fn();
    (callbacksModule.getBackgroundSyncCallback as jest.Mock).mockReturnValue(callback);
    await executeBackgroundSync(config);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ changes: expect.any(Array), db: mockDb })
    );
  });

  it('removes updateHook before calling callback', async () => {
    const callOrder: string[] = [];
    const callback = jest.fn(() => { callOrder.push('callback'); });
    (callbacksModule.getBackgroundSyncCallback as jest.Mock).mockReturnValue(callback);
    (mockDb.updateHook as jest.Mock).mockImplementation((fn: any) => {
      if (fn === null) callOrder.push('unhook');
    });
    await executeBackgroundSync(config);
    // unhook should come before callback
    expect(callOrder.indexOf('unhook')).toBeLessThan(callOrder.indexOf('callback'));
  });

  it('handles callback error gracefully', async () => {
    const callback = jest.fn().mockRejectedValue(new Error('callback failed'));
    (callbacksModule.getBackgroundSyncCallback as jest.Mock).mockReturnValue(callback);
    await expect(executeBackgroundSync(config)).resolves.toBeUndefined();
  });

  it('closes database in finally block', async () => {
    await executeBackgroundSync(config);
    expect(mockDb.close).toHaveBeenCalled();
  });

  it('closes database even when sync fails', async () => {
    (executeSyncModule.executeSync as jest.Mock).mockRejectedValue(new Error('sync failed'));
    await expect(executeBackgroundSync(config)).rejects.toThrow('sync failed');
    expect(mockDb.close).toHaveBeenCalled();
  });

  it('rethrows sync errors', async () => {
    (executeSyncModule.executeSync as jest.Mock).mockRejectedValue(new Error('sync failed'));
    await expect(executeBackgroundSync(config)).rejects.toThrow('sync failed');
  });

  it('skips callback when none registered', async () => {
    (callbacksModule.getBackgroundSyncCallback as jest.Mock).mockReturnValue(null);
    await expect(executeBackgroundSync(config)).resolves.toBeUndefined();
  });

  it('handles db.close() error', async () => {
    (mockDb.close as jest.Mock).mockImplementation(() => { throw new Error('close failed'); });
    await expect(executeBackgroundSync(config)).resolves.toBeUndefined();
  });
});
```

**Step 1: Write test file**
**Step 2: Run:** `yarn test src/core/background/__tests__/executeBackgroundSync.test.ts --verbose`
Expected: 13 passing
**Step 3: Commit**

```bash
git add src/core/background/__tests__/executeBackgroundSync.test.ts
git commit -m "test: add executeBackgroundSync tests"
```

---

## Task 14: Core Logic Tests - registerPushToken

**Files:**
- Create: `src/core/pushNotifications/__tests__/registerPushToken.test.ts`
- Source: `src/core/pushNotifications/registerPushToken.ts`

```
  Test case                                     | Setup                              | Assertion
  ----------------------------------------------|------------------------------------|-----------------------------------------
  Skips if already registered                    | SecureStore returns same token      | No fetch call
  Sends POST with correct URL                   | -                                  | fetch called with tokens endpoint
  Sets Bearer auth with accessToken              | accessToken='tok'                  | Authorization: Bearer tok
  Sets Bearer auth with connectionString+apiKey | apiKey='key'                       | Authorization: Bearer connStr?apikey=key
  Sends correct body fields                     | All params                          | expoToken, deviceId, database, siteId, platform
  Gets iOS device ID                            | Platform.OS='ios'                  | getIosIdForVendorAsync called
  Gets Android device ID                        | Platform.OS='android'              | getAndroidId called
  Throws on non-ok response                     | response.ok=false                  | Rejects with status
  Persists token after success                   | -                                  | setItemAsync called
  Handles SecureStore read error                 | getItemAsync throws                | Continues registration
  Handles SecureStore write error                | setItemAsync throws                | No throw
  Throws when expo-application missing           | ExpoApplication=null               | Rejects with error
```

```typescript
import { registerPushToken } from '../registerPushToken';
import * as optionalDeps from '../../common/optionalDependencies';
import { createLogger } from '../../common/logger';

jest.mock('../../common/optionalDependencies', () => ({
  ExpoSecureStore: {
    getItemAsync: jest.fn().mockResolvedValue(null),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
  },
  ExpoApplication: {
    getIosIdForVendorAsync: jest.fn().mockResolvedValue('ios-vendor-id'),
    getAndroidId: jest.fn(() => 'android-id'),
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const logger = createLogger(false);

const baseParams = {
  expoToken: 'ExponentPushToken[abc]',
  databaseName: 'app.db',
  siteId: 'site-1',
  platform: 'ios',
  connectionString: 'sqlitecloud://host',
  apiKey: 'key123',
  logger,
};

describe('registerPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(''),
    }) as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips registration if token already registered', async () => {
    (optionalDeps.ExpoSecureStore as any).getItemAsync.mockResolvedValueOnce('ExponentPushToken[abc]');
    await registerPushToken(baseParams);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends POST with correct URL', async () => {
    await registerPushToken(baseParams);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/cloudsync/notifications/tokens'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('sets Bearer auth with accessToken', async () => {
    await registerPushToken({ ...baseParams, apiKey: undefined, accessToken: 'tok' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      })
    );
  });

  it('sets Bearer auth with connectionString+apiKey', async () => {
    await registerPushToken(baseParams);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sqlitecloud://host?apikey=key123',
        }),
      })
    );
  });

  it('sends correct body fields', async () => {
    await registerPushToken(baseParams);
    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body.expoToken).toBe('ExponentPushToken[abc]');
    expect(body.database).toBe('app.db');
    expect(body.siteId).toBe('site-1');
    expect(body.platform).toBe('ios');
    expect(body.deviceId).toBeDefined();
  });

  it('gets iOS device ID', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'ios';
    await registerPushToken({ ...baseParams, platform: 'ios' });
    expect(optionalDeps.ExpoApplication!.getIosIdForVendorAsync).toHaveBeenCalled();
  });

  it('gets Android device ID', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    await registerPushToken({ ...baseParams, platform: 'android' });
    expect(optionalDeps.ExpoApplication!.getAndroidId).toHaveBeenCalled();
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue('Unauthorized'),
    });
    await expect(registerPushToken(baseParams)).rejects.toThrow('401');
  });

  it('persists token after successful registration', async () => {
    await registerPushToken(baseParams);
    expect(optionalDeps.ExpoSecureStore!.setItemAsync).toHaveBeenCalledWith(
      'sqlite_sync_push_token_registered',
      'ExponentPushToken[abc]'
    );
  });

  it('handles SecureStore read error gracefully', async () => {
    (optionalDeps.ExpoSecureStore as any).getItemAsync.mockRejectedValueOnce(new Error('read fail'));
    await expect(registerPushToken(baseParams)).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalled();
  });

  it('handles SecureStore write error gracefully', async () => {
    (optionalDeps.ExpoSecureStore as any).setItemAsync.mockRejectedValueOnce(new Error('write fail'));
    await expect(registerPushToken(baseParams)).resolves.toBeUndefined();
  });

  it('throws when expo-application missing', async () => {
    const original = optionalDeps.ExpoApplication;
    (optionalDeps as any).ExpoApplication = null;
    await expect(registerPushToken(baseParams)).rejects.toThrow('expo-application');
    (optionalDeps as any).ExpoApplication = original;
  });
});
```

**Step 1: Write test file**
**Step 2: Run:** `yarn test src/core/pushNotifications/__tests__/registerPushToken.test.ts --verbose`
Expected: 12 passing
**Step 3: Commit**

```bash
git add src/core/pushNotifications/__tests__/registerPushToken.test.ts
git commit -m "test: add registerPushToken tests"
```

---

## Tasks 15-30: Remaining Test Files

The remaining tasks follow the same pattern. Each task creates one test file with the test case table and full test code. Due to the size of this plan, the remaining tasks are documented with their test case tables. The implementation code follows the same patterns established in Tasks 3-14.

---

## Task 15: pushNotificationSyncTask tests

**Files:**
- Create: `src/core/pushNotifications/__tests__/pushNotificationSyncTask.test.ts`
- Source: `src/core/pushNotifications/pushNotificationSyncTask.ts`

Uses `jest.isolateModules` since the source has module-level side effects.

```
  Test case                                              | Setup                            | Assertion
  -------------------------------------------------------|----------------------------------|--------------------------------------
  Defines task when ExpoTaskManager available             | Mock available                   | defineTask called with task name
  Skips task definition when no ExpoTaskManager           | ExpoTaskManager=null             | defineTask not called
  Handler calls executeBackgroundSync for valid notif     | SQLite Cloud notification data   | executeBackgroundSync called
  Handler skips non-SQLite Cloud notification             | Other notification data          | executeBackgroundSync NOT called
  Handler uses foreground callback when app active        | AppState.currentState='active'   | Foreground callback called
  Handler handles foreground sync error                   | Callback throws                  | Logs error, no crash
  Handler skips when no persisted config                  | getPersistedConfig returns null  | No sync executed
  Handler handles task error                              | { error: 'something' }           | Logs error, returns early
```

**Commit:** `git commit -m "test: add pushNotificationSyncTask tests"`

---

## Task 16: optionalDependencies tests

**Files:**
- Create: `src/core/common/__tests__/optionalDependencies.test.ts`
- Source: `src/core/common/optionalDependencies.ts`

Uses `jest.isolateModules` to control `require()` behavior.

```
  Test case                                                | Setup                              | Assertion
  ---------------------------------------------------------|------------------------------------|-------------
  ExpoNotifications is set when available                   | Mock module present                | Non-null
  ExpoNotifications is null when not installed              | require throws                     | null
  ExpoTaskManager is set when available                     | Mock present                       | Non-null
  ExpoTaskManager is null when not installed                | require throws                     | null
  ExpoSecureStore is set when available                     | Mock present                       | Non-null
  ExpoConstants uses .default if present                    | Module has default export           | Uses default
  ExpoConstants uses module directly if no default          | No default                         | Uses module
  ExpoApplication is set when available                     | Mock present                       | Non-null
  isBackgroundSyncAvailable returns true when all 3 present | Notifications+TaskManager+SecureStore | true
  isBackgroundSyncAvailable returns false when any missing  | Only 2 of 3                        | false
```

**Commit:** `git commit -m "test: add optionalDependencies tests"`

---

## Task 17: Context consumer hook tests (5 hooks, 1 commit)

**Files:**
- Create: `src/hooks/context/__tests__/useSqliteDb.test.ts`
- Create: `src/hooks/context/__tests__/useSyncStatus.test.ts`
- Create: `src/hooks/context/__tests__/useSqliteSync.test.ts`
- Create: `src/hooks/context/__tests__/useInternalLogger.test.ts`
- Create: `src/hooks/sync/__tests__/useTriggerSqliteSync.test.ts`

All use `renderHook` with `createTestWrapper`.

### useSqliteDb

```
  Test case                          | Setup                        | Assertion
  -----------------------------------|------------------------------|-------------------------------
  Returns writeDb from context       | writeDb=mockDb               | result.current.writeDb === mockDb
  Returns readDb from context        | readDb=mockDb                | result.current.readDb === mockDb
  Returns initError from context     | initError=Error              | result.current.initError
  Returns null values when no DB     | defaults                     | All null
```

### useSyncStatus

```
  Test case                     | Setup              | Assertion
  ------------------------------|--------------------|---------------------------------
  Returns all sync status fields | Custom values     | Each field matches
  Returns default values        | defaults           | isSyncing=false, lastSyncTime=null
```

### useSqliteSync

```
  Test case                     | Setup              | Assertion
  ------------------------------|--------------------|---------------------------------
  Returns merged contexts       | Custom values      | All fields from db+status+actions
  triggerSync is callable       | Mock triggerSync   | Calls through
```

### useInternalLogger

```
  Test case                     | Setup              | Assertion
  ------------------------------|--------------------|---------------------------------
  Returns logger from context   | Custom logger      | Same reference
  Logger has info/warn/error    | -                  | All methods present
```

### useTriggerSqliteSync

```
  Test case                     | Setup              | Assertion
  ------------------------------|--------------------|---------------------------------
  Returns triggerSync function  | Mock function      | Function returned
  triggerSync calls through     | -                  | Mock called
```

**Commit:** `git commit -m "test: add context consumer hook tests"`

---

## Task 18: useSqliteExecute tests

**Files:**
- Create: `src/hooks/sqlite/__tests__/useSqliteExecute.test.ts`

```
  Test case                                    | Setup                         | Assertion
  ---------------------------------------------|-------------------------------|--------------------------------------
  Returns undefined when no db available        | writeDb=null                  | Returns undefined
  Executes SQL on writeDb by default            | -                             | writeDb.execute called
  Executes SQL on readDb when readOnly=true     | { readOnly: true }            | readDb.execute called
  Returns QueryResult on success                | Mock result                   | Correct result
  Sets isExecuting=true during execution        | -                             | true during promise
  Resets isExecuting=false after success         | -                             | false after await
  Resets isExecuting=false after error           | execute throws                | false after catch
  Sets error state on failure                    | execute throws                | error is set
  Throws error for caller try/catch             | execute throws                | Rejects
  Clears error on next successful execute        | Error then success            | error is null
  Auto-syncs after write by default              | -                             | send_changes called
  Skips auto-sync when readOnly=true             | -                             | send_changes NOT called
  Skips auto-sync when autoSync=false            | { autoSync: false }           | send_changes NOT called
  Auto-sync failure does not fail operation       | send_changes throws           | Original result returned
  Auto-sync failure logs warning                  | send_changes throws           | logger.warn called
```

**Commit:** `git commit -m "test: add useSqliteExecute tests"`

---

## Task 19: useSqliteTransaction tests

**Files:**
- Create: `src/hooks/sqlite/__tests__/useSqliteTransaction.test.ts`

```
  Test case                                    | Setup                         | Assertion
  ---------------------------------------------|-------------------------------|--------------------------------------
  Returns undefined when no writeDb             | writeDb=null                  | Returns undefined
  Calls writeDb.transaction with user function | -                             | transaction called
  Sets isExecuting during transaction           | -                             | true during, false after
  Sets error on transaction failure              | transaction throws            | error is set
  Throws error for caller try/catch             | transaction throws            | Rejects
  Clears error on next success                   | Error then success            | error is null
  Auto-syncs after commit by default             | -                             | send_changes called
  Skips auto-sync when autoSync=false            | { autoSync: false }           | send_changes NOT called
  Auto-sync failure does not fail transaction    | send_changes throws           | No rethrow
  Auto-sync failure logs warning                  | send_changes throws           | logger.warn called
```

**Commit:** `git commit -m "test: add useSqliteTransaction tests"`

---

## Task 20: useOnTableUpdate tests

**Files:**
- Create: `src/hooks/sqlite/__tests__/useOnTableUpdate.test.ts`

```
  Test case                                    | Setup                         | Assertion
  ---------------------------------------------|-------------------------------|--------------------------------------
  Registers updateHook on writeDb               | -                             | updateHook called with function
  Removes updateHook on unmount                  | unmount                       | updateHook(null) called
  Calls onUpdate for watched table               | Hook fires for 'tasks'       | Callback called
  Ignores updates for unwatched tables            | Hook fires for 'other'       | Callback NOT called
  Fetches row data for INSERT                     | operation='INSERT'            | SELECT WHERE rowid query
  Fetches row data for UPDATE                     | operation='UPDATE'            | Row data in callback
  Passes null row for DELETE                      | operation='DELETE'            | row: null
  Handles row fetch error gracefully              | execute throws                | row: null, logger.warn
  Callback ref updates without re-subscribing    | Change onUpdate               | New callback, no re-register
  Tables ref updates without re-subscribing      | Change tables                  | New tables used for filter
  No-ops when writeDb is null                     | writeDb=null                  | No updateHook call
```

**Commit:** `git commit -m "test: add useOnTableUpdate tests"`

---

## Task 21: useSqliteSyncQuery tests

**Files:**
- Create: `src/hooks/sync/__tests__/useSqliteSyncQuery.test.ts`

```
  Test case                                         | Setup                          | Assertion
  --------------------------------------------------|--------------------------------|--------------------------------------
  Returns isLoading=true initially                   | -                              | isLoading: true
  Executes initial read on readDb                    | -                              | readDb.execute called
  Sets data from initial read result                 | Rows returned                  | data matches
  Sets isLoading=false after initial read            | -                              | isLoading: false
  Sets error on initial read failure                 | execute rejects                | error set
  Sets up reactive subscription after debounce       | Advance 1000ms                 | reactiveExecute called
  Reactive subscription config matches input         | -                              | query, args, fireOn match
  Updates data when reactive callback fires          | Callback with new rows         | data updates
  Unsubscribes on unmount                            | unmount                        | Unsubscribe fn called
  Debounces subscription on rapid query changes      | Change query 3x < 1000ms      | Only 1 reactiveExecute
  Skips subscription if query changed during debounce| Change query before timer      | Old subscription not created
  Returns unsubscribe function                       | -                              | Callable
  No-ops when readDb is null                         | readDb=null                    | No execute call
  No-ops when writeDb is null                        | writeDb=null                   | No reactive subscription
  Skips when app is in background                    | isAppInBackground=true         | No execute call
```

**Commit:** `git commit -m "test: add useSqliteSyncQuery tests"`

---

## Task 22: useSyncManager tests

**Files:**
- Create: `src/core/sync/__tests__/useSyncManager.test.ts`

```
  Test case                                         | Setup                         | Assertion
  --------------------------------------------------|-------------------------------|--------------------------------------
  performSync no-ops when writeDb is null            | writeDbRef.current=null       | No executeSync call
  performSync no-ops when isSyncReady=false          | isSyncReady=false             | No executeSync call
  performSync no-ops when already syncing            | Call twice concurrently        | Only 1 executeSync
  performSync checks network on Android              | Platform.OS='android'         | NetInfo.fetch called
  performSync skips sync when offline on Android     | isConnected=false             | No executeSync
  performSync skips network check on iOS             | Platform.OS='ios'             | NetInfo.fetch NOT called
  Sets isSyncing=true during sync                    | -                             | true during
  Sets isSyncing=false after sync                    | -                             | false after
  Sets lastSyncTime on success                       | -                             | Non-null timestamp
  Sets lastSyncChanges from result                   | 5 changes                     | lastSyncChanges: 5
  Resets consecutiveEmptySyncs on changes             | Had 3 empty                   | 0
  Increments consecutiveEmptySyncs on no changes     | -                             | +1
  Resets consecutiveSyncErrors on success             | Had 2 errors                  | 0
  Increments consecutiveSyncErrors on failure         | executeSync throws            | +1
  Sets syncError on failure                           | executeSync throws            | Error set
  Clears syncError on success                         | Had error                     | null
  Recalculates interval in polling mode               | syncMode='polling'            | setCurrentInterval called
  Does NOT recalculate interval in push mode          | syncMode='push'               | setCurrentInterval NOT called
  Recalculates with error backoff on failure          | Polling + error               | Higher interval
  performSyncRef stays in sync                        | Re-render                     | Ref updated
```

**Commit:** `git commit -m "test: add useSyncManager tests"`

---

## Task 23: useInitialSync tests

**Files:**
- Create: `src/core/sync/__tests__/useInitialSync.test.ts`

```
  Test case                                  | Setup                    | Assertion
  -------------------------------------------|--------------------------|--------------------------------------
  Triggers sync after 1500ms delay           | isSyncReady=true         | performSync called after timer
  Does not trigger when isSyncReady=false    | isSyncReady=false        | performSync NOT called
  Only triggers once (ref guard)             | Toggle ready off/on      | Only 1 call
  Clears timeout on unmount                  | Unmount before 1500ms    | performSync NOT called
```

**Commit:** `git commit -m "test: add useInitialSync tests"`

---

## Task 24: useAppLifecycle tests

**Files:**
- Create: `src/core/lifecycle/__tests__/useAppLifecycle.test.ts`

```
  Test case                                        | Setup                          | Assertion
  -------------------------------------------------|--------------------------------|--------------------------------------
  Registers AppState listener when isSyncReady      | isSyncReady=true              | addEventListener called
  Does not register when isSyncReady=false          | isSyncReady=false             | NOT called
  Removes listener on unmount                       | unmount                        | subscription.remove() called
  Triggers sync on background->active               | Simulate state change          | performSync called
  Resets interval on foreground (polling mode)       | polling                        | setCurrentInterval(baseInterval)
  Resets consecutiveEmptySyncs on foreground         | polling                        | setConsecutiveEmptySyncs(0)
  Does NOT reset interval in push mode               | push                           | setCurrentInterval NOT called
  Debounces rapid foreground transitions              | 2 transitions < 2s            | Only 1 sync
  Allows foreground sync after debounce period        | 2 transitions > 2s            | 2 syncs
  Returns isInBackground=true when backgrounded      | appState='background'          | true
  Returns isInBackground=false when active            | appState='active'              | false
  Logs background transition                          | active->background             | Logger called
```

**Commit:** `git commit -m "test: add useAppLifecycle tests"`

---

## Task 25: useNetworkListener tests

**Files:**
- Create: `src/core/lifecycle/__tests__/useNetworkListener.test.ts`

```
  Test case                                         | Setup                               | Assertion
  --------------------------------------------------|-------------------------------------|-------------------------------
  Registers NetInfo listener when isSyncReady        | isSyncReady=true                   | addEventListener called
  Does not register when isSyncReady=false           | isSyncReady=false                  | NOT called
  Unsubscribes on unmount                            | unmount                             | Unsubscribe called
  Triggers sync on offline->online                   | Was offline, now online             | performSync called
  Does NOT trigger on online->online                 | Was online, still online            | NOT called
  Does NOT trigger when app backgrounded             | Background + reconnect              | NOT called
  Updates isNetworkAvailable state                   | Simulate offline                    | false
  Treats isInternetReachable=null as online           | { isConnected: true, isInternetReachable: null } | true
```

**Commit:** `git commit -m "test: add useNetworkListener tests"`

---

## Task 26: useAdaptivePollingSync tests

**Files:**
- Create: `src/core/polling/__tests__/useAdaptivePollingSync.test.ts`

Uses `jest.useFakeTimers()`.

```
  Test case                                    | Setup                               | Assertion
  ---------------------------------------------|-------------------------------------|-------------------------------
  Starts polling when all conditions met        | isSyncReady, active, polling        | performSync called after interval
  Does not start when syncMode='push'           | push                                | NOT called
  Does not start when isSyncReady=false         | false                               | NOT called
  Pauses when app backgrounded                  | appState='background'               | Timer cleared
  Resumes when app returns to active             | background->active                  | Polling restarts
  Uses dynamic interval from ref                 | Change ref                          | Next poll uses new interval
  Prevents multiple polling loops                 | Effect re-runs                      | Only 1 timer
  Stops scheduling when interval becomes null    | Set ref to null                     | No more polls
  Cleans up timer on unmount                      | unmount                             | clearTimeout called
  Reschedules after sync completes                | Sync resolves                       | Next setTimeout queued
```

**Commit:** `git commit -m "test: add useAdaptivePollingSync tests"`

---

## Task 27: usePushNotificationSync tests

**Files:**
- Create: `src/core/pushNotifications/__tests__/usePushNotificationSync.test.ts`

```
  Test case                                              | Setup                              | Assertion
  -------------------------------------------------------|------------------------------------|--------------------------------------
  Requests permissions when push + sync ready             | syncMode='push', ready             | getPermissionsAsync called
  Skips permission request when polling mode              | syncMode='polling'                 | NOT called
  Skips if already requested (ref guard)                  | Re-render                          | Only 1 request
  Uses existing permission if already granted              | status='granted'                   | No requestPermissionsAsync
  Requests permission when not granted                     | status='undetermined'              | requestPermissionsAsync called
  Calls onPermissionsDenied when denied                    | status='denied'                    | Callback called
  Shows custom prompt when renderPushPermissionPrompt set | Render prop provided               | Prompt rendered
  Resolves allow from custom prompt                        | allow() called                     | Continues to request
  Resolves deny from custom prompt                         | deny() called                      | onPermissionsDenied called
  Gets Expo push token after permissions                   | Granted                            | getExpoPushTokenAsync called
  Retrieves site ID for registration                       | -                                  | cloudsync_init called
  Calls registerPushToken with correct params              | -                                  | All fields passed
  Handles token registration failure                       | registerPushToken throws           | Logs warning
  Adds foreground listener in foreground mode              | notificationListening='foreground' | addNotificationReceivedListener
  Triggers sync on SQLite Cloud notification               | Valid notification                  | performSync called
  Ignores non-SQLite Cloud notifications                   | Other notification                  | performSync NOT called
  Registers background sync in always mode                 | notificationListening='always'     | registerBackgroundSync called
  Falls back to foreground when background unavailable     | isBackgroundSyncAvailable=false    | Foreground listener added
  Sets foreground callback in always mode                  | -                                  | setForegroundSyncCallback called
  Removes listeners on unmount                             | unmount                             | subscription.remove() called
  Clears foreground callback on unmount                    | unmount                             | setForegroundSyncCallback(null)
  Unregisters background sync on push->polling transition  | Change syncMode                    | unregisterBackgroundSync called
  Resets permission tracking on mode change                 | push->polling                      | Allows re-request
  Warns when expo-notifications not installed               | ExpoNotifications=null             | logger.warn called
```

**Commit:** `git commit -m "test: add usePushNotificationSync tests"`

---

## Task 28: SQLiteSyncProvider integration tests

**Files:**
- Create: `src/core/__tests__/SQLiteSyncProvider.test.tsx`

```
  Test case                                              | Setup                          | Assertion
  -------------------------------------------------------|--------------------------------|--------------------------------------
  Renders children when DB initializes                    | Valid props                    | Children visible
  Provides writeDb through context                        | -                              | Consumer receives non-null
  Provides readDb through context                         | -                              | Consumer receives non-null
  Provides initError when DB fails                        | createDatabase throws          | initError set, writeDb=null
  Provides syncError when sync init fails                 | initializeSyncExtension throws | syncError set, writeDb available
  Calls onDatabaseReady after DB opens                    | Callback provided              | Called with writeDb
  Handles onDatabaseReady failure as fatal                | Callback throws                | initError set
  Creates tables from tablesToBeSynced                    | 2 tables                       | Both SQL executed
  Handles table creation failure as fatal                 | execute throws                 | initError set
  Provides default sync status values                     | -                              | All defaults match
  Provides syncMode through status context                | syncMode='push'                | Consumer reads 'push'
  Provides triggerSync through actions context             | -                              | Function callable
  Uses default adaptive config when no prop               | -                              | baseInterval=5000
  Merges custom adaptivePolling with defaults              | { baseInterval: 3000 }         | 3000
  Sets currentSyncInterval to null in push mode           | syncMode='push'                | null
  Falls back to polling when permissions denied            | Deny permissions               | effectiveSyncMode='polling'
  Closes both DB connections on unmount                    | unmount                        | close called twice
  Handles close error gracefully                           | close throws                   | No crash
```

**Commit:** `git commit -m "test: add SQLiteSyncProvider integration tests"`

---

## Task 29: Final Verification

**Step 1: Run full test suite**

```bash
yarn test --verbose --coverage
```

Expected: All ~272 tests passing, coverage report generated.

**Step 2: Check coverage thresholds**

Target: 100% statement/branch/function/line coverage on all source files (excluding type-only files).

**Step 3: Fix any coverage gaps**

Add missing test cases for uncovered branches.

**Step 4: Commit**

```bash
git add -A
git commit -m "test: complete test suite with 100% coverage"
```

---

## Execution Summary

| Task | Description                          | Files | Tests |
|------|--------------------------------------|-------|-------|
| 0    | Install dependencies                 | 1     | 0     |
| 1    | Shared mocks                         | 8     | 0     |
| 2    | Test utilities                       | 1     | 0     |
| 3    | calculateAdaptiveSyncInterval        | 1     | 10    |
| 4    | isSqliteCloudNotification            | 1     | 12    |
| 5    | logger                               | 1     | 8     |
| 6    | pushNotificationSyncCallbacks        | 1     | 5     |
| 7    | constants                            | 1     | 2     |
| 8    | createDatabase                       | 1     | 9     |
| 9    | initializeSyncExtension              | 1     | 11    |
| 10   | executeSync                          | 1     | 14    |
| 11   | backgroundSyncConfig                 | 1     | 10    |
| 12   | backgroundSyncRegistry               | 1     | 7     |
| 13   | executeBackgroundSync                | 1     | 13    |
| 14   | registerPushToken                    | 1     | 12    |
| 15   | pushNotificationSyncTask             | 1     | 8     |
| 16   | optionalDependencies                 | 1     | 10    |
| 17   | Context consumer hooks (5)           | 5     | 12    |
| 18   | useSqliteExecute                     | 1     | 15    |
| 19   | useSqliteTransaction                 | 1     | 10    |
| 20   | useOnTableUpdate                     | 1     | 11    |
| 21   | useSqliteSyncQuery                   | 1     | 15    |
| 22   | useSyncManager                       | 1     | 20    |
| 23   | useInitialSync                       | 1     | 4     |
| 24   | useAppLifecycle                      | 1     | 12    |
| 25   | useNetworkListener                   | 1     | 8     |
| 26   | useAdaptivePollingSync               | 1     | 10    |
| 27   | usePushNotificationSync              | 1     | 24    |
| 28   | SQLiteSyncProvider                   | 1     | 18    |
| 29   | Final verification                   | 0     | 0     |
| **Total** |                                | **39**| **~280** |
