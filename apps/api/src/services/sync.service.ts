import type { Model } from 'mongoose';
import {
  MAX_PULLED_CHANGES,
  OTHER_CATEGORY,
  SYNC_ENTITIES,
  accountSettingsId,
  categoryBudgetId,
  monthPlanId,
  otherCategoryId,
  parsePushedChange,
  type PulledChange,
  type PushedChange,
  type SyncEntity,
  type SyncProblem,
  type SyncRequestBody,
  type SyncResponseData,
} from '@money-tracker/shared';
import { committedServerVersion, writeWithServerVersion } from '../models/counter.model';
import { Category, Jar, SYNCED_MODELS } from '../models/synced.model';
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

interface EntityRules {
  kidCanRead: boolean;
  kidCanWrite: boolean;
  references(change: PushedChange): Reference[];
  /** For records with a deterministic ID (spec, Data model): the only ID the record may have. */
  requiredId?(accountId: string, change: PushedChange): string;
  /** Jars the change uses, which must all belong to the given Kid Profile's wallet (spec, Data model). */
  walletJars?(change: PushedChange): { kidProfileId: string; jarIds: string[]; field: string } | null;
}

/**
 * Per-entity sync rules. Ticket 14 fills in what a Kid Session may read and
 * write (ADR-0002); the Kid Wallet entities add their references here.
 */
const RULES: { [E in SyncEntity]: EntityRules } = {
  accountSettings: { kidCanRead: false, kidCanWrite: false, references: () => [], requiredId: (accountId) => accountSettingsId(accountId) },
  category: { kidCanRead: false, kidCanWrite: false, references: () => [] },
  monthPlan: {
    kidCanRead: false,
    kidCanWrite: false,
    references: () => [],
    requiredId: (accountId, change) => (change.entity === 'monthPlan' ? monthPlanId(accountId, change.record.month) : ''),
  },
  categoryBudget: {
    kidCanRead: false,
    kidCanWrite: false,
    references: (change) =>
      change.entity === 'categoryBudget' ? [{ entity: 'category', id: change.record.categoryId, field: 'categoryId' }] : [],
    requiredId: (accountId, change) =>
      change.entity === 'categoryBudget' ? categoryBudgetId(accountId, change.record.month, change.record.categoryId) : '',
  },
  transaction: {
    kidCanRead: false,
    kidCanWrite: false,
    references: (change) =>
      change.entity === 'transaction' && change.record.categoryId
        ? [{ entity: 'category', id: change.record.categoryId, field: 'categoryId' }]
        : [],
  },
  kidProfile: { kidCanRead: false, kidCanWrite: false, references: () => [] },
  jar: {
    kidCanRead: false,
    kidCanWrite: false,
    references: (change) =>
      change.entity === 'jar' ? [{ entity: 'kidProfile', id: change.record.kidProfileId, field: 'kidProfileId' }] : [],
  },
  kidTransaction: {
    kidCanRead: false,
    kidCanWrite: false,
    references: (change) =>
      change.entity === 'kidTransaction'
        ? [{ entity: 'kidProfile', id: change.record.kidProfileId, field: 'kidProfileId' }]
        : [],
    walletJars: (change) =>
      change.entity === 'kidTransaction'
        ? { kidProfileId: change.record.kidProfileId, jarIds: change.record.splits.map((s) => s.jarId), field: 'splits' }
        : null,
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
    const nowMs = now().getTime();
    try {
      await writeWithServerVersion(nowMs, (serverVersion) =>
        Category.create({ _id: id, accountId, ...OTHER_CATEGORY, updatedAt: nowMs, deletedAt: null, serverVersion }),
      );
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

  /** A record with a deterministic ID must carry the one derived from its Account and fields. */
  function checkDerivedIds(accountId: string, changes: PushedChange[]): void {
    const problems: SyncProblem[] = [];
    changes.forEach((change, index) => {
      const required = RULES[change.entity].requiredId?.(accountId, change);
      if (required !== undefined && change.record.id !== required) {
        problems.push({ field: fieldOf(index, 'id'), message: `must be ${required} for this ${change.entity}` });
      }
    });
    if (problems.length > 0) throw new ValidationError(problems);
  }

  /**
   * Other always exists (spec): it can't be archived or deleted, and only the
   * Account's fixed Other ID may carry the Other flag.
   */
  function checkOtherCategory(accountId: string, changes: PushedChange[]): void {
    const problems: SyncProblem[] = [];
    const otherId = otherCategoryId(accountId);
    changes.forEach((change, index) => {
      if (change.entity !== 'category') return;
      const { id, isOther, archivedAt, deletedAt } = change.record;
      if (isOther !== (id === otherId)) {
        problems.push({ field: fieldOf(index, 'isOther'), message: `only ${otherId} is the Other Category` });
      } else if (isOther && archivedAt !== null) {
        problems.push({ field: fieldOf(index, 'archivedAt'), message: 'the Other Category can’t be archived' });
      } else if (isOther && deletedAt !== null) {
        problems.push({ field: fieldOf(index, 'deletedAt'), message: 'the Other Category can’t be deleted' });
      }
    });
    if (problems.length > 0) throw new ValidationError(problems);
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
   * Jars a Kid Transaction uses must be this Account's Jars of the same Kid
   * Profile, stored already or pushed in the same sync (the pushed copy wins).
   */
  async function checkWallets(accountId: string, changes: PushedChange[]): Promise<void> {
    const pushedJars = new Map<string, string>();
    for (const change of changes) if (change.entity === 'jar') pushedJars.set(change.record.id, change.record.kidProfileId);
    const problems: SyncProblem[] = [];
    for (const [index, change] of changes.entries()) {
      const wallet = RULES[change.entity].walletJars?.(change);
      if (!wallet) continue;
      const unknown = wallet.jarIds.filter((id) => !pushedJars.has(id));
      const stored = await Jar.find({ _id: { $in: unknown }, accountId }).lean<{ _id: string; kidProfileId: string }[]>();
      const owners = new Map([...stored.map((j) => [String(j._id), j.kidProfileId] as const), ...pushedJars]);
      if (wallet.jarIds.some((id) => owners.get(id) !== wallet.kidProfileId)) {
        problems.push({ field: fieldOf(index, wallet.field), message: "must name Jars of this Kid Profile's wallet" });
      }
    }
    if (problems.length > 0) throw new ValidationError(problems);
  }

  /**
   * Stores one change by last edit wins (ADR-0001). Returns null when the
   * change was stored, or the stored copy when the push lost, so the device
   * can be handed the winner. A deletion marker always wins: once stored it is
   * never cleared, and a deletion lands even on a copy edited later, so the
   * outcome doesn't depend on which device syncs first.
   */
  async function apply(accountId: string, { entity, record }: PushedChange): Promise<StoredRecord | null> {
    const { id, ...fields } = record;
    const model = modelOf(entity);
    // Another sync may write the same record between our read and write; then read again and redecide.
    let duplicate = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const stored = await model.findOne({ _id: id, accountId }).lean<StoredRecord>();
      let update: Record<string, unknown>;
      if (!stored || (stored.deletedAt == null && record.updatedAt > (stored.updatedAt as number))) update = fields;
      else if (stored.deletedAt == null && record.deletedAt != null) update = { deletedAt: record.deletedAt };
      else return stored;

      try {
        const written = await writeWithServerVersion(now().getTime(), async (serverVersion) => {
          if (!stored) {
            await model.create({ ...update, _id: id, accountId, serverVersion });
            return true;
          }
          const result = await model.updateOne(
            { _id: id, accountId, serverVersion: stored.serverVersion },
            { $set: { ...update, serverVersion } },
          );
          return result.matchedCount === 1;
        });
        if (written) return null;
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        // Created meanwhile, by this Account's other device or (ownership check races) another Account.
        duplicate = true;
      }
    }
    if (duplicate) throw new ForbiddenError('A pushed record belongs to another Account');
    throw new Error(`Sync could not store ${entity} ${id}: other syncs kept changing it`);
  }

  /** Up to `limit` changes after `cursor`, oldest first. */
  async function pull(auth: AuthContext, cursor: number, limit: number): Promise<SyncResponseData> {
    // Stop below any version still being written, or a late commit would fall behind the cursor.
    const committed = await committedServerVersion(now().getTime());
    const readable = SYNC_ENTITIES.filter((entity) => auth.scope === 'full' || RULES[entity].kidCanRead);
    const batches = await Promise.all(
      readable.map(async (entity) => {
        const stored = await modelOf(entity)
          .find({ accountId: auth.accountId, serverVersion: { $gt: cursor, $lte: committed } })
          .sort({ serverVersion: 1 })
          .limit(limit + 1)
          .lean<StoredRecord[]>();
        return stored.map((record) => toPulled(entity, record));
      }),
    );
    const all = batches.flat().sort((a, b) => a.record.serverVersion - b.record.serverVersion);
    const changes = all.slice(0, limit);
    const hasMore = all.length > limit;
    // Versions are unique, so the last one sent is a clean place to resume.
    return { cursor: hasMore ? changes.at(-1)!.record.serverVersion : Math.max(cursor, committed), changes, hasMore };
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
      checkDerivedIds(auth.accountId, changes);
      checkOtherCategory(auth.accountId, changes);
      await checkOwnership(auth.accountId, ordered);
      await checkReferences(auth.accountId, changes);
      await checkWallets(auth.accountId, changes);
      const lost: PulledChange[] = [];
      for (const change of ordered) {
        const winner = await apply(auth.accountId, change);
        if (winner) lost.push(toPulled(change.entity, winner));
      }

      const pulled = await pull(auth, body.cursor, body.limit ?? MAX_PULLED_CHANGES);
      // A device whose push lost may already be past the winner's version; hand it over anyway.
      const inPull = new Set(pulled.changes.map((c) => `${c.entity}:${c.record.id}`));
      const winners = lost.filter((c) => !inPull.has(`${c.entity}:${c.record.id}`));
      return { ...pulled, changes: [...winners, ...pulled.changes] };
    },
  };
}

export type SyncService = ReturnType<typeof createSyncService>;
