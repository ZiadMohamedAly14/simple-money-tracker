# 02: Store and sync the Pay Day history

**Status:** ready-for-agent
**Blocked by:** 01

**What to build:** Store the Pay Day history (each entry is a Pay Day and the date the first Month on it starts) in the shared sync contract, the local SQLite schema with a migration, and the Mongo model. Kid sessions don't need it. A second change before a pending one takes effect replaces the pending one (spec decision 8).

**Open question for the implementer:** `changeAccountSettings` rewrites the whole settings record. If the history lives there, a stale device changing currency could overwrite a Pay Day change made on another device. Decide whether the history gets its own record or the overwrite is acceptable, and note the choice in the PR.

**Acceptance:** A seam test where two devices sync converges on the same history and the same Month boundaries. Old records with no history parse as Pay Day 1.

## Comments

**Storage decision: its own record.** The history is a new synced entity `payDayHistory` (fixed ID `payDayHistoryId(accountId)`, fields `{ entries: PayDayEntry[] }`), not a field of `accountSettings`. Last write wins applies per record (ADR-0001), and `changeAccountSettings` rewrites the whole settings record. If the history lived there, a device with a stale copy that changed the currency or digits later would push the old history back and undo the Pay Day change. As its own record, it can only be replaced by another Pay Day change, which is what last edit wins should mean here (spec decision 8). It also stays out of Kid Sessions (`kidReads: null`), and an elevated Kid-Mode device can't push it.

- No record, or a record with no `entries`, reads as `[]` (Pay Day 1), so existing Accounts need no data migration.
- The contract rejects entries whose Pay Day isn't 1–31, whose `startsOn` isn't a day that Pay Day falls on (with clamping), or that repeat a start date.
- `savePayDayHistory` returns `not_ready` and writes nothing while the device has no Account settings yet (the same guard as `changeAccountSettings`). Otherwise a fresh offline device would build its history on a guessed Pay Day 1 and overwrite the real one.
- Pending-change replacement happens in `payDayOptions` (ticket 01). The device stores `option.history` as is.
