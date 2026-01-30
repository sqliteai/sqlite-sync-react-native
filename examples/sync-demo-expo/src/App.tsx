import { useState, useMemo, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  Button,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  Modal,
  Clipboard,
} from 'react-native';
import {
  SQLiteSyncProvider,
  useTriggerSqliteSync,
  useSqliteSyncQuery,
  useOnTableUpdate,
  useSqliteDb,
  useSyncStatus,
  useSqliteTransaction,
  registerBackgroundSyncCallback,
  type BackgroundSyncResult,
} from '@sqliteai/sqlite-sync-react-native';
import * as Notifications from 'expo-notifications';
import {
  SQLITE_CLOUD_CONNECTION_STRING,
  SQLITE_CLOUD_API_KEY,
  DATABASE_NAME,
  TABLE_NAME,
} from '@env';

/**
 * Register background sync handler at module level (outside components).
 * This is called when new data is synced while app is in background/terminated.
 */
registerBackgroundSyncCallback(
  async ({ changes, db }: BackgroundSyncResult) => {
    const newRowIds = changes
      .filter((c) => c.table === TABLE_NAME && c.operation === 'INSERT')
      .map((c) => c.rowId);

    if (newRowIds.length === 0) return;

    const result = await db.execute(
      `SELECT * FROM ${TABLE_NAME} WHERE rowid IN (${newRowIds.join(
        ','
      )}) ORDER BY created_at DESC LIMIT 1`
    );

    const newestRow = result.rows?.[0] as
      | { id: string; value: string; created_at: string }
      | undefined;

    await Notifications.scheduleNotificationAsync({
      content: {
        title:
          newRowIds.length === 1
            ? 'New item synced'
            : `${newRowIds.length} new items synced`,
        body: newestRow?.value || 'New data is available',
        data: { rowId: newestRow?.id },
      },
      trigger: null,
    });
  }
);

/**
 * Demo app showcasing the reactive hooks and dual connection architecture:
 *
 * 1. useSqliteSyncQuery - Table-level reactive queries using op-sqlite's reactiveExecute
 *    - Always uses writeDb (sees sync changes immediately)
 *    - Automatically re-runs when the table changes (transaction-based)
 *    - No manual refresh needed!
 *
 * 2. useOnTableUpdate - Row-level update notifications using op-sqlite's updateHook
 *    - Always uses writeDb (sees sync changes immediately)
 *    - Fires for individual INSERT/UPDATE/DELETE operations
 *    - Automatically fetches row data for you
 *    - Shows notifications when rows change
 *
 * 3. useSqliteTransaction - Execute SQL in transactions for atomic writes
 *    - Always uses writeDb (for atomic write operations)
 *    - Triggers reactive queries when transaction commits
 */
function TestApp({ deviceToken }: { deviceToken: string | null }) {
  const { writeDb, initError } = useSqliteDb();
  const {
    isSyncReady,
    isSyncing,
    lastSyncTime,
    syncError,
    currentSyncInterval,
  } = useSyncStatus();
  const [nextSyncIn, setNextSyncIn] = useState<number | null>(null);

  useEffect(() => {
    if (!lastSyncTime || !currentSyncInterval) {
      setNextSyncIn(null);
      return;
    }

    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((lastSyncTime + currentSyncInterval - Date.now()) / 1000)
      );
      setNextSyncIn(remaining);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastSyncTime, currentSyncInterval]);
  const [searchText, setSearchText] = useState('');
  const [text, setText] = useState('');
  const [rowNotification, setRowNotification] = useState<string | null>(null);
  const { triggerSync } = useTriggerSqliteSync();
  const { executeTransaction } = useSqliteTransaction();

  // Hook 1: useSqliteSyncQuery - Reactive query with table-level granularity
  // Uses op-sqlite's reactiveExecute to automatically re-run when the table changes
  // Changes are detected at the transaction level
  const {
    data: allRows,
    isLoading,
    error,
  } = useSqliteSyncQuery<{ id: string; value: string; created_at: string }>({
    query: `SELECT * FROM ${TABLE_NAME} ORDER BY created_at DESC`,
    arguments: [],
    fireOn: [{ table: TABLE_NAME }],
  });

  const rows = useMemo(() => {
    if (!searchText.trim()) return allRows;
    const searchLower = searchText.toLowerCase();
    return allRows.filter((row) =>
      row.value.toLowerCase().includes(searchLower)
    );
  }, [allRows, searchText]);

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

  const addRow = async () => {
    if (!text.trim() || !writeDb) return;

    try {
      // Use transaction to trigger reactive query updates
      // Reactive queries only fire on committed transactions, not on direct execute
      await executeTransaction(async (tx) => {
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

  return (
    <View style={styles.mainContainer}>
      {/* 1. FIXED TOP SECTION (Header, Status, Inputs) */}
      <View style={styles.fixedHeader}>
        <Text style={styles.title}>SQLite Sync Demo</Text>

        {deviceToken && (
          <TouchableOpacity
            style={styles.tokenBanner}
            onPress={() => Clipboard.setString(deviceToken)}
          >
            <Text style={styles.tokenLabel}>Device Token (tap to copy):</Text>
            <Text style={styles.tokenText} numberOfLines={2}>
              {deviceToken}
            </Text>
          </TouchableOpacity>
        )}

        {/* Status Section */}
        <View style={styles.statusSection}>
          <Text style={styles.status}>
            Database: {writeDb ? '✅ Ready' : '⏳ Initializing...'}
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
          {nextSyncIn != null && (
            <Text style={styles.status}>Next sync in {nextSyncIn}s</Text>
          )}
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchContainer}>
          <Text style={styles.sectionLabel}>🔍 Search</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Type to filter list..."
            value={searchText}
            onChangeText={setSearchText}
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
          <Button title="Add Row" onPress={addRow} disabled={!writeDb} />

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
      {isLoading ? (
        <View style={styles.listLoading}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.listLoadingText}>
            Loading data from local database...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.listError}>
          <Text style={styles.listErrorTitle}>Query Error</Text>
          <Text style={styles.listErrorMessage}>{error.message}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
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
      )}

      {/* 3. ABSOLUTE BOTTOM NOTIFICATIONS */}
      {/* Row-level update notification */}
      {rowNotification && (
        <View style={styles.notificationBanner}>
          <Text style={styles.notificationText}>{rowNotification}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Full-page permission request dialog
 */
function PermissionDialog({
  visible,
  onAllow,
  onDeny,
}: {
  visible: boolean;
  onAllow: () => void;
  onDeny: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.permissionOverlay}>
        <View style={styles.permissionDialog}>
          <Text style={styles.permissionIcon}>🔔</Text>
          <Text style={styles.permissionTitle}>Enable Real-time Sync</Text>
          <Text style={styles.permissionMessage}>
            Allow notifications to get instant updates when your data changes on
            other devices. This ensures you always have the latest information.
          </Text>
          <View style={styles.permissionFeatures}>
            <Text style={styles.permissionFeature}>
              ✓ Instant sync when data changes
            </Text>
            <Text style={styles.permissionFeature}>
              ✓ Background updates while app is open
            </Text>
            <Text style={styles.permissionFeature}>
              ✓ No manual refresh needed
            </Text>
          </View>
          <TouchableOpacity
            style={styles.permissionAllowButton}
            onPress={onAllow}
          >
            <Text style={styles.permissionAllowText}>Enable Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.permissionDenyButton}
            onPress={onDeny}
          >
            <Text style={styles.permissionDenyText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function App() {
  const [deviceToken, setDeviceToken] = useState<string | null>(null);

  useEffect(() => {
    Notifications.getExpoPushTokenAsync()
      .then((token) => setDeviceToken(token.data as string))
      .catch(() => setDeviceToken('Failed to get token'));
  }, []);

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
      syncMode="push"
      notificationListening="always"
      renderPushPermissionPrompt={({ allow, deny }) => (
        <PermissionDialog visible onAllow={allow} onDeny={deny} />
      )}
      apiKey={SQLITE_CLOUD_API_KEY}
      debug={true}
    >
      <TestApp deviceToken={deviceToken} />
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
  testNotificationButton: {
    backgroundColor: '#34C759',
    marginTop: 8,
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
    backgroundColor: '#5856D6',
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
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
  listLoading: {
    padding: 16,
    alignItems: 'center',
  },
  listLoadingText: {
    textAlign: 'center',
    marginTop: 8,
    color: '#333',
  },
  listError: {
    padding: 16,
  },
  listErrorTitle: {
    color: '#D8000C',
    fontWeight: '600',
    marginBottom: 4,
  },
  listErrorMessage: {
    color: '#333',
  },
  // Permission dialog styles
  permissionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionDialog: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  permissionFeatures: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  permissionFeature: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    paddingLeft: 8,
  },
  permissionAllowButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 12,
  },
  permissionAllowText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  permissionDenyButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  permissionDenyText: {
    color: '#666',
    fontSize: 16,
  },
  tokenBanner: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  tokenLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  tokenText: {
    fontSize: 11,
    color: '#333',
    fontFamily: 'monospace',
  },
});
