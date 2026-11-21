import { parsePushedChange } from './records';

const id = '019ca8a0-3e80-7000-8000-000000000001';
const categoryId = '65f1a2b3-c4d5-8e6f-8708-192a3b000001';

const expense = {
  id,
  updatedAt: 1772355600000,
  deletedAt: null,
  kind: 'expense',
  amount: 12550,
  categoryId,
  date: '2026-03-01',
  note: null,
};

describe('parsePushedChange', () => {
  it('accepts a valid Expense and keeps only the known fields', () => {
    const result = parsePushedChange({
      entity: 'transaction',
      record: { ...expense, serverVersion: 99, accountId: 'someone-else', extra: true },
    });
    expect(result).toEqual({ ok: true, change: { entity: 'transaction', record: expense } });
  });

  it('accepts a Category', () => {
    const record = { id: categoryId, updatedAt: 0, deletedAt: null, name: 'Other', order: 0, isOther: true, archivedAt: null };
    expect(parsePushedChange({ entity: 'category', record })).toEqual({
      ok: true,
      change: { entity: 'category', record },
    });
  });

  it.each([
    ['a zero amount', { amount: 0 }, 'amount'],
    ['a fractional amount', { amount: 12.5 }, 'amount'],
    ['a negative amount', { amount: -5 }, 'amount'],
    ['an Expense with no Category', { categoryId: null }, 'categoryId'],
    ['a non-UUID id', { id: 'abc' }, 'id'],
    ['a date that does not exist', { date: '2026-02-30' }, 'date'],
    ['an unknown kind', { kind: 'refund' }, 'kind'],
    ['a missing edit time', { updatedAt: undefined }, 'updatedAt'],
  ])('rejects %s', (_label, patch, field) => {
    const result = parsePushedChange({ entity: 'transaction', record: { ...expense, ...patch } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.map((p) => p.field)).toContain(field);
  });

  it('rejects an Income that has a Category', () => {
    const result = parsePushedChange({ entity: 'transaction', record: { ...expense, kind: 'income' } });
    expect(result.ok).toBe(false);
  });

  describe('Account settings', () => {
    const settings = { id, updatedAt: 1, deletedAt: null, currency: 'EGP', numberingSystem: 'western' };

    it('accepts a currency and a numbering system', () => {
      expect(parsePushedChange({ entity: 'accountSettings', record: settings })).toEqual({
        ok: true,
        change: { entity: 'accountSettings', record: settings },
      });
    });

    it.each([
      ['a lowercase currency', { currency: 'egp' }, 'currency'],
      ['a currency that is not a code', { currency: 'Pounds' }, 'currency'],
      ['an unknown numbering system', { numberingSystem: 'roman' }, 'numberingSystem'],
    ])('rejects %s', (_label, patch, field) => {
      const result = parsePushedChange({ entity: 'accountSettings', record: { ...settings, ...patch } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.problems.map((p) => p.field)).toEqual([field]);
    });
  });

  describe('Month plan', () => {
    const plan = { id, updatedAt: 1, deletedAt: null, month: '2026-03', expectedIncome: 800000 };

    it('accepts a Month and an Expected Income, including zero', () => {
      expect(parsePushedChange({ entity: 'monthPlan', record: plan })).toEqual({ ok: true, change: { entity: 'monthPlan', record: plan } });
      expect(parsePushedChange({ entity: 'monthPlan', record: { ...plan, expectedIncome: 0 } }).ok).toBe(true);
    });

    it.each([
      ['a Month that does not exist', { month: '2026-13' }, 'month'],
      ['a date instead of a Month', { month: '2026-03-01' }, 'month'],
      ['a negative Expected Income', { expectedIncome: -1 }, 'expectedIncome'],
      ['a fractional Expected Income', { expectedIncome: 1.5 }, 'expectedIncome'],
    ])('rejects %s', (_label, patch, field) => {
      const result = parsePushedChange({ entity: 'monthPlan', record: { ...plan, ...patch } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.problems.map((p) => p.field)).toEqual([field]);
    });
  });

  describe('Category Budget', () => {
    const budget = { id, updatedAt: 1, deletedAt: null, month: '2026-03', categoryId, amount: 300000 };

    it('accepts a Month, a Category and an amount, including zero', () => {
      expect(parsePushedChange({ entity: 'categoryBudget', record: budget })).toEqual({
        ok: true,
        change: { entity: 'categoryBudget', record: budget },
      });
      expect(parsePushedChange({ entity: 'categoryBudget', record: { ...budget, amount: 0 } }).ok).toBe(true);
    });

    it.each([
      ['a missing Category', { categoryId: null }, 'categoryId'],
      ['a negative amount', { amount: -100 }, 'amount'],
      ['a bad Month', { month: 'March' }, 'month'],
    ])('rejects %s', (_label, patch, field) => {
      const result = parsePushedChange({ entity: 'categoryBudget', record: { ...budget, ...patch } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.problems.map((p) => p.field)).toEqual([field]);
    });
  });

  it('rejects an unknown entity', () => {
    const result = parsePushedChange({ entity: 'goal', record: expense });
    expect(result).toEqual({ ok: false, problems: [{ field: 'entity', message: expect.any(String) }] });
  });
});
