# 05: Sync tracer bullet

**What to build:** An adult records a bare Expense while offline on one device, and it appears on their second device once both are online. This proves the local store, the outbox and the sync endpoint end to end.

**Blocked by:** 04 (Session lifecycle).

**Status:** ready-for-agent

- [ ] Local SQLite with Drizzle is the screens' only data source. Every write updates the table and adds an outbox entry in one transaction.
- [ ] Synced records carry a UUIDv7 ID created on the device, the owning Account, the edit time and the server version (ADR-0006, ADR-0007).
- [ ] A single sync endpoint pushes and pulls in one round trip and uses an atomic server-version counter as the cursor.
- [ ] The Other Category exists for every Account, and a minimal Expense can be recorded against it.
- [ ] The Seam B harness runs the sync engine in Node (better-sqlite3 + Drizzle) against the API in the same process, with an in-memory Mongo. Its first scenario: device A records offline, both sync, and device B has the Expense.
