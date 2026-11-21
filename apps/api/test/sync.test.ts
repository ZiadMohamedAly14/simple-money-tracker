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
import { writeWithServerVersion } from '../src/models/counter.model';
import { Transaction } from '../src/models/synced.model';

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
          icon: 'other',
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
    expect(data(again)).toEqual({ cursor: data(pulled).cursor, changes: [], hasMore: false });
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
      record: { id: categoryId, updatedAt: 1, deletedAt: null, name: 'Food', order: 1, isOther: false, archivedAt: null, icon: 'food-groceries' },
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

  describe('Category icons', () => {
    const categoryId = '019ca8a0-3e80-7000-8000-0000000000cc';
    const category = (icon: unknown, patch: object = {}) => ({
      entity: 'category',
      record: { id: categoryId, updatedAt: 1772355600000, deletedAt: null, name: 'Rent', order: 0, isOther: false, archivedAt: null, icon, ...patch },
    });

    it('stores a Category icon and hands it to the other device', async () => {
      const phone = await signIn();
      const tablet = await signIn();
      expect((await sync(phone, 0, [category('housing')])).status).toBe(200);

      const pulled = data(await sync(tablet, 0)).changes.find((c) => c.record.id === categoryId);
      expect(pulled?.record).toMatchObject({ name: 'Rent', icon: 'housing' });
    });

    it('accepts an icon name this server has never heard of, so a newer app is never refused', async () => {
      const sara = await signIn();
      const res = await sync(sara, 0, [category('rocket-ship')]);
      expect(res.status).toBe(200);
      expect(data(res).changes.find((c) => c.record.id === categoryId)?.record).toMatchObject({ icon: 'rocket-ship' });
    });

    it('accepts a Category with no icon from an older app', async () => {
      const sara = await signIn();
      const { icon: _icon, ...withoutIcon } = category(null).record;
      const res = await sync(sara, 0, [{ entity: 'category', record: withoutIcon }]);
      expect(res.status).toBe(200);
      expect(data(res).changes.find((c) => c.record.id === categoryId)?.record).toMatchObject({ icon: null });
    });

    it('refuses an icon that is not a short kebab-case name', async () => {
      const sara = await signIn();
      const res = await sync(sara, 0, [category('Not An Icon!')]);
      expect(res.status).toBe(422);
      expect(res.body.data).toEqual([{ field: 'changes[0].record.icon', message: expect.any(String) }]);
    });

    it('deletes a Category, and the deletion beats a later edit from another device', async () => {
      const phone = await signIn();
      const tablet = await signIn();
      await sync(phone, 0, [category('housing')]);
      await sync(phone, 0, [category('housing', { updatedAt: 1772355600000 + 1000, deletedAt: 1772355600000 + 1000 })]);
      await sync(tablet, 0, [category('health', { updatedAt: 1772355600000 + 5000, name: 'Rent and gym' })]);

      const stored = data(await sync(phone, 0)).changes.find((c) => c.record.id === categoryId);
      expect(stored?.record.deletedAt).toBe(1772355600000 + 1000);
    });
  });

  describe('the Other Category', () => {
    const otherChange = (accountId: string, patch: object = {}): PushedChange =>
      ({
        entity: 'category',
        record: { id: otherCategoryId(accountId), updatedAt: 1772355600000, deletedAt: null, name: 'Other', order: 9999, isOther: true, archivedAt: null, icon: 'other', ...patch },
      }) as PushedChange;

    it.each([
      ['archived', { archivedAt: 1772355600000 }, 'archivedAt'],
      ['deleted', { deletedAt: 1772355600000 }, 'deletedAt'],
      ['no longer flagged as Other', { isOther: false }, 'isOther'],
    ])("can't be %s", async (_label, patch, field) => {
      const sara = await signIn();
      await sync(sara, 0);
      const res = await sync(sara, 0, [otherChange(sara.accountId, patch)]);
      expect(res.status).toBe(422);
      expect(res.body.data).toEqual([{ field: `changes[0].record.${field}`, message: expect.any(String) }]);
    });

    it('is the only Category flagged as Other', async () => {
      const sara = await signIn();
      const res = await sync(sara, 0, [
        otherChange(sara.accountId, { id: '019ca8a0-3e80-7000-8000-0000000000cb', name: 'Misc' }),
      ]);
      expect(res.status).toBe(422);
      expect(res.body.data).toEqual([{ field: 'changes[0].record.isOther', message: expect.any(String) }]);
    });

    it('takes other edits, like any Category', async () => {
      const sara = await signIn();
      await sync(sara, 0);
      const res = await sync(sara, 0, [otherChange(sara.accountId, { updatedAt: Date.now() + 1000 })]);
      expect(res.status).toBe(200);
    });
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

  describe('conflicts and deletion markers (ADR-0001)', () => {
    const T = 1772355600000;

    async function pushed(who: SignedIn, patch: Partial<Record<string, unknown>>) {
      return sync(who, 0, [expense(otherCategoryId(who.accountId), patch)]);
    }

    const storedCopy = async (who: SignedIn) =>
      data(await sync(who, 0)).changes.find((c) => c.record.id === EXPENSE_ID)?.record;

    it('keeps the later edit when an older edit of the same record arrives afterwards', async () => {
      const phone = await signIn();
      const tablet = await signIn();
      await pushed(phone, { updatedAt: T + 2000, amount: 300 });

      const res = await pushed(tablet, { updatedAt: T + 1000, amount: 200 });

      expect(res.status).toBe(200);
      expect(await storedCopy(phone)).toMatchObject({ amount: 300, updatedAt: T + 2000 });
    });

    it('takes a later edit over the stored copy', async () => {
      const phone = await signIn();
      const tablet = await signIn();
      await pushed(phone, { updatedAt: T + 1000, amount: 200 });

      await pushed(tablet, { updatedAt: T + 2000, amount: 300 });

      expect(await storedCopy(phone)).toMatchObject({ amount: 300, updatedAt: T + 2000 });
    });

    it('hands a losing device the winning copy even when its cursor is already past it', async () => {
      const phone = await signIn();
      const tablet = await signIn();
      await pushed(phone, { updatedAt: T + 2000, amount: 300 });
      const caughtUp = data(await sync(tablet, 0)).cursor;

      const res = await sync(tablet, caughtUp, [expense(otherCategoryId(tablet.accountId), { updatedAt: T + 1000, amount: 200 })]);

      expect(data(res).changes).toEqual([
        expect.objectContaining({ entity: 'transaction', record: expect.objectContaining({ id: EXPENSE_ID, amount: 300 }) }),
      ]);
    });

    it('keeps a deletion even when an older live copy syncs back', async () => {
      const phone = await signIn();
      const tablet = await signIn();
      await pushed(phone, { updatedAt: T + 2000, deletedAt: T + 2000 });

      await pushed(tablet, { updatedAt: T + 1000, amount: 999 });

      expect(await storedCopy(phone)).toMatchObject({ deletedAt: T + 2000 });
    });

    it('keeps a deletion even when a later edit syncs after it', async () => {
      const phone = await signIn();
      const tablet = await signIn();
      await pushed(phone, { updatedAt: T + 1000, deletedAt: T + 1000 });

      await pushed(tablet, { updatedAt: T + 2000, amount: 999 });

      expect(await storedCopy(phone)).toMatchObject({ deletedAt: T + 1000 });
    });

    it('deletes a record whose later edit arrived first', async () => {
      const phone = await signIn();
      const tablet = await signIn();
      await pushed(tablet, { updatedAt: T + 2000, amount: 999 });

      await pushed(phone, { updatedAt: T + 1000, deletedAt: T + 1000 });

      expect(await storedCopy(phone)).toMatchObject({ deletedAt: T + 1000 });
    });
  });

  describe('paged pulls', () => {
    const idFor = (n: number) => `019ca8a0-3e80-7000-8000-${String(n).padStart(12, '0')}`;

    it('hands a device catching up on a long history everything, a page at a time', async () => {
      const phone = await signIn();
      const tablet = await signIn();
      const ids = [1, 2, 3, 4, 5].map(idFor);
      await sync(phone, 0, ids.map((id) => expense(otherCategoryId(phone.accountId), { id })));

      const pages: SyncResponseData[] = [];
      let cursor = 0;
      for (let round = 0; round < 10; round += 1) {
        const res = await request(app)
          .post('/sync')
          .set('Authorization', `Bearer ${tablet.accessToken}`)
          .send({ cursor, changes: [], limit: 2 });
        expect(res.status).toBe(200);
        pages.push(data(res));
        cursor = data(res).cursor;
        if (!data(res).hasMore) break;
      }

      expect(pages.map((p) => p.changes.length)).toEqual([2, 2, 2]);
      expect(pages.map((p) => p.hasMore)).toEqual([true, true, false]);
      expect(pages.flatMap((p) => p.changes.map((c) => c.record.id))).toEqual([otherCategoryId(phone.accountId), ...ids]);
    });

    it('says when nothing more is waiting', async () => {
      const sara = await signIn();
      expect(data(await sync(sara, 0)).hasMore).toBe(false);
    });

    it.each([0, 501, 'lots'])('rejects a page size of %p', async (limit) => {
      const sara = await signIn();
      const res = await request(app)
        .post('/sync')
        .set('Authorization', `Bearer ${sara.accessToken}`)
        .send({ cursor: 0, changes: [], limit });
      expect(res.status).toBe(422);
    });
  });

  describe('syncs of one Account running at the same time', () => {
    /** Starts a write the way another sync request would, held open until `finish` is called. */
    function slowWrite(who: SignedIn, id: string) {
      let open!: () => void;
      const gate = new Promise<void>((resolve) => {
        open = resolve;
      });
      const done = writeWithServerVersion(clock().getTime(), async (serverVersion) => {
        await gate;
        const { record } = expense(otherCategoryId(who.accountId), { id });
        await Transaction.create({ ...record, _id: id, accountId: who.accountId, serverVersion });
      });
      return {
        async finish() {
          open();
          await done;
        },
      };
    }

    it("never moves a device's cursor past a change that is still being written", async () => {
      const phone = await signIn();
      const tablet = await signIn();
      await sync(phone, 0);
      const SLOW_ID = '019ca8a0-3e80-7000-8000-00000000005a';
      const slow = slowWrite(phone, SLOW_ID);

      const meanwhile = await sync(tablet, 0, [expense(otherCategoryId(tablet.accountId))]);
      expect(meanwhile.status).toBe(200);
      await slow.finish();

      const after = await sync(tablet, data(meanwhile).cursor);
      const seen = [...data(meanwhile).changes, ...data(after).changes].map((c) => c.record.id);
      expect(seen).toEqual(expect.arrayContaining([SLOW_ID, EXPENSE_ID]));
    });

    it('stops waiting for a write that was abandoned more than a minute ago', async () => {
      const phone = await signIn();
      await sync(phone, 0);
      slowWrite(phone, '019ca8a0-3e80-7000-8000-00000000005b'); // never finishes, like a crashed request
      await sync(phone, 0, [expense(otherCategoryId(phone.accountId))]);

      clock.advance(2 * MINUTE);

      const res = await sync(phone, 0);
      expect(data(res).changes.map((c) => c.record.id)).toContain(EXPENSE_ID);
    });
  });
});
