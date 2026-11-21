/**
 * Seam B: Categories and Category Budgets on simulated devices, synced
 * through the real API (in-memory Mongo).
 */
import { DEFAULT_CATEGORY_KEYS, categoryBudgetId, otherCategoryId, type DefaultCategoryKey } from '@money-tracker/shared';
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createDeviceClock, createTestDevice, type TestDevice } from '@/testing/testDevice';

const NAMES = Object.fromEntries(DEFAULT_CATEGORY_KEYS.map((key) => [key, key])) as Record<DefaultCategoryKey, string>;
const MONTH = '2026-03';

const names = (device: TestDevice) => device.activeCategories().map((c) => (c.isOther ? '(Other)' : c.name));
const idOf = (device: TestDevice, name: string) => device.categories().find((c) => c.name === name)!.id;

describe('Categories and Category Budgets (Seam B)', () => {
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
    phone.onboardPersonal({ currency: 'USD', expectedIncome: 800000, month: MONTH, categoryNames: NAMES });
    return phone;
  }

  async function secondDevice(clock = createDeviceClock()) {
    const tablet = await createTestDevice(server, { now: clock.now });
    await tablet.signIn('sara@example.com');
    await tablet.sync();
    return tablet;
  }

  it('a Category added offline goes after the others, before Other, and reaches the second device', async () => {
    const phone = await onboardedPhone();
    phone.goOffline();
    phone.addCategory('  Pets  ');
    expect(names(phone).slice(-3)).toEqual(['kids', 'Pets', '(Other)']);

    phone.goOnline();
    await phone.sync();
    const tablet = await secondDevice();
    expect(names(tablet).slice(-3)).toEqual(['kids', 'Pets', '(Other)']);
  });

  it('refuses a blank or too long Category name', async () => {
    const phone = await onboardedPhone();
    expect(() => phone.addCategory('   ')).toThrow();
    expect(() => phone.addCategory('x'.repeat(61))).toThrow();
    expect(() => phone.renameCategory(idOf(phone, 'food'), '')).toThrow();
    expect(names(phone)).toContain('food');
  });

  it('a renamed Category keeps its ID, so its Expenses and budgets follow it, and the new name syncs', async () => {
    const phone = await onboardedPhone();
    const food = idOf(phone, 'food');
    phone.recordExpense({ amount: 1000, date: '2026-03-02', categoryId: food });
    phone.renameCategory(food, 'Groceries');
    await phone.sync();

    const tablet = await secondDevice();
    expect(tablet.categories().find((c) => c.id === food)?.name).toBe('Groceries');
    expect(tablet.categoryBreakdown(MONTH).find((row) => row.categoryId === food)?.spent).toBe(1000);
  });

  it('reordered Categories show in the new order on both devices, with Other still last', async () => {
    const clock = createDeviceClock();
    const phone = await onboardedPhone(clock);
    const ids = phone.activeCategories().filter((c) => !c.isOther).map((c) => c.id);
    clock.advance(1000);
    phone.reorderCategories([ids[2]!, ids[0]!, ids[1]!, ...ids.slice(3)]);
    expect(names(phone).slice(0, 3)).toEqual(['transport', 'housing', 'food']);
    expect(names(phone).at(-1)).toBe('(Other)');
    await phone.sync();

    const tablet = await secondDevice(clock);
    expect(names(tablet).slice(0, 3)).toEqual(['transport', 'housing', 'food']);
  });

  it('an Archived Category leaves the active list and new Months but stays in the Months where it was used', async () => {
    const phone = await onboardedPhone();
    const kids = idOf(phone, 'kids');
    phone.recordExpense({ amount: 2500, date: '2026-03-10', categoryId: kids });
    phone.archiveCategory(kids);

    expect(names(phone)).not.toContain('kids');
    expect(phone.archivedCategories().map((c) => c.name)).toEqual(['kids']);
    expect(phone.categoryBreakdown(MONTH).map((row) => row.categoryId)).toContain(kids);
    expect(phone.categoryBreakdown('2026-04').map((row) => row.categoryId)).not.toContain(kids);

    await phone.sync();
    const tablet = await secondDevice();
    expect(names(tablet)).not.toContain('kids');

    // Restoring brings it back to the active list.
    tablet.restoreCategory(kids);
    expect(names(tablet)).toContain('kids');
  });

  it('Other can’t be archived or renamed', async () => {
    const phone = await onboardedPhone();
    const other = otherCategoryId(phone.accountId()!);
    expect(() => phone.archiveCategory(other)).toThrow();
    expect(() => phone.renameCategory(other, 'Misc')).toThrow();
    expect(phone.categories().find((c) => c.id === other)).toMatchObject({ name: 'Other', archivedAt: null });
    expect(names(phone).at(-1)).toBe('(Other)');
  });

  it('two devices setting the same Category Budget offline end up with one record, the later edit winning', async () => {
    const clock = createDeviceClock();
    const phone = await onboardedPhone(clock);
    await phone.sync();
    const tablet = await secondDevice(clock);
    const food = idOf(phone, 'food');

    phone.goOffline();
    tablet.goOffline();
    phone.setCategoryBudgets(MONTH, { [food]: 300000 });
    clock.advance(1000);
    tablet.setCategoryBudgets(MONTH, { [food]: 250000 });

    tablet.goOnline();
    await tablet.sync();
    phone.goOnline();
    await phone.sync();
    await tablet.sync();

    for (const device of [phone, tablet]) {
      const row = device.categoryBreakdown(MONTH).find((r) => r.categoryId === food);
      expect(row).toEqual({ categoryId: food, budget: 250000, spent: 0, remaining: 250000 });
    }
    expect(phone.categoryBudgets(MONTH).map((b) => b.id)).toEqual([categoryBudgetId(phone.accountId()!, MONTH, food)]);
  });

  it('a Category Budget belongs to one Month: next Month’s is set separately', async () => {
    const phone = await onboardedPhone();
    const food = idOf(phone, 'food');
    phone.setCategoryBudgets(MONTH, { [food]: 300000 });
    phone.setCategoryBudgets('2026-04', { [food]: 100000 });
    phone.recordExpense({ amount: 350000, date: '2026-03-20', categoryId: food });

    expect(phone.categoryBreakdown(MONTH).find((r) => r.categoryId === food)).toMatchObject({ budget: 300000, remaining: -50000 });
    expect(phone.categoryBreakdown('2026-04').find((r) => r.categoryId === food)).toMatchObject({ budget: 100000, spent: 0 });
  });

  it('changing this Month’s Expected Income updates Unallocated', async () => {
    const phone = await onboardedPhone();
    phone.setCategoryBudgets(MONTH, { [idOf(phone, 'housing')]: 500000 });
    expect(phone.monthOverview(MONTH).unallocated).toBe(300000);
    phone.setExpectedIncome(MONTH, 450000);
    expect(phone.monthOverview(MONTH)).toMatchObject({ expectedIncome: 450000, unallocated: -50000 });
  });
});
