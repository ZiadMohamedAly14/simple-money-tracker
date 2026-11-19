import { drizzle } from 'drizzle-orm/expo-sqlite';
import { getRandomBytes } from 'expo-crypto';
import { openDatabaseSync } from 'expo-sqlite';
import { createLocalStore } from './localStore';
import { migrate } from './migrations';
import { schema } from './schema';
import type { LocalDb } from './types';

/**
 * The app's one local database. The change listener powers Drizzle's
 * `useLiveQuery`, which is how screens read (spec: "Screens read only through
 * live queries on the local database").
 */
export const localDb: LocalDb = drizzle(openDatabaseSync('mizan.db', { enableChangeListener: true }), { schema });
migrate(localDb);

/** Every screen write goes through this (or a `src/data` helper that uses it). */
export const localStore = createLocalStore({ db: localDb, now: Date.now, randomBytes: getRandomBytes });
