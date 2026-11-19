import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { Schema } from './schema';

/**
 * The local database, whichever synchronous driver opened it: expo-sqlite on
 * the device, better-sqlite3 in Node tests (Seam B).
 */
export type LocalDb = BaseSQLiteDatabase<'sync', unknown, Schema>;
