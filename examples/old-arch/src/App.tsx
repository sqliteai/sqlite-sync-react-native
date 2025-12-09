import { useState, useContext } from 'react';
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
} from '@sqliteai/sqlite-sync-react-native';

function TestApp() {
  const { db, isInitialized, isSyncing, lastSyncTime } =
    useContext(SQLiteSyncContext);
  const [text, setText] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  const addRow = async () => {
    if (!db || !text.trim()) return;

    try {
      const id = Date.now().toString();
      await db.execute(
        `INSERT INTO test (id, value) VALUES ('${id}', '${text}');`
      );
      console.log('✅ Row inserted:', id, text);
      setText('');
      loadRows();
    } catch (err) {
      console.error('Failed to insert:', err);
    }
  };

  const loadRows = async () => {
    if (!db) return;

    try {
      const result = await db.execute('SELECT * FROM test;');
      setRows(result.rows || []);
    } catch (err) {
      console.error('Failed to load rows:', err);
    }
  };

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
        <Button title="Add Row" onPress={addRow} disabled={!isInitialized} />
        <Button title="Refresh" onPress={loadRows} disabled={!isInitialized} />
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
  return (
    <SQLiteSyncProvider
      connectionString="sqlitecloud://cvuzesvcnk.global2.ryujaz.sqlite.cloud:8860/test-database"
      databaseName="test-database.db"
      tablesToBeSynced={[
        {
          name: 'test',
          schema: `
            CREATE TABLE IF NOT EXISTS test (
              id TEXT PRIMARY KEY NOT NULL,
              value TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
          `,
        },
      ]}
      syncInterval={3000}
      apiKey="hCcJLRGVabytCQJNJ3BWW6o2YWMPJpxKXGP8jk1uDDk"
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
});
