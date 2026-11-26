import { monthFigures } from './monthFigures';

const income = (amount: number, date: string) => ({ kind: 'income' as const, amount, date });
const expense = (amount: number, date: string) => ({ kind: 'expense' as const, amount, date });

describe('monthFigures', () => {
  it('a Month with nothing recorded has Income and Spending at zero, and Remaining and Unallocated at the Expected Income', () => {
    expect(monthFigures({ history: [], month: '2026-03', expectedIncome: 800000, budgets: [], transactions: [] })).toEqual({
      expectedIncome: 800000,
      income: 0,
      spending: 0,
      remaining: 800000,
      unallocated: 800000,
    });
  });

  it('sums Income and Spending from the Transactions dated in the Month, and Remaining counts Income once it is above Expected Income', () => {
    const figures = monthFigures({
      month: '2026-03',
      history: [],
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

  it('Remaining counts Expected Income while recorded Income is below it, so Income still to come does not lower it', () => {
    const plan = { month: '2026-03', history: [], expectedIncome: 800000, budgets: [] };
    const none = monthFigures({ ...plan, transactions: [expense(5000, '2026-03-02')] });
    const some = monthFigures({ ...plan, transactions: [income(200000, '2026-03-01'), expense(5000, '2026-03-02')] });
    expect(none.remaining).toBe(795000);
    expect(some.remaining).toBe(795000);
  });

  it('Remaining counts recorded Income once it is above Expected Income', () => {
    const figures = monthFigures({
      month: '2026-11',
      history: [],
      expectedIncome: 800000,
      budgets: [],
      transactions: [income(850000, '2026-11-01'), expense(850000, '2026-11-02')],
    });
    expect(figures.remaining).toBe(0);
  });

  it('Category Budgets do not count as spent', () => {
    const figures = monthFigures({
      month: '2026-03',
      history: [],
      expectedIncome: 800000,
      budgets: [{ month: '2026-03', amount: 300000 }],
      transactions: [expense(10000, '2026-03-02')],
    });
    expect(figures.remaining).toBe(790000);
  });

  it("ignores Transactions dated in other Months, so nothing carries over", () => {
    const figures = monthFigures({
      month: '2026-03',
      history: [],
      expectedIncome: 0,
      budgets: [],
      transactions: [income(5000, '2026-02-28'), expense(3000, '2026-04-01'), expense(100, '2026-03-31')],
    });
    expect(figures).toMatchObject({ income: 0, spending: 100, remaining: -100 });
  });

  it('Remaining goes negative only when Spending is more than both Expected Income and recorded Income', () => {
    const figures = monthFigures({
      month: '2026-03',
      history: [],
      expectedIncome: 1000,
      budgets: [],
      transactions: [income(2000, '2026-03-01'), expense(2500, '2026-03-02')],
    });
    expect(figures.remaining).toBe(-500);
  });

  it('Unallocated is Expected Income minus the Category Budgets of the Month', () => {
    const figures = monthFigures({
      month: '2026-03',
      history: [],
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
      history: [],
      expectedIncome: 500000,
      budgets: [
        { month: '2026-03', amount: 400000 },
        { month: '2026-03', amount: 200000 },
      ],
      transactions: [],
    });
    expect(figures.unallocated).toBe(-100000);
  });

  it('Unallocated counts recorded Income once it is above Expected Income, so extra Income can get a budget', () => {
    const figures = monthFigures({
      month: '2026-03',
      history: [],
      expectedIncome: 800000,
      budgets: [{ month: '2026-03', amount: 800000 }],
      transactions: [income(820000, '2026-03-01'), expense(10000, '2026-03-02')],
    });
    expect(figures.unallocated).toBe(20000);
  });

  it('Unallocated counts Expected Income while recorded Income is below it, and Spending does not lower it', () => {
    const figures = monthFigures({
      month: '2026-03',
      history: [],
      expectedIncome: 800000,
      budgets: [{ month: '2026-03', amount: 700000 }],
      transactions: [income(50000, '2026-03-01'), expense(30000, '2026-03-02')],
    });
    expect(figures.unallocated).toBe(100000);
  });

  it('with Pay Day 26, counts an Expense dated 26 Nov in December and one dated 25 Nov in November', () => {
    const history = [{ payDay: 26, startsOn: '2026-10-26' }];
    const transactions = [expense(2600, '2026-11-26'), expense(2500, '2026-11-25')];
    const figuresFor = (month: string) => monthFigures({ month, history, expectedIncome: 0, budgets: [], transactions });
    expect(figuresFor('2026-12').spending).toBe(2600);
    expect(figuresFor('2026-11').spending).toBe(2500);
  });
});
