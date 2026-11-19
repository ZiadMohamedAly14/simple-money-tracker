# 18: Account deletion and archiving a Kid Profile

**What to build:** An adult permanently deletes their Account and all its data, and can archive a Kid Profile without losing its history.

**Blocked by:** 14 (Kid-Mode device).

**Status:** ready-for-agent

- [ ] Deletion is confirmed with an email code. It hard-deletes every collection for the Account (ADR-0005), revokes all sessions including Kid sessions, and wipes local data on the device.
- [ ] Archiving a Kid Profile hides it, keeps its history, and signs out its Kid-Mode devices.
- [ ] Seam A test: after deletion, no record of the Account remains in any collection.
