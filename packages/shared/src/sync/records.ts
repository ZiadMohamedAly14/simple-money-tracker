import type { NumberingSystem } from '../i18n/language';
import { isCategoryIconName } from '../budget/categoryIcon';
import { topUpSplitProblem } from '../kid/topUpSplit';
import { isUuid } from './ids';

/**
 * The sync contract (ADR-0001, ADR-0007). Every synced record has device-made
 * metadata (`SyncMeta`) and, once the server has it, server-made metadata
 * (`ServerMeta`). To add a synced entity: add its fields to `SyncFieldsByEntity`,
 * its name to `SYNC_ENTITIES` (in dependency order: referenced entities first),
 * and a field parser to `FIELD_PARSERS`.
 */
export const SYNC_ENTITIES = [
  'accountSettings',
  'category',
  'monthPlan',
  'categoryBudget',
  'transaction',
  'kidProfile',
  'jar',
  'kidTransaction',
] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

/** Set by the device. Times are Unix milliseconds from the device's clock. */
export interface SyncMeta {
  /** UUIDv7 made on the device (ADR-0006), or a fixed ID (see `otherCategoryId`). */
  id: string;
  /** The device's last-edit time; decides conflicts (ticket 06). */
  updatedAt: number;
  /** Deletion marker: set instead of deleting the record (ADR-0001). */
  deletedAt: number | null;
}

/** Set by the server; never trusted from a device. */
export interface ServerMeta {
  accountId: string;
  /** From the server's atomic counter; what the sync cursor counts (ADR-0007). */
  serverVersion: number;
}

/** One per Account, ID `accountSettingsId(accountId)`. Kid Wallets use the same currency. */
export interface AccountSettingsFields {
  /** ISO 4217 code. Changing it relabels amounts; nothing is converted (spec). */
  currency: string;
  numberingSystem: NumberingSystem;
}

/** Longest Category name, in UTF-16 code units. */
export const CATEGORY_NAME_MAX_LENGTH = 60;

export interface CategoryFields {
  name: string;
  order: number;
  /** The Other Category: always exists, can't be archived. Shown by its translated name. */
  isOther: boolean;
  archivedAt: number | null;
  /**
   * The app icon it shows (`app:<icon>`), a short kebab-case name; any such
   * name is accepted, so a newer app's icon syncs. Null on records made before
   * icons synced (the app falls back to its old mapping). Other always shows
   * `other`, whatever this says.
   */
  icon: string | null;
}

/** The Other Category's fields. Its ID is `otherCategoryId(accountId)`; it sorts last. */
export const OTHER_CATEGORY: CategoryFields = { name: 'Other', order: 9999, isOther: true, archivedAt: null, icon: 'other' };

/** One per Account and Month, ID `monthPlanId(accountId, month)`, so two offline devices make one record. */
export interface MonthPlanFields {
  /** `YYYY-MM`. */
  month: string;
  /** In minor units; 0 or more. */
  expectedIncome: number;
}

/** One per Account, Month and Category, ID `categoryBudgetId(accountId, month, categoryId)`. No record means 0. */
export interface CategoryBudgetFields {
  month: string;
  categoryId: string;
  /** In minor units; 0 or more. */
  amount: number;
}

export type TransactionKind = 'income' | 'expense';

export interface TransactionFields {
  kind: TransactionKind;
  /** Positive, in the currency's smallest unit (ADR-0004). */
  amount: number;
  /** Required for an Expense; null for Income. */
  categoryId: string | null;
  /** Local calendar date `YYYY-MM-DD`; decides the Month. Never converted between time zones. */
  date: string;
  note: string | null;
}

/** A child under the Account (GLOSSARY). Owns one Kid Wallet: its Jars and Kid Transactions. */
export interface KidProfileFields {
  name: string;
  /** Unused: the avatar is the name's first letter, and this app always writes null. Kept so older records and apps still sync. */
  avatar: string | null;
  archivedAt: number | null;
}

/**
 * A Jar of a Kid Wallet. The three default Jars have IDs from `defaultJarId`
 * so the app knows which is Spend (the default split and rounding remainder go there).
 */
export interface JarFields {
  kidProfileId: string;
  name: string;
  order: number;
  /** An archived Jar is hidden from new Top-ups but keeps its balance and history. */
  archivedAt: number | null;
}

/** Top-up (parent adds money), Kid Expense (kid spends from a Jar), Jar Transfer (parent moves money between Jars). */
export const KID_TRANSACTION_KINDS = ['topUp', 'kidExpense', 'jarTransfer'] as const;
export type KidTransactionKind = (typeof KID_TRANSACTION_KINDS)[number];

/** One Jar's share of a Top-up, in minor units. */
export interface JarSplit {
  jarId: string;
  amount: number;
}

export interface KidTransactionFields {
  kidProfileId: string;
  kind: KidTransactionKind;
  /** Positive, in minor units. For a Top-up, its splits add up to exactly this. */
  amount: number;
  /** A Top-up's split across Jars of the same Kid Wallet: each positive, each Jar once. Empty for the other kinds. */
  splits: JarSplit[];
  /** The Jar the money comes out of: a Kid Expense's Jar, or a Jar Transfer's source. Null for a Top-up. */
  jarId: string | null;
  /** A Jar Transfer's target Jar. Null for the other kinds. */
  toJarId: string | null;
  /** Local calendar date `YYYY-MM-DD`. */
  date: string;
  note: string | null;
}

export interface SyncFieldsByEntity {
  accountSettings: AccountSettingsFields;
  category: CategoryFields;
  monthPlan: MonthPlanFields;
  categoryBudget: CategoryBudgetFields;
  transaction: TransactionFields;
  kidProfile: KidProfileFields;
  jar: JarFields;
  kidTransaction: KidTransactionFields;
}

export type PushedRecord<E extends SyncEntity> = SyncMeta & SyncFieldsByEntity[E];
export type PulledRecord<E extends SyncEntity> = PushedRecord<E> & ServerMeta;

export type PushedChange = { [E in SyncEntity]: { entity: E; record: PushedRecord<E> } }[SyncEntity];
export type PulledChange = { [E in SyncEntity]: { entity: E; record: PulledRecord<E> } }[SyncEntity];

/** `POST /sync` body: the device's changes, and the cursor it pulled up to last time (0 = never). */
export interface SyncRequestBody {
  cursor: number;
  changes: PushedChange[];
  /** Most changes to pull in this round trip (1 to `MAX_PULLED_CHANGES`, the default). */
  limit?: number;
}

/**
 * `POST /sync` data: the changes after the request's cursor (including the
 * ones just pushed), oldest first, up to the page size. When `hasMore` is
 * true, sync again from `cursor` for the next page. It may also hold the
 * current copy of a record whose push lost (last edit wins), even if the
 * device's cursor is past it.
 */
export interface SyncResponseData {
  cursor: number;
  changes: PulledChange[];
  hasMore: boolean;
}

/** Most changes one `POST /sync` may push. */
export const MAX_PUSHED_CHANGES = 500;

/** Most changes one `POST /sync` pulls; a device catching up takes several round trips. */
export const MAX_PULLED_CHANGES = 500;

export interface SyncProblem {
  field: string;
  message: string;
}

export type ParseResult = { ok: true; change: PushedChange } | { ok: false; problems: SyncProblem[] };

type Fields = Record<string, unknown>;

/** Reads fields one by one, collecting problems instead of stopping at the first. */
class FieldReader {
  readonly problems: SyncProblem[] = [];
  constructor(private readonly source: Fields) {}

  private fail<T>(field: string, message: string, fallback: T): T {
    this.problems.push({ field, message });
    return fallback;
  }

  uuid(field: string): string {
    const value = this.source[field];
    return isUuid(value) ? value : this.fail(field, 'must be a lowercase UUID', '');
  }

  time(field: string): number {
    const value = this.source[field];
    return Number.isSafeInteger(value) && (value as number) >= 0
      ? (value as number)
      : this.fail(field, 'must be a time in milliseconds', 0);
  }

  optionalTime(field: string): number | null {
    return this.source[field] === null || this.source[field] === undefined ? null : this.time(field);
  }

  integer(field: string): number {
    const value = this.source[field];
    return Number.isSafeInteger(value) ? (value as number) : this.fail(field, 'must be a whole number', 0);
  }

  positiveAmount(field: string): number {
    const value = this.source[field];
    return Number.isSafeInteger(value) && (value as number) > 0
      ? (value as number)
      : this.fail(field, 'must be a positive whole number of minor units', 0);
  }

  nonNegativeAmount(field: string): number {
    const value = this.source[field];
    return Number.isSafeInteger(value) && (value as number) >= 0
      ? (value as number)
      : this.fail(field, 'must be a whole number of minor units, 0 or more', 0);
  }

  month(field: string): string {
    const value = this.source[field];
    return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
      ? value
      : this.fail(field, 'must be a Month YYYY-MM', '');
  }

  currency(field: string): string {
    const value = this.source[field];
    return typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : this.fail(field, 'must be an ISO 4217 code', '');
  }

  text(field: string, maxLength: number): string {
    const value = this.source[field];
    return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
      ? value
      : this.fail(field, `must be text of 1 to ${maxLength} characters`, '');
  }

  optionalText(field: string, maxLength: number): string | null {
    const value = this.source[field];
    if (value === null || value === undefined) return null;
    return typeof value === 'string' && value.length <= maxLength
      ? value
      : this.fail(field, `must be at most ${maxLength} characters`, null);
  }

  /** A Category icon name (`isCategoryIconName`), or null when absent. */
  optionalIconName(field: string): string | null {
    const value = this.source[field];
    if (value === null || value === undefined) return null;
    return isCategoryIconName(value) ? value : this.fail(field, 'must be a short kebab-case icon name', null);
  }

  boolean(field: string): boolean {
    const value = this.source[field];
    return typeof value === 'boolean' ? value : this.fail(field, 'must be true or false', false);
  }

  oneOf<T extends string>(field: string, options: readonly T[]): T {
    const value = this.source[field];
    return options.includes(value as T) ? (value as T) : this.fail(field, `must be one of ${options.join(', ')}`, options[0]!);
  }

  /** A list of `{ jarId, amount }`, keeping only those fields. Amounts are checked with the total. */
  splits(field: string): JarSplit[] {
    const value = this.source[field];
    if (!Array.isArray(value) || value.length > MAX_SPLITS) return this.fail(field, `must be a list of up to ${MAX_SPLITS} Jar shares`, []);
    const splits = value.map((item) => (typeof item === 'object' && item !== null ? (item as Fields) : {}));
    if (splits.some((split) => !isUuid(split.jarId))) return this.fail(field, 'each share must name a Jar by its UUID', []);
    return splits.map((split) => ({ jarId: split.jarId as string, amount: split.amount as number }));
  }

  localDate(field: string): string {
    const value = this.source[field];
    return isLocalDate(value) ? value : this.fail(field, 'must be a date YYYY-MM-DD', '');
  }

  problem(field: string, message: string): void {
    this.problems.push({ field, message });
  }
}

/** Most Jars one Top-up may be split across. */
const MAX_SPLITS = 20;

function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const FIELD_PARSERS: { [E in SyncEntity]: (read: FieldReader) => SyncFieldsByEntity[E] } = {
  accountSettings: (read) => ({
    currency: read.currency('currency'),
    numberingSystem: read.oneOf('numberingSystem', ['western', 'arabic-indic'] as const),
  }),
  monthPlan: (read) => ({ month: read.month('month'), expectedIncome: read.nonNegativeAmount('expectedIncome') }),
  categoryBudget: (read) => ({
    month: read.month('month'),
    categoryId: read.uuid('categoryId'),
    amount: read.nonNegativeAmount('amount'),
  }),
  category: (read) => ({
    name: read.text('name', CATEGORY_NAME_MAX_LENGTH),
    order: read.integer('order'),
    isOther: read.boolean('isOther'),
    archivedAt: read.optionalTime('archivedAt'),
    icon: read.optionalIconName('icon'),
  }),
  transaction: (read) => {
    const kind = read.oneOf('kind', ['income', 'expense'] as const);
    const amount = read.positiveAmount('amount');
    const categoryId = kind === 'expense' ? read.uuid('categoryId') : null;
    return { kind, amount, categoryId, date: read.localDate('date'), note: read.optionalText('note', 500) };
  },
  kidProfile: (read) => ({
    name: read.text('name', 40),
    avatar: read.optionalText('avatar', 16),
    archivedAt: read.optionalTime('archivedAt'),
  }),
  jar: (read) => ({
    kidProfileId: read.uuid('kidProfileId'),
    name: read.text('name', 40),
    order: read.integer('order'),
    archivedAt: read.optionalTime('archivedAt'),
  }),
  kidTransaction: (read) => {
    const kidProfileId = read.uuid('kidProfileId');
    const kind = read.oneOf('kind', KID_TRANSACTION_KINDS);
    const amount = read.positiveAmount('amount');
    let splits: JarSplit[] = [];
    let jarId: string | null = null;
    let toJarId: string | null = null;
    if (kind === 'topUp') {
      splits = read.splits('splits');
      if (amount > 0 && read.problems.every((p) => p.field !== 'splits')) {
        const problem = topUpSplitProblem(amount, splits);
        if (problem) read.problem('splits', problem);
      }
    } else {
      jarId = read.uuid('jarId');
      if (kind === 'jarTransfer') {
        toJarId = read.uuid('toJarId');
        if (jarId && toJarId === jarId) read.problem('toJarId', 'must be a different Jar from jarId');
      }
    }
    return { kidProfileId, kind, amount, splits, jarId, toJarId, date: read.localDate('date'), note: read.optionalText('note', 500) };
  },
};

const isSyncEntity = (value: unknown): value is SyncEntity => SYNC_ENTITIES.includes(value as SyncEntity);

/**
 * Checks one pushed change's shape and keeps only the fields the contract
 * knows. Ownership, references and scope need the database; the API checks those.
 */
export function parsePushedChange(input: unknown): ParseResult {
  const change = (typeof input === 'object' && input !== null ? input : {}) as Fields;
  if (!isSyncEntity(change.entity)) {
    return { ok: false, problems: [{ field: 'entity', message: `must be one of ${SYNC_ENTITIES.join(', ')}` }] };
  }
  const source = (typeof change.record === 'object' && change.record !== null ? change.record : {}) as Fields;
  const read = new FieldReader(source);
  const meta: SyncMeta = { id: read.uuid('id'), updatedAt: read.time('updatedAt'), deletedAt: read.optionalTime('deletedAt') };
  const fields = FIELD_PARSERS[change.entity](read);
  if (change.entity === 'transaction' && source.kind === 'income' && source.categoryId != null) {
    read.problem('categoryId', 'Income has no Category');
  }
  if (read.problems.length > 0) return { ok: false, problems: read.problems };
  return { ok: true, change: { entity: change.entity, record: { ...meta, ...fields } } as PushedChange };
}
