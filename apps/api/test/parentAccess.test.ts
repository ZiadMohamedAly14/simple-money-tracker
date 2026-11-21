/**
 * Seam A: a parent on a kid's phone (ticket 15). PIN elevation of a Kid
 * Session, listing and revoking Kid-Mode devices, and resetting a forgotten
 * Parent PIN with an email code.
 */
import request from 'supertest';
import type { Express } from 'express';
import { defaultJarId, otherCategoryId, type KidDeviceSummary, type PushedChange, type SyncResponseData } from '@money-tracker/shared';
import { MINUTE, SECOND, buildTestApp, createTestClock, createTestMailer, type TestClock, type TestMailer } from './helpers/testApp';
import { useTestDatabase } from './helpers/testDatabase';

const OMAR = '019ca8a0-3e80-7000-8000-0000000000b1';
const LINA = '019ca8a0-3e80-7000-8000-0000000000b2';
const meta = { updatedAt: 1772355600000, deletedAt: null };
const PIN = '2580';
const EMAIL = 'sara@example.com';

let nextId = 0x200;
const newId = (): string => `019ca8a0-3e80-7000-8000-${(nextId++).toString(16).padStart(12, '0')}`;

interface Tokens {
  accessToken: string;
  refreshToken: string;
}
interface Parent extends Tokens {
  accountId: string;
}

const kidProfile = (id: string, name: string): PushedChange =>
  ({ entity: 'kidProfile', record: { id, ...meta, name, avatar: null, archivedAt: null } }) as PushedChange;

const jarChanges = (accountId: string, kidProfileId: string): PushedChange[] =>
  (['save', 'spend', 'give'] as const).map(
    (key, order) =>
      ({
        entity: 'jar',
        record: { id: defaultJarId(accountId, kidProfileId, key), ...meta, kidProfileId, name: key, order, archivedAt: null },
      }) as PushedChange,
  );

const topUp = (accountId: string, kidProfileId: string, amount: number): PushedChange => {
  const jarId = defaultJarId(accountId, kidProfileId, 'spend');
  return {
    entity: 'kidTransaction',
    record: {
      id: newId(),
      ...meta,
      kidProfileId,
      kind: 'topUp',
      amount,
      splits: [{ jarId, amount }],
      jarId: null,
      toJarId: null,
      date: '2026-03-02',
      note: null,
    },
  } as unknown as PushedChange;
};

const expense = (accountId: string): PushedChange =>
  ({
    entity: 'transaction',
    record: { id: newId(), ...meta, kind: 'expense', amount: 1500, categoryId: otherCategoryId(accountId), date: '2026-03-02', note: 'Coffee' },
  }) as unknown as PushedChange;

describe('Parent access on a kid device (Seam A)', () => {
  useTestDatabase();

  let mailer: TestMailer;
  let clock: TestClock;
  let app: Express;

  beforeEach(() => {
    mailer = createTestMailer();
    clock = createTestClock();
    app = buildTestApp({}, { mailer, now: clock });
  });

  const bearer = (who: { accessToken: string }) => `Bearer ${who.accessToken}`;

  async function signIn(email = EMAIL): Promise<Parent> {
    clock.advance(MINUTE);
    await request(app).post('/auth/code').send({ email, language: 'en' });
    const res = await request(app).post('/auth/verify').send({ email, code: mailer.lastCodeFor(email) });
    expect(res.status).toBe(200);
    const { accessToken, refreshToken, account } = res.body.data;
    return { accessToken, refreshToken, accountId: account.id };
  }

  const sync = (who: { accessToken: string }, cursor: number, changes: unknown[] = []) =>
    request(app).post('/sync').set('Authorization', bearer(who)).send({ cursor, changes });

  /** Sara's Account with a PIN, Personal data and two kids, Omar and Lina. */
  async function family(): Promise<Parent> {
    const parent = await signIn();
    expect((await request(app).put('/account/pin').set('Authorization', bearer(parent)).send({ pin: PIN })).status).toBe(200);
    const res = await sync(parent, 0, [
      kidProfile(OMAR, 'Omar'),
      kidProfile(LINA, 'Lina'),
      ...jarChanges(parent.accountId, OMAR),
      ...jarChanges(parent.accountId, LINA),
      topUp(parent.accountId, OMAR, 5000),
    ]);
    expect(res.status).toBe(200);
    return parent;
  }

  /** Sets up a second phone as `kid`'s Kid-Mode device. */
  async function kidDevice(kidProfileId = OMAR, deviceLabel = 'Omar'): Promise<Tokens> {
    const phone = await signIn();
    const res = await request(app)
      .post('/kid-devices')
      .set('Authorization', bearer(phone))
      .send({ kidProfileId, pin: PIN, deviceLabel });
    expect(res.status).toBe(200);
    return res.body.data;
  }

  const elevate = (who: { accessToken: string }, pin: string) =>
    request(app).post('/kid-devices/elevate').set('Authorization', bearer(who)).send({ pin });

  describe('PIN elevation', () => {
    it('gives a Kid Session a short-lived full access token, with no refresh token', async () => {
      await family();
      const kid = await kidDevice();
      expect((await request(app).get('/account/pin').set('Authorization', bearer(kid))).status).toBe(403);

      const res = await elevate(kid, PIN);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ accessToken: expect.any(String), expiresInSeconds: 15 * 60 });
      expect(res.body.data.refreshToken).toBeUndefined();
      const elevated = res.body.data as { accessToken: string };
      expect((await request(app).get('/account/pin').set('Authorization', bearer(elevated))).status).toBe(200);

      clock.advance(15 * MINUTE + SECOND);
      const expired = await request(app).get('/account/pin').set('Authorization', bearer(elevated));
      expect(expired.status).toBe(401);
      // The Kid Session itself carries on.
      expect((await request(app).post('/auth/refresh').send({ refreshToken: kid.refreshToken })).status).toBe(200);
    });

    it('counts wrong PINs with the PIN gate throttle, shared with the Account', async () => {
      await family();
      const kid = await kidDevice();
      for (let attempt = 1; attempt <= 5; attempt++) {
        const res = await elevate(kid, '1111');
        expect(res.status).toBe(403);
        expect(res.body.data).toEqual({ reason: 'wrong_pin', attemptsRemaining: 5 - attempt });
      }
      const locked = await elevate(kid, PIN);
      expect(locked.status).toBe(429);
      expect(locked.body.data).toEqual({ reason: 'pin_locked', retryAfterSeconds: 30 });

      clock.advance(30 * SECOND);
      expect((await elevate(kid, PIN)).status).toBe(200);
      // A right PIN clears the count.
      expect((await elevate(kid, '1111')).body.data).toEqual({ reason: 'wrong_pin', attemptsRemaining: 4 });
    });

    it('is only for a Kid Session, and validates the PIN', async () => {
      const parent = await family();
      const refused = await elevate(parent, PIN);
      expect(refused.status).toBe(403);
      expect(refused.body.data).toEqual({ reason: 'not_kid_session' });

      const kid = await kidDevice();
      expect((await elevate(kid, '12')).status).toBe(422);
      expect((await request(app).post('/kid-devices/elevate').send({ pin: PIN })).status).toBe(401);
    });

    it('lets the parent top up from the kid device while it still holds only that kid', async () => {
      const parent = await family();
      expect((await sync(parent, 0, [expense(parent.accountId)])).status).toBe(200);
      const kid = await kidDevice();
      const elevated = (await elevate(kid, PIN)).body.data as { accessToken: string };

      const res = await sync(elevated, 0, [topUp(parent.accountId, OMAR, 2000)]);
      expect(res.status).toBe(200);
      const pulled = (res.body.data as SyncResponseData).changes;
      expect(new Set(pulled.map((change) => change.entity))).toEqual(new Set(['kidProfile', 'jar', 'kidTransaction']));
      const kidOf = (change: (typeof pulled)[number]) =>
        change.entity === 'kidProfile' ? change.record.id : (change.record as { kidProfileId?: string }).kidProfileId;
      expect(pulled.every((change) => kidOf(change) === OMAR)).toBe(true);
      expect(pulled.filter((change) => change.entity === 'kidTransaction')).toHaveLength(2);

      const seenByParent = (await sync(parent, 0)).body.data as SyncResponseData;
      expect(seenByParent.changes.filter((change) => change.entity === 'kidTransaction')).toHaveLength(2);
    });
  });

  const listDevices = (who: { accessToken: string }) => request(app).get('/kid-devices').set('Authorization', bearer(who));
  const revoke = (who: { accessToken: string }, id: string) =>
    request(app).delete(`/kid-devices/${id}`).set('Authorization', bearer(who));

  describe('listing Kid-Mode devices', () => {
    it("lists this Account's Kid-Mode devices by the kid's name, newest first, and marks the one asking", async () => {
      const parent = await family();
      const omars = await kidDevice(OMAR, 'Omar');
      clock.advance(MINUTE);
      await kidDevice(LINA, 'Lina');
      await signIn('someone@example.com'); // another Account's sessions never show

      const res = await listDevices(parent);
      expect(res.status).toBe(200);
      const devices = res.body.data.devices as KidDeviceSummary[];
      expect(devices.map((d) => [d.kidProfileId, d.deviceLabel, d.current])).toEqual([
        [LINA, 'Lina', false],
        [OMAR, 'Omar', false],
      ]);
      expect(devices[0]).toEqual({
        id: expect.any(String),
        kidProfileId: LINA,
        deviceLabel: 'Lina',
        createdAt: expect.any(Number),
        lastActiveAt: expect.any(Number),
        current: false,
      });

      // From Omar's phone, elevated: only Kid Sessions are listed, and Omar's is marked.
      const elevated = (await elevate(omars, PIN)).body.data as { accessToken: string };
      const fromKid = (await listDevices(elevated)).body.data.devices as KidDeviceSummary[];
      expect(fromKid.map((d) => [d.deviceLabel, d.current])).toEqual([
        ['Lina', false],
        ['Omar', true],
      ]);
    });

    it('needs full access: a Kid Session cannot list devices', async () => {
      await family();
      const kid = await kidDevice();
      const res = await listDevices(kid);
      expect(res.status).toBe(403);
      expect(res.body.data).toEqual({ reason: 'kid_session' });
    });
  });

  describe('revoking a Kid-Mode device', () => {
    it('signs the device out on its next sync or refresh, and ends any elevation it holds', async () => {
      const parent = await family();
      const kid = await kidDevice();
      const elevated = (await elevate(kid, PIN)).body.data as { accessToken: string };
      const [device] = (await listDevices(parent)).body.data.devices as KidDeviceSummary[];

      const res = await revoke(parent, device!.id);
      expect(res.status).toBe(200);
      expect((await listDevices(parent)).body.data.devices).toEqual([]);

      const next = await sync(kid, 0);
      expect(next.status).toBe(401);
      expect(next.body.data).toEqual({ reason: 'session_ended' });
      expect((await request(app).post('/auth/refresh').send({ refreshToken: kid.refreshToken })).status).toBe(401);
      expect((await sync(elevated, 0)).status).toBe(401);
    });

    it("can be done from the kid's phone, elevated", async () => {
      await family();
      const omars = await kidDevice(OMAR, 'Omar');
      const linas = await kidDevice(LINA, 'Lina');
      const elevated = (await elevate(omars, PIN)).body.data as { accessToken: string };
      const lina = ((await listDevices(elevated)).body.data.devices as KidDeviceSummary[]).find((d) => d.kidProfileId === LINA);

      expect((await revoke(elevated, lina!.id)).status).toBe(200);
      expect((await sync(linas, 0)).status).toBe(401);
      expect((await sync(omars, 0)).status).toBe(200);
    });

    it("refuses another Account's device, a full session, an unknown id, and a Kid Session asking", async () => {
      const parent = await family();
      const kid = await kidDevice();
      const [device] = (await listDevices(parent)).body.data.devices as KidDeviceSummary[];

      const stranger = await signIn('someone@example.com');
      expect((await revoke(stranger, device!.id)).status).toBe(404);
      expect((await revoke(parent, '0123456789abcdef01234567')).status).toBe(404);
      expect((await revoke(parent, 'not-an-id')).status).toBe(422);
      expect((await revoke(kid, device!.id)).status).toBe(403);
      expect((await sync(kid, 0)).status).toBe(200);

      expect((await listDevices(parent)).body.data.devices).toHaveLength(1);
    });
  });

  /** Asks for a reset code a minute after the last email, past the resend wait. */
  const requestResetCode = (who: { accessToken: string }, language = 'en') => {
    clock.advance(MINUTE);
    return request(app).post('/account/pin/reset-code').set('Authorization', bearer(who)).send({ language });
  };
  const resetPin = (who: { accessToken: string }, body: object) =>
    request(app).post('/account/pin/reset').set('Authorization', bearer(who)).send(body);

  describe('resetting a forgotten Parent PIN', () => {
    it('emails a code to the Account, which sets a new PIN in place of the forgotten one', async () => {
      const parent = await family();
      const sent = await requestResetCode(parent);
      expect(sent.status).toBe(200);
      expect(sent.body.data).toEqual({ expiresInSeconds: 600, resendAfterSeconds: 60 });
      const email = mailer.lastTo(EMAIL);
      expect(email.subject).toMatch(/PIN/);

      const res = await resetPin(parent, { code: mailer.lastCodeFor(EMAIL), pin: '9753' });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ pinHash: expect.any(String) });

      // The new PIN works and the old one doesn't, on the kid's phone too.
      const phone = await signIn();
      const setUpWith = (pin: string) =>
        request(app).post('/kid-devices').set('Authorization', bearer(phone)).send({ kidProfileId: OMAR, pin });
      expect((await setUpWith(PIN)).status).toBe(403);
      const setUp = await setUpWith('9753');
      expect(setUp.status).toBe(200);
      expect((await elevate(setUp.body.data, '9753')).status).toBe(200);
    });

    it('sends the email in the asking device language', async () => {
      const parent = await family();
      await requestResetCode(parent, 'ar');
      expect(mailer.lastTo(EMAIL).html).toContain('dir="rtl"');
    });

    it('clears a wrong-PIN lock', async () => {
      const parent = await family();
      const kid = await kidDevice();
      for (let attempt = 0; attempt < 5; attempt++) await elevate(kid, '1111');
      expect((await elevate(kid, PIN)).status).toBe(429);

      await requestResetCode(parent);
      expect((await resetPin(parent, { code: mailer.lastCodeFor(EMAIL), pin: '9753' })).status).toBe(200);
      expect((await elevate(kid, '9753')).status).toBe(200);
    });

    it('refuses a wrong, used or expired code, and limits wrong guesses', async () => {
      const parent = await family();
      await requestResetCode(parent);
      const code = mailer.lastCodeFor(EMAIL);
      const wrong = code === '000000' ? '111111' : '000000';

      const refused = await resetPin(parent, { code: wrong, pin: '9753' });
      expect(refused.status).toBe(400);
      expect(refused.body.data).toEqual({ reason: 'invalid_code', attemptsRemaining: 4 });
      expect((await resetPin(parent, { code, pin: '9753' })).status).toBe(200);
      expect((await resetPin(parent, { code, pin: '1357' })).body.data).toEqual({ reason: 'code_expired' });

      await requestResetCode(parent);
      const late = mailer.lastCodeFor(EMAIL);
      clock.advance(11 * MINUTE);
      expect((await resetPin(parent, { code: late, pin: '1357' })).body.data).toEqual({ reason: 'code_expired' });

      await requestResetCode(parent);
      const fresh = mailer.lastCodeFor(EMAIL);
      const other = fresh === '000000' ? '111111' : '000000';
      for (let attempt = 0; attempt < 5; attempt++) await resetPin(parent, { code: other, pin: '1357' });
      const exhausted = await resetPin(parent, { code: fresh, pin: '1357' });
      expect(exhausted.status).toBe(429);
      expect(exhausted.body.data).toEqual({ reason: 'too_many_guesses' });
    });

    it('is not available to a Kid Session, so a child cannot reset the PIN', async () => {
      await family();
      const kid = await kidDevice();
      const sent = await requestResetCode(kid);
      expect(sent.status).toBe(403);
      expect(sent.body.data).toEqual({ reason: 'kid_session' });
      expect((await resetPin(kid, { code: '123456', pin: '9753' })).status).toBe(403);
      expect(mailer.sent.filter((email) => /PIN/.test(email.subject))).toHaveLength(0);
    });

    it('validates the new PIN and the code', async () => {
      const parent = await family();
      expect((await resetPin(parent, { code: '123456', pin: '12' })).status).toBe(422);
      expect((await resetPin(parent, { code: 'abc', pin: '9753' })).status).toBe(422);
    });
  });
});
