import request from 'supertest';
import type { Express } from 'express';
import {
  accountSettingsId,
  categoryBudgetId,
  monthPlanId,
  otherCategoryId,
  type PushedChange,
  type SyncResponseData,
} from '@money-tracker/shared';
import { MINUTE, buildTestApp, createTestClock, createTestMailer, type TestClock, type TestMailer } from './helpers/testApp';
import { useTestDatabase } from './helpers/testDatabase';

interface SignedIn {
  accessToken: string;
  accountId: string;
}

const EXPENSE_ID = '019ca8a0-3e80-7000-8000-000000000001';

const expense = (categoryId: string, patch: Partial<Record<string, unknown>> = {}): PushedChange =>
  ({
    entity: 'transaction',
    record: {
      id: EXPENSE_ID,
      updatedAt: 1772355600000,
      deletedAt: null,
      kind: 'expense',
      amount: 12550,
      categoryId,
      date: '2026-03-01',
      note: 'Lunch',
      ...patch,
    },
  }) as PushedChange;

describe('POST /sync', () => {
  useTestDatabase();

  let mailer: TestMailer;
  let clock: TestClock;
  let app: Express;

  beforeEach(() => {
    mailer = createTestMailer();
    clock = createTestClock();
    app = buildTestApp({}, { mailer, now: clock });
  });

  async function signIn(email = 'sara@example.com'): Promise<SignedIn> {
    clock.advance(MINUTE); // a code can be re-sent to one email once a minute
    await request(app).post('/auth/code').send({ email, language: 'en' });
    const res = await request(app).post('/auth/verify').send({ email, code: mailer.lastCodeFor(email) });
    expect(res.status).toBe(200);
    return { accessToken: res.body.data.accessToken, accountId: res.body.data.account.id };
  }

  const sync = (who: SignedIn, cursor: number, changes: unknown[] = []) =>
    request(app).post('/sync').set('Authorization', `Bearer ${who.accessToken}`).send({ cursor, changes });

  const data = (res: request.Response): SyncResponseData => res.body.data;

  it('needs a signed-in device', async () => {
    const res = await request(app).post('/sync').send({ cursor: 0, changes: [] });
    expect(res.status).toBe(401);
  });

  it("gives a new Account's first sync its Other Category", async () => {
    const sara = await signIn();
    const res = await sync(sara, 0);

    expect(res.status).toBe(200);
    expect(data(res).changes).toEqual([
      {
        entity: 'category',
        record: {
          id: otherCategoryId(sara.accountId),
          accountId: sara.accountId,
          name: 'Other',
          order: expect.any(Number),
          isOther: true,
          archivedAt: null,
          updatedAt: expect.any(Number),
          deletedAt: null,
          serverVersion: expect.any(Number),
        },
      },
    ]);
    expect(data(res).cursor).toBe(data(res).changes[0]!.record.serverVersion);
  });

  it('pushes an Expense and returns it stamped with the Account and a server version', async () => {
    const sara = await signIn();
    const first = await sync(sara, 0);

    const res = await sync(sara, data(first).cursor, [expense(otherCategoryId(sara.accountId))]);

    expect(res.status).toBe(200);
    expect(data(res).changes).toEqual([
      {
        entity: 'transaction',
        record: {
          ...expense(otherCategoryId(sara.accountId)).record,
          accountId: sara.accountId,
          serverVersion: data(first).cursor + 1,
        },
      },
    ]);
    expect(data(res).cursor).toBe(data(first).cursor + 1);
  });

  it("lets the Account's other device pull the Expense, then nothing new after its cursor", async () => {
    const phone = await signIn();
    const tablet = await signIn();
    await sync(phone, 0, [expense(otherCategoryId(phone.accountId))]);

    const pulled = await sync(tablet, 0);
    expect(data(pulled).changes.map((c) => c.record.id)).toEqual([otherCategoryId(phone.accountId), EXPENSE_ID]);

    const again = await sync(tablet, data(pulled).cursor);
    expect(data(again)).toEqual({ cursor: data(pulled).cursor, changes: [] });
  });

  it("never shows one Account's records to another", async () => {
    const sara = await signIn('sara@example.com');
    const omar = await signIn('omar@example.com');
    await sync(sara, 0, [expense(otherCategoryId(sara.accountId))]);

    const res = await sync(omar, 0);
    expect(data(res).changes.map((c) => c.record.id)).toEqual([otherCategoryId(omar.accountId)]);
  });

  it('lists every problem in a malformed change and stores nothing', async () => {
    const sara = await signIn();
    const res = await sync(sara, 0, [expense(otherCategoryId(sara.accountId), { amount: -1, date: 'yesterday' })]);

    expect(res.status).toBe(422);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        { field: 'changes[0].record.amount', message: expect.any(String) },
        { field: 'changes[0].record.date', message: expect.any(String) },
      ]),
    );
    expect(data(await sync(sara, 0)).changes.map((c) => c.entity)).toEqual(['category']);
  });

  it('rejects a bad cursor', async () => {
    const sara = await signIn();
    expect((await sync(sara, -1)).status).toBe(422);
  });

  it("rejects an Expense in another Account's Category", async () => {
    const sara = await signIn('sara@example.com');
    const omar = await signIn('omar@example.com');
    await sync(omar, 0);

    const res = await sync(sara, 0, [expense(otherCategoryId(omar.accountId))]);
    expect(res.status).toBe(422);
    expect(res.body.data).toEqual([{ field: 'changes[0].record.categoryId', message: expect.any(String) }]);
  });

  it('accepts an Expense in a Category pushed in the same sync', async () => {
    const sara = await signIn();
    const categoryId = '019ca8a0-3e80-7000-8000-0000000000ca';
    const category: PushedChange = {
      entity: 'category',
      record: { id: categoryId, updatedAt: 1, deletedAt: null, name: 'Food', order: 1, isOther: false, archivedAt: null },
    };

    const res = await sync(sara, 0, [category, expense(categoryId)]);
    expect(res.status).toBe(200);
    expect(data(res).changes.map((c) => c.record.id)).toEqual(
      expect.arrayContaining([categoryId, EXPENSE_ID]),
    );
  });

  it("refuses to overwrite another Account's record", async () => {
    const sara = await signIn('sara@example.com');
    const omar = await signIn('omar@example.com');
    await sync(omar, 0, [expense(otherCategoryId(omar.accountId))]);

    const res = await sync(sara, 0, [expense(otherCategoryId(sara.accountId), { amount: 1 })]);
    expect(res.status).toBe(403);

    const omarsCopy = data(await sync(omar, 0)).changes.find((c) => c.record.id === EXPENSE_ID);
    expect(omarsCopy?.record).toMatchObject({ amount: 12550, accountId: omar.accountId });
  });

  describe('Account settings, Month plans and Category Budgets', () => {
    const meta = { updatedAt: 1772355600000, deletedAt: null };
    const settings = (accountId: string, patch: object = {}): PushedChange =>
      ({ entity: 'accountSettings', record: { id: accountSettingsId(accountId), ...meta, currency: 'EGP', numberingSystem: 'western', ...patch } }) as PushedChange;
    const plan = (accountId: string, month: string, patch: object = {}): PushedChange =>
      ({ entity: 'monthPlan', record: { id: monthPlanId(accountId, month), ...meta, month, expectedIncome: 800000, ...patch } }) as PushedChange;
    const budget = (accountId: string, month: string, categoryId: string, patch: object = {}): PushedChange =>
      ({
        entity: 'categoryBudget',
        record: { id: categoryBudgetId(accountId, month, categoryId), ...meta, month, categoryId, amount: 300000, ...patch },
      }) as PushedChange;

    it("stores them and the Account's other device pulls them", async () => {
      const phone = await signIn();
      const tablet = await signIn();
      const other = otherCategoryId(phone.accountId);

      const res = await sync(phone, 0, [settings(phone.accountId), plan(phone.accountId, '2026-03'), budget(phone.accountId, '2026-03', other)]);
      expect(res.status).toBe(200);

      const pulled = data(await sync(tablet, 0)).changes;
      expect(pulled.map((c) => c.entity)).toEqual(expect.arrayContaining(['accountSettings', 'monthPlan', 'categoryBudget']));
      expect(pulled.find((c) => c.entity === 'monthPlan')?.record).toMatchObject({
        id: monthPlanId(phone.accountId, '2026-03'),
        accountId: phone.accountId,
        month: '2026-03',
        expectedIncome: 800000,
      });
    });

    it('two devices creating the same Month end up with one Month plan', async () => {
      const phone = await signIn();
      const tablet = await signIn();
      await sync(phone, 0, [plan(phone.accountId, '2026-03', { expectedIncome: 800000 })]);
      await sync(tablet, 0, [plan(tablet.accountId, '2026-03', { expectedIncome: 900000, updatedAt: meta.updatedAt + 1 })]);

      const plans = data(await sync(phone, 0)).changes.filter((c) => c.entity === 'monthPlan');
      expect(plans).toHaveLength(1);
    });

    it.each([
      ['a Month plan whose ID is not the one for its Month', (a: string) => plan(a, '2026-03', { id: monthPlanId(a, '2026-04') })],
      [
        'a Category Budget whose ID is not the one for its Month and Category',
        (a: string) => budget(a, '2026-03', otherCategoryId(a), { id: categoryBudgetId(a, '2026-04', otherCategoryId(a)) }),
      ],
      ['Account settings under any other ID', (a: string) => settings(a, { id: otherCategoryId(a) })],
    ])('rejects %s', async (_label, make) => {
      const sara = await signIn();
      const res = await sync(sara, 0, [make(sara.accountId)]);
      expect(res.status).toBe(422);
      expect(res.body.data).toEqual([{ field: 'changes[0].record.id', message: expect.any(String) }]);
    });

    it("rejects a Category Budget for another Account's Category", async () => {
      const sara = await signIn('sara@example.com');
      const omar = await signIn('omar@example.com');
      await sync(omar, 0);

      const res = await sync(sara, 0, [budget(sara.accountId, '2026-03', otherCategoryId(omar.accountId))]);
      expect(res.status).toBe(422);
      expect(res.body.data).toEqual([{ field: 'changes[0].record.categoryId', message: expect.any(String) }]);
    });
  });
});
