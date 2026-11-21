import { and, count, countDistinct, eq, inArray, lte, sql } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import {
  OTHER_CATEGORY,
  SYNC_ENTITIES,
  otherCategoryId,
  uuidv7,
  type PulledChange,
  type PushedChange,
  type RandomBytes,
  type SyncEntity,
  type SyncFieldsByEntity,
  type SyncResponseData,
} from '@money-tracker/shared';
import { SYNCED_TABLES, deviceState, outbox } from './schema';
import type { LocalDb } from './types';

type Tx = Parameters<Parameters<LocalDb['transaction']>[0]>[0];
type Db = LocalDb | Tx;

/** The `device_state` key holding the `OnboardingState` (screens read it with a live query). */
export const ONBOARDING_STATE_KEY = 'onboarding';

const STATE = { accountId: 'accountId', cursor: 'cursor', onboarding: ONBOARDING_STATE_KEY } as const;

/**
 * Where this device's Account is with onboarding:
 * - `not_started`: show onboarding.
 * - `unreported`: finished here; the server hasn't been told yet (the sync engine tells it).
 * - `complete`: finished, and the server knows.
 */
export type OnboardingState = 'not_started' | 'unreported' | 'complete';

/** The columns every synced table shares; drizzle can't see them through the entity union. */
type SyncedTable = SQLiteTable & {
  id: SQLiteColumn;
};
const tableOf = (entity: SyncEntity): SyncedTable => SYNCED_TABLES[entity] as unknown as SyncedTable;

/** Inserts or replaces a whole row of a synced table. */
function upsertRow(db: Db, entity: SyncEntity, row: object): void {
  const table = tableOf(entity);
  db.insert(table).values(row as never).onConflictDoUpdate({ target: table.id as never, set: row as never }).run();
}

/** A record whose ID the caller already knows (a fixed or deterministic one). */
export type KnownRecord = { [E in SyncEntity]: { entity: E; id: string; fields: SyncFieldsByEntity[E] } }[SyncEntity];

export interface PendingPush {
  changes: PushedChange[];
  /** The newest outbox entry included; acknowledged when the server has stored the push. */
  upTo: number;
  /** More outbox entries are waiting than one push may carry. */
  hasMore: boolean;
}

export interface LocalStoreDeps {
  db: LocalDb;
  /** Device clock, Unix ms. */
  now: () => number;
  randomBytes: RandomBytes;
}

/**
 * The device's synced data: whose it is, the rows, the outbox and the cursor.
 * Screens write through it (each write and its outbox entry in one
 * transaction) and read the tables with live queries; the sync engine uses its
 * push and pull side. Ticket 06 extends `completeSync` with last edit wins and
 * deletion markers.
 */
export function createLocalStore({ db, now, randomBytes }: LocalStoreDeps) {
  function getState(key: string, tx: Db = db): string | null {
    return tx.select().from(deviceState).where(eq(deviceState.key, key)).get()?.value ?? null;
  }

  function setState(tx: Db, key: string, value: string): void {
    tx.insert(deviceState).values({ key, value }).onConflictDoUpdate({ target: deviceState.key, set: { value } }).run();
  }

  function wipe(tx: Db): void {
    SYNC_ENTITIES.forEach((entity) => tx.delete(tableOf(entity)).run());
    tx.delete(outbox).run();
    tx.delete(deviceState).run();
  }

  /** The Other Category is there before the first sync; the server's copy (same fixed ID) replaces it. */
  function ensureOtherCategory(tx: Db, accountId: string): void {
    const table = tableOf('category');
    const id = otherCategoryId(accountId);
    if (tx.select({ id: table.id }).from(table).where(eq(table.id, id)).get()) return;
    upsertRow(tx, 'category', { id, accountId, ...OTHER_CATEGORY, updatedAt: 0, deletedAt: null, serverVersion: 0 });
  }

  function requireAccount(tx: Db = db): string {
    const accountId = getState(STATE.accountId, tx);
    if (!accountId) throw new Error('No Account is signed in on this device');
    return accountId;
  }

  function putRows(tx: Db, records: readonly KnownRecord[]): void {
    const accountId = requireAccount(tx);
    const updatedAt = now();
    for (const { entity, id, fields } of records) {
      upsertRow(tx, entity, { ...fields, id, accountId, updatedAt, deletedAt: null, serverVersion: 0 });
      tx.insert(outbox).values({ entity, recordId: id, queuedAt: updatedAt }).run();
    }
  }

  return {
    /** The Account whose data is on this device, or null when it holds none. */
    accountId: (): string | null => getState(STATE.accountId),

    /**
     * Makes the device hold `accountId`'s data. If it held another Account's,
     * everything local (rows, outbox, cursor) is deleted first, so one
     * Account's records never show under another.
     */
    claimAccount(accountId: string, { onboardingCompleted = false }: { onboardingCompleted?: boolean } = {}): void {
      db.transaction((tx) => {
        if (getState(STATE.accountId, tx) !== accountId) {
          wipe(tx);
          setState(tx, STATE.accountId, accountId);
        }
        ensureOtherCategory(tx, accountId);
        if (onboardingCompleted) setState(tx, STATE.onboarding, 'complete');
      });
    },

    onboarding: (): OnboardingState => (getState(STATE.onboarding) as OnboardingState | null) ?? 'not_started',

    /**
     * Writes the onboarding records and marks onboarding finished on this
     * device, all at once. The server is told later (`onboardingReported`).
     */
    completeOnboarding(records: readonly KnownRecord[]): void {
      db.transaction((tx) => {
        putRows(tx, records);
        if (getState(STATE.onboarding, tx) !== 'complete') setState(tx, STATE.onboarding, 'unreported');
      });
    },

    /** The server has recorded onboarding for `accountId`. Ignored if another Account signed in meanwhile. */
    onboardingReported(accountId: string): void {
      db.transaction((tx) => {
        if (getState(STATE.accountId, tx) === accountId) setState(tx, STATE.onboarding, 'complete');
      });
    },

    /** Deletes every local record, unsynced ones included (sign-out). */
    wipe(): void {
      db.transaction((tx) => wipe(tx));
    },

    /** Creates a record with a new UUIDv7 and queues it for sync. Returns its ID. */
    create<E extends SyncEntity>(entity: E, fields: SyncFieldsByEntity[E]): string {
      const updatedAt = now();
      const id = uuidv7(updatedAt, randomBytes);
      db.transaction((tx) => {
        const accountId = requireAccount(tx);
        upsertRow(tx, entity, { ...fields, id, accountId, updatedAt, deletedAt: null, serverVersion: 0 });
        tx.insert(outbox).values({ entity, recordId: id, queuedAt: updatedAt }).run();
      });
      return id;
    },

    /**
     * Creates or replaces records with known IDs (deterministic ones, such as
     * `monthPlanId`) and queues them for sync, all at once. Two devices doing
     * this offline end up with one record each.
     */
    put(records: readonly KnownRecord[]): void {
      db.transaction((tx) => putRows(tx, records));
    },

    /** The server version this device has pulled up to (0 = never synced). */
    cursor: (): number => Number(getState(STATE.cursor) ?? 0),

    /** How many records have local changes not yet on the server. */
    pendingCount(): number {
      return db.select({ n: countDistinct(sql`${outbox.entity} || ':' || ${outbox.recordId}`) }).from(outbox).get()?.n ?? 0;
    },

    /** The current state of up to `limit` records with queued changes, oldest first. */
    pendingPush(limit: number): PendingPush {
      return db.transaction((tx) => {
        const entries = tx.select().from(outbox).orderBy(outbox.id).all();
        const keys = new Map<string, { entity: SyncEntity; recordId: string }>();
        let upTo = 0;
        for (const entry of entries) {
          const key = `${entry.entity}:${entry.recordId}`;
          if (!keys.has(key) && keys.size === limit) break;
          keys.set(key, entry);
          upTo = entry.id;
        }
        const changes: PushedChange[] = [];
        for (const entity of SYNC_ENTITIES) {
          const ids = [...keys.values()].filter((k) => k.entity === entity).map((k) => k.recordId);
          if (ids.length === 0) continue;
          const table = tableOf(entity);
          const rows = tx.select().from(table).where(inArray(table.id, ids)).all() as Record<string, unknown>[];
          for (const { accountId: _accountId, serverVersion: _serverVersion, ...record } of rows) {
            changes.push({ entity, record } as unknown as PushedChange);
          }
        }
        const total = tx.select({ n: count() }).from(outbox).where(lte(outbox.id, upTo)).get()?.n ?? 0;
        return { changes, upTo, hasMore: total < entries.length };
      });
    },

    /**
     * Records a finished sync: drops the outbox entries the server stored,
     * applies the pulled changes and saves the cursor, all at once. Ignored
     * (returns false) if a different Account signed in while the sync ran.
     * A pulled record that was edited here during the sync keeps the local
     * edit; it goes out with the next push.
     */
    completeSync(accountId: string, upTo: number, response: SyncResponseData): boolean {
      return db.transaction((tx) => {
        if (getState(STATE.accountId, tx) !== accountId) return false;
        tx.delete(outbox).where(lte(outbox.id, upTo)).run();
        for (const change of response.changes) applyPulled(tx, accountId, change);
        setState(tx, STATE.cursor, String(response.cursor));
        return true;
      });
    },
  };

  function applyPulled(tx: Db, accountId: string, { entity, record }: PulledChange): void {
    if (record.accountId !== accountId) return;
    const pending = tx
      .select({ id: outbox.id })
      .from(outbox)
      .where(and(eq(outbox.entity, entity), eq(outbox.recordId, record.id)))
      .get();
    if (pending) return; // ticket 06: last edit wins instead
    upsertRow(tx, entity, record);
  }
}

export type LocalStore = ReturnType<typeof createLocalStore>;
