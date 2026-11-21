import { categoryBreakdown } from './categoryBreakdown';

const food = { id: 'food', order: 1, isOther: false, archivedAt: null };
const housing = { id: 'housing', order: 0, isOther: false, archivedAt: null };
const other = { id: 'other', order: 9999, isOther: true, archivedAt: null };
const expense = (categoryId: string, amount: number, date: string) => ({ kind: 'expense' as const, categoryId, amount, date });
const budget = (categoryId: string, amount: number, month = '2026-03') => ({ categoryId, amount, month });

describe('categoryBreakdown', () => {
  it('shows each Category in display order with its budget, spent and remaining', () => {
    const rows = categoryBreakdown({
      month: '2026-03',
      categories: [other, food, housing],
      budgets: [budget('food', 300000), budget('housing', 500000)],
      transactions: [expense('food', 12550, '2026-03-02'), expense('food', 7450, '2026-03-31')],
    });
    expect(rows).toEqual([
      { categoryId: 'housing', budget: 500000, spent: 0, remaining: 500000 },
      { categoryId: 'food', budget: 300000, spent: 20000, remaining: 280000 },
      { categoryId: 'other', budget: 0, spent: 0, remaining: 0 },
    ]);
  });

  it('a Category with no Category Budget has a budget of 0, so any spending puts it over', () => {
    const [row] = categoryBreakdown({
      month: '2026-03',
      categories: [other],
      budgets: [],
      transactions: [expense('other', 4200, '2026-03-10')],
    });
    expect(row).toEqual({ categoryId: 'other', budget: 0, spent: 4200, remaining: -4200 });
  });

  it('remaining goes negative when a Category is over budget', () => {
    const [row] = categoryBreakdown({
      month: '2026-03',
      categories: [food],
      budgets: [budget('food', 100000)],
      transactions: [expense('food', 142000, '2026-03-05')],
    });
    expect(row!.remaining).toBe(-42000);
  });

  it('counts only the Month’s budgets and Expenses: Income and other Months are ignored', () => {
    const [row] = categoryBreakdown({
      month: '2026-03',
      categories: [food],
      budgets: [budget('food', 100000, '2026-02'), budget('food', 50000)],
      transactions: [
        expense('food', 1000, '2026-02-28'),
        expense('food', 2000, '2026-04-01'),
        expense('food', 300, '2026-03-01'),
        { kind: 'income', categoryId: null, amount: 900000, date: '2026-03-01' },
      ],
    });
    expect(row).toEqual({ categoryId: 'food', budget: 50000, spent: 300, remaining: 49700 });
  });

  it('an Archived Category is hidden from a Month where it has no budget and no spending', () => {
    const archived = { ...food, archivedAt: Date.parse('2026-02-15T00:00:00Z') };
    const rows = categoryBreakdown({ month: '2026-03', categories: [archived, other], budgets: [], transactions: [] });
    expect(rows.map((r) => r.categoryId)).toEqual(['other']);
  });

  it('an Archived Category stays in the history of a Month where it had a budget or spending', () => {
    const archived = { ...food, archivedAt: Date.parse('2026-03-15T00:00:00Z') };
    const withSpending = categoryBreakdown({
      month: '2026-01',
      categories: [archived],
      budgets: [],
      transactions: [expense('food', 500, '2026-01-20')],
    });
    expect(withSpending).toEqual([{ categoryId: 'food', budget: 0, spent: 500, remaining: -500 }]);
    const withBudget = categoryBreakdown({
      month: '2026-02',
      categories: [archived],
      budgets: [budget('food', 70000, '2026-02')],
      transactions: [],
    });
    expect(withBudget).toEqual([{ categoryId: 'food', budget: 70000, spent: 0, remaining: 70000 }]);
  });

  it('Other always sorts last, whatever its order number', () => {
    const rows = categoryBreakdown({
      month: '2026-03',
      categories: [{ ...other, order: -5 }, { ...food, order: 20000 }],
      budgets: [],
      transactions: [],
    });
    expect(rows.map((r) => r.categoryId)).toEqual(['food', 'other']);
  });
});
