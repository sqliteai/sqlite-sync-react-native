const IS_DEV = process.env.APP_VARIANT === 'development';

export default {
  expo: {
    name: IS_DEV ? 'sync-demo-expo (Dev)' : 'sync-demo-expo',
    slug: 'sqlite-sync-demo',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    extra: {
      eas: {
        projectId: process.env.EAS_PROJECT_ID || 'YOUR_EAS_PROJECT_ID',
      },
    },
    plugins: [
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26,
          },
        },
      ],
      [
        'expo-notifications',
        {
          enableBackgroundRemoteNotifications: true,
        },
      ],
    ],
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier:
        process.env.IOS_BUNDLE_IDENTIFIER ||
        'com.yourcompany.sqlitesyncexample',
      infoPlist: {
        UIBackgroundModes: ['remote-notification'],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      package:
        process.env.ANDROID_PACKAGE || 'com.yourcompany.sqlitesyncexample',
      minSdkVersion: 26,
      googleServicesFile: './google-services.json',
    },
    web: {
      favicon: './assets/favicon.png',
    },
  },
};
