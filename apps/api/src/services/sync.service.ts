import type { Model } from 'mongoose';
import {
  OTHER_CATEGORY,
  SYNC_ENTITIES,
  otherCategoryId,
  parsePushedChange,
  type PulledChange,
  type PushedChange,
  type SyncEntity,
  type SyncProblem,
  type SyncRequestBody,
  type SyncResponseData,
} from '@money-tracker/shared';
import { nextServerVersion } from '../models/counter.model';
import { Category, SYNCED_MODELS } from '../models/synced.model';
import type { AuthContext } from './token.service';
import { ForbiddenError, ValidationError } from '../utils/AppError';
import type { Clock } from '../utils/clock';

/** A stored synced record, as `lean()` returns it. */
type StoredRecord = Record<string, unknown> & { _id: string; accountId: { toString(): string }; serverVersion: number };
type SyncedModel = Model<StoredRecord>;

const modelOf = (entity: SyncEntity): SyncedModel => SYNCED_MODELS[entity] as unknown as SyncedModel;

interface Reference {
  entity: SyncEntity;
  id: string;
  field: string;
}

/**
 * Per-entity sync rules. Ticket 14 fills in what a Kid Session may read and
 * write (ADR-0002); the Kid Wallet entities add their references here.
 */
const RULES: { [E in SyncEntity]: { kidCanRead: boolean; kidCanWrite: boolean; references(change: PushedChange): Reference[] } } = {
  category: { kidCanRead: false, kidCanWrite: false, references: () => [] },
  transaction: {
    kidCanRead: false,
    kidCanWrite: false,
    references: (change) =>
      change.entity === 'transaction' && change.record.categoryId
        ? [{ entity: 'category', id: change.record.categoryId, field: 'categoryId' }]
        : [],
  },
};

const isDuplicateKey = (error: unknown): boolean => (error as { code?: unknown }).code === 11000;

function toPulled(entity: SyncEntity, stored: StoredRecord): PulledChange {
  const { _id, accountId, ...rest } = stored;
  return { entity, record: { ...rest, id: _id, accountId: accountId.toString() } } as PulledChange;
}

/**
 * The single sync endpoint (ADR-0007): push the device's changes, then pull
 * every change after its cursor. Writes are stamped with the next value of an
 * atomic counter, and that server version is the cursor.
 */
export function createSyncService({ now }: { now: Clock }) {
  /** The Other Category exists for every Account (spec); created on the Account's first sync. */
  async function ensureOtherCategory(accountId: string): Promise<void> {
    const id = otherCategoryId(accountId);
    if (await Category.exists({ _id: id })) return;
    try {
      await Category.create({
        _id: id,
        accountId,
        ...OTHER_CATEGORY,
        updatedAt: now().getTime(),
        deletedAt: null,
        serverVersion: await nextServerVersion(),
      });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error; // another device's sync created it first
    }
  }

  function parseAll(changes: unknown[]): PushedChange[] {
    const problems: SyncProblem[] = [];
    const parsed: PushedChange[] = [];
    changes.forEach((input, index) => {
      const result = parsePushedChange(input);
      if (result.ok) parsed.push(result.change);
      else problems.push(...result.problems.map((p) => ({ ...p, field: fieldOf(index, p.field) })));
    });
    if (problems.length > 0) throw new ValidationError(problems);
    return parsed;
  }

  const fieldOf = (index: number, field: string): string =>
    field === 'entity' ? `changes[${index}].entity` : `changes[${index}].record.${field}`;

  /** Every pushed ID must be new or already this Account's. */
  async function checkOwnership(accountId: string, changes: PushedChange[]): Promise<void> {
    for (const entity of SYNC_ENTITIES) {
      const ids = changes.filter((c) => c.entity === entity).map((c) => c.record.id);
      if (ids.length === 0) continue;
      const foreign = await modelOf(entity).exists({ _id: { $in: ids }, accountId: { $ne: accountId } });
      if (foreign) throw new ForbiddenError('A pushed record belongs to another Account');
    }
  }

  /** References must point at this Account's records, stored already or pushed in the same sync. */
  async function checkReferences(accountId: string, changes: PushedChange[]): Promise<void> {
    const pushed = new Set(changes.map((c) => `${c.entity}:${c.record.id}`));
    const problems: SyncProblem[] = [];
    for (const [index, change] of changes.entries()) {
      for (const ref of RULES[change.entity].references(change)) {
        if (pushed.has(`${ref.entity}:${ref.id}`)) continue;
        if (await modelOf(ref.entity).exists({ _id: ref.id, accountId })) continue;
        problems.push({ field: fieldOf(index, ref.field), message: `must be one of this Account's ${ref.entity} records` });
      }
    }
    if (problems.length > 0) throw new ValidationError(problems);
  }

  /**
   * Stores one change with a fresh server version. Ticket 06 adds conflict
   * resolution here (keep the stored copy when its `updatedAt` is later, and
   * never let an older copy clear a deletion marker).
   */
  async function apply(accountId: string, { entity, record }: PushedChange): Promise<void> {
    const { id, ...fields } = record;
    const serverVersion = await nextServerVersion();
    try {
      await modelOf(entity).updateOne(
        { _id: id, accountId },
        { $set: { ...fields, accountId, serverVersion } },
        { upsert: true },
      );
    } catch (error) {
      if (isDuplicateKey(error)) throw new ForbiddenError('A pushed record belongs to another Account');
      throw error;
    }
  }

  async function pull(auth: AuthContext, cursor: number): Promise<SyncResponseData> {
    const readable = SYNC_ENTITIES.filter((entity) => auth.scope === 'full' || RULES[entity].kidCanRead);
    const batches = await Promise.all(
      readable.map(async (entity) => {
        const stored = await modelOf(entity)
          .find({ accountId: auth.accountId, serverVersion: { $gt: cursor } })
          .lean<StoredRecord[]>();
        return stored.map((record) => toPulled(entity, record));
      }),
    );
    const changes = batches.flat().sort((a, b) => a.record.serverVersion - b.record.serverVersion);
    return { cursor: changes.at(-1)?.record.serverVersion ?? cursor, changes };
  }

  return {
    async sync(auth: AuthContext, body: SyncRequestBody): Promise<SyncResponseData> {
      const changes = parseAll(body.changes);
      if (auth.scope !== 'full' && changes.some((c) => !RULES[c.entity].kidCanWrite)) {
        throw new ForbiddenError('A Kid Session cannot change these records');
      }
      if (auth.scope === 'full') await ensureOtherCategory(auth.accountId);

      // Referenced entities first, so a Category is stored before its Expenses.
      const ordered = [...changes].sort((a, b) => SYNC_ENTITIES.indexOf(a.entity) - SYNC_ENTITIES.indexOf(b.entity));
      await checkOwnership(auth.accountId, ordered);
      await checkReferences(auth.accountId, changes);
      for (const change of ordered) await apply(auth.accountId, change);

      return pull(auth, body.cursor);
    },
  };
}

export type SyncService = ReturnType<typeof createSyncService>;
