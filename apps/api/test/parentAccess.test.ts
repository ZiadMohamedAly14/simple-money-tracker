/**
 * Seam A: a parent on a kid's phone (ticket 15). PIN elevation of a Kid
 * Session, listing and revoking Kid-Mode devices, and resetting a forgotten
 * Parent PIN with an email code.
 */
import request from 'supertest';
import type { Express } from 'express';
import { defaultJarId, type PushedChange, type SyncResponseData } from '@money-tracker/shared';
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
    record: { id: newId(), ...meta, kind: 'expense', amount: 1500, categoryId: `${accountId}`, date: '2026-03-02', note: 'Coffee' },
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
      await sync(parent, 0, [expense(parent.accountId)]);
      const kid = await kidDevice();
      const elevated = (await elevate(kid, PIN)).body.data as { accessToken: string };

      const res = await sync(elevated, 0, [topUp(parent.accountId, OMAR, 2000)]);
      expect(res.status).toBe(200);
      const pulled = (res.body.data as SyncResponseData).changes;
      expect(new Set(pulled.map((change) => change.entity))).toEqual(new Set(['kidProfile', 'jar', 'kidTransaction']));
      expect(pulled.every((change) => change.entity === 'kidProfile' ? change.record.id === OMAR : (change.record as { kidProfileId?: string }).kidProfileId === OMAR)).toBe(true);
      expect(pulled.filter((change) => change.entity === 'kidTransaction')).toHaveLength(2);

      const seenByParent = (await sync(parent, 0)).body.data as SyncResponseData;
      expect(seenByParent.changes.filter((change) => change.entity === 'kidTransaction')).toHaveLength(2);
    });
  });
});
