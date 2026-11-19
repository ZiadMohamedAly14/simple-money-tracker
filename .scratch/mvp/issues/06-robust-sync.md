# 06: Robust sync

**What to build:** Sync behaves correctly in the messy cases. Concurrent offline edits merge, deletions stay deleted, sync runs on its own at the right moments, and a new device downloads everything.

**Blocked by:** 05 (Sync tracer bullet).

**Status:** ready-for-agent

- [ ] Conflicts on the same record go to the latest edit (ADR-0001).
- [ ] Deletions are kept as markers, and an older copy syncing back can't undo them.
- [ ] Sync runs after local writes (debounced about 2 seconds), when the app comes to the foreground, when the connection returns, and on pull-to-refresh. There's no background sync.
- [ ] A "pending sync" indicator appears only when changes have waited more than a minute.
- [ ] A newly signed-in device downloads everything from cursor zero.
- [ ] Concurrent syncs of one Account can't make a device skip a change: a pull never returns a server version past one that is still being written (found in ticket 05; see its Comments).
- [ ] Pulls are paged, so a new device catching up on a large history gets everything over several round trips.
- [ ] Seam B scenarios cover conflicting edits, deleting on one device while editing on the other, out-of-order syncs, and a new device catching up.
