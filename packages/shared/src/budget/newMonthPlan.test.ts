import { newMonthPlan } from './newMonthPlan';

const food = { id: 'food', archivedAt: null };
const housing = { id: 'housing', archivedAt: null };
const plan = (month: string, expectedIncome: number) => ({ month, expectedIncome });
const budget = (month: string, categoryId: string, amount: number) => ({ month, categoryId, amount });

describe('newMonthPlan', () => {
  it("copies the previous Month's Expected Income and Category Budgets", () => {
    expect(
      newMonthPlan({
        month: '2026-04',
        plans: [plan('2026-03', 800000)],
        budgets: [budget('2026-03', 'housing', 500000), budget('2026-03', 'food', 200000)],
        categories: [food, housing],
      }),
    ).toEqual({
      expectedIncome: 800000,
      budgets: [
        { categoryId: 'housing', amount: 500000 },
        { categoryId: 'food', amount: 200000 },
      ],
    });
  });

  it("leaves out Archived Categories' budgets, so they don't come back in new Months", () => {
    const result = newMonthPlan({
      month: '2026-04',
      plans: [plan('2026-03', 800000)],
      budgets: [budget('2026-03', 'housing', 500000), budget('2026-03', 'food', 200000)],
      categories: [{ id: 'food', archivedAt: 1700000000000 }, housing],
    });
    expect(result?.budgets).toEqual([{ categoryId: 'housing', amount: 500000 }]);
  });

  it('leaves out budgets of Categories that no longer exist, and zero budgets (a missing one counts as 0)', () => {
    const result = newMonthPlan({
      month: '2026-04',
      plans: [plan('2026-03', 800000)],
      budgets: [budget('2026-03', 'deleted', 1000), budget('2026-03', 'food', 0), budget('2026-03', 'housing', 500000)],
      categories: [food, housing],
    });
    expect(result?.budgets).toEqual([{ categoryId: 'housing', amount: 500000 }]);
  });

  it('copies from the latest earlier Month with a plan when Months were skipped, never from a later one', () => {
    const result = newMonthPlan({
      month: '2026-06',
      plans: [plan('2026-02', 600000), plan('2026-07', 1), plan('2026-03', 800000)],
      budgets: [budget('2026-02', 'food', 100000), budget('2026-03', 'food', 200000), budget('2026-07', 'food', 9)],
      categories: [food],
    });
    expect(result).toEqual({ expectedIncome: 800000, budgets: [{ categoryId: 'food', amount: 200000 }] });
  });

  it('is null when the Month already has a plan, so opening it again changes nothing', () => {
    expect(
      newMonthPlan({
        month: '2026-04',
        plans: [plan('2026-03', 800000), plan('2026-04', 0)],
        budgets: [budget('2026-03', 'food', 200000)],
        categories: [food],
      }),
    ).toBeNull();
  });

  it('is null when no earlier Month has a plan (before onboarding)', () => {
    expect(newMonthPlan({ month: '2026-02', plans: [plan('2026-03', 800000)], budgets: [], categories: [food] })).toBeNull();
    expect(newMonthPlan({ month: '2026-02', plans: [], budgets: [], categories: [food] })).toBeNull();
  });
});
