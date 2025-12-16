import { useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  Button,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {
  SQLiteSyncProvider,
  useOnSqliteSync,
  useTriggerSqliteSync,
  useSqliteSyncQuery,
  useOnTableUpdate,
  useSqliteDb,
  useSyncStatus,
} from '@sqliteai/sqlite-sync-react-native';
import {
  SQLITE_CLOUD_CONNECTION_STRING,
  SQLITE_CLOUD_API_KEY,
  DATABASE_NAME,
  TABLE_NAME,
} from '@env';

/**
 * Demo app showcasing the reactive hooks:
 *
 * 1. useSqliteSyncQuery - Table-level reactive queries using op-sqlite's reactiveExecute
 *    - Automatically re-runs when the table changes (transaction-based)
 *    - No manual refresh needed!
 *
 * 2. useOnTableUpdate - Row-level update notifications using op-sqlite's updateHook
 *    - Fires for individual INSERT/UPDATE/DELETE operations
 *    - Automatically fetches row data for you
 *    - Shows notifications when rows change
 *
 * 3. useOnSqliteSync - Sync completion notifications
 *    - Fires when cloud sync completes
 */
function TestApp() {
  const { db, initError } = useSqliteDb();
  const { isSyncReady, isSyncing, lastSyncTime, syncError } = useSyncStatus();
  const [searchText, setSearchText] = useState('');
  const [text, setText] = useState('');
  const [rowNotification, setRowNotification] = useState<string | null>(null);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);
  const { triggerSync } = useTriggerSqliteSync();

  // Hook 1: useSqliteSyncQuery - Reactive query with table-level granularity
  // Uses op-sqlite's reactiveExecute to automatically re-run when the table changes
  // Changes are detected at the transaction level
  const {
    data: rows,
    isLoading,
    error,
  } = useSqliteSyncQuery<{ id: string; value: string; created_at: string }>({
    query: searchText.trim()
      ? `SELECT * FROM ${TABLE_NAME} WHERE value LIKE ? ORDER BY created_at DESC`
      : `SELECT * FROM ${TABLE_NAME} ORDER BY created_at DESC`,
    arguments: searchText.trim() ? [`%${searchText}%`] : [],
    fireOn: [{ table: TABLE_NAME }],
  });

  // Hook 2: useOnTableUpdate - Row-level update notifications
  // Fires for individual row changes with automatic row data fetching
  useOnTableUpdate<{ id: string; value: string; created_at: string }>({
    tables: [TABLE_NAME],
    onUpdate: (data) => {
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

  // Hook 3: useOnSqliteSync - Event listener for sync completion
  // Shows a notification when cloud data arrives (doesn't run on mount)
  useOnSqliteSync(() => {
    setSyncNotification('✅ New data synced from cloud!');
    setTimeout(() => setSyncNotification(null), 2000);
  });

  const addRow = async () => {
    if (!text.trim() || !db) return;

    try {
      // Use transaction to trigger reactive query updates
      // Reactive queries only fire on committed transactions, not on direct execute
      await db.transaction(async (tx) => {
        await tx.execute(
          `INSERT INTO ${TABLE_NAME} (id, value) VALUES (cloudsync_uuid(), ?);`,
          [text]
        );
      });
      console.log('[sqlite-sync-demo] ✅ Row inserted:', text);
      setText('');
      // No manual refresh needed - reactive query updates automatically when transaction commits!
    } catch (err) {
      console.error('[sqlite-sync-demo] Failed to insert row:', err);
    }
  };

  // Show init error (fatal - blocks the app)
  if (initError) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Database Initialization Failed</Text>
        <Text style={styles.errorDetails}>{initError.message}</Text>
        <Text style={styles.errorHelp}>
          This is a fatal error. The database cannot be used.
        </Text>
      </View>
    );
  }

  // Show loading spinner only on first load (offline-first: data loads immediately from local DB)
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.status}>Loading data from local database...</Text>
      </View>
    );
  }

  // Show query error
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Query Error</Text>
        <Text style={styles.errorDetails}>{error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      {/* 1. FIXED TOP SECTION (Header, Status, Inputs) */}
      <View style={styles.fixedHeader}>
        <Text style={styles.title}>SQLite Sync Demo</Text>

        {/* Status Section */}
        <View style={styles.statusSection}>
          <Text style={styles.status}>
            Database: {db ? '✅ Ready' : '⏳ Initializing...'}
          </Text>
          <Text style={styles.status}>
            Sync: {isSyncReady ? '✅ Enabled' : '⚠️ Offline-only'}
          </Text>
          <Text style={styles.status}>
            {isSyncing ? '🔄 Syncing...' : '✓ Idle'}
          </Text>
          {lastSyncTime && (
            <Text style={styles.status}>
              Last sync: {new Date(lastSyncTime).toLocaleTimeString()}
            </Text>
          )}
        </View>

        {/* SEARCH BAR (New) */}
        <View style={styles.searchContainer}>
          <Text style={styles.sectionLabel}>🔍 Search (Live Filter)</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Type to filter list..."
            value={searchText}
            onChangeText={setSearchText} // No debounce! Testing concurrency.
            autoCapitalize="none"
          />
        </View>

        {/* Sync Error Banner (Non-blocking) */}
        {syncError && (
          <View style={styles.syncErrorBanner}>
            <Text style={styles.syncErrorText}>
              ⚠️ Sync failed: {syncError.message}
            </Text>
          </View>
        )}

        {/* Input Section */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter text to add a row"
            value={text}
            onChangeText={setText}
          />
          <Button title="Add Row" onPress={addRow} disabled={!db} />

          <TouchableOpacity
            style={[styles.button, styles.syncButton]}
            onPress={triggerSync}
            disabled={isSyncing}
          >
            <Text style={styles.buttonText}>
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.rowCount}>Rows: {rows.length}</Text>
        </View>
      </View>

      {/* 2. SCROLLABLE AREA (Rows Only) */}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        // Empty state component
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No data yet. Add a row to get started!
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowId}>{item.id.substring(0, 8)}...</Text>
            <Text style={styles.rowValue}>{item.value}</Text>
            <Text style={styles.rowTime}>
              {item.created_at
                ? new Date(item.created_at).toLocaleTimeString()
                : ''}
            </Text>
          </View>
        )}
      />

      {/* 3. ABSOLUTE BOTTOM NOTIFICATIONS */}
      {/* Row-level update notification (slightly higher) */}
      {rowNotification && (
        <View style={[styles.notificationBanner, styles.rowNotificationBanner]}>
          <Text style={styles.notificationText}>{rowNotification}</Text>
        </View>
      )}

      {/* Sync completion notification */}
      {syncNotification && (
        <View style={styles.notificationBanner}>
          <Text style={styles.notificationText}>{syncNotification}</Text>
        </View>
      )}
    </View>
  );
}

export default function App() {
  if (
    !SQLITE_CLOUD_CONNECTION_STRING ||
    !SQLITE_CLOUD_API_KEY ||
    !DATABASE_NAME ||
    !TABLE_NAME
  ) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>
          Missing environment variables. Please create a .env file with your
          SQLite Cloud credentials.
        </Text>
        <Text style={styles.errorDetails}>
          See README.md for setup instructions.
        </Text>
      </View>
    );
  }

  return (
    <SQLiteSyncProvider
      connectionString={SQLITE_CLOUD_CONNECTION_STRING}
      databaseName={DATABASE_NAME}
      tablesToBeSynced={[
        {
          name: TABLE_NAME,
          createTableSql: `
            CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
              id TEXT PRIMARY KEY NOT NULL,
              value TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
          `,
        },
      ]}
      syncInterval={3000}
      apiKey={SQLITE_CLOUD_API_KEY}
      debug={true}
    >
      <TestApp />
    </SQLiteSyncProvider>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingTop: 60,
  },
  fixedHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#F2F2F7',
    zIndex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000',
  },
  statusSection: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  status: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
  },
  syncErrorBanner: {
    backgroundColor: '#FFD2D2',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    marginLeft: 4,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF', // Blue border to highlight search focus
    fontSize: 16,
  },
  syncErrorText: {
    color: '#D8000C',
    fontSize: 12,
  },
  inputContainer: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  syncButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rowCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  row: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowId: {
    fontSize: 10,
    color: '#999',
    width: 60,
  },
  rowValue: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    marginHorizontal: 10,
  },
  rowTime: {
    fontSize: 11,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 32,
  },
  notificationBanner: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#323232',
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  rowNotificationBanner: {
    bottom: 100, // Position higher to avoid overlapping with sync notification
    backgroundColor: '#5856D6', // Purple color to distinguish from sync notification
  },
  notificationText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  error: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#D8000C',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorDetails: {
    fontSize: 14,
    color: '#333',
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 24,
    textAlign: 'center',
    width: '100%',
  },
  errorHelp: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});
