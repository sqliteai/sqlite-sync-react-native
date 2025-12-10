# SQLite Sync React Native - Sync Demo

This is an example Expo app demonstrating the usage of `@sqliteai/sqlite-sync-react-native`.

## What This Demo Shows

This example demonstrates:

- ✅ **Auto-sync with SQLite Cloud**: Automatic synchronization between local and cloud database
- ✅ **Real-time updates**: Changes sync automatically with configurable intervals
- ✅ **Offline-first**: Works offline and syncs when connection is available
- ✅ **Simple API**: Easy-to-use hooks for sync status and triggers

## Running the Example

### Prerequisites

```bash
# From repository root
yarn install
yarn prepare
```

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
