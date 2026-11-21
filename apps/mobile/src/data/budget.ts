import { and, eq, isNull, like } from 'drizzle-orm';
import {
  DEFAULT_CATEGORY_KEYS,
  DEFAULT_NUMBERING_SYSTEM,
  accountSettingsId,
  categoryBudgetId,
  defaultCategoryId,
  monthFigures,
  monthPlanId,
  type CurrencyCode,
  type DefaultCategoryKey,
  type Month,
  type MonthFigures,
} from '@money-tracker/shared';
import { ONBOARDING_STATE_KEY, type KnownRecord, type LocalStore } from '@/db/localStore';
import { accountSettings, categoryBudgets, deviceState, monthPlans, transactions } from '@/db/schema';
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
    {
      entity: 'accountSettings',
      id: accountSettingsId(accountId),
      fields: { currency, numberingSystem: DEFAULT_NUMBERING_SYSTEM },
    },
    ...DEFAULT_CATEGORY_KEYS.map(
      (key, order): KnownRecord => ({
        entity: 'category',
        id: defaultCategoryId(accountId, key),
        fields: { name: categoryNames[key], order, isOther: false, archivedAt: null },
      }),
    ),
    monthPlanRecord(accountId, month, expectedIncome),
  ]);
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

/** Live-queryable: a Month's Category Budgets. */
export function categoryBudgetsQuery(db: LocalDb, month: Month) {
  return db
    .select()
    .from(categoryBudgets)
    .where(and(isNull(categoryBudgets.deletedAt), eq(categoryBudgets.month, month)));
}

/** Live-queryable: the Transactions dated in a Month. */
export function monthTransactionsQuery(db: LocalDb, month: Month) {
  return db
    .select()
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), like(transactions.date, `${month}-%`)));
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
