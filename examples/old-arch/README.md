# Old Architecture Example

This is an example Expo app demonstrating the usage of `@sqliteai/sqlite-sync-react-native` with **React Native's Old Architecture** (Bridge-based).

## Architecture

This example uses:
- ✅ **Old Architecture**: Uses React Native Bridge
- ✅ `newArchEnabled: false`
- ✅ Works on both iOS and Android
- ✅ Maximum compatibility for production apps

## Running the Example

### Prerequisites

```bash
# From repository root
yarn install
yarn prepare
```

### iOS

```bash
cd examples/old-arch
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
npx expo run:ios
```

### Android

```bash
cd examples/old-arch
npx expo prebuild --platform android --clean
npx expo run:android
```

## Testing

This example uses the same source code as the new-arch example to verify that the library works correctly with both the old and new React Native architectures.

## Learn More

- [React Native Old Architecture](https://reactnative.dev/docs/the-new-architecture/landing-page)
- [Expo Documentation](https://docs.expo.dev/)
