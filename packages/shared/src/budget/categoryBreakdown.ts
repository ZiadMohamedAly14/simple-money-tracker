import { monthOf, type Month, type PayDayHistory } from '../dates/month';
import type { TransactionKind } from '../sync/records';

/** One Category's figures for a Month. All amounts in minor units (ADR-0004). */
export interface CategoryFigures {
  categoryId: string;
  /** The Month's Category Budget; 0 when it has none. */
  budget: number;
  /** Sum of the Month's Expenses in this Category. */
  spent: number;
  /** Budget minus spent. Negative when the Category is over budget. */
  remaining: number;
}

export interface CategoryBreakdownInput {
  month: Month;
  /** The Account's Pay Day history, which draws the Month's dates. */
  history: PayDayHistory;
  /** Live (not deleted) Categories, archived ones included. */
  categories: readonly { id: string; order: number; isOther: boolean; archivedAt: number | null }[];
  /** Category Budgets; only the ones for `month` count. */
  budgets: readonly { month: Month; categoryId: string; amount: number }[];
  /** Live Transactions; only the Expenses dated in `month` count. One in a Category not listed above (deleted) counts as Other's. */
  transactions: readonly { kind: TransactionKind; categoryId: string | null; amount: number; date: string }[];
}

/**
 * The per-Category breakdown of a Month (spec, story 20): budget, spent and
 * remaining for each Category in display order, Other last. An Archived
 * Category is hidden from a Month where it has no budget and no spending, and
 * stays in the history of Months where it had either. A deleted Category's
 * Expenses count as Other's, and its budgets are gone. Never stored or synced.
 */
export function categoryBreakdown({ month, history, categories, budgets, transactions }: CategoryBreakdownInput): CategoryFigures[] {
  const budgeted = new Map<string, number>();
  for (const b of budgets) {
    if (b.month === month) budgeted.set(b.categoryId, (budgeted.get(b.categoryId) ?? 0) + b.amount);
  }
  // An Expense whose Category is deleted (or not here at all) counts as Other's (ticket 21).
  const live = new Set(categories.map((c) => c.id));
  const otherId = categories.find((c) => c.isOther)?.id;
  const spentBy = new Map<string, number>();
  for (const t of transactions) {
    if (t.kind !== 'expense' || t.categoryId === null || monthOf(t.date, history) !== month) continue;
    const categoryId = live.has(t.categoryId) || otherId === undefined ? t.categoryId : otherId;
    spentBy.set(categoryId, (spentBy.get(categoryId) ?? 0) + t.amount);
  }
  return [...categories]
    .sort((a, b) => Number(a.isOther) - Number(b.isOther) || a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((category) => {
      const budget = budgeted.get(category.id) ?? 0;
      const spent = spentBy.get(category.id) ?? 0;
      return { category, figures: { categoryId: category.id, budget, spent, remaining: budget - spent } };
    })
    .filter(({ category, figures }) => category.archivedAt === null || figures.budget > 0 || figures.spent > 0)
    .map(({ figures }) => figures);
}
