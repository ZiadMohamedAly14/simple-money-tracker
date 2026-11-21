/**
 * Seam B: deleting the Account from Settings. A code is emailed, the adult
 * enters it, the server deletes everything and ends every session, and the
 * device wipes its local data and signs out.
 */
import { DEFAULT_CATEGORY_KEYS, type DefaultCategoryKey } from '@money-tracker/shared';
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createTestDevice } from '@/testing/testDevice';

const CATEGORY_NAMES = Object.fromEntries(DEFAULT_CATEGORY_KEYS.map((key) => [key, key])) as Record<DefaultCategoryKey, string>;
const JAR_NAMES = { save: 'Save', spend: 'Spend', give: 'Give' };
const EMAIL = 'sara@example.com';
const PIN = '2580';

describe('Account deletion (Seam B)', () => {
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

  /** Sara's phone with a budget, an Expense and a kid; plus her tablet and Omar's Kid-Mode phone. */
  async function family() {
    const phone = await createTestDevice(server);
    await phone.signIn(EMAIL);
    phone.onboardPersonal({ currency: 'EGP', expectedIncome: 500000, month: '2026-03', categoryNames: CATEGORY_NAMES });
    phone.recordExpense({ amount: 2500, date: '2026-03-02' });
    expect(await phone.pinGate.setPin(PIN)).toEqual({ status: 'ok' });
    const omar = phone.createKidProfile({ name: 'Omar', jarNames: JAR_NAMES });
    expect(await phone.sync()).toBe('synced');

    const tablet = await createTestDevice(server);
    await tablet.signIn(EMAIL);
    await tablet.sync();
    const kidPhone = await createTestDevice(server);
    await kidPhone.signIn(EMAIL);
    expect(await kidPhone.setUpKidDevice({ kidProfileId: omar, pin: PIN })).toEqual({ status: 'ok' });
    return { phone, tablet, kidPhone, omar };
  }

  it('deletes the Account with the emailed code, wipes this device and signs every device out', async () => {
    const { phone, tablet, kidPhone } = await family();
    phone.recordExpense({ amount: 900, date: '2026-03-03' }); // unsynced: it goes too

    expect(await phone.requestDeletionCode()).toEqual({ status: 'ok' });
    const result = await phone.deleteAccount(server.mailer.lastCodeFor(EMAIL));

    expect(result).toEqual({ status: 'ok' });
    expect(phone.authStatus()).toBe('signedOut');
    expect(phone.heldRecords()).toEqual([]);
    expect(phone.pendingChanges()).toBe(0);
    expect(phone.onboarding()).toBe('not_started');
    expect(phone.accountId()).toBeNull();
    expect(await server.sessionCount()).toBe(0);
    expect(await tablet.sync()).toBe('needs_sign_in');
    expect(await kidPhone.sync()).toBe('needs_sign_in');
    // The server says the Account is gone, so the other devices wipe their copy and go back to sign-in.
    for (const device of [tablet, kidPhone]) {
      expect(device.authStatus()).toBe('signedOut');
      expect(device.heldRecords()).toEqual([]);
      expect(device.accountId()).toBeNull();
    }
  });

  it('a wrong code keeps everything and says how many tries are left', async () => {
    const { phone } = await family();
    await phone.requestDeletionCode();
    const right = server.mailer.lastCodeFor(EMAIL);

    const result = await phone.deleteAccount(right === '000000' ? '111111' : '000000');

    expect(result).toEqual({ status: 'rejected', reason: 'invalid_code', attemptsRemaining: 4 });
    expect(phone.authStatus()).toBe('signedIn');
    expect(phone.expenses()).toHaveLength(1);
    expect(await phone.sync()).toBe('synced');
  });

  it('needs the internet: offline, nothing is deleted', async () => {
    const { phone } = await family();
    phone.goOffline();
    expect(await phone.requestDeletionCode()).toEqual({ status: 'unreachable' });
    expect(phone.expenses()).toHaveLength(1);
  });
});
