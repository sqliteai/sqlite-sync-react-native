import * as rootExports from '../../index';
import * as backgroundSyncExports from '../backgroundSync';

describe('public exports', () => {
  it('exports the documented root runtime APIs', () => {
    expect(rootExports.SQLiteSyncProvider).toBeDefined();
    expect(rootExports.registerBackgroundSyncCallback).toBeDefined();
    expect(rootExports.useSqliteDb).toBeDefined();
    expect(rootExports.useSyncStatus).toBeDefined();
    expect(rootExports.useSqliteSync).toBeDefined();
    expect(rootExports.useOnTableUpdate).toBeDefined();
    expect(rootExports.useSqliteExecute).toBeDefined();
    expect(rootExports.useSqliteTransaction).toBeDefined();
    expect(rootExports.useTriggerSqliteSync).toBeDefined();
    expect(rootExports.useSqliteSyncQuery).toBeDefined();
  });

  it('exports the backgroundSync subpath runtime APIs', () => {
    expect(backgroundSyncExports.registerBackgroundSync).toBeDefined();
    expect(backgroundSyncExports.unregisterBackgroundSync).toBeDefined();
    expect(backgroundSyncExports.getPersistedConfig).toBeDefined();
    expect(backgroundSyncExports.persistConfig).toBeDefined();
    expect(backgroundSyncExports.clearPersistedConfig).toBeDefined();
    expect(backgroundSyncExports.executeBackgroundSync).toBeDefined();
  });
});
