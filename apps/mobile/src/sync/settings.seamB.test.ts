/**
 * Seam B: the Settings screen's synced Account settings (currency label and
 * numbering system) and sign-out, on simulated devices through the real API.
 */
import { DEFAULT_CATEGORY_KEYS, type DefaultCategoryKey } from '@money-tracker/shared';
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createTestDevice } from '@/testing/testDevice';

const NAMES = Object.fromEntries(DEFAULT_CATEGORY_KEYS.map((key) => [key, key])) as Record<DefaultCategoryKey, string>;

describe('Settings: Account settings and sign-out (Seam B)', () => {
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

  it('changing the currency relabels amounts without converting them, and reaches the other device', async () => {
    const phone = await createTestDevice(server);
    await phone.signIn('sara@example.com');
    phone.onboardPersonal({ currency: 'EGP', expectedIncome: 800000, month: '2026-03', categoryNames: NAMES });
    phone.recordExpense({ amount: 12500, date: '2026-03-02' });
    await phone.sync();

    const tablet = await createTestDevice(server);
    await tablet.signIn('sara@example.com');
    await tablet.sync();
    expect(tablet.accountSettings()).toMatchObject({ currency: 'EGP' });

    phone.changeAccountSettings({ currency: 'USD' });
    expect(phone.accountSettings()).toMatchObject({ currency: 'USD', numberingSystem: 'western' });
    expect(phone.expenses()).toEqual([expect.objectContaining({ amount: 12500 })]);
    expect(phone.monthOverview('2026-03')).toMatchObject({ expectedIncome: 800000, spending: 12500 });
    expect(await phone.sync()).toBe('synced');

    await tablet.sync();
    expect(tablet.accountSettings()).toMatchObject({ currency: 'USD', numberingSystem: 'western' });
    expect(tablet.expenses()).toEqual([expect.objectContaining({ amount: 12500 })]);
    expect(tablet.monthOverview('2026-03')).toMatchObject({ expectedIncome: 800000, spending: 12500 });
  });

  it('the numbering system is an Account setting: switching to Arabic-Indic offline keeps the currency and syncs', async () => {
    const phone = await createTestDevice(server);
    await phone.signIn('sara@example.com');
    phone.onboardPersonal({ currency: 'SAR', expectedIncome: 0, month: '2026-03', categoryNames: NAMES });
    await phone.sync();

    phone.goOffline();
    phone.changeAccountSettings({ numberingSystem: 'arabic-indic' });
    expect(phone.accountSettings()).toMatchObject({ currency: 'SAR', numberingSystem: 'arabic-indic' });
    phone.goOnline();
    expect(await phone.sync()).toBe('synced');

    const tablet = await createTestDevice(server);
    await tablet.signIn('sara@example.com');
    await tablet.sync();
    expect(tablet.accountSettings()).toMatchObject({ currency: 'SAR', numberingSystem: 'arabic-indic' });
  });

  it('signing out ends the session on the server and clears the Account’s data from the device', async () => {
    const phone = await createTestDevice(server);
    await phone.signIn('sara@example.com');
    phone.onboardPersonal({ currency: 'USD', expectedIncome: 0, month: '2026-03', categoryNames: NAMES });
    await phone.sync();
    const sessionsBefore = await server.sessionCount();

    await phone.signOut();

    expect(await server.sessionCount()).toBe(sessionsBefore - 1);
    expect(phone.accountSettings()).toBeUndefined();
    expect(phone.monthPlans()).toEqual([]);
    expect(phone.onboarding()).toBe('not_started');
  });
});
