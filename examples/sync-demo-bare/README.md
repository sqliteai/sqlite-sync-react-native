# SQLite Sync React Native - Sync Demo (Bare React Native)

This is an example **bare React Native** app (without Expo) demonstrating the usage of `@sqliteai/sqlite-sync-react-native`.

This example ensures that the library works correctly in both Expo and non-Expo projects.

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
   - Select \`test_table\` to enable synchronization
   - Learn more about [OffSync configuration](https://docs.sqlitecloud.io/docs/offsync#configuring-offsync)

5. **Get your credentials**
   - Navigate to your database's **Configuration** tab
   - Copy your **Connection String** (format: \`sqlitecloud://your-host.sqlite.cloud:8860/your-database\`)
   - Copy your **API Key**

### 2. Set Up React Native Environment

Follow the [React Native environment setup guide](https://reactnative.dev/docs/set-up-your-environment) to install Xcode and Android Studio.

### 3. Configure Environment Variables

1. **Create a \`.env\` file**

   ```bash
   cd examples/sync-demo-bare
   cp .env.example .env
   ```

2. **Fill in your credentials** in the \`.env\` file:

   ```env
   SQLITE_CLOUD_CONNECTION_STRING=sqlitecloud://your-host.sqlite.cloud:8860/your-database
   SQLITE_CLOUD_API_KEY=your-api-key-here
   DATABASE_NAME=sync-demo.db
   TABLE_NAME=test_table
   ```

   **Note**: The \`TABLE_NAME\` must match the table name you created in SQLite Cloud and enabled for OffSync.

### 4. Install Dependencies

```bash
# From repository root
yarn install
```

This will install dependencies for both the library and the example.

### 5. Install iOS Pods (iOS only)

```bash
# From repository root
cd examples/sync-demo-bare/ios
pod install
cd ../../..
```

## Running the Example

You can run the example from either the **repository root** or the **example directory**.

### Option 1: Run from Root (Recommended)

This automatically builds the library and runs the example:

```bash
# From repository root
yarn bare:ios      # Build library + run iOS
yarn bare:android  # Build library + run Android
```

### Option 2: Run from Example Directory

If you prefer to run commands from the example directory:

```bash
# From repository root
cd examples/sync-demo-bare

# iOS
yarn ios

# Android
yarn android
```

## Differences from Expo Version

This bare React Native example:

- Uses React Native CLI instead of Expo
- Has direct access to native iOS and Android folders
- Requires manual CocoaPods installation for iOS
- Provides a more traditional React Native development experience
- Ensures the library works correctly without Expo dependencies

## How It Works

The demo app:

1. Creates a local SQLite database that syncs with the cloud
2. Allows you to add text entries that are automatically synced
3. Displays sync status and last sync time
4. Auto-reloads data when changes are received

## Try It Out

**Test Real-Time Sync:**
- Open the app on multiple devices or alongside the SQLite Cloud dashboard to see real-time synchronization in action!

**Test Offline Mode:**
- Turn off your internet connection
- Add entries in the app (they'll be saved locally)
- Turn your internet back on
- Watch the sync automatically happen and changes appear in the cloud!

## Learn More

- [SQLite Sync Getting Started Guide](https://docs.sqlitecloud.io/docs/sqlite-sync-getting-started)
- [OffSync Configuration](https://docs.sqlitecloud.io/docs/offsync)
- [React Native Documentation](https://reactnative.dev/)
