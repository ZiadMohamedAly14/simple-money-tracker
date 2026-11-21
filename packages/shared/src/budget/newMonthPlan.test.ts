import { copiedPlanEditTime, newMonthPlan } from './newMonthPlan';

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
    ).toMatchObject({
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
    expect(result).toMatchObject({ sourceMonth: '2026-03', expectedIncome: 800000, budgets: [{ categoryId: 'food', amount: 200000 }] });
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

  it('names the source Month and the live Categories the copy leaves at 0, archived ones included', () => {
    const result = newMonthPlan({
      month: '2026-04',
      plans: [plan('2026-03', 800000)],
      budgets: [budget('2026-03', 'housing', 500000), budget('2026-03', 'food', 0), budget('2026-03', 'toys', 7000)],
      categories: [food, housing, { id: 'toys', archivedAt: 1700000000000 }],
    });
    expect(result).toMatchObject({ sourceMonth: '2026-03', budgets: [{ categoryId: 'housing', amount: 500000 }] });
    expect(result?.cleared).toEqual(['food', 'toys']);
  });
});

describe('copiedPlanEditTime', () => {
  it('is later for a copy from a later source Month, so that copy wins a merge', () => {
    expect(copiedPlanEditTime('2026-03')).toBeGreaterThan(copiedPlanEditTime('2026-02'));
    expect(copiedPlanEditTime('2027-01')).toBeGreaterThan(copiedPlanEditTime('2026-12'));
  });

  it('is far below any real edit time, so a real edit always beats a copy', () => {
    expect(copiedPlanEditTime('9999-12')).toBeLessThan(Date.UTC(2001, 0, 1));
    expect(copiedPlanEditTime('2026-01')).toBeGreaterThan(0);
  });
});
