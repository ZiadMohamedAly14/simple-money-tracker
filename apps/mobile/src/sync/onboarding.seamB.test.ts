/**
 * Seam B: personal onboarding and Month plans on simulated devices, synced
 * through the real API (in-memory Mongo).
 */
import { DEFAULT_CATEGORY_KEYS, defaultCategoryId, monthPlanId, otherCategoryId, type DefaultCategoryKey } from '@money-tracker/shared';
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createTestDevice } from '@/testing/testDevice';

const ENGLISH: Record<DefaultCategoryKey, string> = {
  food: 'Food & Groceries',
  bills: 'Bills & Utilities',
  shopping: 'Shopping',
};

const ARABIC: Record<DefaultCategoryKey, string> = {
  food: 'الطعام والبقالة',
  bills: 'الفواتير والخدمات',
  shopping: 'التسوق',
};

describe('personal onboarding and Month plans (Seam B)', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.clear();
  });
  afterAll(async () => {
    await server.stop();
  });

  it('a new adult onboarding offline gets their currency, the default Categories and this Month’s plan', async () => {
    const phone = await createTestDevice(server);
    await phone.signIn('sara@example.com');
    expect(phone.onboarding()).toBe('not_started');

    phone.goOffline();
    phone.onboardPersonal({ currency: 'USD', expectedIncome: 800000, month: '2026-03', categoryNames: ENGLISH });

    expect(phone.onboarding()).toBe('unreported');
    expect(phone.accountSettings()).toMatchObject({ currency: 'USD', numberingSystem: 'western' });
    expect(phone.categories().map((c) => (c.isOther ? '(Other)' : c.name))).toEqual([
      'Food & Groceries',
      'Bills & Utilities',
      'Shopping',
      '(Other)',
    ]);
    // Each default has its icon set; Other is always `other`.
    expect(phone.categories().map((c) => c.icon)).toEqual(['food-groceries', 'bills-utilities', 'shopping-spend', 'other']);
    expect(phone.monthPlans()).toEqual([expect.objectContaining({ month: '2026-03', expectedIncome: 800000 })]);
    // Every Category starts with a budget of 0: no Category Budget yet.
    expect(phone.monthOverview('2026-03')).toEqual({
      expectedIncome: 800000,
      income: 0,
      spending: 0,
      remaining: 0,
      unallocated: 800000,
    });
  });

  it('names the default Categories in the device language', async () => {
    const phone = await createTestDevice(server);
    await phone.signIn('sara@example.com');
    phone.onboardPersonal({ currency: 'EGP', expectedIncome: 0, month: '2026-03', categoryNames: ARABIC });
    expect(phone.categories().slice(0, 2).map((c) => c.name)).toEqual(['الطعام والبقالة', 'الفواتير والخدمات']);
  });

  it('marks onboarding complete on the server once online, so a second device skips onboarding and gets the same data', async () => {
    const phone = await createTestDevice(server);
    await phone.signIn('sara@example.com');
    phone.goOffline();
    phone.onboardPersonal({ currency: 'USD', expectedIncome: 800000, month: '2026-03', categoryNames: ENGLISH });
    expect(await phone.sync()).toBe('offline');

    const early = await createTestDevice(server);
    await early.signIn('sara@example.com');
    expect(early.onboarding()).toBe('not_started'); // the server hasn't heard yet

    phone.goOnline();
    expect(await phone.sync()).toBe('synced');
    expect(phone.onboarding()).toBe('complete');

    const tablet = await createTestDevice(server);
    await tablet.signIn('sara@example.com');
    expect(tablet.onboarding()).toBe('complete');
    expect(await tablet.sync()).toBe('synced');
    expect(tablet.accountSettings()).toMatchObject({ currency: 'USD' });
    expect(tablet.categories().map((c) => c.id)).toEqual(phone.categories().map((c) => c.id));
    expect(tablet.monthPlans()).toEqual(phone.monthPlans());
  });

  it('two devices onboarding the same Account offline end up with one set of Categories and one Month plan', async () => {
    const phone = await createTestDevice(server);
    const tablet = await createTestDevice(server);
    await phone.signIn('sara@example.com');
    await tablet.signIn('sara@example.com');
    phone.goOffline();
    tablet.goOffline();
    phone.onboardPersonal({ currency: 'USD', expectedIncome: 800000, month: '2026-03', categoryNames: ENGLISH });
    tablet.onboardPersonal({ currency: 'USD', expectedIncome: 900000, month: '2026-03', categoryNames: ENGLISH });

    phone.goOnline();
    tablet.goOnline();
    await phone.sync();
    await tablet.sync();
    await phone.sync();

    const accountId = phone.accountId()!;
    const ids = [...DEFAULT_CATEGORY_KEYS.map((key) => defaultCategoryId(accountId, key)), otherCategoryId(accountId)];
    expect(phone.categories().map((c) => c.id)).toEqual(ids);
    expect(tablet.categories().map((c) => c.id)).toEqual(ids);
    expect(phone.monthPlans()).toHaveLength(1);
    expect(tablet.monthPlans()).toEqual(phone.monthPlans());
  });

  it('splits Expected Income across Categories, and the second device sees the same Unallocated', async () => {
    const phone = await createTestDevice(server);
    await phone.signIn('sara@example.com');
    phone.onboardPersonal({ currency: 'USD', expectedIncome: 800000, month: '2026-03', categoryNames: ENGLISH });
    const accountId = phone.accountId()!;

    phone.setCategoryBudgets('2026-03', {
      [defaultCategoryId(accountId, 'bills')]: 300000,
      [defaultCategoryId(accountId, 'food')]: 150000,
      [defaultCategoryId(accountId, 'shopping')]: 0,
    });
    expect(phone.monthOverview('2026-03').unallocated).toBe(350000);
    await phone.sync();

    const tablet = await createTestDevice(server);
    await tablet.signIn('sara@example.com');
    await tablet.sync();
    expect(tablet.monthOverview('2026-03').unallocated).toBe(350000);
  });

  it('shows extra Income as ordinary Income with a note: Income can exceed Expected Income', async () => {
    const phone = await createTestDevice(server);
    await phone.signIn('sara@example.com');
    phone.onboardPersonal({ currency: 'USD', expectedIncome: 800000, month: '2026-03', categoryNames: ENGLISH });
    phone.store.create('transaction', { kind: 'income', amount: 800000, categoryId: null, date: '2026-03-01', note: 'Salary' });
    phone.store.create('transaction', { kind: 'income', amount: 200000, categoryId: null, date: '2026-03-20', note: 'Freelance' });
    phone.recordExpense({ amount: 50000, date: '2026-03-05' });
    phone.recordExpense({ amount: 999, date: '2026-04-01' }); // next Month

    expect(phone.monthOverview('2026-03')).toEqual({
      expectedIncome: 800000,
      income: 1000000,
      spending: 50000,
      remaining: 950000,
      unallocated: 800000,
    });
  });

  it('two offline devices creating the same Month end up with one Month plan', async () => {
    const phone = await createTestDevice(server);
    const tablet = await createTestDevice(server);
    await phone.signIn('sara@example.com');
    await tablet.signIn('sara@example.com');

    phone.goOffline();
    tablet.goOffline();
    phone.setExpectedIncome('2026-04', 800000);
    tablet.setExpectedIncome('2026-04', 850000);

    phone.goOnline();
    tablet.goOnline();
    expect(await phone.sync()).toBe('synced');
    expect(await tablet.sync()).toBe('synced');
    expect(await phone.sync()).toBe('synced');

    const id = monthPlanId(phone.accountId()!, '2026-04');
    expect(phone.monthPlans()).toEqual([expect.objectContaining({ id, month: '2026-04' })]);
    expect(tablet.monthPlans()).toEqual([expect.objectContaining({ id, month: '2026-04' })]);
    expect(tablet.monthPlans()[0]!.expectedIncome).toBe(phone.monthPlans()[0]!.expectedIncome);
  });
});
