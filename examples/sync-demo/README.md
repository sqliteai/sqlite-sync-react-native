# SQLite Sync React Native - Sync Demo

This is an example Expo app demonstrating the usage of `@sqliteai/sqlite-sync-react-native`.

## What This Demo Shows

This example demonstrates:

- ✅ **Auto-sync with SQLite Cloud**: Automatic synchronization between local and cloud database
- ✅ **Real-time updates**: Changes sync automatically with configurable intervals
- ✅ **Offline-first**: Works offline and syncs when connection is available
- ✅ **Simple API**: Easy-to-use hooks for sync status and triggers

## Setup Instructions

### 1. Set Up SQLite Cloud

Before running the example, you need to set up a SQLite Cloud database:

1. **Create a SQLite Cloud account**
   - Go to [SQLite Cloud Dashboard](https://dashboard.sqlitecloud.io/)
   - Create a new account or sign in

2. **Create a new database**
   - Create a new project
   - Create a new database in your project

3. **Create the table**
   - In the SQLite Cloud dashboard, navigate to your database
   - Execute the following SQL to create the demo table:
   ```sql
   CREATE TABLE IF NOT EXISTS test_table (
     id TEXT PRIMARY KEY NOT NULL,
     value TEXT,
     created_at TEXT DEFAULT CURRENT_TIMESTAMP
   );
   ```

4. **Enable OffSync for the table**
   - Navigate to **Databases > OffSync** page in the dashboard
   - Select `test_table` to enable synchronization
   - Learn more about [OffSync configuration](https://docs.sqlitecloud.io/docs/offsync#configuring-offsync)

5. **Get your credentials**
   - Navigate to your database's **Configuration** tab
   - Copy your **Connection String** (format: `sqlitecloud://your-host.sqlite.cloud:8860/your-database`)
   - Copy your **API Key**

### 2. Configure Environment Variables

1. **Create a `.env` file**
   ```bash
   cd examples/sync-demo
   cp .env.example .env
   ```

2. **Fill in your credentials** in the `.env` file:
   ```env
   SQLITE_CLOUD_CONNECTION_STRING=sqlitecloud://your-host.sqlite.cloud:8860/your-database
   SQLITE_CLOUD_API_KEY=your-api-key-here
   DATABASE_NAME=sync-demo.db
   TABLE_NAME=test_table
   ```

   **Note**: The `TABLE_NAME` must match the table name you created in SQLite Cloud and enabled for OffSync.

### 3. Install Dependencies

```bash
# From repository root
yarn install
yarn prepare

# Install example dependencies
cd examples/sync-demo
yarn install
```

## Running the Example

### iOS

```bash
cd examples/sync-demo
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
npx expo run:ios
```

### Android

```bash
cd examples/sync-demo
npx expo prebuild --platform android --clean
npx expo run:android
```

## How It Works

The demo app:
1. Connects to your SQLite Cloud database on startup
2. Creates a local SQLite database that syncs with the cloud
3. Allows you to add text entries that are automatically synced
4. Displays sync status and last sync time
5. Auto-reloads data when changes are detected from other devices

Try opening the app on multiple devices or alongside the SQLite Cloud dashboard to see real-time synchronization in action!

## Learn More

- [SQLite Sync Getting Started Guide](https://docs.sqlitecloud.io/docs/sqlite-sync-getting-started)
- [OffSync Configuration](https://docs.sqlitecloud.io/docs/offsync)
