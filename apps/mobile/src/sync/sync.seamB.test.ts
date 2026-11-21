/**
 * Seam B: the real sync engine and local store (better-sqlite3 + Drizzle) on
 * simulated devices, talking to the real API in this process (in-memory Mongo).
 */
import { otherCategoryId } from '@money-tracker/shared';
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createDeviceClock, createTestDevice, type TestDevice } from '@/testing/testDevice';

describe('sync between devices (Seam B)', () => {
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

  it('an Expense recorded offline on one device reaches the second device once both are online', async () => {
    const phone = await createTestDevice(server);
    const tablet = await createTestDevice(server);
    await phone.signIn('sara@example.com');
    await tablet.signIn('sara@example.com');

    phone.goOffline();
    phone.recordExpense({ amount: 12550, date: '2026-03-01', note: 'Lunch' });
    expect(await phone.sync()).toBe('offline');
    expect(phone.pendingChanges()).toBe(1);

    phone.goOnline();
    expect(await phone.sync()).toBe('synced');
    expect(phone.pendingChanges()).toBe(0);
    expect(await tablet.sync()).toBe('synced');

    expect(tablet.expenses()).toEqual([
      expect.objectContaining({
        amount: 12550,
        date: '2026-03-01',
        note: 'Lunch',
        categoryId: otherCategoryId(tablet.accountId()!),
      }),
    ]);
    expect(tablet.expenses()).toEqual(phone.expenses());
  });

  it('records against the Other Category before the device has ever synced', async () => {
    const phone = await createTestDevice(server);
    await phone.signIn('sara@example.com');

    expect(phone.categories()).toEqual([expect.objectContaining({ isOther: true })]);
    phone.goOffline();
    phone.recordExpense({ amount: 500, date: '2026-03-02' });
    expect(phone.expenses()).toHaveLength(1);

    phone.goOnline();
    expect(await phone.sync()).toBe('synced');
    expect(phone.categories()).toEqual([expect.objectContaining({ id: otherCategoryId(phone.accountId()!), isOther: true })]);
  });

  it('waits for a new code instead of syncing when the session has ended', async () => {
    const phone = await createTestDevice(server);
    await phone.signIn('sara@example.com');
    phone.recordExpense({ amount: 500, date: '2026-03-02' });

    await server.endAllSessions();

    expect(await phone.sync()).toBe('needs_sign_in');
    expect(phone.expenses()).toHaveLength(1);
    expect(phone.pendingChanges()).toBe(1);
  });

  describe("one Account's records never show under another", () => {
    it('signing out empties the local database', async () => {
      const phone = await createTestDevice(server);
      await phone.signIn('sara@example.com');
      phone.recordExpense({ amount: 500, date: '2026-03-02' });
      await phone.sync();

      await phone.signOut();

      expect(phone.expenses()).toEqual([]);
      expect(phone.categories()).toEqual([]);
      expect(phone.pendingChanges()).toBe(0);
    });

    it('a different Account signing in (after the session ended) starts from an empty database', async () => {
      const shared = await createTestDevice(server);
      await shared.signIn('sara@example.com');
      shared.recordExpense({ amount: 500, date: '2026-03-02' });
      await server.endAllSessions();
      expect(await shared.sync()).toBe('needs_sign_in');

      await shared.signIn('omar@example.com');

      expect(shared.expenses()).toEqual([]);
      expect(shared.pendingChanges()).toBe(0);
      expect(await shared.sync()).toBe('synced');
      expect(shared.categories()).toEqual([expect.objectContaining({ id: otherCategoryId(shared.accountId()!) })]);
      expect(shared.expenses()).toEqual([]);
    });

    it('the same Account signing in again keeps its unsynced records', async () => {
      const phone = await createTestDevice(server);
      await phone.signIn('sara@example.com');
      phone.recordExpense({ amount: 500, date: '2026-03-02' });
      await server.endAllSessions();
      expect(await phone.sync()).toBe('needs_sign_in');

      await phone.signIn('sara@example.com');

      expect(phone.pendingChanges()).toBe(1);
      expect(await phone.sync()).toBe('synced');
      const tablet = await createTestDevice(server);
      await tablet.signIn('sara@example.com');
      await tablet.sync();
      expect(tablet.expenses()).toHaveLength(1);
    });

    it('a device restarted with a different stored Account drops the old records', async () => {
      const phone = await createTestDevice(server);
      await phone.signIn('sara@example.com');
      phone.recordExpense({ amount: 500, date: '2026-03-02' });

      await phone.restartAs({ id: '65f1a2b3c4d5e6f708192a3b', email: 'someone@example.com' });

      expect(phone.expenses()).toEqual([]);
      expect(phone.pendingChanges()).toBe(0);
    });
  });

  describe('sync on its own', () => {
    it('a write reaches the other device about 2 seconds later without anyone pressing sync', async () => {
      const phone = await createTestDevice(server, { autoSync: true });
      const tablet = await createTestDevice(server);
      await phone.signIn('sara@example.com');
      await tablet.signIn('sara@example.com');

      phone.recordExpense({ amount: 500, date: '2026-03-02' });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      expect(phone.pendingChanges()).toBe(1);
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(phone.pendingChanges()).toBe(0);
      await tablet.sync();
      expect(tablet.expenses()).toHaveLength(1);
      phone.stopAutoSync();
    });

    it('shows the pending-sync indicator only once changes have waited more than a minute', async () => {
      const clock = createDeviceClock();
      const phone = await createTestDevice(server, { now: clock.now });
      await phone.signIn('sara@example.com');
      expect(phone.syncOverdue()).toBe(false);

      phone.goOffline();
      phone.recordExpense({ amount: 500, date: '2026-03-02' });
      await phone.sync();
      clock.advance(60_000);
      expect(phone.syncOverdue()).toBe(false);
      clock.advance(1);
      expect(phone.syncOverdue()).toBe(true);

      phone.goOnline();
      await phone.sync();
      expect(phone.syncOverdue()).toBe(false);
    });
  });

  describe('messy cases (ADR-0001)', () => {
    /** Two devices of one Account with a lunch Expense both already hold, on clocks we control. */
    async function twoDevicesWithLunch() {
      const clock = createDeviceClock();
      const phone = await createTestDevice(server, { now: clock.now });
      const tablet = await createTestDevice(server, { now: clock.now });
      await phone.signIn('sara@example.com');
      await tablet.signIn('sara@example.com');
      const lunch = phone.recordExpense({ amount: 10000, date: '2026-03-01', note: 'Lunch' });
      await phone.sync();
      await tablet.sync();
      expect(tablet.expenses()).toHaveLength(1);
      return { clock, phone, tablet, lunch };
    }

    const amounts = (device: TestDevice) => device.expenses().map((e) => e.amount);

    it('both devices end with the later of two offline edits to one Expense', async () => {
      const { clock, phone, tablet, lunch } = await twoDevicesWithLunch();
      phone.goOffline();
      tablet.goOffline();
      clock.advance(1000);
      phone.editExpense(lunch, { amount: 12000 });
      clock.advance(1000);
      tablet.editExpense(lunch, { amount: 15000 });

      phone.goOnline();
      tablet.goOnline();
      await phone.sync();
      await tablet.sync();
      await phone.sync();

      expect(amounts(phone)).toEqual([15000]);
      expect(amounts(tablet)).toEqual([15000]);
      expect(phone.pendingChanges()).toBe(0);
      expect(tablet.pendingChanges()).toBe(0);
    });

    it('keeps the later edit when the devices sync out of order (the later edit syncs first)', async () => {
      const { clock, phone, tablet, lunch } = await twoDevicesWithLunch();
      phone.goOffline();
      clock.advance(1000);
      phone.editExpense(lunch, { amount: 12000 });
      clock.advance(1000);
      tablet.editExpense(lunch, { amount: 15000 });
      await tablet.sync();

      phone.goOnline();
      await phone.sync();
      await tablet.sync();

      expect(amounts(phone)).toEqual([15000]);
      expect(amounts(tablet)).toEqual([15000]);
    });

    it('lets the edit with the later device time win, even if it reached the server first', async () => {
      const phoneClock = createDeviceClock();
      const tabletClock = createDeviceClock();
      const phone = await createTestDevice(server, { now: phoneClock.now });
      const tablet = await createTestDevice(server, { now: tabletClock.now });
      await phone.signIn('sara@example.com');
      await tablet.signIn('sara@example.com');
      const lunch = phone.recordExpense({ amount: 10000, date: '2026-03-01' });
      await phone.sync();
      await tablet.sync();

      phoneClock.advance(5000);
      phone.editExpense(lunch, { amount: 12000 });
      await phone.sync();
      tabletClock.advance(2000); // the tablet's clock says this edit is older
      tablet.editExpense(lunch, { amount: 15000 });
      await tablet.sync();
      await phone.sync();

      expect(amounts(phone)).toEqual([12000]);
      expect(amounts(tablet)).toEqual([12000]);
    });

    it('a deletion on one device beats an edit made offline on the other, whichever syncs first', async () => {
      for (const deleterSyncsFirst of [true, false]) {
        await server.clear();
        const { clock, phone, tablet, lunch } = await twoDevicesWithLunch();
        phone.goOffline();
        tablet.goOffline();
        clock.advance(1000);
        phone.deleteExpense(lunch);
        clock.advance(1000);
        tablet.editExpense(lunch, { amount: 15000 }); // later than the deletion

        phone.goOnline();
        tablet.goOnline();
        const [first, second] = deleterSyncsFirst ? [phone, tablet] : [tablet, phone];
        await first.sync();
        await second.sync();
        await first.sync();

        expect(phone.expenses()).toEqual([]);
        expect(tablet.expenses()).toEqual([]);
        expect(tablet.pendingChanges()).toBe(0);
      }
    });

    it('a deleted Expense stays deleted when an old device that never saw the deletion syncs later', async () => {
      const { clock, phone, tablet, lunch } = await twoDevicesWithLunch();
      tablet.goOffline(); // the old device, left in a drawer
      clock.advance(1000);
      phone.deleteExpense(lunch);
      await phone.sync();

      tablet.goOnline();
      await tablet.sync();
      await phone.sync();

      expect(phone.expenses()).toEqual([]);
      expect(tablet.expenses()).toEqual([]);
      const newcomer = await createTestDevice(server);
      await newcomer.signIn('sara@example.com');
      await newcomer.sync();
      expect(newcomer.expenses()).toEqual([]);
    });

    it('a newer copy pulled while the device edited during the sync replaces the older local edit', async () => {
      const phoneClock = createDeviceClock();
      const tabletClock = createDeviceClock(Date.parse('2026-03-01T10:00:00Z')); // an hour ahead
      const phone = await createTestDevice(server, { now: phoneClock.now });
      const tablet = await createTestDevice(server, { now: tabletClock.now });
      await phone.signIn('sara@example.com');
      await tablet.signIn('sara@example.com');
      const lunch = phone.recordExpense({ amount: 10000, date: '2026-03-01' });
      await phone.sync();
      await tablet.sync();
      tablet.editExpense(lunch, { amount: 15000 });
      await tablet.sync();

      const syncing = phone.sync();
      phoneClock.advance(1000);
      phone.editExpense(lunch, { amount: 12000 }); // lands while the sync is in flight; older than the tablet's
      await syncing;

      expect(amounts(phone)).toEqual([15000]);
      expect(phone.pendingChanges()).toBe(0);
    });

    it('a pulled deletion replaces an edit made during the sync', async () => {
      const { clock, phone, tablet, lunch } = await twoDevicesWithLunch();
      clock.advance(1000);
      tablet.deleteExpense(lunch);
      await tablet.sync();

      const syncing = phone.sync();
      clock.advance(1000);
      phone.editExpense(lunch, { amount: 12000 });
      await syncing;

      expect(phone.expenses()).toEqual([]);
      expect(phone.pendingChanges()).toBe(0);
    });

    it('a newly signed-in device downloads everything from cursor zero, a page at a time', async () => {
      const phone = await createTestDevice(server);
      await phone.signIn('sara@example.com');
      for (let day = 1; day <= 7; day += 1) {
        phone.recordExpense({ amount: day * 100, date: `2026-03-0${day}` });
      }
      await phone.sync();

      const tablet = await createTestDevice(server, { pullLimit: 3 });
      await tablet.signIn('sara@example.com');
      expect(await tablet.sync()).toBe('synced');

      expect(tablet.expenses()).toHaveLength(7);
      expect(tablet.expenses()).toEqual(phone.expenses());
      expect(tablet.categories()).toEqual(phone.categories());
    });
  });
});
