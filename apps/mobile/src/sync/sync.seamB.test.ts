/**
 * Seam B: the real sync engine and local store (better-sqlite3 + Drizzle) on
 * simulated devices, talking to the real API in this process (in-memory Mongo).
 */
import { otherCategoryId } from '@money-tracker/shared';
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createTestDevice } from '@/testing/testDevice';

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
});
