# 02: Store and sync the Pay Day history

**Status:** ready-for-agent
**Blocked by:** 01

**What to build:** Store the Pay Day history (each entry is a Pay Day and the date the first Month on it starts) in the shared sync contract, the local SQLite schema with a migration, and the Mongo model. Kid sessions don't need it. A second change before a pending one takes effect replaces the pending one (spec decision 8).

**Open question for the implementer:** `changeAccountSettings` rewrites the whole settings record. If the history lives there, a stale device changing currency could overwrite a Pay Day change made on another device. Decide whether the history gets its own record or the overwrite is acceptable, and note the choice in the PR.

**Acceptance:** A seam test where two devices sync converges on the same history and the same Month boundaries. Old records with no history parse as Pay Day 1.
