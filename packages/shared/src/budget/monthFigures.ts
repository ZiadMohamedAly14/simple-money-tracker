import { monthOf, type Month, type PayDayHistory } from '../dates/month';
import type { TransactionKind } from '../sync/records';

/** The headline figures of a Month (GLOSSARY). All amounts in minor units (ADR-0004). */
export interface MonthFigures {
  /** What the adult plans to receive this Month. */
  expectedIncome: number;
  /** Sum of the Month's Income Transactions. */
  income: number;
  /** Sum of the Month's Expense Transactions. */
  spending: number;
  /**
   * The larger of Expected Income and Income, minus Spending: what is left to spend.
   * Income still to come doesn't lower it, and Income above the plan raises it.
   * Category Budgets don't count as spent. May be negative.
   */
  remaining: number;
  /**
   * The larger of Expected Income and Income, minus the Month's Category Budgets:
   * money not yet given a budget. Income above the plan raises it. May be negative.
   */
  unallocated: number;
}

export interface MonthFiguresInput {
  month: Month;
  /** The Account's Pay Day history, which draws the Month's dates. */
  history: PayDayHistory;
  /** The Month plan's Expected Income (0 when the Month has no plan yet). */
  expectedIncome: number;
  /** Category Budgets; only the ones for `month` count. */
  budgets: readonly { month: Month; amount: number }[];
  /** Live (not deleted) Transactions; only the ones dated in `month` count. */
  transactions: readonly { kind: TransactionKind; amount: number; date: string }[];
}

/**
 * Works out a Month's figures from its plan and Transactions. They are never
 * stored or synced (spec), so every screen shows the same numbers.
 */
export function monthFigures({ month, history, expectedIncome, budgets, transactions }: MonthFiguresInput): MonthFigures {
  let income = 0;
  let spending = 0;
  for (const transaction of transactions) {
    if (monthOf(transaction.date, history) !== month) continue;
    if (transaction.kind === 'income') income += transaction.amount;
    else spending += transaction.amount;
  }
  const budgeted = budgets.reduce((sum, budget) => (budget.month === month ? sum + budget.amount : sum), 0);
  const available = Math.max(expectedIncome, income);
  return { expectedIncome, income, spending, remaining: available - spending, unallocated: available - budgeted };
}
