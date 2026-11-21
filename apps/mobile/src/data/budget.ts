import { and, asc, eq, inArray, isNull, like } from 'drizzle-orm';
import {
  DEFAULT_CATEGORY_ICONS,
  DEFAULT_CATEGORY_KEYS,
  DEFAULT_NUMBERING_SYSTEM,
  accountSettingsId,
  categoryBudgetId,
  defaultCategoryId,
  monthFigures,
  monthPlanId,
  newMonthPlan,
  type CurrencyCode,
  type DefaultCategoryKey,
  type Month,
  type MonthFigures,
  type NumberingSystem,
} from '@money-tracker/shared';
import { ONBOARDING_STATE_KEY, type KnownRecord, type LocalStore } from '@/db/localStore';
import { accountSettings, categories, categoryBudgets, deviceState, monthPlans, transactions } from '@/db/schema';
import type { LocalDb } from '@/db/types';

function requireAccount(store: LocalStore): string {
  const accountId = store.accountId();
  if (!accountId) throw new Error('No Account is signed in on this device');
  return accountId;
}

const monthPlanRecord = (accountId: string, month: Month, expectedIncome: number): KnownRecord => ({
  entity: 'monthPlan',
  id: monthPlanId(accountId, month),
  fields: { month, expectedIncome },
});

export interface PersonalOnboarding {
  currency: CurrencyCode;
  /** In minor units. */
  expectedIncome: number;
  /** The Month onboarding happens in (`currentMonth(new Date())`). */
  month: Month;
  /** Each default Category's name in the device language (from the `categories.defaults` strings). */
  categoryNames: Record<DefaultCategoryKey, string>;
}

/**
 * Finishes the personal onboarding path on this device: the Account's
 * currency, the default Categories (budget 0, so no Category Budgets) and this
 * Month's plan. Works offline; every ID is derived from the Account, so a
 * second device onboarding offline makes the same records. The sync engine
 * then tells the server onboarding is complete.
 */
export function completePersonalOnboarding(
  store: LocalStore,
  { currency, expectedIncome, month, categoryNames }: PersonalOnboarding,
): void {
  const accountId = requireAccount(store);
  store.completeOnboarding([
    ...accountBasics(accountId, currency, categoryNames),
    monthPlanRecord(accountId, month, expectedIncome),
  ]);
}

/**
 * What every onboarding path writes: the Account's currency and the default
 * Categories (budget 0). The kid path writes them too, so the Personal Budget
 * is there whenever the parent wants it (spec, story 16).
 */
export function accountBasics(
  accountId: string,
  currency: CurrencyCode,
  categoryNames: Record<DefaultCategoryKey, string>,
): KnownRecord[] {
  return [
    {
      entity: 'accountSettings',
      id: accountSettingsId(accountId),
      fields: { currency, numberingSystem: DEFAULT_NUMBERING_SYSTEM },
    },
    ...DEFAULT_CATEGORY_KEYS.map(
      (key, order): KnownRecord => ({
        entity: 'category',
        id: defaultCategoryId(accountId, key),
        fields: { name: categoryNames[key], order, isOther: false, archivedAt: null, icon: DEFAULT_CATEGORY_ICONS[key] },
      }),
    ),
  ];
}

/** Sets a Month's Expected Income, creating its plan if needed. Two devices doing it offline make one plan. */
export function setExpectedIncome(store: LocalStore, month: Month, expectedIncome: number): void {
  store.put([monthPlanRecord(requireAccount(store), month, expectedIncome)]);
}

/** Sets Category Budgets for a Month: `{ [categoryId]: amount in minor units }`. */
export function setCategoryBudgets(store: LocalStore, month: Month, amounts: Record<string, number>): void {
  const accountId = requireAccount(store);
  store.put(
    Object.entries(amounts).map(([categoryId, amount]) => ({
      entity: 'categoryBudget',
      id: categoryBudgetId(accountId, month, categoryId),
      fields: { month, categoryId, amount },
    })),
  );
}

/**
 * Creates a Month the first time it is opened or receives a Transaction
 * (spec, Domain rules), by copying the previous Month's Expected Income and
 * Category Budgets (`newMonthPlan`). Does nothing if the Month already has a
 * plan, or there is no earlier plan to copy. The copies are written as
 * defaults (edit time 0), so if another device already created or changed
 * this Month, its copy wins on sync; the IDs are deterministic, so there is
 * still one plan.
 */
export function openMonth(store: LocalStore, db: LocalDb, month: Month): void {
  const accountId = requireAccount(store);
  const plans = db.select().from(monthPlans).where(isNull(monthPlans.deletedAt)).all();
  if (plans.some((p) => p.month === month)) return;
  const plan = newMonthPlan({
    month,
    plans,
    budgets: db.select().from(categoryBudgets).where(isNull(categoryBudgets.deletedAt)).all(),
    categories: db.select().from(categories).where(isNull(categories.deletedAt)).all(),
  });
  if (!plan) return;
  store.put(
    [
      monthPlanRecord(accountId, month, plan.expectedIncome),
      ...plan.budgets.map(
        ({ categoryId, amount }): KnownRecord => ({
          entity: 'categoryBudget',
          id: categoryBudgetId(accountId, month, categoryId),
          fields: { month, categoryId, amount },
        }),
      ),
    ],
    { asDefault: true },
  );
}

export interface AccountSettingsChanges {
  currency?: CurrencyCode;
  numberingSystem?: NumberingSystem;
}

/**
 * Changes the Account's currency label and/or numbering system (Settings).
 * Amounts are stored in minor units and never converted: a new currency only
 * relabels them. Synced like any record, so every device follows. Returns
 * `not_ready` and writes nothing while the device hasn't received the
 * Account settings yet (e.g. a new device offline before its first sync).
 */
export function changeAccountSettings(store: LocalStore, db: LocalDb, changes: AccountSettingsChanges): 'saved' | 'not_ready' {
  const accountId = requireAccount(store);
  const current = accountSettingsQuery(db).get();
  // The record holds both fields and last edit wins (ADR-0001), so writing it
  // with a guessed field could overwrite a choice made on another device.
  if (!current) return 'not_ready';
  store.put([
    {
      entity: 'accountSettings',
      id: accountSettingsId(accountId),
      fields: {
        currency: changes.currency ?? current.currency,
        numberingSystem: changes.numberingSystem ?? current.numberingSystem,
      },
    },
  ]);
  return 'saved';
}

/** Live-queryable: the Account's settings (one row, or none before onboarding or first sync). */
export function accountSettingsQuery(db: LocalDb) {
  return db.select().from(accountSettings).where(isNull(accountSettings.deletedAt)).limit(1);
}

/** Live-queryable: the device's onboarding state row (see `OnboardingState`; no row = not started). */
export function onboardingQuery(db: LocalDb) {
  return db.select().from(deviceState).where(eq(deviceState.key, ONBOARDING_STATE_KEY));
}

/** Live-queryable: Month plans (all Months, or one). */
export function monthPlansQuery(db: LocalDb, month?: Month) {
  return db
    .select()
    .from(monthPlans)
    .where(and(isNull(monthPlans.deletedAt), month ? eq(monthPlans.month, month) : undefined))
    .orderBy(monthPlans.month);
}

/**
 * Live-queryable: a Month's Category Budgets. A budget whose Category is
 * deleted doesn't count (one set offline on another device can outlive the
 * Category's deletion).
 */
export function categoryBudgetsQuery(db: LocalDb, month: Month) {
  const liveCategories = db.select({ id: categories.id }).from(categories).where(isNull(categories.deletedAt));
  return db
    .select()
    .from(categoryBudgets)
    .where(
      and(
        isNull(categoryBudgets.deletedAt),
        eq(categoryBudgets.month, month),
        inArray(categoryBudgets.categoryId, liveCategories),
      ),
    );
}

/** Live-queryable: the Transactions dated in a Month. */
export function monthTransactionsQuery(db: LocalDb, month: Month) {
  return db
    .select()
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), like(transactions.date, `${month}-%`)));
}

/** Live-queryable: the earliest dated Transaction (one row, or none), which bounds how far back Months go. */
export function earliestTransactionQuery(db: LocalDb) {
  return db
    .select({ date: transactions.date })
    .from(transactions)
    .where(isNull(transactions.deletedAt))
    .orderBy(asc(transactions.date))
    .limit(1);
}

/** A Month's figures from what the live queries above return. */
export function monthOverviewOf(
  month: Month,
  plans: readonly { expectedIncome: number }[],
  budgets: readonly { month: Month; amount: number }[],
  monthTransactions: Parameters<typeof monthFigures>[0]['transactions'],
): MonthFigures {
  return monthFigures({ month, expectedIncome: plans[0]?.expectedIncome ?? 0, budgets, transactions: monthTransactions });
}

/** A Month's figures, read once (tests; screens use the live queries with `monthOverviewOf`). */
export function readMonthOverview(db: LocalDb, month: Month): MonthFigures {
  return monthOverviewOf(
    month,
    monthPlansQuery(db, month).all(),
    categoryBudgetsQuery(db, month).all(),
    monthTransactionsQuery(db, month).all(),
  );
}
