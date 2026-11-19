# Offline sync: per-record last-write-wins with tombstones

Offline use is part of the MVP and an Account can be used on several devices. Every record gets an ID generated on the device, edits are queued locally and pushed, then newer changes are pulled, and conflicts on the same record go to the edit with the latest timestamp. Deletes are kept as tombstones so an older copy syncing back can't undo them. We chose this over CRDTs or per-field event replay because the data is mostly add-only (new Transactions never conflict) and losing an occasional concurrent edit to the same Transaction is acceptable for virtual money.

## Consequences

- Records are never hard-deleted while any device might still sync them.
- Totals (Remaining, Jar balances) are always derived from Transactions, never synced as stored values, so they can't drift.
