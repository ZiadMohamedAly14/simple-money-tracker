import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import {
  DEFAULT_JAR_KEYS,
  defaultJarId,
  jarBalances,
  suggestTopUpSplit,
  topUpSplitProblem,
  type CurrencyCode,
  type DefaultCategoryKey,
  type DefaultJarKey,
  type JarSplit,
} from '@money-tracker/shared';
import type { KnownRecord, LocalStore } from '@/db/localStore';
import { jars, kidProfiles, kidTransactions, type JarRow, type KidTransactionRow } from '@/db/schema';
import type { LocalDb } from '@/db/types';
import { accountBasics } from './budget';

/**
 * The Kid Wallet from the parent's side (ticket 12): Kid Profiles, their
 * Jars and Top-ups. Every write is local first and syncs on its own, so all
 * of it works offline on the parent's phone (spec, story 47).
 */

function requireAccount(store: LocalStore): string {
  const accountId = store.accountId();
  if (!accountId) throw new Error('No Account is signed in on this device');
  return accountId;
}

export interface NewKidProfile {
  name: string;
  /** One of `KID_AVATARS`, or null for the name's initial. */
  avatar: string | null;
  /** The default Jars' names in the device language (from the `kid.jars` strings). */
  jarNames: Record<DefaultJarKey, string>;
}

/** The avatars a parent can pick for a Kid Profile. */
export const KID_AVATARS = ['🦊', '🐼', '🦁', '🐸', '🐙', '🦄', '🐢', '🚀'] as const;

function kidProfileRecords(accountId: string, id: string, { name, avatar, jarNames }: NewKidProfile): KnownRecord[] {
  return [
    { entity: 'kidProfile', id, fields: { name: name.trim(), avatar, archivedAt: null } },
    ...DEFAULT_JAR_KEYS.map(
      (key, order): KnownRecord => ({
        entity: 'jar',
        id: defaultJarId(accountId, id, key),
        fields: { kidProfileId: id, name: jarNames[key], order, archivedAt: null },
      }),
    ),
  ];
}

/** Creates a Kid Profile with Save, Spend and Give Jars, all at once. Returns its ID. */
export function createKidProfile(store: LocalStore, kid: NewKidProfile): string {
  const accountId = requireAccount(store);
  const id = store.newId();
  store.put(kidProfileRecords(accountId, id, kid));
  return id;
}

export interface KidOnboarding {
  currency: CurrencyCode;
  /** Each default Category's name in the device language. */
  categoryNames: Record<DefaultCategoryKey, string>;
  kid: NewKidProfile;
}

/**
 * Finishes the kid onboarding path on this device: the Account's currency,
 * the default Categories (so the Personal Budget is ready for later) and the
 * first Kid Profile with its Jars. The Parent PIN and the optional first
 * Top-up come after. Returns the Kid Profile's ID.
 */
export function completeKidOnboarding(store: LocalStore, { currency, categoryNames, kid }: KidOnboarding): string {
  const accountId = requireAccount(store);
  const id = store.newId();
  store.completeOnboarding([...accountBasics(accountId, currency, categoryNames), ...kidProfileRecords(accountId, id, kid)]);
  return id;
}

/** Adds a Jar to a Kid Wallet after the existing ones. Returns its ID. */
export function addJar(store: LocalStore, kidProfileId: string, name: string, order: number): string {
  return store.create('jar', { kidProfileId, name: name.trim(), order, archivedAt: null });
}

export function renameJar(store: LocalStore, jarId: string, name: string): boolean {
  return store.update('jar', jarId, { name: name.trim() });
}

/** Hides a Jar from new Top-ups. Its balance and history stay (GLOSSARY). */
export function archiveJar(store: LocalStore, jarId: string): boolean {
  return store.update('jar', jarId, (now) => ({ archivedAt: now }));
}

export interface NewTopUp {
  kidProfileId: string;
  /** Positive, in minor units. */
  amount: number;
  /** Must add up to `amount`; each share positive, each Jar once. */
  splits: JarSplit[];
  /** Local calendar date `YYYY-MM-DD`. */
  date: string;
  note?: string | null;
}

export type TopUpResult = { status: 'ok'; id: string } | { status: 'invalid_split'; problem: string };

const cleanSplits = (splits: readonly JarSplit[]): JarSplit[] => splits.map(({ jarId, amount }) => ({ jarId, amount }));

/**
 * Saves a Top-up locally and queues it for sync. A split that doesn't add up
 * is refused here (and again by the server), and nothing is saved.
 */
export function addTopUp(store: LocalStore, { kidProfileId, amount, splits, date, note = null }: NewTopUp): TopUpResult {
  const problem = topUpSplitProblem(amount, splits);
  if (problem) return { status: 'invalid_split', problem };
  const id = store.create('kidTransaction', { kidProfileId, kind: 'topUp', amount, splits: cleanSplits(splits), date, note });
  return { status: 'ok', id };
}

export type TopUpChanges = Partial<Pick<NewTopUp, 'amount' | 'splits' | 'date' | 'note'>>;

/**
 * Changes a Top-up (parents only). Changing the amount needs a split that
 * adds up to the new amount. `deleted` if it's gone (deleted, maybe on another device).
 */
export function editTopUp(
  store: LocalStore,
  db: LocalDb,
  id: string,
  changes: TopUpChanges,
): TopUpResult | { status: 'deleted' } {
  const current = db
    .select()
    .from(kidTransactions)
    .where(and(eq(kidTransactions.id, id), isNull(kidTransactions.deletedAt)))
    .get();
  if (!current) return { status: 'deleted' };
  const amount = changes.amount ?? current.amount;
  const splits = changes.splits ?? current.splits;
  const problem = topUpSplitProblem(amount, splits);
  if (problem) return { status: 'invalid_split', problem };
  const saved = store.update('kidTransaction', id, { ...changes, amount, splits: cleanSplits(splits) });
  return saved ? { status: 'ok', id } : { status: 'deleted' };
}

/** Deletes a Top-up: it stays as a deletion marker so the deletion syncs (ADR-0001). */
export function deleteTopUp(store: LocalStore, id: string): boolean {
  return store.remove('kidTransaction', id);
}

/** Live-queryable: Kid Profiles that aren't archived, oldest first. */
export function kidProfilesQuery(db: LocalDb) {
  return db
    .select()
    .from(kidProfiles)
    .where(and(isNull(kidProfiles.deletedAt), isNull(kidProfiles.archivedAt)))
    .orderBy(asc(kidProfiles.id));
}

/** Live-queryable: one Kid Profile. */
export function kidProfileQuery(db: LocalDb, id: string) {
  return db
    .select()
    .from(kidProfiles)
    .where(and(eq(kidProfiles.id, id), isNull(kidProfiles.deletedAt)));
}

/** Live-queryable: a Kid Wallet's Jars, archived ones included, in display order. */
export function jarsQuery(db: LocalDb, kidProfileId: string) {
  return db
    .select()
    .from(jars)
    .where(and(eq(jars.kidProfileId, kidProfileId), isNull(jars.deletedAt)))
    .orderBy(asc(jars.order), asc(jars.id));
}

/** Live-queryable: every Jar of every Kid Wallet (the Parent Area's list of kids with totals). */
export function allJarsQuery(db: LocalDb) {
  return db.select().from(jars).where(isNull(jars.deletedAt)).orderBy(asc(jars.order), asc(jars.id));
}

/** Live-queryable: a Kid Wallet's Kid Transactions, newest first. */
export function kidTransactionsQuery(db: LocalDb, kidProfileId: string) {
  return db
    .select()
    .from(kidTransactions)
    .where(and(eq(kidTransactions.kidProfileId, kidProfileId), isNull(kidTransactions.deletedAt)))
    .orderBy(desc(kidTransactions.date), desc(kidTransactions.id));
}

/** Live-queryable: every live Kid Transaction (the Parent Area's totals). */
export function allKidTransactionsQuery(db: LocalDb) {
  return db.select().from(kidTransactions).where(isNull(kidTransactions.deletedAt));
}

export interface WalletJar {
  id: string;
  name: string;
  /** Which default Jar this is (decides its color), or null for one the parent added. */
  key: DefaultJarKey | null;
  archived: boolean;
  /** Worked out from the Kid Transactions; may be negative after sync (ticket 13). */
  balance: number;
}

export interface Wallet {
  /** Live Jars in order, then archived Jars that still hold money. */
  jars: WalletJar[];
  total: number;
}

/** Which default Jar `jarId` is, if any. */
export function defaultJarKeyOf(accountId: string | null, kidProfileId: string, jarId: string): DefaultJarKey | null {
  if (!accountId) return null;
  return DEFAULT_JAR_KEYS.find((key) => defaultJarId(accountId, kidProfileId, key) === jarId) ?? null;
}

/** A Kid Wallet's Jars with balances, from the live queries above. */
export function walletOf(
  accountId: string | null,
  jarRows: readonly JarRow[],
  transactions: readonly Pick<KidTransactionRow, 'kind' | 'amount' | 'splits'>[],
): Wallet {
  const balances = jarBalances(
    jarRows.map((jar) => jar.id),
    transactions,
  );
  const toWalletJar = (jar: JarRow): WalletJar => ({
    id: jar.id,
    name: jar.name,
    key: defaultJarKeyOf(accountId, jar.kidProfileId, jar.id),
    archived: jar.archivedAt !== null,
    balance: balances[jar.id] ?? 0,
  });
  const live = jarRows.filter((jar) => jar.archivedAt === null).map(toWalletJar);
  const archived = jarRows.filter((jar) => jar.archivedAt !== null).map(toWalletJar).filter((jar) => jar.balance !== 0);
  const total = Object.values(balances).reduce((sum, balance) => sum + balance, 0);
  return { jars: [...live, ...archived], total };
}

/** The Jars a new Top-up can go into: the live ones, in order. */
export const topUpJarsOf = (jarRows: readonly JarRow[]): JarRow[] => jarRows.filter((jar) => jar.archivedAt === null);

/**
 * The split a new Top-up of `total` starts with: the most recent Top-up's
 * proportions (it syncs, so every parent device remembers the same), or all
 * Spend when there is none (spec, story 42).
 */
export function suggestedSplitOf(
  accountId: string,
  kidProfileId: string,
  jarRows: readonly JarRow[],
  newestFirst: readonly Pick<KidTransactionRow, 'kind' | 'splits'>[],
  total: number,
): JarSplit[] {
  const last = newestFirst.find((transaction) => transaction.kind === 'topUp');
  return suggestTopUpSplit(total, {
    jarIds: topUpJarsOf(jarRows).map((jar) => jar.id),
    spendJarId: defaultJarId(accountId, kidProfileId, 'spend'),
    lastSplit: last?.splits ?? null,
  });
}
