import { and, count, countDistinct, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
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

const STATE = { accountId: 'accountId', cursor: 'cursor' } as const;

/** The columns every synced table shares; drizzle can't see them through the entity union. */
type SyncedTable = SQLiteTable & {
  id: SQLiteColumn;
  deletedAt: SQLiteColumn;
};
const tableOf = (entity: SyncEntity): SyncedTable => SYNCED_TABLES[entity] as unknown as SyncedTable;

/** Inserts or replaces a whole row of a synced table. */
function upsertRow(db: Db, entity: SyncEntity, row: object): void {
  const table = tableOf(entity);
  db.insert(table).values(row as never).onConflictDoUpdate({ target: table.id as never, set: row as never }).run();
}

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
 * push and pull side. A deletion keeps the row as a marker (ADR-0001), and
 * pulled copies are merged by last edit wins.
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

  function edit(entity: SyncEntity, id: string, changes: object): boolean {
    const updatedAt = now();
    const table = tableOf(entity);
    return db.transaction((tx) => {
      const live = tx
        .select({ id: table.id })
        .from(table)
        .where(and(eq(table.id, id), isNull(table.deletedAt)))
        .get();
      if (!live) return false;
      tx.update(table).set({ ...changes, updatedAt } as never).where(eq(table.id, id)).run();
      tx.insert(outbox).values({ entity, recordId: id, queuedAt: updatedAt }).run();
      return true;
    });
  }

  function requireAccount(tx: Db = db): string {
    const accountId = getState(STATE.accountId, tx);
    if (!accountId) throw new Error('No Account is signed in on this device');
    return accountId;
  }

  return {
    /** The Account whose data is on this device, or null when it holds none. */
    accountId: (): string | null => getState(STATE.accountId),

    /**
     * Makes the device hold `accountId`'s data. If it held another Account's,
     * everything local (rows, outbox, cursor) is deleted first, so one
     * Account's records never show under another.
     */
    claimAccount(accountId: string): void {
      db.transaction((tx) => {
        if (getState(STATE.accountId, tx) !== accountId) {
          wipe(tx);
          setState(tx, STATE.accountId, accountId);
        }
        ensureOtherCategory(tx, accountId);
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
     * Changes a record's fields and queues it for sync. Returns false (and
     * changes nothing) if the record doesn't exist or has been deleted.
     */
    update<E extends SyncEntity>(entity: E, id: string, changes: Partial<SyncFieldsByEntity[E]>): boolean {
      return edit(entity, id, changes);
    },

    /** Marks a record deleted (ADR-0001) and queues it for sync. False if it doesn't exist or is already deleted. */
    remove(entity: SyncEntity, id: string): boolean {
      return edit(entity, id, { deletedAt: now() });
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
     * Pulled copies are taken by last edit wins (see `applyPulled`).
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

  /**
   * Takes a pulled copy by the server's rules (ADR-0001). A record with no
   * local changes waiting takes the server's copy unless it's older than the
   * one held. A record edited here since the last push (during this sync)
   * keeps the local edit only if it is later and the pulled copy isn't a
   * deletion; otherwise the pulled copy replaces it and the waiting change is
   * dropped, since the server would refuse it anyway. Ties go to the server.
   */
  function applyPulled(tx: Db, accountId: string, { entity, record }: PulledChange): void {
    if (record.accountId !== accountId) return;
    const table = tableOf(entity) as SyncedTable & { updatedAt: SQLiteColumn; serverVersion: SQLiteColumn };
    const local = tx
      .select({ updatedAt: table.updatedAt, deletedAt: table.deletedAt, serverVersion: table.serverVersion })
      .from(table)
      .where(eq(table.id, record.id))
      .get() as { updatedAt: number; deletedAt: number | null; serverVersion: number } | undefined;
    const waiting = and(eq(outbox.entity, entity), eq(outbox.recordId, record.id));
    const pending = tx.select({ id: outbox.id }).from(outbox).where(waiting).get();

    if (!pending) {
      if (local && local.serverVersion > record.serverVersion) return;
      upsertRow(tx, entity, record);
      return;
    }
    const localWins = local && record.deletedAt == null && (local.deletedAt != null || local.updatedAt > record.updatedAt);
    if (localWins) return;
    upsertRow(tx, entity, record);
    tx.delete(outbox).where(waiting).run();
  }
}

export type LocalStore = ReturnType<typeof createLocalStore>;
