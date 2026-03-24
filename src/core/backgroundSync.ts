export {
  registerBackgroundSync,
  unregisterBackgroundSync,
} from './background/backgroundSyncRegistry';
export {
  getPersistedConfig,
  persistConfig,
  clearPersistedConfig,
} from './background/backgroundSyncConfig';
export { executeBackgroundSync } from './background/executeBackgroundSync';
export type { BackgroundSyncConfig } from './background/backgroundSyncConfig';
