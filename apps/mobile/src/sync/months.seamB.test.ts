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
/** A Month's Category Budgets above 0 (a missing budget and a 0 one are the same). */
const budgetsOf = (device: TestDevice, month: string) =>
  Object.fromEntries(device.categoryBudgets(month).filter((b) => b.amount > 0).map((b) => [b.categoryId, b.amount]));

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
    phone.onboardPersonal({ currency: 'USD', expectedIncome: 800000, payDay: 1, today: `${MARCH}-01`, categoryNames: NAMES });
    return phone;
  }

  it("opening a new Month copies the previous Month's Expected Income and Category Budgets; nothing carries over", async () => {
    const phone = await onboardedPhone();
    const housing = idOf(phone, 'bills');
    const food = idOf(phone, 'food');
    phone.setCategoryBudgets(MARCH, { [housing]: 500000, [food]: 200000 });
    phone.recordExpense({ amount: 30000, date: '2026-03-10', categoryId: food });

    phone.openMonth(APRIL);

    expect(phone.monthOverview(APRIL)).toEqual({
      expectedIncome: 800000,
      income: 0,
      spending: 0,
      remaining: 800000,
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
    const transport = idOf(phone, 'shopping');
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
      expect(Object.keys(budgetsOf(device, APRIL))).toHaveLength(1);
      expect(device.monthOverview(APRIL)).toMatchObject({ expectedIncome: 800000, unallocated: 600000 });
    }
  });

  it("a Month's first Transaction creates it, before it is ever opened", async () => {
    const phone = await onboardedPhone();
    phone.recordExpense({ amount: 1200, date: '2026-04-02' });
    expect(phone.monthOverview(APRIL)).toMatchObject({ expectedIncome: 800000, spending: 1200 });
  });

  it('an Expense can be recorded in an earlier Month, or moved there by editing its date', async () => {
    const phone = await onboardedPhone();
    const food = idOf(phone, 'food');
    phone.openMonth(APRIL);

    phone.recordExpense({ amount: 2500, date: '2026-03-28', categoryId: food });
    const late = phone.recordExpense({ amount: 900, date: '2026-04-01', categoryId: food });
    phone.editExpense(late, { date: '2026-03-31' });
    await phone.sync();

    const tablet = await createTestDevice(server);
    await tablet.signIn('sara@example.com');
    await tablet.sync();
    for (const device of [phone, tablet]) {
      expect(device.monthOverview(MARCH).spending).toBe(3400);
      expect(device.monthOverview(APRIL).spending).toBe(0);
      expect(device.categoryBreakdown(MARCH).find((row) => row.categoryId === food)?.spent).toBe(3400);
    }
  });

  it('moving an Expense into a Month that has no plan yet creates that Month', async () => {
    const phone = await onboardedPhone();
    const id = phone.recordExpense({ amount: 900, date: '2026-03-15' });
    phone.editExpense(id, { date: '2026-05-01' });
    expect(phone.monthOverview('2026-05')).toMatchObject({ expectedIncome: 800000, spending: 900 });
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
  describe('two devices copying the same new Month, one behind on sync', () => {
    /**
     * The phone knows March's plan and that Shopping was archived; the tablet
     * last synced in February. Both open April offline.
     */
    async function phoneAheadTabletBehind() {
      const phone = await createTestDevice(server);
      await phone.signIn('sara@example.com');
      phone.onboardPersonal({ currency: 'USD', expectedIncome: 800000, payDay: 1, today: '2026-02-01', categoryNames: NAMES });
      const [food, bills, shopping] = ['food', 'bills', 'shopping'].map((name) => idOf(phone, name)) as [string, string, string];
      phone.setCategoryBudgets('2026-02', { [food]: 100000, [bills]: 50000, [shopping]: 30000 });
      await phone.sync();
      const tablet = await createTestDevice(server);
      await tablet.signIn('sara@example.com');
      await tablet.sync();
      tablet.goOffline();

      phone.openMonth(MARCH);
      phone.setExpectedIncome(MARCH, 900000);
      phone.setCategoryBudgets(MARCH, { [food]: 200000, [bills]: 0 });
      phone.archiveCategory(shopping);
      await phone.sync();
      phone.goOffline();

      phone.openMonth(APRIL);
      tablet.openMonth(APRIL); // copies February: it hasn't seen March or the archive
      return { phone, tablet, food };
    }

    const expectAprilFromMarch = (devices: TestDevice[], food: string) => {
      for (const device of devices) {
        expect(device.monthPlans().filter((p) => p.month === APRIL)).toEqual([expect.objectContaining({ expectedIncome: 900000 })]);
        expect(budgetsOf(device, APRIL)).toEqual({ [food]: 200000 });
      }
    };

    it('converge on the copy from the newest source Month when the device behind syncs first', async () => {
      const { phone, tablet, food } = await phoneAheadTabletBehind();
      tablet.goOnline();
      await tablet.sync();
      phone.goOnline();
      await phone.sync();
      await tablet.sync();
      expectAprilFromMarch([phone, tablet], food);
    });

    it('converge on the copy from the newest source Month when the device ahead syncs first', async () => {
      const { phone, tablet, food } = await phoneAheadTabletBehind();
      phone.goOnline();
      await phone.sync();
      tablet.goOnline();
      await tablet.sync();
      await phone.sync();
      expectAprilFromMarch([phone, tablet], food);
    });
  });
});
