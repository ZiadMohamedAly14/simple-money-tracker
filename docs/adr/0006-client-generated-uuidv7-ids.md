# Synced records use client-generated UUIDv7 `_id`s

Records are created offline (ADR-0001), so the device must assign IDs before the server sees them. Every synced record uses a UUIDv7 string as its Mongo `_id` instead of an ObjectId. UUIDv7s sort by creation time and need no coordination between devices. Server-only collections (Sessions, OTP codes) keep ObjectIds.
