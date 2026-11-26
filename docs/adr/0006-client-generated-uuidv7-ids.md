# Synced records use client-generated UUIDv7 `_id`s

Records are created offline (ADR-0001), so the device must assign IDs before the server sees them. Every synced record uses a UUIDv7 string as its Mongo `_id` instead of an ObjectId. UUIDv7s sort by creation time and need no coordination between devices. Server-only collections (Sessions, OTP codes) keep ObjectIds.

(Amended: records that exist once per Account, per Month or per Kid Profile use deterministic UUIDv8 IDs instead, so two offline devices creating "the same" record end up with one. The Other Category, Account settings and the Pay Day history use a fixed ID built from the Account id; Month plans, Category Budgets, default Categories and default Jars use the SHA-256 of the Account and the record's key fields (`packages/shared/src/sync/ids.ts`). The server refuses a push whose ID isn't the one derived from its fields. Every other record still uses a UUIDv7.)
