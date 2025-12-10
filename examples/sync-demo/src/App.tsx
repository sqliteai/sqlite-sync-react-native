import { useState, useContext, useCallback } from 'react';
import {
  Text,
  View,
  StyleSheet,
  Button,
  TextInput,
  ScrollView,
} from 'react-native';
import {
  SQLiteSyncProvider,
  SQLiteSyncContext,
  useOnSqliteSync,
  useTriggerSqliteSync,
} from '@sqliteai/sqlite-sync-react-native';
import {
  SQLITE_CLOUD_CONNECTION_STRING,
  SQLITE_CLOUD_API_KEY,
  DATABASE_NAME,
  TABLE_NAME,
} from '@env';

function TestApp() {
  const { db, isInitialized, isSyncing, lastSyncTime } =
    useContext(SQLiteSyncContext);
  const [text, setText] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const { triggerSync } = useTriggerSqliteSync();

  const loadRows = useCallback(async () => {
    if (!db) return;

    try {
      const result = await db.execute(`SELECT * FROM ${TABLE_NAME};`);
      setRows(result.rows || []);
      console.log('[sqlite-sync-demo] Loaded rows:', result.rows?.length || 0);
    } catch (err) {
      console.error('[sqlite-sync-demo] Failed to load rows:', err);
    }
  }, [db]);

  const addRow = async () => {
    if (!db || !text.trim()) return;

    try {
      await db.execute(
        `INSERT INTO ${TABLE_NAME} (id, value) VALUES (cloudsync_uuid(), '${text}');`
      );
      console.log('[sqlite-sync-demo] ✅ Row inserted:', text);
      setText('');
      loadRows();
    } catch (err) {
      console.error('[sqlite-sync-demo] Failed to insert row:', err);
    }
  };

  // Auto-reload rows when sync has changes
  useOnSqliteSync(loadRows);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>SQLite Sync Test</Text>
      <Text style={styles.status}>
        {isInitialized ? '✅ Initialized' : '⏳ Initializing...'}
      </Text>
      <Text style={styles.status}>
        {isSyncing ? '🔄 Syncing...' : '✓ Idle'}
      </Text>
      {lastSyncTime && (
        <Text style={styles.status}>
          Last sync: {new Date(lastSyncTime).toLocaleTimeString()}
        </Text>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter text"
          value={text}
          onChangeText={setText}
        />
        <Button title="Add Row" onPress={addRow} />
        <Button title="Refresh" onPress={triggerSync} />
      </View>

      <Text style={styles.rowCount}>Rows: {rows.length}</Text>
      {rows.map((row, index) => (
        <Text key={index} style={styles.row}>
          {row.id}: {row.value}
        </Text>
      ))}
    </ScrollView>
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
          schema: `
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
    >
      <TestApp />
    </SQLiteSyncProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  status: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  inputContainer: {
    width: '100%',
    marginTop: 20,
    marginBottom: 20,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    backgroundColor: 'white',
  },
  rowCount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  row: {
    fontSize: 14,
    padding: 8,
    backgroundColor: 'white',
    marginBottom: 4,
    borderRadius: 4,
    width: '100%',
  },
  error: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  errorDetails: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
