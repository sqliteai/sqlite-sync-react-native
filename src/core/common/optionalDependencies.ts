/**
 * Centralized optional Expo dependencies
 * Loaded once at module initialization
 */

/** MODULE REFERENCES */
export let ExpoNotifications: any = null;
export let ExpoTaskManager: any = null;
export let ExpoSecureStore: any = null;
export let ExpoConstants: any = null;
export let ExpoApplication: any = null;

/** LOAD EXPO-NOTIFICATIONS */
try {
  ExpoNotifications = require('expo-notifications');
} catch {
  // Not available
}

/** LOAD EXPO-TASK-MANAGER */
try {
  ExpoTaskManager = require('expo-task-manager');
} catch {
  // Not available
}

/** LOAD EXPO-SECURE-STORE */
try {
  ExpoSecureStore = require('expo-secure-store');
} catch {
  // Not available
}

/** LOAD EXPO-CONSTANTS */
try {
  const constantsModule = require('expo-constants');
  ExpoConstants = constantsModule.default || constantsModule;
} catch {
  // Not available
}

/** LOAD EXPO-APPLICATION */
try {
  ExpoApplication = require('expo-application');
} catch {
  // Not available
}

/** COMPOUND AVAILABILITY CHECK */
export const isBackgroundSyncAvailable = () =>
  ExpoNotifications !== null &&
  ExpoTaskManager !== null &&
  ExpoSecureStore !== null;
