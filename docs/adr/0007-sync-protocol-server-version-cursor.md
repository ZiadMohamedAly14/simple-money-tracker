# Sync protocol: one endpoint, server-version cursor, client-time conflicts

Sync is a single `POST /sync { cursor, changes }` that pushes the device's changes and returns `{ changes, cursor }`. Two separate clocks are used on purpose. The device's `updatedAt` decides which edit wins a conflict (ADR-0001). A `serverVersion` counter that only goes up, stamped by the server from an atomic counter, decides what each device still needs to pull, so a phone with a wrong clock never misses or repeats changes. A new device pulls from version 0, and a Kid Session only receives that Kid Profile's records.

Sync runs after a local write (debounced about 2 seconds), when the app comes to the foreground, when the connection returns, and on pull-to-refresh. There is no background sync while the app is closed in the MVP.
