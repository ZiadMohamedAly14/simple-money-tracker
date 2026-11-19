# 05: Sync tracer bullet

**What to build:** An adult records a bare Expense while offline on one device, and it appears on their second device once both are online. This proves the local store, the outbox and the sync endpoint end to end.

**Blocked by:** 04 (Session lifecycle).

**Status:** resolved

- [x] Local SQLite with Drizzle is the screens' only data source. Every write updates the table and adds an outbox entry in one transaction.
- [x] Synced records carry a UUIDv7 ID created on the device, the owning Account, the edit time and the server version (ADR-0006, ADR-0007).
- [x] A single sync endpoint pushes and pulls in one round trip and uses an atomic server-version counter as the cursor.
- [x] The Other Category exists for every Account, and a minimal Expense can be recorded against it.
- [x] The Seam B harness runs the sync engine in Node (better-sqlite3 + Drizzle) against the API in the same process, with an in-memory Mongo. Its first scenario: device A records offline, both sync, and device B has the Expense.

## Comments

Built on `ticket/05-sync-tracer-bullet`:

- **Shared:** sync contract (`SyncRequestBody`/`SyncResponseData`, `PushedChange`/`PulledChange`, `SYNC_ENTITIES`, `parsePushedChange` validation), `uuidv7`, `otherCategoryId(accountId)` (a fixed UUID per Account so a device can record against Other before its first sync), `OTHER_CATEGORY`, `toLocalDate`.
- **API:** `POST /sync {cursor, changes}` → `{cursor, changes}` (Seam A, `apps/api/test/sync.test.ts`). Categories and Transactions collections with UUID `_id`, `accountId`, `updatedAt`, `deletedAt`, `serverVersion`; `Counter` gives atomic server versions. Validates shape, ownership (403 on another Account's ID), references (Expense's Category must be this Account's, stored or pushed in the same sync). Other is created on the Account's first sync. Kid scope reads/writes nothing yet (rules table in `sync.service.ts`, ticket 14).
- **Mobile:** `src/db/` (Drizzle schema, hand-written SQL migrations on `user_version`, `createLocalStore`), `src/sync/syncEngine.ts` (single-flight push+pull), `src/data/transactions.ts` (`recordExpense`, live-queryable `expensesQuery`/`categoriesQuery`). Screens `app/expenses/index.tsx` (live list, pull to sync) and `app/expenses/new.tsx` (keypad, Other, today), linked from the home screen.
- **Extra scope:** the local database belongs to one Account. `claimAccount` wipes rows, outbox and cursor when a different Account signs in (also checked at app start), and sign-out wipes everything. Covered in the Seam B file (`src/sync/sync.seamB.test.ts`).
- **Left for ticket 06:** last edit wins (server `apply()` in `sync.service.ts`, client `applyPulled` in `localStore.ts`, both marked), deletion-marker rules, triggers (debounce, foreground, reconnect), the pending-sync indicator, pull paging for large catch-ups, and concurrent syncs of one Account getting versions committed out of order (a reader could skip a version still being written).
- Currency is a placeholder (`PLACEHOLDER_CURRENCY = 'EGP'`) until Account settings (ticket 07).

**Human follow-up:**
- Build a new dev client (`expo-sqlite` and `expo-crypto` are new native modules), then check by hand on two devices: record an Expense offline on one, go online, pull to refresh on the other. Also check the Expenses screens in Arabic (RTL).
- Deploy the API so `/sync` exists on Railway.
