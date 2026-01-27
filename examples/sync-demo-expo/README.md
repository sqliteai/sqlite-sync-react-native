# SQLite Sync React Native - Expo Demo

This is an example **Expo** app demonstrating the usage of `@sqliteai/sqlite-sync-react-native` with push notification sync mode.

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

### 2. Set Up React Native Environment

Follow the [React Native environment setup guide](https://reactnative.dev/docs/set-up-your-environment) to install Xcode and Android Studio.

### 3. Configure Environment Variables

1. **Create configuration files**

   ```bash
   cd examples/sync-demo-expo
   cp .env.example .env
   cp eas.json.example eas.json
   ```

2. **Set up an Expo project** (for push notifications)

   - Go to [Expo Dashboard](https://expo.dev/)
   - Create a new account or sign in
   - Create a new project and copy your **Project ID**

3. **Fill in your `.env` file**

   ```env
   # SQLite Cloud credentials
   SQLITE_CLOUD_CONNECTION_STRING=sqlitecloud://your-host.sqlite.cloud:8860/your-database
   SQLITE_CLOUD_API_KEY=your-api-key-here
   DATABASE_NAME=sync-demo.db
   TABLE_NAME=test_table

   # Expo/EAS configuration
   EAS_PROJECT_ID=your-eas-project-id
   IOS_BUNDLE_IDENTIFIER=com.yourcompany.sqlitesyncexample
   ANDROID_PACKAGE=com.yourcompany.sqlitesyncexample
   ```

   **Note**: The `TABLE_NAME` must match the table you created in SQLite Cloud and enabled for OffSync.

4. **Set up push notification credentials**

   ```bash
   # Configure iOS APNs credentials
   eas credentials -p ios

   # Configure Android FCM credentials (optional)
   eas credentials -p android
   ```

5. **Configure Firebase for Android (optional)**

   If you want push notifications on Android:

   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Add an Android app with your package name
   - Download `google-services.json` and place it in this directory

### 4. Install Dependencies

```bash
# From repository root
yarn install
```

## Running the Example

From the repository root:

```bash
yarn expo:ios:device      # Build library + run iOS
yarn expo:android:device  # Build library + run Android
```

## How It Works

The demo app demonstrates:

1. **SQLiteSyncProvider** - Creates a local SQLite database that syncs with the cloud
2. **Push notification sync** - Uses `expo-notifications` for real-time sync triggers
3. **Reactive queries** - Uses `useSqliteSyncQuery` for automatic UI updates
4. **Row-level notifications** - Uses `useOnTableUpdate` for change tracking
5. **Manual sync** - Uses `useTriggerSqliteSync` for on-demand sync
6. **Background sync callback** - Uses `registerBackgroundSyncCallback` for background notifications

## Try It Out

**Test Push Notification Sync:**
1. Run the app on a real device (push notifications don't work on simulators)
2. Grant push notification permissions when prompted
3. Add data from the SQLite Cloud dashboard
4. Watch the app sync instantly via push notification

**Test Permission Denial Fallback:**
1. Deny push notification permissions when prompted
2. The app automatically falls back to polling mode
3. Data still syncs, just on a polling interval instead of instantly

## Learn More

- [SQLite Sync Getting Started Guide](https://docs.sqlitecloud.io/docs/sqlite-sync-getting-started)
- [OffSync Configuration](https://docs.sqlitecloud.io/docs/offsync)
