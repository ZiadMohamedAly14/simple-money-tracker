/**
 * Seam B: Kid Profiles, Jars and Top-ups on the parent's devices, offline
 * first and synced through the real API (in-memory Mongo).
 */
import { DEFAULT_CATEGORY_KEYS, defaultJarId, type DefaultCategoryKey } from '@money-tracker/shared';
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createDeviceClock, createTestDevice, type TestDevice } from '@/testing/testDevice';

const JAR_NAMES = { save: 'Save', spend: 'Spend', give: 'Give' };
const CATEGORY_NAMES = Object.fromEntries(DEFAULT_CATEGORY_KEYS.map((key) => [key, key])) as Record<DefaultCategoryKey, string>;

/** Each Jar's name and balance, in display order. */
const balancesOf = (device: TestDevice, kidProfileId: string) =>
  device.wallet(kidProfileId).jars.map((jar) => [jar.name, jar.balance]);

describe('Kid Profiles, Jars and Top-ups (Seam B)', () => {
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

  async function onboardedPhone(options: Parameters<typeof createTestDevice>[1] = {}) {
    const phone = await createTestDevice(server, options);
    await phone.signIn('sara@example.com');
    phone.onboardPersonal({ currency: 'EGP', expectedIncome: 0, month: '2026-03', categoryNames: CATEGORY_NAMES });
    return phone;
  }

  it('the kid onboarding path, offline: currency, default Categories for later, and a Kid Profile with Save, Spend and Give at zero', async () => {
    const phone = await createTestDevice(server);
    await phone.signIn('sara@example.com');
    phone.goOffline();

    const kid = phone.onboardKid({
      currency: 'SAR',
      categoryNames: CATEGORY_NAMES,
      kid: { name: 'Omar', avatar: '🦊', jarNames: JAR_NAMES },
    });

    expect(phone.onboarding()).toBe('unreported');
    expect(phone.accountSettings()).toMatchObject({ currency: 'SAR' });
    // The Personal Budget still exists for later (spec, story 16).
    expect(phone.categories()).toHaveLength(9);
    expect(phone.kidProfiles()).toEqual([expect.objectContaining({ id: kid, name: 'Omar', avatar: '🦊' })]);
    expect(balancesOf(phone, kid)).toEqual([
      ['Save', 0],
      ['Spend', 0],
      ['Give', 0],
    ]);
    expect(phone.wallet(kid).total).toBe(0);

    phone.goOnline();
    await phone.sync();
    expect(phone.onboarding()).toBe('complete');

    const tablet = await createTestDevice(server);
    await tablet.signIn('sara@example.com');
    await tablet.sync();
    expect(tablet.onboarding()).toBe('complete');
    expect(balancesOf(tablet, kid)).toEqual(balancesOf(phone, kid));
  });

  it('a parent adds several Kid Profiles, each with its own Jars', async () => {
    const clock = createDeviceClock();
    const phone = await onboardedPhone({ now: clock.now });
    const omar = phone.createKidProfile({ name: 'Omar', avatar: null, jarNames: JAR_NAMES });
    clock.advance(1000);
    const lina = phone.createKidProfile({ name: 'Lina', avatar: '🐼', jarNames: JAR_NAMES });

    expect(phone.kidProfiles().map((k) => k.name)).toEqual(['Omar', 'Lina']);
    phone.addTopUp({ kidProfileId: omar, amount: 5000, splits: [{ jarId: phone.jarIds(omar).spend, amount: 5000 }], date: '2026-03-02' });
    expect(phone.wallet(omar).total).toBe(5000);
    expect(phone.wallet(lina).total).toBe(0);
    expect(phone.jarIds(omar).spend).not.toBe(phone.jarIds(lina).spend);
  });

  it('a Top-up split across Jars fills each Jar, and the other device shows the same balances', async () => {
    const phone = await onboardedPhone();
    const kid = phone.createKidProfile({ name: 'Omar', avatar: null, jarNames: JAR_NAMES });
    const jars = phone.jarIds(kid);
    phone.goOffline();

    const result = phone.addTopUp({
      kidProfileId: kid,
      amount: 10000,
      splits: [
        { jarId: jars.save, amount: 4000 },
        { jarId: jars.spend, amount: 5000 },
        { jarId: jars.give, amount: 1000 },
      ],
      date: '2026-03-02',
    });
    expect(result.status).toBe('ok');
    expect(balancesOf(phone, kid)).toEqual([
      ['Save', 4000],
      ['Spend', 5000],
      ['Give', 1000],
    ]);
    expect(phone.wallet(kid).total).toBe(10000);

    phone.goOnline();
    await phone.sync();
    const tablet = await createTestDevice(server);
    await tablet.signIn('sara@example.com');
    await tablet.sync();
    expect(balancesOf(tablet, kid)).toEqual(balancesOf(phone, kid));
  });

  it('refuses a split that does not add up to the total, and saves nothing', async () => {
    const phone = await onboardedPhone();
    const kid = phone.createKidProfile({ name: 'Omar', avatar: null, jarNames: JAR_NAMES });
    const pending = phone.pendingChanges();

    const result = phone.addTopUp({
      kidProfileId: kid,
      amount: 10000,
      splits: [{ jarId: phone.jarIds(kid).spend, amount: 9000 }],
      date: '2026-03-02',
    });

    expect(result).toEqual({ status: 'invalid_split', problem: 'must add up to the total' });
    expect(phone.wallet(kid).total).toBe(0);
    expect(phone.pendingChanges()).toBe(pending);
  });

  it('suggests all to Spend for the first Top-up, then remembers the last split', async () => {
    const clock = createDeviceClock();
    const phone = await onboardedPhone({ now: clock.now });
    const kid = phone.createKidProfile({ name: 'Omar', avatar: null, jarNames: JAR_NAMES });
    const jars = phone.jarIds(kid);

    expect(phone.suggestedSplit(kid, 5000)).toEqual([{ jarId: jars.spend, amount: 5000 }]);

    clock.advance(1000);
    phone.addTopUp({
      kidProfileId: kid,
      amount: 5000,
      splits: [
        { jarId: jars.save, amount: 2500 },
        { jarId: jars.spend, amount: 2500 },
      ],
      date: '2026-03-02',
    });
    expect(phone.suggestedSplit(kid, 3000)).toEqual([
      { jarId: jars.save, amount: 1500 },
      { jarId: jars.spend, amount: 1500 },
    ]);

    // The remembered split syncs with the Top-ups: the tablet suggests the same.
    await phone.sync();
    const tablet = await createTestDevice(server);
    await tablet.signIn('sara@example.com');
    await tablet.sync();
    expect(tablet.suggestedSplit(kid, 3000)).toEqual(phone.suggestedSplit(kid, 3000));
  });

  it('Jars can be added, renamed and archived; an archived Jar leaves new Top-ups but keeps its money', async () => {
    const clock = createDeviceClock();
    const phone = await onboardedPhone({ now: clock.now });
    const kid = phone.createKidProfile({ name: 'Omar', avatar: null, jarNames: JAR_NAMES });
    const jars = phone.jarIds(kid);
    phone.addTopUp({ kidProfileId: kid, amount: 2000, splits: [{ jarId: jars.give, amount: 2000 }], date: '2026-03-02' });

    clock.advance(1000);
    const bike = phone.addJar(kid, 'Bike');
    phone.renameJar(jars.save, 'Savings');
    phone.archiveJar(jars.give);

    expect(balancesOf(phone, kid)).toEqual([
      ['Savings', 0],
      ['Spend', 0],
      ['Bike', 0],
      ['Give', 2000], // archived, still holding money
    ]);
    expect(phone.wallet(kid).jars.find((j) => j.id === jars.give)?.archived).toBe(true);
    expect(phone.wallet(kid).total).toBe(2000);
    expect(phone.topUpJars(kid).map((j) => j.id)).toEqual([jars.save, jars.spend, bike]);

    await phone.sync();
    const tablet = await createTestDevice(server);
    await tablet.signIn('sara@example.com');
    await tablet.sync();
    expect(balancesOf(tablet, kid)).toEqual(balancesOf(phone, kid));
  });

  it('a parent edits and deletes a Top-up offline, and the other device follows', async () => {
    const clock = createDeviceClock();
    const phone = await onboardedPhone({ now: clock.now });
    const kid = phone.createKidProfile({ name: 'Omar', avatar: null, jarNames: JAR_NAMES });
    const jars = phone.jarIds(kid);
    const first = phone.addTopUp({ kidProfileId: kid, amount: 5000, splits: [{ jarId: jars.spend, amount: 5000 }], date: '2026-03-02' });
    const second = phone.addTopUp({ kidProfileId: kid, amount: 1000, splits: [{ jarId: jars.save, amount: 1000 }], date: '2026-03-03' });
    if (first.status !== 'ok' || second.status !== 'ok') throw new Error('Top-ups not saved');
    await phone.sync();
    const tablet = await createTestDevice(server);
    await tablet.signIn('sara@example.com');
    await tablet.sync();

    phone.goOffline();
    clock.advance(1000);
    expect(
      phone.editTopUp(first.id, {
        amount: 6000,
        splits: [
          { jarId: jars.save, amount: 1000 },
          { jarId: jars.spend, amount: 5000 },
        ],
      }),
    ).toEqual({ status: 'ok', id: first.id });
    expect(phone.editTopUp(first.id, { amount: 7000 })).toEqual({ status: 'invalid_split', problem: 'must add up to the total' });
    expect(phone.deleteTopUp(second.id)).toBe(true);
    expect(balancesOf(phone, kid)).toEqual([
      ['Save', 1000],
      ['Spend', 5000],
      ['Give', 0],
    ]);
    expect(phone.topUps(kid).map((t) => t.id)).toEqual([first.id]);

    phone.goOnline();
    await phone.sync();
    await tablet.sync();
    expect(balancesOf(tablet, kid)).toEqual(balancesOf(phone, kid));
    expect(tablet.topUps(kid).map((t) => t.id)).toEqual([first.id]);
  });

  it('the default Jars are recognised by their fixed IDs, so Spend stays Spend after a rename', async () => {
    const phone = await onboardedPhone();
    const kid = phone.createKidProfile({ name: 'Omar', avatar: null, jarNames: JAR_NAMES });
    const accountId = phone.accountId()!;
    expect(phone.jarIds(kid).spend).toBe(defaultJarId(accountId, kid, 'spend'));
    phone.renameJar(phone.jarIds(kid).spend, 'Fun money');
    expect(phone.suggestedSplit(kid, 100)).toEqual([{ jarId: defaultJarId(accountId, kid, 'spend'), amount: 100 }]);
  });
});
