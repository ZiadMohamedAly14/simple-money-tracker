/**
 * Seam A: setting up a Kid-Mode device (`POST /kid-devices`) and what its
 * Kid Session can read and write through `POST /sync` (ADR-0002).
 */
import request from 'supertest';
import type { Express } from 'express';
import {
  accountSettingsId,
  defaultJarId,
  monthPlanId,
  otherCategoryId,
  type PushedChange,
  type SyncResponseData,
} from '@money-tracker/shared';
import { MINUTE, buildTestApp, createTestClock, createTestMailer, type TestClock, type TestMailer } from './helpers/testApp';
import { useTestDatabase } from './helpers/testDatabase';

const OMAR = '019ca8a0-3e80-7000-8000-0000000000a1';
const LINA = '019ca8a0-3e80-7000-8000-0000000000a2';
const meta = { updatedAt: 1772355600000, deletedAt: null };
const PIN = '2580';

let nextId = 0x100;
const newId = (): string => `019ca8a0-3e80-7000-8000-${(nextId++).toString(16).padStart(12, '0')}`;

interface Tokens {
  accessToken: string;
  refreshToken: string;
}
interface Parent extends Tokens {
  accountId: string;
}

const kidProfile = (id: string, name: string, patch: object = {}): PushedChange =>
  ({ entity: 'kidProfile', record: { id, ...meta, name, avatar: null, archivedAt: null, ...patch } }) as PushedChange;

const jarsOf = (accountId: string, kidProfileId: string) => ({
  save: defaultJarId(accountId, kidProfileId, 'save'),
  spend: defaultJarId(accountId, kidProfileId, 'spend'),
  give: defaultJarId(accountId, kidProfileId, 'give'),
});

const jarChanges = (accountId: string, kidProfileId: string): PushedChange[] => {
  const ids = jarsOf(accountId, kidProfileId);
  return (['save', 'spend', 'give'] as const).map(
    (key, order) => ({ entity: 'jar', record: { id: ids[key], ...meta, kidProfileId, name: key, order, archivedAt: null } }) as PushedChange,
  );
};

const kidTransaction = (kidProfileId: string, fields: object, id = newId()): PushedChange =>
  ({
    entity: 'kidTransaction',
    record: { id, ...meta, kidProfileId, splits: [], jarId: null, toJarId: null, date: '2026-03-02', note: null, ...fields },
  }) as unknown as PushedChange;

const topUp = (kidProfileId: string, jarId: string, amount: number, id?: string) =>
  kidTransaction(kidProfileId, { kind: 'topUp', amount, splits: [{ jarId, amount }] }, id);
const kidExpense = (kidProfileId: string, jarId: string, amount: number, id?: string, patch: object = {}) =>
  kidTransaction(kidProfileId, { kind: 'kidExpense', amount, jarId, ...patch }, id);
const jarTransfer = (kidProfileId: string, jarId: string, toJarId: string, amount: number, id?: string) =>
  kidTransaction(kidProfileId, { kind: 'jarTransfer', amount, jarId, toJarId }, id);

const expense = (accountId: string, id = newId()): PushedChange =>
  ({
    entity: 'transaction',
    record: { id, ...meta, kind: 'expense', amount: 1500, categoryId: otherCategoryId(accountId), date: '2026-03-02', note: 'Coffee' },
  }) as unknown as PushedChange;

const settings = (accountId: string): PushedChange =>
  ({ entity: 'accountSettings', record: { id: accountSettingsId(accountId), ...meta, currency: 'EGP', numberingSystem: 'arabic-indic' } }) as PushedChange;

const monthPlan = (accountId: string): PushedChange =>
  ({ entity: 'monthPlan', record: { id: monthPlanId(accountId, '2026-03'), ...meta, month: '2026-03', expectedIncome: 800000 } }) as PushedChange;

describe('Kid-Mode device (Seam A)', () => {
  useTestDatabase();

  let mailer: TestMailer;
  let clock: TestClock;
  let app: Express;

  beforeEach(() => {
    mailer = createTestMailer();
    clock = createTestClock();
    app = buildTestApp({}, { mailer, now: clock });
  });

  async function signIn(email = 'sara@example.com'): Promise<Parent> {
    clock.advance(MINUTE);
    await request(app).post('/auth/code').send({ email, language: 'en' });
    const res = await request(app).post('/auth/verify').send({ email, code: mailer.lastCodeFor(email) });
    expect(res.status).toBe(200);
    const { accessToken, refreshToken, account } = res.body.data;
    return { accessToken, refreshToken, accountId: account.id };
  }

  const sync = (who: { accessToken: string }, cursor: number, changes: unknown[] = []) =>
    request(app).post('/sync').set('Authorization', `Bearer ${who.accessToken}`).send({ cursor, changes });

  const data = (res: request.Response): SyncResponseData => res.body.data;

  const setUpKidDevice = (who: { accessToken: string }, body: object) =>
    request(app).post('/kid-devices').set('Authorization', `Bearer ${who.accessToken}`).send(body);

  /**
   * Sara's Account: a PIN, settings, Personal data, and two kids (Omar and
   * Lina), each with a Top-up, and Omar with a Kid Expense and a Jar Transfer.
   */
  async function family() {
    const parent = await signIn();
    const pinRes = await request(app).put('/account/pin').set('Authorization', `Bearer ${parent.accessToken}`).send({ pin: PIN });
    expect(pinRes.status).toBe(200);
    const omar = jarsOf(parent.accountId, OMAR);
    const lina = jarsOf(parent.accountId, LINA);
    const res = await sync(parent, 0, [
      settings(parent.accountId),
      monthPlan(parent.accountId),
      expense(parent.accountId),
      kidProfile(OMAR, 'Omar'),
      kidProfile(LINA, 'Lina'),
      ...jarChanges(parent.accountId, OMAR),
      ...jarChanges(parent.accountId, LINA),
      topUp(OMAR, omar.spend, 5000),
      topUp(LINA, lina.spend, 9000),
      kidExpense(OMAR, omar.spend, 500),
      jarTransfer(OMAR, omar.spend, omar.save, 1000),
    ]);
    expect(res.status).toBe(200);
    return { parent, omar, lina };
  }

  /** Sets up a second phone as Omar's Kid-Mode device. */
  async function omarsDevice(): Promise<Tokens> {
    const phone = await signIn();
    const res = await setUpKidDevice(phone, { kidProfileId: OMAR, pin: PIN, deviceLabel: "Omar's phone" });
    expect(res.status).toBe(200);
    return res.body.data;
  }

  describe('setting up a Kid-Mode device', () => {
    it('swaps the signed-in session for a Kid Session for one Kid Profile', async () => {
      await family();
      const phone = await signIn();

      const res = await setUpKidDevice(phone, { kidProfileId: OMAR, pin: PIN });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String), kidProfileId: OMAR });
      // The full session it came from has ended, so its tokens are useless even if kept.
      expect((await sync(phone, 0)).status).toBe(401);
      const refreshed = await request(app).post('/auth/refresh').send({ refreshToken: phone.refreshToken });
      expect(refreshed.status).toBe(401);
    });

    it('keeps the Kid scope when the Kid Session refreshes', async () => {
      await family();
      const kid = await omarsDevice();

      const refreshed = await request(app).post('/auth/refresh').send({ refreshToken: kid.refreshToken });
      expect(refreshed.status).toBe(200);

      const pulled = data(await sync(refreshed.body.data, 0)).changes;
      expect(pulled.some((c) => c.entity === 'transaction')).toBe(false);
      expect(pulled.some((c) => c.entity === 'kidProfile')).toBe(true);
    });

    it('needs the right Parent PIN, and counts wrong ones like the PIN gate does', async () => {
      await family();
      const phone = await signIn();

      const wrong = await setUpKidDevice(phone, { kidProfileId: OMAR, pin: '0000' });
      expect(wrong.status).toBe(403);
      expect(wrong.body.data).toEqual({ reason: 'wrong_pin', attemptsRemaining: 4 });
      for (let i = 0; i < 4; i += 1) await setUpKidDevice(phone, { kidProfileId: OMAR, pin: '0000' });

      const locked = await setUpKidDevice(phone, { kidProfileId: OMAR, pin: PIN });
      expect(locked.status).toBe(429);
      expect(locked.body.data).toEqual({ reason: 'pin_locked', retryAfterSeconds: 30 });
      // Still signed in as the parent: nothing was swapped.
      expect((await sync(phone, 0)).status).toBe(200);
    });

    it('needs a Parent PIN to exist first', async () => {
      const parent = await signIn();
      await sync(parent, 0, [kidProfile(OMAR, 'Omar')]);

      const res = await setUpKidDevice(parent, { kidProfileId: OMAR, pin: PIN });
      expect(res.status).toBe(409);
      expect(res.body.data).toEqual({ reason: 'no_pin' });
    });

    it("refuses a Kid Profile that isn't this Account's, or is deleted or archived", async () => {
      await family();
      const other = await signIn('noor@example.com');
      await request(app).put('/account/pin').set('Authorization', `Bearer ${other.accessToken}`).send({ pin: PIN });
      const sara = await signIn();
      await sync(sara, 0, [kidProfile(LINA, 'Lina', { archivedAt: meta.updatedAt, updatedAt: meta.updatedAt + 1 })]);

      for (const [who, kidProfileId] of [
        [other, OMAR],
        [sara, LINA],
        [sara, newId()],
      ] as const) {
        const res = await setUpKidDevice(who, { kidProfileId, pin: PIN });
        expect(res.status).toBe(404);
        expect(res.body.data).toEqual({ reason: 'kid_not_found' });
      }
    });

    it('is only for a full session: a Kid Session cannot set up another kid', async () => {
      await family();
      const kid = await omarsDevice();
      const res = await setUpKidDevice(kid, { kidProfileId: LINA, pin: PIN });
      expect(res.status).toBe(403);
      expect(res.body.data).toEqual({ reason: 'kid_session' });
    });

    it('validates the body', async () => {
      const parent = await signIn();
      const res = await setUpKidDevice(parent, { kidProfileId: 'not-a-uuid', pin: '12' });
      expect(res.status).toBe(422);
    });
  });

  describe("a Kid Session's reads", () => {
    it("pulls only its Kid Profile's wallet, plus the Account settings for the currency", async () => {
      const { parent } = await family();
      const kid = await omarsDevice();

      const pulled = data(await sync(kid, 0)).changes;

      const byEntity = (entity: string) => pulled.filter((c) => c.entity === entity).map((c) => c.record);
      expect(byEntity('accountSettings')).toEqual([expect.objectContaining({ currency: 'EGP', numberingSystem: 'arabic-indic' })]);
      expect(byEntity('kidProfile')).toEqual([expect.objectContaining({ id: OMAR, name: 'Omar' })]);
      expect(byEntity('jar').map((j) => j.id).sort()).toEqual(Object.values(jarsOf(parent.accountId, OMAR)).sort());
      // Its own Top-ups and Jar Transfers come too: the balances and My history need them.
      expect(byEntity('kidTransaction').map((t) => (t as { kind: string }).kind).sort()).toEqual(['jarTransfer', 'kidExpense', 'topUp']);
      expect(byEntity('kidTransaction').every((t) => (t as { kidProfileId: string }).kidProfileId === OMAR)).toBe(true);
    });

    it('never pulls Personal data or another kid', async () => {
      await family();
      const kid = await omarsDevice();

      const body = JSON.stringify((await sync(kid, 0)).body);

      for (const entity of ['category', 'monthPlan', 'categoryBudget', 'transaction']) {
        expect(body).not.toContain(`"entity":"${entity}"`);
      }
      expect(body).not.toContain(LINA);
      expect(body).not.toContain('Coffee');
    });

    it('keeps it that way for later changes: a new Expense or a Top-up for another kid stays away', async () => {
      const { parent, lina } = await family();
      const kid = await omarsDevice();
      const { cursor } = data(await sync(kid, 0));

      await sync(parent, 0, [expense(parent.accountId), topUp(LINA, lina.spend, 100)]);
      const later = data(await sync(kid, cursor));

      expect(later.changes).toEqual([]);
      expect(later.cursor).toBeGreaterThan(cursor);
    });
  });

  describe("a Kid Session's writes", () => {
    it('records, edits and deletes Kid Expenses from its own Jars, and the parent pulls them', async () => {
      const { parent, omar } = await family();
      const kid = await omarsDevice();
      const id = newId();

      expect((await sync(kid, 0, [kidExpense(OMAR, omar.spend, 700, id)])).status).toBe(200);
      const edit = kidExpense(OMAR, omar.save, 300, id, { updatedAt: meta.updatedAt + 1 });
      expect((await sync(kid, 0, [edit])).status).toBe(200);

      const atParent = data(await sync(parent, 0)).changes.find((c) => c.record.id === id);
      expect(atParent?.record).toEqual(expect.objectContaining({ amount: 300, jarId: omar.save }));

      const deletion = kidExpense(OMAR, omar.save, 300, id, { updatedAt: meta.updatedAt + 2, deletedAt: meta.updatedAt + 2 });
      expect((await sync(kid, 0, [deletion])).status).toBe(200);
      const deleted = data(await sync(parent, 0)).changes.find((c) => c.record.id === id);
      expect(deleted?.record.deletedAt).toBe(meta.updatedAt + 2);
    });

    it('cannot write Top-ups or Jar Transfers, even for its own wallet', async () => {
      const { omar } = await family();
      const kid = await omarsDevice();

      for (const change of [topUp(OMAR, omar.spend, 100000), jarTransfer(OMAR, omar.save, omar.spend, 100)]) {
        const res = await sync(kid, 0, [change]);
        expect(res.status).toBe(403);
        expect(res.body.data).toEqual({ reason: 'kid_session' });
      }
    });

    it('cannot turn an existing Top-up or Jar Transfer into a Kid Expense by reusing its ID', async () => {
      const { parent, omar } = await family();
      const kid = await omarsDevice();
      const stored = data(await sync(parent, 0)).changes.filter((c) => c.entity === 'kidTransaction' && c.record.kidProfileId === OMAR);
      const notExpenses = stored.filter((c) => (c.record as { kind: string }).kind !== 'kidExpense');
      expect(notExpenses).toHaveLength(2);

      for (const target of notExpenses) {
        const forged = kidExpense(OMAR, omar.spend, 1, target.record.id, { updatedAt: meta.updatedAt + 10, deletedAt: meta.updatedAt + 10 });
        expect((await sync(kid, 0, [forged])).status).toBe(403);
      }
      const after = data(await sync(parent, 0)).changes.filter((c) => notExpenses.some((n) => n.record.id === c.record.id));
      expect(after.every((c) => c.record.deletedAt === null)).toBe(true);
    });

    it("cannot write another kid's Kid Expenses or spend from another kid's Jars", async () => {
      const { parent, omar, lina } = await family();
      const kid = await omarsDevice();
      const linasExpense = newId();
      await sync(parent, 0, [kidExpense(LINA, lina.spend, 100, linasExpense)]);

      const attempts = [
        kidExpense(LINA, lina.spend, 100),
        kidExpense(OMAR, lina.spend, 100),
        kidExpense(OMAR, omar.spend, 100, linasExpense, { updatedAt: meta.updatedAt + 10 }),
      ];
      for (const change of attempts) {
        expect([403, 422]).toContain((await sync(kid, 0, [change])).status);
      }
      const linas = data(await sync(parent, 0)).changes.filter((c) => c.entity === 'kidTransaction' && c.record.kidProfileId === LINA);
      expect(linas.map((c) => (c.record as { amount: number }).amount).sort((a, b) => Number(a) - Number(b))).toEqual([100, 9000]);
    });

    it('cannot write Personal data, Account settings, Kid Profiles or Jars', async () => {
      const { parent } = await family();
      const kid = await omarsDevice();

      const attempts = [
        expense(parent.accountId),
        settings(parent.accountId),
        monthPlan(parent.accountId),
        kidProfile(OMAR, 'Omar the Great', { updatedAt: meta.updatedAt + 10 }),
        jarChanges(parent.accountId, OMAR)[0]!,
      ];
      for (const change of attempts) {
        const res = await sync(kid, 0, [change]);
        expect(res.status).toBe(403);
      }
      const names = data(await sync(parent, 0)).changes.filter((c) => c.entity === 'kidProfile').map((c) => c.record.name);
      expect(names).not.toContain('Omar the Great');
    });

    it('cannot read the Parent PIN or mark onboarding', async () => {
      await family();
      const kid = await omarsDevice();

      const pin = await request(app).get('/account/pin').set('Authorization', `Bearer ${kid.accessToken}`);
      expect(pin.status).toBe(403);
      const onboarding = await request(app).post('/account/onboarding').set('Authorization', `Bearer ${kid.accessToken}`);
      expect(onboarding.status).toBe(403);
    });
  });
});
