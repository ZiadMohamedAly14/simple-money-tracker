/**
 * Seam B: recording, editing and deleting Transactions (ticket 08) on
 * simulated devices, synced through the real API (in-memory Mongo).
 */
import { DEFAULT_CATEGORY_KEYS, defaultCategoryId, otherCategoryId, type DefaultCategoryKey } from '@money-tracker/shared';
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createTestDevice, type TestDevice } from '@/testing/testDevice';

const NAMES = Object.fromEntries(DEFAULT_CATEGORY_KEYS.map((key) => [key, key])) as Record<DefaultCategoryKey, string>;

describe('recording Transactions (Seam B)', () => {
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

  /** Two signed-in devices of one onboarded Account, both synced. */
  async function twoDevices(): Promise<[TestDevice, TestDevice]> {
    // One clock that ticks on every read, so each write is strictly later than
    // the one before (UUIDv7 IDs made in the same millisecond don't sort by time).
    let time = Date.now();
    const now = () => (time += 1);
    const phone = await createTestDevice(server, { now });
    const tablet = await createTestDevice(server, { now });
    await phone.signIn('sara@example.com');
    await tablet.signIn('sara@example.com');
    phone.onboardPersonal({ currency: 'EGP', expectedIncome: 1_000_000, payDay: 1, today: '2026-03-01', categoryNames: NAMES });
    await phone.sync();
    await tablet.sync();
    return [phone, tablet];
  }

  it('Income recorded offline, with a date and a note but no Category, reaches the second device and counts in its Month', async () => {
    const [phone, tablet] = await twoDevices();

    phone.goOffline();
    phone.recordIncome({ amount: 850_000, date: '2026-03-01', note: 'Salary' });
    phone.recordIncome({ amount: 50_000, date: '2026-03-04' });
    expect(phone.monthOverview('2026-03')).toMatchObject({ income: 900_000, remaining: 1_000_000 });

    phone.goOnline();
    await phone.sync();
    await tablet.sync();

    expect(tablet.monthTransactions('2026-03')).toEqual([
      expect.objectContaining({ kind: 'income', amount: 50_000, date: '2026-03-04', note: null, categoryId: null }),
      expect.objectContaining({ kind: 'income', amount: 850_000, date: '2026-03-01', note: 'Salary', categoryId: null }),
    ]);
    expect(tablet.monthOverview('2026-03')).toMatchObject({ income: 900_000, spending: 0, remaining: 1_000_000 });
  });

  it('edits to an Income and an Expense made offline, including moving one to an earlier Month, reach the second device', async () => {
    const [phone, tablet] = await twoDevices();
    const accountId = phone.accountId()!;
    const salary = phone.recordIncome({ amount: 850_000, date: '2026-03-01', note: 'Salary' });
    const lunch = phone.recordExpense({ amount: 12_000, date: '2026-03-02', categoryId: defaultCategoryId(accountId, 'food') });
    await phone.sync();
    await tablet.sync();

    tablet.goOffline();
    expect(tablet.editIncome(salary, { amount: 900_000, note: null })).toBe(true);
    expect(tablet.editExpense(lunch, { amount: 15_000, date: '2026-02-27', note: 'Late entry', categoryId: otherCategoryId(accountId) })).toBe(true);
    tablet.goOnline();
    await tablet.sync();
    await phone.sync();

    expect(phone.monthTransactions('2026-03')).toEqual([
      expect.objectContaining({ id: salary, kind: 'income', amount: 900_000, note: null, categoryId: null }),
    ]);
    expect(phone.monthTransactions('2026-02')).toEqual([
      expect.objectContaining({ id: lunch, kind: 'expense', amount: 15_000, date: '2026-02-27', note: 'Late entry', categoryId: otherCategoryId(accountId) }),
    ]);
    expect(phone.monthOverview('2026-03')).toMatchObject({ income: 900_000, spending: 0 });
    expect(phone.monthOverview('2026-02')).toMatchObject({ income: 0, spending: 15_000 });
  });

  it('offers Categories most recently used first (on any device), then the rest in order, without archived ones', async () => {
    const [phone, tablet] = await twoDevices();
    const id = (key: DefaultCategoryKey) => defaultCategoryId(phone.accountId()!, key);
    const order = (device: TestDevice) => device.categoryChoices().map((c) => (c.isOther ? 'other' : c.name));

    expect(order(phone)).toEqual([...DEFAULT_CATEGORY_KEYS, 'other']);

    phone.recordExpense({ amount: 100, date: '2026-03-05', categoryId: id('shopping') });
    phone.recordExpense({ amount: 100, date: '2026-03-01', categoryId: id('food') }); // recorded later, dated earlier
    await phone.sync();
    await tablet.sync();
    tablet.recordExpense({ amount: 100, date: '2026-03-02' }); // Other
    tablet.addCategory('Pets');
    tablet.archiveCategory(id('bills'));

    expect(order(tablet)).toEqual(['other', 'food', 'shopping', 'Pets']);
  });

  it('a deleted Expense no longer counts as a use of its Category', async () => {
    const [phone] = await twoDevices();
    const id = (key: DefaultCategoryKey) => defaultCategoryId(phone.accountId()!, key);
    phone.recordExpense({ amount: 100, date: '2026-03-01', categoryId: id('bills') });
    const mistake = phone.recordExpense({ amount: 100, date: '2026-03-01', categoryId: id('shopping') });
    phone.deleteTransaction(mistake);

    expect(phone.categoryChoices()[0]).toMatchObject({ id: id('bills') });
  });

  it("Income recorded in, or moved by its date into, a Month with no plan yet creates that Month from the previous plan", async () => {
    const [phone, tablet] = await twoDevices(); // March's plan: Expected Income 1,000,000
    phone.goOffline();
    const bonus = phone.recordIncome({ amount: 20_000, date: '2026-04-03' });
    expect(phone.monthOverview('2026-04')).toMatchObject({ expectedIncome: 1_000_000, income: 20_000 });

    expect(phone.editIncome(bonus, { date: '2026-05-01' })).toBe(true);
    expect(phone.monthOverview('2026-05')).toMatchObject({ expectedIncome: 1_000_000, income: 20_000 });
    expect(phone.monthOverview('2026-04')).toMatchObject({ income: 0 });

    phone.goOnline();
    await phone.sync();
    await tablet.sync();
    expect(tablet.monthPlans().map((p) => p.month)).toEqual(['2026-03', '2026-04', '2026-05']);
    expect(tablet.monthOverview('2026-05')).toMatchObject({ expectedIncome: 1_000_000, income: 20_000 });
  });

  it('deleting an Income or an Expense offline removes it from the Month on both devices', async () => {
    const [phone, tablet] = await twoDevices();
    const salary = phone.recordIncome({ amount: 850_000, date: '2026-03-01' });
    const lunch = phone.recordExpense({ amount: 12_000, date: '2026-03-02' });
    const taxi = phone.recordExpense({ amount: 3_000, date: '2026-03-03' });
    await phone.sync();
    await tablet.sync();

    tablet.goOffline();
    expect(tablet.deleteTransaction(salary)).toBe(true);
    expect(tablet.deleteTransaction(lunch)).toBe(true);
    expect(tablet.monthTransactions('2026-03').map((t) => t.id)).toEqual([taxi]);
    tablet.goOnline();
    await tablet.sync();
    await phone.sync();

    expect(phone.monthTransactions('2026-03').map((t) => t.id)).toEqual([taxi]);
    expect(phone.monthOverview('2026-03')).toMatchObject({ income: 0, spending: 3_000, remaining: 997_000 });
  });

  it('deleting several selected Transactions at once, offline, removes them all on both devices and skips ones already gone', async () => {
    const [phone, tablet] = await twoDevices();
    const salary = phone.recordIncome({ amount: 850_000, date: '2026-03-01' });
    const lunch = phone.recordExpense({ amount: 12_000, date: '2026-03-02' });
    const taxi = phone.recordExpense({ amount: 3_000, date: '2026-03-03' });
    const coffee = phone.recordExpense({ amount: 1_000, date: '2026-03-04' });
    await phone.sync();
    await tablet.sync();

    tablet.goOffline();
    expect(tablet.deleteTransaction(coffee)).toBe(true);
    expect(tablet.deleteTransactions([salary, lunch, coffee])).toBe(2); // coffee was already deleted
    expect(tablet.monthTransactions('2026-03').map((t) => t.id)).toEqual([taxi]);
    tablet.goOnline();
    await tablet.sync();
    await phone.sync();

    expect(phone.monthTransactions('2026-03').map((t) => t.id)).toEqual([taxi]);
    expect(phone.monthOverview('2026-03')).toMatchObject({ income: 0, spending: 3_000 });
  });
});
