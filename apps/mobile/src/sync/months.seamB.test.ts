/**
 * Seam B: Months created lazily on simulated devices, synced through the real
 * API (in-memory Mongo).
 */
import { DEFAULT_CATEGORY_KEYS, type DefaultCategoryKey } from '@money-tracker/shared';
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createDeviceClock, createTestDevice, type TestDevice } from '@/testing/testDevice';

const NAMES = Object.fromEntries(DEFAULT_CATEGORY_KEYS.map((key) => [key, key])) as Record<DefaultCategoryKey, string>;
const MARCH = '2026-03';
const APRIL = '2026-04';

const idOf = (device: TestDevice, name: string) => device.categories().find((c) => c.name === name)!.id;
const budgetsOf = (device: TestDevice, month: string) =>
  Object.fromEntries(device.categoryBudgets(month).map((b) => [b.categoryId, b.amount]));

describe('Months created lazily (Seam B)', () => {
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

  async function onboardedPhone(clock = createDeviceClock()) {
    const phone = await createTestDevice(server, { now: clock.now });
    await phone.signIn('sara@example.com');
    phone.onboardPersonal({ currency: 'USD', expectedIncome: 800000, month: MARCH, categoryNames: NAMES });
    return phone;
  }

  it("opening a new Month copies the previous Month's Expected Income and Category Budgets; nothing carries over", async () => {
    const phone = await onboardedPhone();
    const housing = idOf(phone, 'housing');
    const food = idOf(phone, 'food');
    phone.setCategoryBudgets(MARCH, { [housing]: 500000, [food]: 200000 });
    phone.recordExpense({ amount: 30000, date: '2026-03-10', categoryId: food });

    phone.openMonth(APRIL);

    expect(phone.monthOverview(APRIL)).toEqual({
      expectedIncome: 800000,
      income: 0,
      spending: 0,
      remaining: 0,
      unallocated: 100000,
    });
    expect(budgetsOf(phone, APRIL)).toEqual({ [housing]: 500000, [food]: 200000 });
    expect(phone.categoryBreakdown(APRIL).find((row) => row.categoryId === food)).toMatchObject({ spent: 0, remaining: 200000 });
  });

  it('opening a Month that already exists writes nothing, so later changes to the previous Month stay there', async () => {
    const phone = await onboardedPhone();
    phone.openMonth(APRIL);
    await phone.sync();
    phone.setExpectedIncome(MARCH, 900000);
    await phone.sync();

    phone.openMonth(APRIL);
    expect(phone.pendingChanges()).toBe(0);
    expect(phone.monthOverview(APRIL).expectedIncome).toBe(800000);
  });

  it('an Archived Category stays in the past Months it was used in, and its budget is not copied into new Months', async () => {
    const phone = await onboardedPhone();
    const food = idOf(phone, 'food');
    const transport = idOf(phone, 'transport');
    phone.setCategoryBudgets(MARCH, { [food]: 200000, [transport]: 50000 });
    phone.recordExpense({ amount: 4500, date: '2026-03-04', categoryId: transport });
    phone.archiveCategory(transport);

    phone.openMonth(APRIL);

    expect(budgetsOf(phone, APRIL)).toEqual({ [food]: 200000 });
    expect(phone.categoryBreakdown(APRIL).map((row) => row.categoryId)).not.toContain(transport);
    expect(phone.categoryBreakdown(MARCH).find((row) => row.categoryId === transport)).toEqual({
      categoryId: transport,
      budget: 50000,
      spent: 4500,
      remaining: 45500,
    });
  });

  it('two devices opening the same Month offline end up with one plan and one set of budgets', async () => {
    const phone = await onboardedPhone();
    const food = idOf(phone, 'food');
    phone.setCategoryBudgets(MARCH, { [food]: 200000 });
    await phone.sync();
    const tablet = await createTestDevice(server);
    await tablet.signIn('sara@example.com');
    await tablet.sync();

    phone.goOffline();
    tablet.goOffline();
    phone.openMonth(APRIL);
    tablet.openMonth(APRIL);
    phone.goOnline();
    tablet.goOnline();
    await phone.sync();
    await tablet.sync();
    await phone.sync();

    for (const device of [phone, tablet]) {
      expect(device.monthPlans().filter((p) => p.month === APRIL)).toHaveLength(1);
      expect(device.categoryBudgets(APRIL)).toHaveLength(1);
      expect(device.monthOverview(APRIL)).toMatchObject({ expectedIncome: 800000, unallocated: 600000 });
    }
  });

  it("a device opening a Month late doesn't overwrite changes another device already made to it", async () => {
    const phoneClock = createDeviceClock();
    const phone = await onboardedPhone(phoneClock);
    const food = idOf(phone, 'food');
    phone.setCategoryBudgets(MARCH, { [food]: 200000 });
    await phone.sync();
    const tabletClock = createDeviceClock();
    const tablet = await createTestDevice(server, { now: tabletClock.now });
    await tablet.signIn('sara@example.com');
    await tablet.sync();

    // The phone plans April (a bonus Month) and syncs; the tablet, offline, opens April an hour later.
    phoneClock.advance(60_000);
    phone.openMonth(APRIL);
    phone.setExpectedIncome(APRIL, 1000000);
    phone.setCategoryBudgets(APRIL, { [food]: 250000 });
    await phone.sync();
    tablet.goOffline();
    tabletClock.advance(3_600_000);
    tablet.openMonth(APRIL);
    expect(tablet.monthOverview(APRIL).expectedIncome).toBe(800000);

    tablet.goOnline();
    await tablet.sync();
    await phone.sync();
    for (const device of [phone, tablet]) {
      expect(device.monthOverview(APRIL).expectedIncome).toBe(1000000);
      expect(budgetsOf(device, APRIL)).toEqual({ [food]: 250000 });
    }
  });
});
