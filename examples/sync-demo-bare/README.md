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
   - Select `test_table` to enable synchronization
   - Learn more about [OffSync configuration](https://docs.sqlitecloud.io/docs/offsync#configuring-offsync)

5. **Get your credentials**
   - Navigate to your database's **Configuration** tab
   - Copy your **Database ID**
   - Generate or copy an **Access Token** for the user/session you want to test with

### 2. Set Up React Native Environment

Follow the [React Native environment setup guide](https://reactnative.dev/docs/set-up-your-environment) to install Xcode and Android Studio.

### 3. Configure Environment Variables

1. **Create a `.env` file**

   ```bash
   cd examples/sync-demo-bare
   cp .env.example .env
   ```

2. **Fill in your configuration** in the `.env` file:

   ```env
   SQLITE_CLOUD_DATABASE_ID=db_xxxxxxxxxxxxxxxxxxxxxxxx
   DATABASE_NAME=sync-demo.db
   TABLE_NAME=test_table
   ```

   **Note**: The `TABLE_NAME` must match the table name you created in SQLite Cloud and enabled for OffSync.
3. **Set your auth credential** in [`examples/sync-demo-bare/.env`](/Users/damlayildiz/SqliteCloud/sqlite-sync-react-native/examples/sync-demo-bare/.env):

   ```env
   ACCESS_TOKEN=your_jwt_here
   # or use SQLITE_CLOUD_API_KEY=your_api_key_here
   ```

   The bare example reads env values from `.env` via `react-native-dotenv`, so after changing `.env` you should reset Metro cache before rerunning the app.

### 4. Install Dependencies

```bash
# From repository root
yarn install
```

## Running the Example

From the repository root:

```bash
yarn bare:metro:reset # Terminal 1: start Metro with cache reset
yarn bare:ios         # Terminal 2: clean + build + run iOS

# Android
yarn bare:metro:reset # Terminal 1: same Metro command
yarn bare:android     # Terminal 2: clean + build + run Android
```

## How It Works

The demo app demonstrates:

1. **SQLiteSyncProvider** - Creates a local SQLite database that syncs with the cloud
2. **Adaptive polling sync** - Automatically syncs at intelligent intervals
3. **Reactive queries** - Uses `useSqliteSyncQuery` for automatic UI updates
4. **Row-level notifications** - Uses `useOnTableUpdate` for change tracking
5. **Manual sync** - Uses `useTriggerSqliteSync` for on-demand sync

## Try It Out

**Test Real-Time Sync:**
- Open the app on multiple devices or alongside the SQLite Cloud dashboard to see real-time synchronization in action!

**Test Offline Mode:**
- Turn off your internet connection
- Add entries in the app (they'll be saved locally)
- Turn your internet back on
- Watch the sync automatically happen

## Learn More

- [SQLite Sync Getting Started Guide](https://docs.sqlitecloud.io/docs/sqlite-sync-getting-started)
- [OffSync Configuration](https://docs.sqlitecloud.io/docs/offsync)
- [React Native Documentation](https://reactnative.dev/)
