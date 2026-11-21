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
  /** The Month the plan is copied from. */
  sourceMonth: Month;
  expectedIncome: number;
  /** In minor units (ADR-0004). */
  budgets: { categoryId: string; amount: number }[];
  /**
   * Live Categories (archived ones included) the copy has no budget for. The
   * device writes 0 for them, so a merge with an older copy made on a device
   * behind on sync can't bring back a budget this copy left out.
   */
  cleared: string[];
}

/**
 * The edit time a copied plan is written with (ADR-0001's last edit wins):
 * one step per source Month, far below any real edit time (milliseconds
 * since 1970). So a real edit always beats a copy, and when two devices copy
 * the same new Month from different source Months, the copy from the newer
 * source wins, whichever device syncs first.
 */
export function copiedPlanEditTime(sourceMonth: Month): number {
  const [year, month] = sourceMonth.split('-').map(Number);
  return year! * 12 + month!;
}

/**
 * The plan a Month starts with when it is created lazily (spec, Domain rules):
 * the Expected Income and Category Budgets of the latest earlier Month with a
 * plan, so skipped Months don't break the chain. Only the plan is copied;
 * Transactions and leftover money never carry over. Archived and deleted
 * Categories' budgets are dropped, so they stay out of new Months, and the
 * live Categories left at 0 are listed so the device can write that 0 (see
 * `cleared`, `copiedPlanEditTime`). Null when
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
  const copied = budgets
    .filter((b) => b.month === source.month && b.amount > 0 && active.has(b.categoryId))
    .map(({ categoryId, amount }) => ({ categoryId, amount }));
  const kept = new Set(copied.map((b) => b.categoryId));
  return {
    sourceMonth: source.month,
    expectedIncome: source.expectedIncome,
    budgets: copied,
    cleared: categories.filter((c) => !kept.has(c.id)).map((c) => c.id),
  };
}
