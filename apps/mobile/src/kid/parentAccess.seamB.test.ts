/**
 * Seam B: a parent on the kid's phone (ticket 15). The Parent PIN is checked
 * on the server (ADR-0002), so the Parent Area there needs the internet. Also
 * listing and revoking Kid-Mode devices, leaving Kid Mode, and resetting a
 * forgotten PIN with an email code.
 */
import { DEFAULT_CATEGORY_KEYS, type DefaultCategoryKey } from '@money-tracker/shared';
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createTestDevice, type TestDevice } from '@/testing/testDevice';

const JAR_NAMES = { save: 'Save', spend: 'Spend', give: 'Give' };
const CATEGORY_NAMES = Object.fromEntries(DEFAULT_CATEGORY_KEYS.map((key) => [key, key])) as Record<DefaultCategoryKey, string>;
const PIN = '2580';
const EMAIL = 'sara@example.com';
const MINUTE = 60_000;

describe('Parent access on a kid device (Seam B)', () => {
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

  /** Sara's phone: a Personal Budget, a PIN, and Omar and Lina with money. */
  async function parentsPhone() {
    const phone = await createTestDevice(server);
    await phone.signIn(EMAIL);
    phone.onboardPersonal({ currency: 'EGP', expectedIncome: 500000, payDay: 1, today: '2026-03-01', categoryNames: CATEGORY_NAMES });
    phone.recordExpense({ amount: 2500, categoryId: phone.categories()[0]!.id, date: '2026-03-02', note: 'Groceries' });
    expect(await phone.pinGate.setPin(PIN)).toEqual({ status: 'ok' });
    const omar = phone.createKidProfile({ name: 'Omar', jarNames: JAR_NAMES });
    const lina = phone.createKidProfile({ name: 'Lina', jarNames: JAR_NAMES });
    phone.addTopUp({ kidProfileId: omar, amount: 5000, splits: [{ jarId: phone.jarIds(omar).spend, amount: 5000 }], date: '2026-03-01' });
    expect(await phone.sync()).toBe('synced');
    return { phone, omar, lina };
  }

  /** A second phone set up as `kidProfileId`'s Kid-Mode device, labelled with the kid's name. */
  async function kidPhone(kidProfileId: string, name: string): Promise<TestDevice> {
    const device = await createTestDevice(server);
    await device.signIn(EMAIL);
    expect(await device.setUpKidDevice({ kidProfileId, pin: PIN, deviceLabel: name })).toEqual({ status: 'ok' });
    return device;
  }

  const heldKidProfiles = (device: TestDevice) => [
    ...new Set(device.heldRecords().map((r) => r.kidProfileId).filter((id) => id !== undefined)),
  ];

  describe('PIN elevation', () => {
    it('opens the Parent Area with the PIN, so the parent can top up from the kid’s phone', async () => {
      const { phone, omar } = await parentsPhone();
      const omars = await kidPhone(omar, 'Omar');
      expect(omars.elevated()).toBe(false);

      expect(await omars.elevate(PIN)).toEqual({ status: 'ok' });
      expect(omars.elevated()).toBe(true);

      omars.addTopUp({ kidProfileId: omar, amount: 2000, splits: [{ jarId: omars.jarIds(omar).save, amount: 2000 }], date: '2026-03-05' });
      expect(await omars.sync()).toBe('synced');
      expect(omars.wallet(omar).total).toBe(7000);
      // Full access doesn't bring the parent's other data onto the kid's phone.
      expect(heldKidProfiles(omars)).toEqual([omar]);
      expect(omars.heldRecords().some((r) => ['category', 'transaction', 'monthPlan'].includes(r.entity))).toBe(false);

      await phone.sync();
      expect(phone.wallet(omar).total).toBe(7000);
    });

    it('needs the internet, the right PIN, and asks again after a restart or once the short access runs out', async () => {
      const { omar } = await parentsPhone();
      const omars = await kidPhone(omar, 'Omar');

      omars.goOffline();
      expect(await omars.elevate(PIN)).toEqual({ status: 'unreachable' });
      omars.goOnline();
      expect(await omars.elevate('1111')).toEqual({ status: 'wrong_pin', attemptsRemaining: 4 });
      expect(omars.elevated()).toBe(false);

      expect(await omars.elevate(PIN)).toEqual({ status: 'ok' });
      await omars.restartApp(); // the full access token is never stored
      expect(omars.elevated()).toBe(false);
      expect(omars.kidProfileId()).toBe(omar);

      expect(await omars.elevate(PIN)).toEqual({ status: 'ok' });
      omars.advanceClock(15 * MINUTE);
      expect(omars.elevated()).toBe(false);
      // Back to the Kid Session: the kid's own sync still works, parent calls don't.
      expect(await omars.sync()).toBe('synced');
      expect(await omars.kidDevices()).toEqual({ status: 'refused' });
    });

    it('a Top-up the parent made on the kid’s phone but never synced waits for the next unlock without blocking the kid’s syncs', async () => {
      const { phone, omar } = await parentsPhone();
      const omars = await kidPhone(omar, 'Omar');
      expect(await omars.elevate(PIN)).toEqual({ status: 'ok' });
      omars.goOffline();
      omars.addTopUp({ kidProfileId: omar, amount: 2000, splits: [{ jarId: omars.jarIds(omar).save, amount: 2000 }], date: '2026-03-05' });
      omars.advanceClock(15 * MINUTE); // the unlock runs out before the phone is back online
      omars.goOnline();
      expect(omars.elevated()).toBe(false);

      omars.addKidExpense({ kidProfileId: omar, jarId: omars.jarIds(omar).spend, amount: 500, date: '2026-03-06', note: 'Juice' });
      expect(await omars.sync()).toBe('synced');
      expect(omars.pendingChanges()).toBe(1); // the Top-up, held back
      await phone.sync();
      expect(phone.wallet(omar).total).toBe(4500);

      expect(await omars.elevate(PIN)).toEqual({ status: 'ok' });
      expect(await omars.sync()).toBe('synced');
      expect(omars.pendingChanges()).toBe(0);
      await phone.sync();
      expect(phone.wallet(omar).total).toBe(6500);
    });
  });

  describe('Kid-Mode devices', () => {
    it('lists them by the kid’s name, from the parent’s phone or an elevated kid’s phone', async () => {
      const { phone, omar, lina } = await parentsPhone();
      const omars = await kidPhone(omar, 'Omar');
      await kidPhone(lina, 'Lina');

      const listed = await phone.kidDevices();
      expect(listed.status).toBe('ok');
      const labels = listed.status === 'ok' ? listed.devices.map((d) => [d.deviceLabel, d.kidProfileId, d.current]) : [];
      expect(labels).toEqual([
        ['Lina', lina, false],
        ['Omar', omar, false],
      ]);

      await omars.elevate(PIN);
      const fromKid = await omars.kidDevices();
      expect(fromKid.status === 'ok' && fromKid.devices.find((d) => d.current)?.kidProfileId).toBe(omar);

      phone.goOffline();
      expect(await phone.kidDevices()).toEqual({ status: 'unreachable' });
    });

    it('signs a revoked device out on its next sync and removes the kid’s wallet from it', async () => {
      const { phone, omar } = await parentsPhone();
      const omars = await kidPhone(omar, 'Omar');
      const listed = await phone.kidDevices();
      const device = listed.status === 'ok' ? listed.devices[0]! : null;

      expect(await phone.revokeKidDevice(device!.id)).toEqual({ status: 'ok' });
      expect(await phone.revokeKidDevice(device!.id)).toEqual({ status: 'not_found' });

      await omars.sync();
      expect(omars.authStatus()).toBe('signedOut');
      expect(omars.kidProfileId()).toBeNull();
      expect(omars.heldRecords()).toEqual([]);
    });
  });

  describe('a Kid-Mode phone whose Kid Session ends', () => {
    /** Signed out with nothing left: back to sign-in, no wallet, no Kid Mode. */
    const expectSignedOutAndWiped = (device: TestDevice) => {
      expect(device.authStatus()).toBe('signedOut');
      expect(device.kidProfileId()).toBeNull();
      expect(device.accountId()).toBeNull();
      expect(device.heldRecords()).toEqual([]);
      expect(device.pendingChanges()).toBe(0);
    };

    it('is wiped and back at sign-in when revoked, even while elevated', async () => {
      const { phone, omar } = await parentsPhone();
      const omars = await kidPhone(omar, 'Omar');
      await omars.elevate(PIN);
      const listed = await phone.kidDevices();
      await phone.revokeKidDevice(listed.status === 'ok' ? listed.devices[0]!.id : '');

      expect(await omars.sync()).toBe('needs_sign_in');
      expectSignedOutAndWiped(omars);
      expect(omars.elevated()).toBe(false);
    });

    it('is wiped and back at sign-in when its kid is archived', async () => {
      const { phone, omar } = await parentsPhone();
      const omars = await kidPhone(omar, 'Omar');
      await omars.elevate(PIN); // an elevation from it ends too
      phone.archiveKidProfile(omar);
      expect(await phone.sync()).toBe('synced');

      expect(await omars.sync()).toBe('needs_sign_in');
      expectSignedOutAndWiped(omars);
    });

    it('is wiped and back at sign-in when the Account is deleted', async () => {
      const { phone, omar } = await parentsPhone();
      const omars = await kidPhone(omar, 'Omar');
      omars.addKidExpense({ kidProfileId: omar, jarId: omars.jarIds(omar).spend, amount: 500, date: '2026-03-06', note: 'Juice' });
      expect(await phone.requestDeletionCode()).toEqual({ status: 'ok' });
      expect(await phone.deleteAccount(server.mailer.lastCodeFor(EMAIL))).toEqual({ status: 'ok' });

      expect(await omars.sync()).toBe('needs_sign_in');
      expectSignedOutAndWiped(omars);
    });
  });

  describe('leaving Kid Mode', () => {
    it('needs the Parent PIN; then the kid’s phone is signed out and its Kid Session ended', async () => {
      const { phone, omar } = await parentsPhone();
      const omars = await kidPhone(omar, 'Omar');
      omars.addKidExpense({ kidProfileId: omar, jarId: omars.jarIds(omar).spend, amount: 500, date: '2026-03-06', note: 'Juice' });

      expect(await omars.leaveKidMode()).toEqual({ status: 'locked' });
      expect(omars.kidProfileId()).toBe(omar);

      await omars.elevate(PIN);
      expect(await omars.leaveKidMode()).toEqual({ status: 'ok' });
      expect(omars.authStatus()).toBe('signedOut');
      expect(omars.heldRecords()).toEqual([]);

      // The kid's last expense went out first, and the device is gone from the list.
      await phone.sync();
      expect(phone.history(omar).map((t) => t.note)).toContain('Juice');
      expect(await phone.kidDevices()).toEqual({ status: 'ok', devices: [] });
    });

    it('waits for the internet, so nothing on the phone is lost', async () => {
      const { omar } = await parentsPhone();
      const omars = await kidPhone(omar, 'Omar');
      await omars.elevate(PIN);
      omars.goOffline();
      expect(await omars.leaveKidMode()).toEqual({ status: 'unreachable' });
      expect(omars.kidProfileId()).toBe(omar);
    });
  });

  describe('resetting a forgotten PIN', () => {
    it('sets a new PIN with an emailed code, clears the wrong-PIN wait, and the kid’s phone takes the new PIN', async () => {
      const { phone, omar } = await parentsPhone();
      const omars = await kidPhone(omar, 'Omar');
      for (let attempt = 0; attempt < 5; attempt++) await phone.pinGate.checkPin('1111');
      expect((await phone.pinGate.checkPin(PIN)).status).toBe('locked');

      server.nextMinute();
      expect(await phone.pinGate.requestReset('en')).toEqual({ status: 'ok', resendAfterSeconds: 60 });
      const code = server.mailer.lastCodeFor(EMAIL);
      expect(await phone.pinGate.resetPin(code === '000000' ? '111111' : '000000', '9753')).toEqual({
        status: 'invalid_code',
        attemptsRemaining: 4,
      });
      expect(await phone.pinGate.resetPin(code, '9753')).toEqual({ status: 'ok' });

      phone.goOffline();
      expect(await phone.pinGate.checkPin('9753')).toEqual({ status: 'ok' });
      expect(await omars.elevate(PIN)).toEqual({ status: 'wrong_pin', attemptsRemaining: 4 });
      expect(await omars.elevate('9753')).toEqual({ status: 'ok' });
    });

    it('is not offered to a Kid-Mode device', async () => {
      const { omar } = await parentsPhone();
      const omars = await kidPhone(omar, 'Omar');
      server.nextMinute();
      expect(await omars.pinGate.requestReset('en')).toEqual({ status: 'failed' });
    });
  });
});
