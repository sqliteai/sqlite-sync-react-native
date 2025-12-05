import { Text, View, StyleSheet } from 'react-native';
import { SQLiteSyncProvider } from '@sqliteai/sqlite-sync-react-native';

function TestApp() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SQLite Sync Test</Text>
      <Text style={styles.subtitle}>Check console for initialization logs</Text>
    </View>
  );
}

export default function App() {
  return (
    <SQLiteSyncProvider
      connectionString="sqlitecloud://cvuzesvcnk.global2.ryujaz.sqlite.cloud:8860/my-database"
      databaseName="my-database.db"
      tablesToBeSynced={['test']}
      syncInterval={3000}
      apiKey="hCcJLRGVabytCQJNJ3BWW6o2YWMPJpxKXGP8jk1uDDk"
    >
      <TestApp />
    </SQLiteSyncProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
