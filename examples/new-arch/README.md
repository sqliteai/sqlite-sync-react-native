# SQLite Sync React Native - New Architecture Example

This is an example Expo app demonstrating the usage of `@sqliteai/sqlite-sync-react-native` with **React Native's New Architecture** enabled.

## New Architecture Support

This example uses `@op-engineering/op-sqlite` v15.1.6, which has improved support for React Native's new architecture.

**Status by Platform:**
- ✅ **iOS**: Fully supported with new architecture
- ✅ **Android**: Supported with new architecture (requires op-sqlite v15+)

## What's Different

This example is identical to the main `example` app, but with these key differences:

- ✅ **New Architecture Enabled**: Uses Fabric renderer and TurboModules
- ✅ `newArchEnabled: true` in `app.json`
- ✅ Tests compatibility with React Native's modern architecture on iOS

## Running the Example

### Prerequisites

```bash
# From repository root
yarn install
yarn prepare
```

### iOS (Recommended - New Architecture Supported)

```bash
cd example-new-arch
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
npx expo run:ios
```

### Android

```bash
cd example-new-arch
npx expo prebuild --platform android --clean
npx expo run:android
```

## Testing

This example uses the same source code as the old-arch example to verify that the library works correctly with both the old and new React Native architectures.

## Learn More

- [React Native New Architecture](https://reactnative.dev/docs/new-architecture-intro)
- [Expo New Architecture](https://docs.expo.dev/guides/new-architecture/)
