/**
 * Options for executing SQL commands with connection selection
 */
export type ExecuteOptions =
  | {
      /**
       * Read-only mode - uses readDb connection
       */
      readOnly: true;
      /**
       * Auto-sync is not applicable for read-only operations
       */
      autoSync?: never;
    }
  | {
      /**
       * Write mode (default) - uses writeDb connection
       */
      readOnly?: false;
      /**
       * Whether to automatically sync local changes to the cloud after execution.
       * - `true` (default): Calls cloudsync_network_send_changes() after write operations
       * - `false`: Skip auto-sync (useful for bulk operations or local-only tables)
       */
      autoSync?: boolean;
    };
