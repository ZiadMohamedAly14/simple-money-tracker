# 06: Robust sync

**What to build:** Sync behaves correctly in the messy cases. Concurrent offline edits merge, deletions stay deleted, sync runs on its own at the right moments, and a new device downloads everything.

**Blocked by:** 05 (Sync tracer bullet).

**Status:** resolved

- [x] Conflicts on the same record go to the latest edit (ADR-0001).
- [x] Deletions are kept as markers, and an older copy syncing back can't undo them.
- [x] Sync runs after local writes (debounced about 2 seconds), when the app comes to the foreground, when the connection returns, and on pull-to-refresh. There's no background sync.
- [x] A "pending sync" indicator appears only when changes have waited more than a minute.
- [x] A newly signed-in device downloads everything from cursor zero.
- [x] Concurrent syncs of one Account can't make a device skip a change: a pull never returns a server version past one that is still being written (found in ticket 05; see its Comments).
- [x] Pulls are paged, so a new device catching up on a large history gets everything over several round trips.
- [x] Seam B scenarios cover conflicting edits, deleting on one device while editing on the other, out-of-order syncs, and a new device catching up.

## Comments

Built on `ticket/06-robust-sync`:

- **Last edit wins (server, `sync.service.ts` `apply`).** A push is stored only if its `updatedAt` is later than the stored copy. Ties go to the stored copy. Writes are conditional on the stored `serverVersion`, so two syncs racing on one record re-read and decide again instead of overwriting a later edit. When a push loses, the response includes the winning copy even if the device's cursor is already past it, so the losing device converges in the same round trip.
- **Deletion markers.** A deletion always wins: once stored it is never cleared, and it lands even on a copy edited later. That way the result doesn't depend on which device syncs first. Recorded as a consequence in ADR-0001.
- **Last edit wins (client, `localStore.ts` `applyPulled`).** A pulled copy replaces a change made during the sync if it is later or a deletion, and the waiting outbox entry is dropped. A record with nothing waiting takes the server copy unless it is older than the one held. The store gained `update`/`remove` (deletion is a marker), `onWrite`, and `oldestPendingAt`. `src/data/transactions.ts` gained `editExpense`/`deleteExpense` (no screens yet; ticket 08).
- **Concurrent syncs (`counter.model.ts`).** Each write marks its server version in flight on the counter document until it settles (`writeWithServerVersion`). A pull reads only up to `committedServerVersion`, the highest version with nothing in flight below it, and the cursor moves there. An entry older than a minute counts as abandoned (a crashed request), so it can't stall pulls forever. The counter is global, so a slow write by one Account briefly holds back other Accounts' pulls. It only delays them; it never skips anything.
- **Paged pulls.** `POST /sync` takes an optional `limit` (1–500, default `MAX_PULLED_CHANGES` = 500) and returns `hasMore`. The engine keeps syncing while `hasMore` is true. New shared contract fields: `SyncRequestBody.limit`, `SyncResponseData.hasMore`.
- **Triggers (`src/sync/syncTriggers.ts`, wired in `appSync.ts` `startAutoSync`, started from `app/_layout.tsx`).** Sync runs 2 s after the last local write, right away on foreground (`AppState`), on reconnect (`expo-network`, a **new native module**), on sign-in (so a new device downloads at once), and on app open. Pull-to-refresh uses `syncTriggers.refresh()`. There is no background sync. The screens no longer call `syncEngine.sync()` directly.
- **Pending sync indicator.** `isSyncOverdue` (`src/sync/pendingSync.ts`) and the `useSyncOverdue` hook, which uses a live query on the outbox and rechecks every 10 s. The Expenses screen header shows `PendingSyncLabel` only once a change has waited more than a minute.
- **Tests.** Seam A (`apps/api/test/sync.test.ts`) covers conflicts, deletion markers, the winner being handed back, paging, page-size validation, and a held-open write not being skipped (plus abandonment after a minute). Seam B (`sync.seamB.test.ts`) covers conflicting offline edits, syncing out of order, a wrong device clock, deleting on one device while editing on the other (both orders), an old device syncing back after a deletion, edits landing mid-sync (newer pull, pulled deletion), a new device catching up from cursor zero over several pages, auto-sync after a write, and the one-minute indicator. Trigger timing is unit-tested with fake timers (`syncTriggers.test.ts`). The Seam B test server now rebuilds the Express app on `clear()`, so the per-IP sign-in limit doesn't carry over between tests.

**Left over:**
- "No duplicate Months" (spec Seam B) waits for Month plans (ticket 07, being built in parallel). They will need a deterministic ID per Account and Month, like `otherCategoryId`, so two offline devices create the same record and last edit wins merges them.
- Kid-scope reads and writes are still closed (ticket 14).

**Human follow-up:**
- Build a new dev client (`expo-network` is new). Then check by hand: record offline, wait over a minute and see "Pending sync" (also in Arabic); turn the network back on and see it sync without pulling to refresh; background and foreground the app on a second device and see it pick up changes.
- Deploy the API. Existing devices keep working: `limit` is optional and `hasMore` is additive.
