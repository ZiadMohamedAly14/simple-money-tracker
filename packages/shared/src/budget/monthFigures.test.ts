import { monthFigures } from './monthFigures';

const income = (amount: number, date: string) => ({ kind: 'income' as const, amount, date });
const expense = (amount: number, date: string) => ({ kind: 'expense' as const, amount, date });

describe('monthFigures', () => {
  it('a Month with nothing recorded has every figure at zero except Unallocated, which is the Expected Income', () => {
    expect(monthFigures({ month: '2026-03', expectedIncome: 800000, budgets: [], transactions: [] })).toEqual({
      expectedIncome: 800000,
      income: 0,
      spending: 0,
      remaining: 0,
      unallocated: 800000,
    });
  });

  it('sums Income and Spending from the Transactions dated in the Month, and Remaining is Income minus Spending', () => {
    const figures = monthFigures({
      month: '2026-03',
      expectedIncome: 800000,
      budgets: [],
      transactions: [
        income(800000, '2026-03-01'),
        income(200000, '2026-03-15'), // freelance work on top of the salary
        expense(12550, '2026-03-02'),
        expense(7450, '2026-03-31'),
      ],
    });
    expect(figures.income).toBe(1000000);
    expect(figures.spending).toBe(20000);
    expect(figures.remaining).toBe(980000);
  });

  it("ignores Transactions dated in other Months, so nothing carries over", () => {
    const figures = monthFigures({
      month: '2026-03',
      expectedIncome: 0,
      budgets: [],
      transactions: [income(5000, '2026-02-28'), expense(3000, '2026-04-01'), expense(100, '2026-03-31')],
    });
    expect(figures).toMatchObject({ income: 0, spending: 100, remaining: -100 });
  });

  it('Remaining goes negative when Spending is more than Income', () => {
    const figures = monthFigures({
      month: '2026-03',
      expectedIncome: 0,
      budgets: [],
      transactions: [income(1000, '2026-03-01'), expense(2500, '2026-03-02')],
    });
    expect(figures.remaining).toBe(-1500);
  });

  it('Unallocated is Expected Income minus the Category Budgets of the Month', () => {
    const figures = monthFigures({
      month: '2026-03',
      expectedIncome: 800000,
      budgets: [
        { month: '2026-03', amount: 300000 },
        { month: '2026-03', amount: 150000 },
        { month: '2026-02', amount: 999999 }, // another Month's plan
      ],
      transactions: [],
    });
    expect(figures.unallocated).toBe(350000);
  });

  it('Unallocated goes negative when the Category Budgets add up to more than Expected Income', () => {
    const figures = monthFigures({
      month: '2026-03',
      expectedIncome: 500000,
      budgets: [
        { month: '2026-03', amount: 400000 },
        { month: '2026-03', amount: 200000 },
      ],
      transactions: [],
    });
    expect(figures.unallocated).toBe(-100000);
  });

  it('Unallocated depends on the plan, not on what was actually received or spent', () => {
    const figures = monthFigures({
      month: '2026-03',
      expectedIncome: 800000,
      budgets: [{ month: '2026-03', amount: 300000 }],
      transactions: [income(1000000, '2026-03-01'), expense(50000, '2026-03-02')],
    });
    expect(figures.unallocated).toBe(500000);
  });
});
