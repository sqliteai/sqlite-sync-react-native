/**
 * Centralized optional Expo dependencies
 * Loaded once at module initialization
 */

// Module references
export let ExpoNotifications: any = null;
export let ExpoTaskManager: any = null;
export let ExpoSecureStore: any = null;
export let ExpoConstants: any = null;

// Load expo-notifications
try {
  ExpoNotifications = require('expo-notifications');
} catch {
  // Not available
}

// Load expo-task-manager
try {
  ExpoTaskManager = require('expo-task-manager');
} catch {
  // Not available
}

// Load expo-secure-store
try {
  ExpoSecureStore = require('expo-secure-store');
} catch {
  // Not available
}

// Load expo-constants
try {
  const constantsModule = require('expo-constants');
  ExpoConstants = constantsModule.default || constantsModule;
} catch {
  // Not available
}

// Load expo-application
export let ExpoApplication: any = null;
try {
  ExpoApplication = require('expo-application');
} catch {
  // Not available
}

// Compound availability check
export const isBackgroundSyncAvailable = () =>
  ExpoNotifications !== null &&
  ExpoTaskManager !== null &&
  ExpoSecureStore !== null;
