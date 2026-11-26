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
    const record = { id: categoryId, updatedAt: 0, deletedAt: null, name: 'Other', order: 0, isOther: true, archivedAt: null, icon: 'other' };
    expect(parsePushedChange({ entity: 'category', record })).toEqual({
      ok: true,
      change: { entity: 'category', record },
    });
  });

  describe('a Category icon', () => {
    const category = { id: categoryId, updatedAt: 0, deletedAt: null, name: 'Rent', order: 0, isOther: false, archivedAt: null };

    it('accepts any short kebab-case icon name, including ones this app version does not know', () => {
      for (const icon of ['housing', 'food-groceries', 'rocket-ship-2']) {
        expect(parsePushedChange({ entity: 'category', record: { ...category, icon } })).toEqual({
          ok: true,
          change: { entity: 'category', record: { ...category, icon } },
        });
      }
    });

    it('reads a missing icon (an older app) as none', () => {
      expect(parsePushedChange({ entity: 'category', record: category })).toEqual({
        ok: true,
        change: { entity: 'category', record: { ...category, icon: null } },
      });
    });

    it.each([
      ['an app: prefix', 'app:housing'],
      ['capitals', 'Housing'],
      ['spaces', 'food groceries'],
      ['a long name', 'x'.repeat(41)],
      ['a number', 7],
    ])('rejects an icon with %s', (_label, icon) => {
      const result = parsePushedChange({ entity: 'category', record: { ...category, icon } });
      expect(result).toEqual({ ok: false, problems: [{ field: 'icon', message: expect.any(String) }] });
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

  describe('Pay Day history', () => {
    const history = {
      id,
      updatedAt: 1,
      deletedAt: null,
      entries: [
        { payDay: 25, startsOn: '2026-12-25' },
        { payDay: 31, startsOn: '2027-02-28' },
      ],
    };

    it('accepts a list of Pay Days, each with the date its first Month starts', () => {
      expect(parsePushedChange({ entity: 'payDayHistory', record: history })).toEqual({
        ok: true,
        change: { entity: 'payDayHistory', record: history },
      });
    });

    it('keeps only the known fields of each entry', () => {
      const record = { ...history, entries: [{ payDay: 25, startsOn: '2026-12-25', note: 'x' }] };
      expect(parsePushedChange({ entity: 'payDayHistory', record })).toEqual({
        ok: true,
        change: { entity: 'payDayHistory', record: { ...history, entries: [{ payDay: 25, startsOn: '2026-12-25' }] } },
      });
    });

    it('reads a missing list (an older app) as no changes, which is Pay Day 1', () => {
      const { entries: _entries, ...withoutEntries } = history;
      expect(parsePushedChange({ entity: 'payDayHistory', record: withoutEntries })).toEqual({
        ok: true,
        change: { entity: 'payDayHistory', record: { ...withoutEntries, entries: [] } },
      });
    });

    it.each([
      ['a Pay Day of 0', [{ payDay: 0, startsOn: '2026-12-01' }]],
      ['a Pay Day of 32', [{ payDay: 32, startsOn: '2026-12-01' }]],
      ['a fractional Pay Day', [{ payDay: 1.5, startsOn: '2026-12-01' }]],
      ['a start date that does not exist', [{ payDay: 30, startsOn: '2027-02-30' }]],
      ['a start date that is not on its Pay Day', [{ payDay: 25, startsOn: '2026-12-24' }]],
      ['Pay Day 31 starting before the last day', [{ payDay: 31, startsOn: '2027-04-29' }]],
      ['two entries starting the same day', [{ payDay: 1, startsOn: '2027-01-01' }, { payDay: 1, startsOn: '2027-01-01' }]],
      ['an entry that is not an object', ['2027-01-01']],
      ['a list that is too long', Array.from({ length: 1001 }, () => ({ payDay: 1, startsOn: '2027-01-01' }))],
      ['something that is not a list', 'none'],
    ])('rejects %s', (_label, entries) => {
      const result = parsePushedChange({ entity: 'payDayHistory', record: { ...history, entries } });
      expect(result).toEqual({ ok: false, problems: [{ field: 'entries', message: expect.any(String) }] });
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

  describe('Kid Profile', () => {
    const kid = { id, updatedAt: 1, deletedAt: null, name: 'Omar', avatar: '🦊', archivedAt: null };

    it('accepts a name and an optional avatar', () => {
      expect(parsePushedChange({ entity: 'kidProfile', record: kid })).toEqual({
        ok: true,
        change: { entity: 'kidProfile', record: kid },
      });
      expect(parsePushedChange({ entity: 'kidProfile', record: { ...kid, avatar: null } }).ok).toBe(true);
    });

    it.each([
      ['an empty name', { name: '  ' }, 'name'],
      ['a long avatar', { avatar: 'x'.repeat(40) }, 'avatar'],
    ])('rejects %s', (_label, patch, field) => {
      const result = parsePushedChange({ entity: 'kidProfile', record: { ...kid, ...patch } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.problems.map((p) => p.field)).toEqual([field]);
    });
  });

  describe('Jar', () => {
    const jar = { id, updatedAt: 1, deletedAt: null, kidProfileId: categoryId, name: 'Save', order: 0, archivedAt: null };

    it('accepts a Kid Profile, a name and an order', () => {
      expect(parsePushedChange({ entity: 'jar', record: jar })).toEqual({ ok: true, change: { entity: 'jar', record: jar } });
    });

    it.each([
      ['a missing Kid Profile', { kidProfileId: null }, 'kidProfileId'],
      ['an empty name', { name: '' }, 'name'],
    ])('rejects %s', (_label, patch, field) => {
      const result = parsePushedChange({ entity: 'jar', record: { ...jar, ...patch } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.problems.map((p) => p.field)).toEqual([field]);
    });
  });

  describe('Top-up', () => {
    const jarA = '019ca8a0-3e80-7000-8000-00000000000a';
    const jarB = '019ca8a0-3e80-7000-8000-00000000000b';
    const topUp = {
      id,
      updatedAt: 1,
      deletedAt: null,
      kidProfileId: categoryId,
      kind: 'topUp',
      amount: 10000,
      splits: [
        { jarId: jarA, amount: 3000 },
        { jarId: jarB, amount: 7000 },
      ],
      date: '2026-03-01',
      note: null,
    };

    it('accepts a split that adds up to the total, keeping only known split fields', () => {
      const withExtra = { ...topUp, splits: topUp.splits.map((s) => ({ ...s, percent: 50 })) };
      expect(parsePushedChange({ entity: 'kidTransaction', record: withExtra })).toEqual({
        ok: true,
        change: { entity: 'kidTransaction', record: { ...topUp, jarId: null, toJarId: null } },
      });
    });

    it('ignores Jar fields on a Top-up (its Jars are in the split)', () => {
      const result = parsePushedChange({ entity: 'kidTransaction', record: { ...topUp, jarId: jarA, toJarId: jarB } });
      expect(result).toEqual({ ok: true, change: { entity: 'kidTransaction', record: { ...topUp, jarId: null, toJarId: null } } });
    });

    it.each([
      ['a split that does not add up', { splits: [{ jarId: jarA, amount: 9000 }] }, 'splits'],
      ['no splits', { splits: [] }, 'splits'],
      ['splits that are not a list', { splits: 'all to Spend' }, 'splits'],
      ['a split with a bad Jar', { splits: [{ jarId: 'spend', amount: 10000 }] }, 'splits'],
      ['a zero total', { amount: 0, splits: [] }, 'amount'],
      ['an unknown kind', { kind: 'allowance' }, 'kind'],
      ['a missing Kid Profile', { kidProfileId: undefined }, 'kidProfileId'],
    ])('rejects %s', (_label, patch, field) => {
      const result = parsePushedChange({ entity: 'kidTransaction', record: { ...topUp, ...patch } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.problems.map((p) => p.field)).toContain(field);
    });
  });

  describe('Kid Expense', () => {
    const jarA = '019ca8a0-3e80-7000-8000-00000000000a';
    const kidExpense = {
      id,
      updatedAt: 1,
      deletedAt: null,
      kidProfileId: categoryId,
      kind: 'kidExpense',
      amount: 1500,
      splits: [],
      jarId: jarA,
      toJarId: null,
      date: '2026-03-01',
      note: 'Ice cream',
    };

    it('accepts an amount from one Jar', () => {
      expect(parsePushedChange({ entity: 'kidTransaction', record: kidExpense })).toEqual({
        ok: true,
        change: { entity: 'kidTransaction', record: kidExpense },
      });
    });

    it('drops a split or target Jar it does not use', () => {
      const result = parsePushedChange({
        entity: 'kidTransaction',
        record: { ...kidExpense, splits: [{ jarId: jarA, amount: 1500 }], toJarId: jarA },
      });
      expect(result).toEqual({ ok: true, change: { entity: 'kidTransaction', record: kidExpense } });
    });

    it.each([
      ['no Jar', { jarId: null }, 'jarId'],
      ['a bad Jar', { jarId: 'spend' }, 'jarId'],
      ['a zero amount', { amount: 0 }, 'amount'],
    ])('rejects %s', (_label, patch, field) => {
      const result = parsePushedChange({ entity: 'kidTransaction', record: { ...kidExpense, ...patch } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.problems.map((p) => p.field)).toEqual([field]);
    });
  });

  describe('Jar Transfer', () => {
    const jarA = '019ca8a0-3e80-7000-8000-00000000000a';
    const jarB = '019ca8a0-3e80-7000-8000-00000000000b';
    const jarTransfer = {
      id,
      updatedAt: 1,
      deletedAt: null,
      kidProfileId: categoryId,
      kind: 'jarTransfer',
      amount: 1000,
      splits: [],
      jarId: jarA,
      toJarId: jarB,
      date: '2026-03-01',
      note: null,
    };

    it('accepts an amount moved from one Jar to another', () => {
      expect(parsePushedChange({ entity: 'kidTransaction', record: jarTransfer })).toEqual({
        ok: true,
        change: { entity: 'kidTransaction', record: jarTransfer },
      });
    });

    it.each([
      ['no source Jar', { jarId: null }, 'jarId'],
      ['no target Jar', { toJarId: undefined }, 'toJarId'],
      ['the same Jar twice', { toJarId: jarA }, 'toJarId'],
    ])('rejects %s', (_label, patch, field) => {
      const result = parsePushedChange({ entity: 'kidTransaction', record: { ...jarTransfer, ...patch } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.problems.map((p) => p.field)).toEqual([field]);
    });
  });

  it('rejects an unknown entity', () => {
    const result = parsePushedChange({ entity: 'goal', record: expense });
    expect(result).toEqual({ ok: false, problems: [{ field: 'entity', message: expect.any(String) }] });
  });
});
