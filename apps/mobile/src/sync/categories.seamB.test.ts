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
    expect(names(phone).slice(-3)).toEqual(['shopping', 'Pets', '(Other)']);

    phone.goOnline();
    await phone.sync();
    const tablet = await secondDevice();
    expect(names(tablet).slice(-3)).toEqual(['shopping', 'Pets', '(Other)']);
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
    expect(names(phone).slice(0, 3)).toEqual(['shopping', 'food', 'bills']);
    expect(names(phone).at(-1)).toBe('(Other)');
    await phone.sync();

    const tablet = await secondDevice(clock);
    expect(names(tablet).slice(0, 3)).toEqual(['shopping', 'food', 'bills']);
  });

  it('an Archived Category leaves the active list and new Months but stays in the Months where it was used', async () => {
    const phone = await onboardedPhone();
    const kids = idOf(phone, 'shopping');
    phone.recordExpense({ amount: 2500, date: '2026-03-10', categoryId: kids });
    phone.archiveCategory(kids);

    expect(names(phone)).not.toContain('shopping');
    expect(phone.archivedCategories().map((c) => c.name)).toEqual(['shopping']);
    expect(phone.categoryBreakdown(MONTH).map((row) => row.categoryId)).toContain(kids);
    expect(phone.categoryBreakdown('2026-04').map((row) => row.categoryId)).not.toContain(kids);

    await phone.sync();
    const tablet = await secondDevice();
    expect(names(tablet)).not.toContain('shopping');

    // Restoring brings it back to the active list.
    tablet.restoreCategory(kids);
    expect(names(tablet)).toContain('shopping');
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
    phone.setCategoryBudgets(MONTH, { [idOf(phone, 'bills')]: 500000 });
    expect(phone.monthOverview(MONTH).unallocated).toBe(300000);
    phone.setExpectedIncome(MONTH, 450000);
    expect(phone.monthOverview(MONTH)).toMatchObject({ expectedIncome: 450000, unallocated: -50000 });
  });
  describe('deleting a Category', () => {
    it('its Expenses show as Other everywhere, without being rewritten, and totals stay the same; its budgets go in every Month', async () => {
      const phone = await onboardedPhone();
      const other = otherCategoryId(phone.accountId()!);
      const food = idOf(phone, 'food');
      phone.setCategoryBudgets(MONTH, { [food]: 300000 });
      phone.setCategoryBudgets('2026-04', { [food]: 100000 });
      const lunch = phone.recordExpense({ amount: 1200, date: '2026-03-02', categoryId: food });
      phone.recordExpense({ amount: 800, date: '2026-04-02', categoryId: food });
      phone.recordExpense({ amount: 500, date: '2026-03-03' }); // already Other
      const before = phone.monthOverview(MONTH);

      expect(phone.categoryDeletionImpact(food, MONTH)).toEqual({ expenseCount: 2, hasBudgetThisMonth: true });
      expect(phone.categoryDeletionImpact(food, '2026-05')).toEqual({ expenseCount: 2, hasBudgetThisMonth: false });
      expect(phone.deleteCategory(food)).toBe(true);
      await phone.sync();
      const tablet = await secondDevice();

      for (const device of [phone, tablet]) {
        expect(device.categories().map((c) => c.id)).not.toContain(food);
        expect(device.categoryBreakdown(MONTH).find((r) => r.categoryId === other)).toEqual({
          categoryId: other,
          budget: 0,
          spent: 1700,
          remaining: -1700,
        });
        expect(device.categoryBreakdown('2026-04').find((r) => r.categoryId === other)?.spent).toBe(800);
        expect(device.categoryBreakdown(MONTH).map((r) => r.categoryId)).not.toContain(food);
        // No budget left for it, and none above 0 (April, copied from March, holds 0s for the others).
        for (const month of [MONTH, '2026-04']) {
          expect(device.categoryBudgets(month).filter((b) => b.categoryId === food || b.amount > 0)).toEqual([]);
        }
        // The budget goes back to Unallocated; spending doesn't change.
        expect(device.monthOverview(MONTH)).toEqual({ ...before, unallocated: before.unallocated + 300000 });
        // The record still names the deleted Category; it's shown as Other.
        expect(device.expenses().find((e) => e.id === lunch)?.categoryId).toBe(food);
        expect(device.shownCategory(food)?.id).toBe(other);
        expect(device.categoryChoices().map((c) => c.id)).not.toContain(food);
      }
    });

    it('chip order credits a deleted Category’s Expenses to Other', async () => {
      const clock = createDeviceClock();
      const phone = await onboardedPhone(clock);
      const other = otherCategoryId(phone.accountId()!);
      const food = idOf(phone, 'food');
      const bills = idOf(phone, 'bills');
      phone.recordExpense({ amount: 900, date: '2026-03-01', categoryId: bills });
      clock.advance(1000);
      phone.recordExpense({ amount: 1200, date: '2026-03-02', categoryId: food });
      phone.deleteCategory(food);

      expect(phone.categoryChoices().map((c) => c.id).slice(0, 2)).toEqual([other, bills]);
    });

    it('saving an Expense whose Category was deleted files it under Other', async () => {
      const phone = await onboardedPhone();
      const other = otherCategoryId(phone.accountId()!);
      const food = idOf(phone, 'food');
      const lunch = phone.recordExpense({ amount: 1200, date: '2026-03-02', categoryId: food });
      phone.deleteCategory(food);

      expect(phone.editExpense(lunch, { note: 'Lunch' })).toBe(true);
      expect(phone.expenses().find((e) => e.id === lunch)).toMatchObject({ categoryId: other, note: 'Lunch' });
      phone.editExpense(lunch, { categoryId: food });
      expect(phone.expenses().find((e) => e.id === lunch)?.categoryId).toBe(other);
    });

    it('a deletion on one phone and an Expense recorded into that Category offline on another both end up under Other', async () => {
      const clock = createDeviceClock();
      const phoneA = await onboardedPhone(clock);
      await phoneA.sync();
      const phoneB = await secondDevice(clock);
      const other = otherCategoryId(phoneA.accountId()!);
      const bills = idOf(phoneA, 'bills');
      phoneA.recordExpense({ amount: 1000, date: '2026-03-01', categoryId: bills });
      await phoneA.sync();
      await phoneB.sync();

      phoneB.goOffline();
      clock.advance(1000);
      phoneA.deleteCategory(bills);
      await phoneA.sync();
      clock.advance(1000);
      phoneB.recordExpense({ amount: 2500, date: '2026-03-04', categoryId: bills });
      clock.advance(1000);
      phoneB.renameCategory(bills, 'Utilities'); // a later edit still loses to the deletion
      phoneB.setCategoryBudgets(MONTH, { [bills]: 40000 }); // a budget for it set offline doesn't count either

      phoneB.goOnline();
      await phoneB.sync();
      await phoneA.sync();

      for (const device of [phoneA, phoneB]) {
        expect(device.categories().map((c) => c.id)).not.toContain(bills);
        expect(device.expenses()).toHaveLength(2);
        expect(device.categoryBreakdown(MONTH).find((r) => r.categoryId === other)?.spent).toBe(3500);
        expect(device.monthOverview(MONTH)).toMatchObject({ spending: 3500, unallocated: 800000 });
      }
    });

    it('Other can never be deleted', async () => {
      const phone = await onboardedPhone();
      const other = otherCategoryId(phone.accountId()!);
      expect(() => phone.deleteCategory(other)).toThrow();
      expect(names(phone).at(-1)).toBe('(Other)');
    });
  });

  describe('keeping at least one Category besides Other', () => {
    it('the last active Category that isn’t Other can be neither deleted nor archived', async () => {
      const phone = await onboardedPhone();
      const [food, bills, shopping] = ['food', 'bills', 'shopping'].map((name) => idOf(phone, name)) as [string, string, string];
      phone.deleteCategory(food);
      phone.archiveCategory(bills);

      expect(phone.isLastActiveCategory(shopping)).toBe(true);
      expect(() => phone.deleteCategory(shopping)).toThrow();
      expect(() => phone.archiveCategory(shopping)).toThrow();
      expect(names(phone)).toEqual(['shopping', '(Other)']);

      // An Archived one can still be deleted, since it isn't active.
      expect(phone.isLastActiveCategory(bills)).toBe(false);
      expect(phone.deleteCategory(bills)).toBe(true);

      // Adding another lifts the block.
      phone.addCategory('Rent');
      expect(phone.isLastActiveCategory(shopping)).toBe(false);
      expect(phone.archiveCategory(shopping)).toBe(true);
    });
  });

  describe('Category icons', () => {
    it('a new Category gets the icon guessed from its name, or the one picked; renaming keeps it; it syncs', async () => {
      const phone = await onboardedPhone();
      const rent = phone.addCategory('Rent');
      const pets = phone.addCategory('Pets');
      const gym = phone.addCategory('Gym', 'gift-give'); // picked by hand
      phone.renameCategory(rent, 'Netflix');
      const iconOf = (device: TestDevice, id: string) => device.categories().find((c) => c.id === id)?.icon;

      expect([iconOf(phone, rent), iconOf(phone, pets), iconOf(phone, gym)]).toEqual(['housing', 'tag', 'gift-give']);

      phone.setCategoryIcon(pets, 'kids');
      await phone.sync();
      const tablet = await secondDevice();
      expect([iconOf(tablet, rent), iconOf(tablet, pets), iconOf(tablet, gym)]).toEqual(['housing', 'kids', 'gift-give']);
    });

    it('Other’s icon can’t be changed', async () => {
      const phone = await onboardedPhone();
      expect(() => phone.setCategoryIcon(otherCategoryId(phone.accountId()!), 'tag')).toThrow();
    });
  });
});
