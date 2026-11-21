/**
 * Seam B: a Kid-Mode device (ADR-0002). A parent sets up the kid's phone; from
 * then on it only ever holds its Kid Profile's records (plus the Account
 * settings, for the currency), however the parent's data changes.
 */
import { DEFAULT_CATEGORY_KEYS, type DefaultCategoryKey } from '@money-tracker/shared';
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createTestDevice, type TestDevice } from '@/testing/testDevice';

const JAR_NAMES = { save: 'Save', spend: 'Spend', give: 'Give' };
const CATEGORY_NAMES = Object.fromEntries(DEFAULT_CATEGORY_KEYS.map((key) => [key, key])) as Record<DefaultCategoryKey, string>;
const PIN = '2580';
const EMAIL = 'sara@example.com';

describe('Kid-Mode device (Seam B)', () => {
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

  /** Sara's phone: Personal Budget with an Expense, a PIN, and two kids with money. */
  async function parentsPhone() {
    const phone = await createTestDevice(server);
    await phone.signIn(EMAIL);
    phone.onboardPersonal({ currency: 'EGP', expectedIncome: 500000, month: '2026-03', categoryNames: CATEGORY_NAMES });
    phone.recordExpense({ amount: 2500, categoryId: phone.categories()[0]!.id, date: '2026-03-02', note: 'Groceries' });
    expect(await phone.pinGate.setPin(PIN)).toEqual({ status: 'ok' });
    const omar = phone.createKidProfile({ name: 'Omar', avatar: null, jarNames: JAR_NAMES });
    const lina = phone.createKidProfile({ name: 'Lina', avatar: null, jarNames: JAR_NAMES });
    const omarJars = phone.jarIds(omar);
    const linaJars = phone.jarIds(lina);
    phone.addTopUp({ kidProfileId: omar, amount: 5000, splits: [{ jarId: omarJars.spend, amount: 5000 }], date: '2026-03-01' });
    phone.addTopUp({ kidProfileId: lina, amount: 9000, splits: [{ jarId: linaJars.spend, amount: 9000 }], date: '2026-03-01' });
    phone.addJarTransfer({ kidProfileId: omar, fromJarId: omarJars.spend, toJarId: omarJars.save, amount: 1000, date: '2026-03-01' });
    expect(await phone.sync()).toBe('synced');
    return { phone, omar, lina, omarJars, linaJars };
  }

  /** The kid's phone after the parent signed in on it (it downloads everything, like any new device). */
  async function signedInKidPhone() {
    const kidPhone = await createTestDevice(server);
    await kidPhone.signIn(EMAIL);
    await kidPhone.sync();
    return kidPhone;
  }

  /** Every record the device holds, as `entity:id`, with the Kid Profile each one belongs to. */
  const heldKidProfiles = (device: TestDevice) => {
    const held = device.heldRecords();
    return {
      entities: [...new Set(held.map((r) => r.entity))].sort(),
      kidProfiles: [...new Set(held.map((r) => r.kidProfileId).filter((id) => id !== undefined))],
    };
  };

  it('only ever holds its Kid Profile’s records', async () => {
    const { phone, omar, lina, linaJars } = await parentsPhone();
    const kidPhone = await signedInKidPhone();
    expect(kidPhone.kidProfiles()).toHaveLength(2); // still the parent's full download

    expect(await kidPhone.setUpKidDevice({ kidProfileId: omar, pin: PIN })).toEqual({ status: 'ok' });

    expect(kidPhone.kidProfileId()).toBe(omar);
    expect(heldKidProfiles(kidPhone)).toEqual({ entities: ['accountSettings', 'jar', 'kidProfile', 'kidTransaction'], kidProfiles: [omar] });
    expect(kidPhone.kidProfiles().map((k) => k.name)).toEqual(['Omar']);
    expect(kidPhone.accountSettings()?.currency).toBe('EGP');
    expect(kidPhone.wallet(omar).total).toBe(5000);
    expect(kidPhone.history(omar).map((t) => t.kind).sort()).toEqual(['jarTransfer', 'topUp']);

    // The parent keeps changing Personal data and Lina's wallet: none of it arrives.
    phone.recordExpense({ amount: 900, categoryId: phone.categories()[0]!.id, date: '2026-03-03', note: 'Taxi' });
    phone.addTopUp({ kidProfileId: lina, amount: 100, splits: [{ jarId: linaJars.save, amount: 100 }], date: '2026-03-03' });
    phone.addTopUp({ kidProfileId: omar, amount: 2000, splits: [{ jarId: phone.jarIds(omar).save, amount: 2000 }], date: '2026-03-03' });
    await phone.sync();
    expect(await kidPhone.sync()).toBe('synced');

    expect(heldKidProfiles(kidPhone)).toEqual({ entities: ['accountSettings', 'jar', 'kidProfile', 'kidTransaction'], kidProfiles: [omar] });
    expect(kidPhone.wallet(omar).total).toBe(7000);

    // An app restart keeps it in Kid Mode, still holding only Omar's records.
    await kidPhone.restartApp();
    expect(kidPhone.kidProfileId()).toBe(omar);
    expect(heldKidProfiles(kidPhone).kidProfiles).toEqual([omar]);
    expect(kidPhone.heldRecords().some((r) => r.entity === 'category')).toBe(false);
  });

  it('records Kid Expenses offline, and the parent sees them after sync', async () => {
    const { phone, omar, omarJars } = await parentsPhone();
    const kidPhone = await signedInKidPhone();
    await kidPhone.setUpKidDevice({ kidProfileId: omar, pin: PIN });

    kidPhone.goOffline();
    expect(kidPhone.addKidExpense({ kidProfileId: omar, jarId: omarJars.spend, amount: 1500, date: '2026-03-04', note: 'Ice cream' })).toEqual({
      status: 'ok',
      id: expect.any(String),
    });
    kidPhone.goOnline();
    expect(await kidPhone.sync()).toBe('synced');
    expect(kidPhone.pendingChanges()).toBe(0);

    await phone.sync();
    expect(phone.wallet(omar).total).toBe(3500);
    expect(phone.history(omar).map((t) => t.note)).toContain('Ice cream');
  });

  it('forgets the full tokens and the PIN hash copy: the kid can’t reach the Personal Budget', async () => {
    const { omar } = await parentsPhone();
    const kidPhone = await signedInKidPhone();
    await kidPhone.pinGate.refresh();
    expect(await kidPhone.pinGate.hasPin()).toBe(true); // while the parent was signed in

    await kidPhone.setUpKidDevice({ kidProfileId: omar, pin: PIN });

    expect(await kidPhone.pinGate.hasPin()).toBe(false);
    const pin = await kidPhone.request({ method: 'GET', url: '/account/pin' });
    expect(pin).toEqual(expect.objectContaining({ status: 'ok', httpStatus: 403 }));
    // One live session per device: the parent's phone and this Kid Session.
    expect(await server.sessionCount()).toBe(2);
  });

  it('sets up a Kid Profile created on the kid’s phone during setup', async () => {
    await parentsPhone();
    const kidPhone = await signedInKidPhone();

    const noor = kidPhone.createKidProfile({ name: 'Noor', avatar: '🦊', jarNames: JAR_NAMES });
    expect(await kidPhone.setUpKidDevice({ kidProfileId: noor, pin: PIN })).toEqual({ status: 'ok' });

    expect(kidPhone.kidProfiles().map((k) => k.name)).toEqual(['Noor']);
    expect(kidPhone.wallet(noor).jars).toHaveLength(3);
  });

  it('stays a full device when the PIN is wrong or the server can’t be reached', async () => {
    const { omar } = await parentsPhone();
    const kidPhone = await signedInKidPhone();

    expect(await kidPhone.setUpKidDevice({ kidProfileId: omar, pin: '0000' })).toEqual({ status: 'wrong_pin', attemptsRemaining: 4 });
    kidPhone.goOffline();
    expect(await kidPhone.setUpKidDevice({ kidProfileId: omar, pin: PIN })).toEqual({ status: 'unreachable' });

    expect(kidPhone.kidProfileId()).toBeNull();
    expect(kidPhone.kidProfiles()).toHaveLength(2);
    kidPhone.goOnline();
    expect(await kidPhone.sync()).toBe('synced');
  });
});
