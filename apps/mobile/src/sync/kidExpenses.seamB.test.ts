/**
 * Seam B: Kid Expenses, Jar Transfers and the Kid Wallet's history, offline
 * first and synced through the real API (in-memory Mongo). Includes a Jar
 * going below zero after two devices spent the same money.
 */
import { DEFAULT_CATEGORY_KEYS, type DefaultCategoryKey } from '@money-tracker/shared';
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createDeviceClock, createTestDevice, type TestDevice } from '@/testing/testDevice';

const JAR_NAMES = { save: 'Save', spend: 'Spend', give: 'Give' };
const CATEGORY_NAMES = Object.fromEntries(DEFAULT_CATEGORY_KEYS.map((key) => [key, key])) as Record<DefaultCategoryKey, string>;

const balancesOf = (device: TestDevice, kidProfileId: string) =>
  device.wallet(kidProfileId).jars.map((jar) => [jar.name, jar.balance]);

describe('Kid Expenses, Jar Transfers and history (Seam B)', () => {
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

  /** A parent's phone with one kid whose Spend Jar holds 50.00 and Save 20.00. */
  async function phoneWithKid(clock = createDeviceClock()) {
    const phone = await createTestDevice(server, { now: clock.now });
    await phone.signIn('sara@example.com');
    phone.onboardPersonal({ currency: 'EGP', expectedIncome: 0, month: '2026-03', categoryNames: CATEGORY_NAMES });
    const kid = phone.createKidProfile({ name: 'Omar', jarNames: JAR_NAMES });
    const jars = phone.jarIds(kid);
    phone.addTopUp({
      kidProfileId: kid,
      amount: 7000,
      splits: [
        { jarId: jars.save, amount: 2000 },
        { jarId: jars.spend, amount: 5000 },
      ],
      date: '2026-03-01',
    });
    return { phone, kid, jars, clock };
  }

  async function secondDevice() {
    const tablet = await createTestDevice(server);
    await tablet.signIn('sara@example.com');
    await tablet.sync();
    return tablet;
  }

  it('a Kid Expense comes out of its Jar offline, and the other device sees the same balance', async () => {
    const { phone, kid, jars } = await phoneWithKid();
    phone.goOffline();

    const result = phone.addKidExpense({ kidProfileId: kid, jarId: jars.spend, amount: 1500, date: '2026-03-02', note: 'Ice cream' });

    expect(result).toEqual({ status: 'ok', id: expect.any(String) });
    expect(balancesOf(phone, kid)).toEqual([
      ['Save', 2000],
      ['Spend', 3500],
      ['Give', 0],
    ]);
    phone.goOnline();
    await phone.sync();
    const tablet = await secondDevice();
    expect(balancesOf(tablet, kid)).toEqual(balancesOf(phone, kid));
  });

  it("blocks a Kid Expense larger than its Jar's balance, saving nothing", async () => {
    const { phone, kid, jars } = await phoneWithKid();
    const pending = phone.pendingChanges();

    const result = phone.addKidExpense({ kidProfileId: kid, jarId: jars.spend, amount: 5001, date: '2026-03-02' });

    expect(result).toEqual({ status: 'not_enough', available: 5000 });
    expect(phone.wallet(kid).total).toBe(7000);
    expect(phone.pendingChanges()).toBe(pending);
    expect(phone.addKidExpense({ kidProfileId: kid, jarId: jars.spend, amount: 5000, date: '2026-03-02' }).status).toBe('ok');
  });

  it('a kid edits and deletes their own Kid Expense; an edit may use the money it already took', async () => {
    const { phone, kid, jars, clock } = await phoneWithKid();
    const added = phone.addKidExpense({ kidProfileId: kid, jarId: jars.spend, amount: 4000, date: '2026-03-02' });
    if (added.status !== 'ok') throw new Error('not saved');
    const tablet = await secondDevice();
    await phone.sync();
    await tablet.sync();

    clock.advance(1000);
    // Spend has 10.00 left, but the edit can use the 40.00 this expense already took.
    expect(phone.editKidExpense(added.id, { amount: 5000 })).toEqual({ status: 'ok', id: added.id });
    expect(phone.editKidExpense(added.id, { amount: 5001 })).toEqual({ status: 'not_enough', available: 5000 });
    // Moving it to Save: only Save's 20.00 counts.
    expect(phone.editKidExpense(added.id, { jarId: jars.save, amount: 2500 })).toEqual({ status: 'not_enough', available: 2000 });
    expect(phone.editKidExpense(added.id, { jarId: jars.save, amount: 2000, note: 'Book' })).toEqual({ status: 'ok', id: added.id });
    expect(balancesOf(phone, kid)).toEqual([
      ['Save', 0],
      ['Spend', 5000],
      ['Give', 0],
    ]);
    await phone.sync();
    await tablet.sync();
    expect(balancesOf(tablet, kid)).toEqual(balancesOf(phone, kid));

    clock.advance(1000);
    expect(phone.deleteKidExpense(added.id)).toBe(true);
    expect(phone.wallet(kid).total).toBe(7000);
    await phone.sync();
    await tablet.sync();
    expect(tablet.wallet(kid).total).toBe(7000);
  });

  it('a kid can only edit or delete Kid Expenses, never a Top-up or Jar Transfer', async () => {
    const { phone, kid, jars } = await phoneWithKid();
    const topUpId = phone.history(kid)[0]!.id;
    const transfer = phone.addJarTransfer({ kidProfileId: kid, fromJarId: jars.save, toJarId: jars.give, amount: 500, date: '2026-03-02' });
    if (transfer.status !== 'ok') throw new Error('not saved');

    expect(phone.editKidExpense(topUpId, { amount: 1 })).toEqual({ status: 'not_a_kid_expense' });
    expect(phone.editKidExpense(transfer.id, { amount: 1 })).toEqual({ status: 'not_a_kid_expense' });
    expect(phone.deleteKidExpense(topUpId)).toBe(false);
    expect(phone.deleteKidExpense(transfer.id)).toBe(false);
    expect(phone.wallet(kid).total).toBe(7000);
  });

  it('a parent moves money between Jars offline; the total stays and the other device follows', async () => {
    const { phone, kid, jars } = await phoneWithKid();
    phone.goOffline();

    expect(phone.addJarTransfer({ kidProfileId: kid, fromJarId: jars.save, toJarId: jars.spend, amount: 2001, date: '2026-03-02' })).toEqual({
      status: 'not_enough',
      available: 2000,
    });
    expect(phone.addJarTransfer({ kidProfileId: kid, fromJarId: jars.save, toJarId: jars.save, amount: 100, date: '2026-03-02' })).toEqual({
      status: 'same_jar',
    });
    const moved = phone.addJarTransfer({ kidProfileId: kid, fromJarId: jars.save, toJarId: jars.spend, amount: 1500, date: '2026-03-02' });

    expect(moved).toEqual({ status: 'ok', id: expect.any(String) });
    expect(balancesOf(phone, kid)).toEqual([
      ['Save', 500],
      ['Spend', 6500],
      ['Give', 0],
    ]);
    expect(phone.wallet(kid).total).toBe(7000);
    phone.goOnline();
    await phone.sync();
    const tablet = await secondDevice();
    expect(balancesOf(tablet, kid)).toEqual(balancesOf(phone, kid));
  });

  it('a parent edits a Jar Transfer; the money it already moved counts as available again', async () => {
    const { phone, kid, jars, clock } = await phoneWithKid();
    const moved = phone.addJarTransfer({ kidProfileId: kid, fromJarId: jars.save, toJarId: jars.spend, amount: 1500, date: '2026-03-02' });
    if (moved.status !== 'ok') throw new Error('not saved');
    clock.advance(1000);

    expect(phone.editJarTransfer(moved.id, { amount: 2001 })).toEqual({ status: 'not_enough', available: 2000 });
    expect(phone.editJarTransfer(moved.id, { toJarId: jars.save })).toEqual({ status: 'same_jar' });
    expect(phone.editJarTransfer(moved.id, { amount: 2000, toJarId: jars.give })).toEqual({ status: 'ok', id: moved.id });
    expect(balancesOf(phone, kid)).toEqual([
      ['Save', 0],
      ['Spend', 5000],
      ['Give', 2000],
    ]);
    expect(phone.editJarTransfer(phone.history(kid).at(-1)!.id, { amount: 1 })).toEqual({ status: 'not_a_jar_transfer' });
  });

  it('a parent can delete a Jar Transfer, which puts the money back', async () => {
    const { phone, kid, jars } = await phoneWithKid();
    const moved = phone.addJarTransfer({ kidProfileId: kid, fromJarId: jars.save, toJarId: jars.spend, amount: 1500, date: '2026-03-02' });
    if (moved.status !== 'ok') throw new Error('not saved');
    expect(phone.deleteJarTransfer(moved.id)).toBe(true);
    expect(balancesOf(phone, kid)).toEqual([
      ['Save', 2000],
      ['Spend', 5000],
      ['Give', 0],
    ]);
  });

  it('history lists Top-ups, Jar Transfers and Kid Expenses, newest first', async () => {
    const { phone, kid, jars, clock } = await phoneWithKid();
    clock.advance(1000);
    const transfer = phone.addJarTransfer({ kidProfileId: kid, fromJarId: jars.save, toJarId: jars.give, amount: 500, date: '2026-03-03' });
    clock.advance(1000);
    const older = phone.addKidExpense({ kidProfileId: kid, jarId: jars.spend, amount: 300, date: '2026-03-02' });
    clock.advance(1000);
    const sameDayLater = phone.addKidExpense({ kidProfileId: kid, jarId: jars.spend, amount: 200, date: '2026-03-03' });
    if (transfer.status !== 'ok' || older.status !== 'ok' || sameDayLater.status !== 'ok') throw new Error('not saved');

    const history = phone.history(kid);
    expect(history.map((entry) => [entry.kind, entry.date])).toEqual([
      ['kidExpense', '2026-03-03'],
      ['jarTransfer', '2026-03-03'],
      ['kidExpense', '2026-03-02'],
      ['topUp', '2026-03-01'],
    ]);
    expect(history[0]!.id).toBe(sameDayLater.id);

    await phone.sync();
    const tablet = await secondDevice();
    expect(tablet.history(kid).map((entry) => entry.id)).toEqual(history.map((entry) => entry.id));
  });

  it('a Jar that goes below zero after a sync shows its balance, blocks spending from it and is flagged for the parent', async () => {
    const { phone, kid, jars } = await phoneWithKid();
    await phone.sync();
    const kidTablet = await secondDevice();

    // Both devices are offline and each spends 40.00 of the 50.00 in Spend.
    phone.goOffline();
    kidTablet.goOffline();
    expect(phone.addKidExpense({ kidProfileId: kid, jarId: jars.spend, amount: 4000, date: '2026-03-02' }).status).toBe('ok');
    expect(kidTablet.addKidExpense({ kidProfileId: kid, jarId: jars.spend, amount: 4000, date: '2026-03-02' }).status).toBe('ok');

    phone.goOnline();
    kidTablet.goOnline();
    await phone.sync();
    await kidTablet.sync();
    await phone.sync();

    for (const device of [phone, kidTablet]) {
      expect(balancesOf(device, kid)).toEqual([
        ['Save', 2000],
        ['Spend', -3000],
        ['Give', 0],
      ]);
      expect(device.wallet(kid).negativeJarIds).toEqual([jars.spend]);
      expect(device.addKidExpense({ kidProfileId: kid, jarId: jars.spend, amount: 1, date: '2026-03-03' })).toEqual({
        status: 'not_enough',
        available: 0,
      });
      // Other Jars still work.
      expect(device.addKidExpense({ kidProfileId: kid, jarId: jars.save, amount: 100, date: '2026-03-03' }).status).toBe('ok');
    }

    // A Jar Transfer from the parent fixes it, and the flag goes away.
    await phone.sync();
    await kidTablet.sync();
    await phone.sync();
    phone.addJarTransfer({ kidProfileId: kid, fromJarId: jars.save, toJarId: jars.spend, amount: 1800, date: '2026-03-03' });
    expect(phone.wallet(kid).jars.find((jar) => jar.id === jars.spend)?.balance).toBe(-1200);
    phone.addTopUp({ kidProfileId: kid, amount: 1200, splits: [{ jarId: jars.spend, amount: 1200 }], date: '2026-03-03' });
    expect(phone.wallet(kid).negativeJarIds).toEqual([]);
  });
  it('on a Jar below zero, a Kid Expense can still be fixed as long as it takes no more (note, date, lower amount)', async () => {
    const { phone, kid, jars } = await phoneWithKid();
    await phone.sync();
    const kidTablet = await secondDevice();
    phone.goOffline();
    kidTablet.goOffline();
    const mine = phone.addKidExpense({ kidProfileId: kid, jarId: jars.spend, amount: 4000, date: '2026-03-02' });
    kidTablet.addKidExpense({ kidProfileId: kid, jarId: jars.spend, amount: 4000, date: '2026-03-02' });
    phone.goOnline();
    kidTablet.goOnline();
    await phone.sync();
    await kidTablet.sync();
    await phone.sync();
    expect(phone.wallet(kid).jars.find((jar) => jar.id === jars.spend)?.balance).toBe(-3000);
    if (mine.status !== 'ok') throw new Error('setup');

    expect(phone.editKidExpense(mine.id, { note: 'Juice', date: '2026-03-03' }).status).toBe('ok');
    expect(phone.editKidExpense(mine.id, { amount: 3500 }).status).toBe('ok');
    expect(phone.editKidExpense(mine.id, { amount: 3600 })).toEqual({ status: 'not_enough', available: 3500 });
    expect(phone.wallet(kid).jars.find((jar) => jar.id === jars.spend)?.balance).toBe(-2500);
  });

  it('on a source Jar below zero, a Jar Transfer can still be lowered but not raised', async () => {
    const { phone, kid, jars } = await phoneWithKid();
    await phone.sync();
    const kidTablet = await secondDevice();
    // Offline, the parent moves all 20.00 of Save to Give while the kid spends 15.00 from Save.
    phone.goOffline();
    kidTablet.goOffline();
    const move = phone.addJarTransfer({ kidProfileId: kid, fromJarId: jars.save, toJarId: jars.give, amount: 2000, date: '2026-03-02' });
    kidTablet.addKidExpense({ kidProfileId: kid, jarId: jars.save, amount: 1500, date: '2026-03-02' });
    phone.goOnline();
    kidTablet.goOnline();
    await phone.sync();
    await kidTablet.sync();
    await phone.sync();
    expect(phone.wallet(kid).jars.find((jar) => jar.id === jars.save)?.balance).toBe(-1500);
    if (move.status !== 'ok') throw new Error('setup');

    expect(phone.editJarTransfer(move.id, { amount: 1000 }).status).toBe('ok');
    expect(phone.wallet(kid).jars.find((jar) => jar.id === jars.save)?.balance).toBe(-500);
    expect(phone.editJarTransfer(move.id, { amount: 1100 })).toEqual({ status: 'not_enough', available: 1000 });
  });
});
