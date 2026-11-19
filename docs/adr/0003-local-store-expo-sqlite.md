# Local store: expo-sqlite with a hand-written sync layer

Offline-first needs a real on-device database. We chose expo-sqlite (with Drizzle as the query layer) and a thin custom sync layer over WatermelonDB, because the sync model in ADR-0001 is simple enough to write by hand, WatermelonDB's upkeep and Expo support have been patchy, and SQL makes the monthly and Jar totals easy to work out.
