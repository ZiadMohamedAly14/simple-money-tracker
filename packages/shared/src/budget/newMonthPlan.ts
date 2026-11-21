import type { Month } from '../dates/month';

export interface NewMonthPlanInput {
  /** The Month being opened (or receiving its first Transaction). */
  month: Month;
  /** Every Month plan held. */
  plans: readonly { month: Month; expectedIncome: number }[];
  /** Category Budgets; only the source Month's count. */
  budgets: readonly { month: Month; categoryId: string; amount: number }[];
  /** Live (not deleted) Categories, archived ones included. */
  categories: readonly { id: string; archivedAt: number | null }[];
}

export interface NewMonthPlan {
  expectedIncome: number;
  /** In minor units (ADR-0004). */
  budgets: { categoryId: string; amount: number }[];
}

/**
 * The plan a Month starts with when it is created lazily (spec, Domain rules):
 * the Expected Income and Category Budgets of the latest earlier Month with a
 * plan, so skipped Months don't break the chain. Only the plan is copied;
 * Transactions and leftover money never carry over. Archived and deleted
 * Categories' budgets are dropped, so they stay out of new Months. Null when
 * the Month already has a plan, or there is no earlier plan to copy.
 */
export function newMonthPlan({ month, plans, budgets, categories }: NewMonthPlanInput): NewMonthPlan | null {
  if (plans.some((p) => p.month === month)) return null;
  const source = plans.filter((p) => p.month < month).reduce<NewMonthPlanInput['plans'][number] | null>(
    (latest, p) => (latest === null || p.month > latest.month ? p : latest),
    null,
  );
  if (source === null) return null;
  const active = new Set(categories.filter((c) => c.archivedAt === null).map((c) => c.id));
  return {
    expectedIncome: source.expectedIncome,
    budgets: budgets
      .filter((b) => b.month === source.month && b.amount > 0 && active.has(b.categoryId))
      .map(({ categoryId, amount }) => ({ categoryId, amount })),
  };
}
