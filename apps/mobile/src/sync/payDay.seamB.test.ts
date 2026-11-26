/**
 * Seam B: the Account's Pay Day history (ADR-0009) syncing between simulated
 * devices through the real API, so every device draws the same Months.
 */
import {
  DEFAULT_CATEGORY_KEYS,
  addMonths,
  monthDates,
  payDayOptions,
  type DefaultCategoryKey,
  type PayDayHistory,
} from '@money-tracker/shared';
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createDeviceClock, createTestDevice } from '@/testing/testDevice';

const NAMES = Object.fromEntries(DEFAULT_CATEGORY_KEYS.map((key) => [key, key])) as Record<DefaultCategoryKey, string>;

/** Month dates from November 2026 to February 2027 under a history. */
const boundaries = (history: PayDayHistory) =>
  [0, 1, 2, 3].map((n) => monthDates(addMonths('2026-11', n), history));

describe('Pay Day history (Seam B)', () => {
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

  async function phoneAndTablet(clock = createDeviceClock()) {
    const phone = await createTestDevice(server, { now: clock.now });
    await phone.signIn('sara@example.com');
    phone.onboardPersonal({ currency: 'EGP', expectedIncome: 800000, month: '2026-11', categoryNames: NAMES });
    await phone.sync();
    const tablet = await createTestDevice(server, { now: clock.now });
    await tablet.signIn('sara@example.com');
    await tablet.sync();
    return { phone, tablet, clock };
  }

  it('an Account that never changed Pay Day has no history: calendar Months (Pay Day 1)', async () => {
    const { phone, tablet } = await phoneAndTablet();

    expect(phone.payDayHistory()).toEqual([]);
    expect(tablet.payDayHistory()).toEqual([]);
    expect(monthDates('2026-11', tablet.payDayHistory())).toEqual({ start: '2026-11-01', end: '2026-11-30' });
  });

  it('a Pay Day change on one device reaches the other, and both draw the same Months', async () => {
    const { phone, tablet } = await phoneAndTablet();

    const { history } = payDayOptions(phone.payDayHistory(), 25, '2026-11-10').startAfterThisMonth;
    expect(phone.savePayDayHistory(history)).toBe('saved');
    expect(await phone.sync()).toBe('synced');
    await tablet.sync();

    expect(tablet.payDayHistory()).toEqual(phone.payDayHistory());
    expect(tablet.payDayHistory()).toEqual([{ payDay: 25, startsOn: '2026-12-25' }]);
    // Spec: 1 → 25 on 10 Nov, start after this Month.
    expect(boundaries(tablet.payDayHistory())).toEqual([
      { start: '2026-11-01', end: '2026-11-30' },
      { start: '2026-12-01', end: '2026-12-24' },
      { start: '2026-12-25', end: '2027-01-24' },
      { start: '2027-01-25', end: '2027-02-24' },
    ]);
    expect(boundaries(tablet.payDayHistory())).toEqual(boundaries(phone.payDayHistory()));
  });

  it('a second change before the pending one takes effect replaces it on every device', async () => {
    const { phone, tablet, clock } = await phoneAndTablet();
    phone.savePayDayHistory(payDayOptions(phone.payDayHistory(), 25, '2026-11-10').startAfterThisMonth.history);
    await phone.sync();
    await tablet.sync();

    clock.advance(60_000);
    tablet.savePayDayHistory(payDayOptions(tablet.payDayHistory(), 28, '2026-11-12').startAfterThisMonth.history);
    await tablet.sync();
    await phone.sync();

    expect(phone.payDayHistory()).toEqual([{ payDay: 28, startsOn: '2026-12-28' }]);
    expect(boundaries(phone.payDayHistory())).toEqual(boundaries(tablet.payDayHistory()));
  });

  it("a later currency change from a device that hasn't seen the Pay Day change doesn't undo it", async () => {
    const { phone, tablet, clock } = await phoneAndTablet();
    tablet.goOffline();

    phone.savePayDayHistory(payDayOptions(phone.payDayHistory(), 25, '2026-11-10').startAfterThisMonth.history);
    await phone.sync();
    clock.advance(60_000);
    tablet.changeAccountSettings({ currency: 'USD' });
    tablet.goOnline();
    await tablet.sync();
    await phone.sync();

    for (const device of [phone, tablet]) {
      expect(device.accountSettings()).toMatchObject({ currency: 'USD' });
      expect(device.payDayHistory()).toEqual([{ payDay: 25, startsOn: '2026-12-25' }]);
    }
  });

  it("a device that hasn't received the Account yet saves nothing, so it can't overwrite a Pay Day set elsewhere", async () => {
    const { phone } = await phoneAndTablet();
    phone.savePayDayHistory(payDayOptions([], 25, '2026-11-10').startAfterThisMonth.history);
    await phone.sync();

    const laptop = await createTestDevice(server);
    await laptop.signIn('sara@example.com');
    laptop.goOffline();
    expect(laptop.savePayDayHistory(payDayOptions(laptop.payDayHistory(), 5, '2026-11-10').startAfterThisMonth.history)).toBe(
      'not_ready',
    );
    expect(laptop.pendingChanges()).toBe(0);

    laptop.goOnline();
    await laptop.sync();
    expect(laptop.payDayHistory()).toEqual([{ payDay: 25, startsOn: '2026-12-25' }]);
  });

  describe('Months drawn from Pay Day 26', () => {
    // Pay Day 26 from 26 Oct: "November" is 26 Oct – 25 Nov, "December" 26 Nov – 25 Dec.
    const PAY_DAY_26 = payDayOptions([], 26, '2026-10-05').startNow!.history;

    async function phoneOnPayDay26() {
      const { phone } = await phoneAndTablet();
      phone.savePayDayHistory(PAY_DAY_26);
      return phone;
    }

    it('an Expense dated 26 Nov counts in December, and one dated 25 Nov counts in November', async () => {
      const phone = await phoneOnPayDay26();
      const food = phone.categories().find((c) => c.name === 'food')!.id;

      phone.recordExpense({ amount: 2600, date: '2026-11-26', categoryId: food });
      phone.recordExpense({ amount: 2500, date: '2026-11-25', categoryId: food });

      expect(phone.monthOverview('2026-12').spending).toBe(2600);
      expect(phone.monthOverview('2026-11').spending).toBe(2500);
      expect(phone.monthTransactions('2026-12').map((t) => t.amount)).toEqual([2600]);
      expect(phone.monthTransactions('2026-11').map((t) => t.amount)).toEqual([2500]);
      expect(phone.categoryBreakdown('2026-12').find((row) => row.categoryId === food)?.spent).toBe(2600);
    });

    it("an Expense dated after the Pay Day creates the next Month, copying the current Month's plan", async () => {
      const phone = await phoneOnPayDay26();

      phone.recordExpense({ amount: 2600, date: '2026-11-26' });

      expect(phone.monthPlans().map((p) => p.month)).toEqual(['2026-11', '2026-12']);
      expect(phone.monthOverview('2026-12')).toMatchObject({ expectedIncome: 800000, spending: 2600 });
    });

    it('moving an Expense across the Pay Day by editing its date moves it to that Month', async () => {
      const phone = await phoneOnPayDay26();
      const id = phone.recordExpense({ amount: 900, date: '2026-11-20' });

      phone.editExpense(id, { date: '2026-11-27' });

      expect(phone.monthOverview('2026-11').spending).toBe(0);
      expect(phone.monthOverview('2026-12').spending).toBe(900);
    });
  });
});
