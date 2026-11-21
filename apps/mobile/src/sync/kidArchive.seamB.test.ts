/**
 * Seam B: archiving a Kid Profile from the Parent Area. It disappears from
 * the kids list on every parent device, keeps its wallet and history, can be
 * restored, and its Kid-Mode phone is signed out.
 */
import { DEFAULT_CATEGORY_KEYS, type DefaultCategoryKey } from '@money-tracker/shared';
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createTestDevice } from '@/testing/testDevice';

const CATEGORY_NAMES = Object.fromEntries(DEFAULT_CATEGORY_KEYS.map((key) => [key, key])) as Record<DefaultCategoryKey, string>;
const JAR_NAMES = { save: 'Save', spend: 'Spend', give: 'Give' };
const EMAIL = 'sara@example.com';
const PIN = '2580';

describe('Archiving a Kid Profile (Seam B)', () => {
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

  async function family() {
    const phone = await createTestDevice(server);
    await phone.signIn(EMAIL);
    phone.onboardPersonal({ currency: 'EGP', expectedIncome: 0, month: '2026-03', categoryNames: CATEGORY_NAMES });
    expect(await phone.pinGate.setPin(PIN)).toEqual({ status: 'ok' });
    const omar = phone.createKidProfile({ name: 'Omar', jarNames: JAR_NAMES });
    const lina = phone.createKidProfile({ name: 'Lina', jarNames: JAR_NAMES });
    phone.addTopUp({ kidProfileId: omar, amount: 5000, splits: [{ jarId: phone.jarIds(omar).spend, amount: 5000 }], date: '2026-03-01' });
    expect(await phone.sync()).toBe('synced');
    const tablet = await createTestDevice(server);
    await tablet.signIn(EMAIL);
    await tablet.sync();
    return { phone, tablet, omar, lina };
  }

  it('hides the kid on every parent device and keeps the wallet and history', async () => {
    const { phone, tablet, omar } = await family();

    phone.goOffline();
    expect(phone.archiveKidProfile(omar)).toBe(true);
    expect(phone.kidProfiles().map((k) => k.name)).toEqual(['Lina']);
    expect(phone.archivedKidProfiles().map((k) => k.name)).toEqual(['Omar']);
    phone.goOnline();
    expect(await phone.sync()).toBe('synced');

    await tablet.sync();
    expect(tablet.kidProfiles().map((k) => k.name)).toEqual(['Lina']);
    expect(tablet.archivedKidProfiles().map((k) => k.name)).toEqual(['Omar']);
    expect(tablet.wallet(omar).total).toBe(5000);
    expect(tablet.history(omar)).toHaveLength(1);
  });

  it('restoring brings the kid back with the same wallet', async () => {
    const { phone, tablet, omar } = await family();
    phone.archiveKidProfile(omar);
    await phone.sync();
    await tablet.sync();

    expect(tablet.restoreKidProfile(omar)).toBe(true);
    await tablet.sync();
    await phone.sync();

    expect(phone.kidProfiles().map((k) => k.name)).toEqual(['Omar', 'Lina']);
    expect(phone.archivedKidProfiles()).toEqual([]);
    expect(phone.wallet(omar).total).toBe(5000);
  });

  it("signs out the archived kid's Kid-Mode phone, not another kid's", async () => {
    const { phone, omar, lina } = await family();
    const omarsPhone = await createTestDevice(server);
    await omarsPhone.signIn(EMAIL);
    expect(await omarsPhone.setUpKidDevice({ kidProfileId: omar, pin: PIN })).toEqual({ status: 'ok' });
    const linasPhone = await createTestDevice(server);
    await linasPhone.signIn(EMAIL);
    expect(await linasPhone.setUpKidDevice({ kidProfileId: lina, pin: PIN })).toEqual({ status: 'ok' });

    phone.archiveKidProfile(omar);
    expect(await phone.sync()).toBe('synced');

    expect(await omarsPhone.sync()).toBe('needs_sign_in');
    expect(await linasPhone.sync()).toBe('synced');
  });
});
