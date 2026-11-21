import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { verifyParentPin } from '@money-tracker/shared';
import { Account } from '../src/models/account.model';
import { Session } from '../src/models/session.model';
import { MINUTE, buildTestApp, createTestClock, createTestMailer, testEnv, type TestClock, type TestMailer } from './helpers/testApp';
import { useTestDatabase } from './helpers/testDatabase';

describe('Parent PIN (Seam A)', () => {
  useTestDatabase();

  let mailer: TestMailer;
  let clock: TestClock;
  let app: Express;

  beforeEach(() => {
    mailer = createTestMailer();
    clock = createTestClock();
    app = buildTestApp({}, { mailer, now: clock });
  });

  async function signIn(email = 'sara@example.com'): Promise<string> {
    clock.advance(MINUTE);
    await request(app).post('/auth/code').send({ email, language: 'en' });
    const res = await request(app).post('/auth/verify').send({ email, code: mailer.lastCodeFor(email) });
    expect(res.status).toBe(200);
    return res.body.data.accessToken;
  }

  const getPin = (token: string) => request(app).get('/account/pin').set('Authorization', `Bearer ${token}`);
  const putPin = (token: string, body: object) =>
    request(app).put('/account/pin').set('Authorization', `Bearer ${token}`).send(body);

  it('a new Account has no PIN', async () => {
    const token = await signIn();
    const res = await getPin(token);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ pinHash: null });
  });

  it('sets the PIN and hands back only its hash, which checks the PIN offline', async () => {
    const token = await signIn();

    const set = await putPin(token, { pin: '2580' });
    expect(set.status).toBe(200);
    const { pinHash } = set.body.data;
    expect(pinHash).not.toContain('2580');
    expect(await verifyParentPin('2580', pinHash)).toBe(true);
    expect(await verifyParentPin('1111', pinHash)).toBe(false);

    const read = await getPin(token);
    expect(read.body.data).toEqual({ pinHash });
  });

  it('stores only the hash on the Account', async () => {
    const token = await signIn();
    await putPin(token, { pin: '2580' });

    const stored = await Account.findOne({ email: 'sara@example.com' }).lean();
    expect(JSON.stringify(stored)).not.toContain('2580');
    expect(await verifyParentPin('2580', stored!.parentPinHash!)).toBe(true);
  });

  it('another device of the same Account receives the PIN hash', async () => {
    const phone = await signIn();
    const tablet = await signIn();
    await putPin(phone, { pin: '2580' });

    const read = await getPin(tablet);
    expect(await verifyParentPin('2580', read.body.data.pinHash)).toBe(true);
  });

  it.each([['123'], ['1234567'], ['12a4'], [1234], [undefined]])('refuses %p as a PIN', async (pin) => {
    const token = await signIn();
    const res = await putPin(token, { pin });
    expect(res.status).toBe(422);
    expect((await getPin(token)).body.data).toEqual({ pinHash: null });
  });

  describe('changing the PIN', () => {
    it('needs the current PIN', async () => {
      const token = await signIn();
      await putPin(token, { pin: '2580' });

      const res = await putPin(token, { pin: '1397' });
      expect(res.status).toBe(403);
      expect(res.body.data).toEqual(expect.objectContaining({ reason: 'wrong_pin' }));
      expect(await verifyParentPin('2580', (await getPin(token)).body.data.pinHash)).toBe(true);
    });

    it('works with the current PIN, after which only the new PIN checks', async () => {
      const token = await signIn();
      await putPin(token, { pin: '2580' });

      const res = await putPin(token, { pin: '139700', currentPin: '2580' });
      expect(res.status).toBe(200);
      const { pinHash } = res.body.data;
      expect(await verifyParentPin('139700', pinHash)).toBe(true);
      expect(await verifyParentPin('2580', pinHash)).toBe(false);
      expect((await getPin(token)).body.data).toEqual({ pinHash });
    });

    it('refuses a wrong current PIN and says how many tries are left', async () => {
      const token = await signIn();
      await putPin(token, { pin: '2580' });

      const res = await putPin(token, { pin: '1397', currentPin: '0000' });
      expect(res.status).toBe(403);
      expect(res.body.data).toEqual({ reason: 'wrong_pin', attemptsRemaining: 4 });
      expect(await verifyParentPin('2580', (await getPin(token)).body.data.pinHash)).toBe(true);
    });

    it('throttles wrong current PINs: after 5, even the right one waits', async () => {
      const token = await signIn();
      await putPin(token, { pin: '2580' });
      for (let i = 0; i < 5; i += 1) await putPin(token, { pin: '1397', currentPin: '0000' });

      const locked = await putPin(token, { pin: '1397', currentPin: '2580' });
      expect(locked.status).toBe(429);
      expect(locked.body.data).toEqual({ reason: 'pin_locked', retryAfterSeconds: 30 });

      clock.advance(30 * 1000);
      const ok = await putPin(token, { pin: '1397', currentPin: '2580' });
      expect(ok.status).toBe(200);
    });

    it('the wait grows with each wrong PIN after the free tries, and a right PIN resets it', async () => {
      const token = await signIn();
      await putPin(token, { pin: '2580' });
      for (let i = 0; i < 5; i += 1) await putPin(token, { pin: '1397', currentPin: '0000' });
      clock.advance(30 * 1000);

      const sixth = await putPin(token, { pin: '1397', currentPin: '0000' });
      expect(sixth.status).toBe(403);
      expect(sixth.body.data).toEqual({ reason: 'wrong_pin', attemptsRemaining: 0 });
      const locked = await putPin(token, { pin: '1397', currentPin: '2580' });
      expect(locked.body.data).toEqual({ reason: 'pin_locked', retryAfterSeconds: 60 });

      clock.advance(60 * 1000);
      expect((await putPin(token, { pin: '1397', currentPin: '2580' })).status).toBe(200);
      const fresh = await putPin(token, { pin: '2580', currentPin: '0000' });
      expect(fresh.body.data).toEqual({ reason: 'wrong_pin', attemptsRemaining: 4 });
    });
  });

  describe('a Kid-Mode device (ADR-0002)', () => {
    /** A Kid Session, made directly until kid device setup exists (ticket 14). */
    async function kidToken(): Promise<string> {
      await signIn();
      const account = await Account.findOne({ email: 'sara@example.com' }).lean();
      const session = await Session.create({
        accountId: account!._id,
        scope: 'kid',
        kidProfileId: 'kid-1',
        refreshTokenHash: 'unused',
        expiresAt: new Date(clock().getTime() + 60 * MINUTE),
      });
      return jwt.sign(
        { typ: 'access', sid: session.id, scope: 'kid', iat: Math.floor(clock().getTime() / 1000) },
        testEnv().jwtAccessSecret,
        { subject: String(account!._id), expiresIn: 15 * 60 },
      );
    }

    it('never receives the PIN hash', async () => {
      const parent = await signIn();
      await putPin(parent, { pin: '2580' });
      const kid = await kidToken();

      const res = await getPin(kid);
      expect(res.status).toBe(403);
      expect(res.body.data).toEqual({ reason: 'kid_session' });
      expect(JSON.stringify(res.body)).not.toContain('pbkdf2');
    });

    it('cannot set or change the PIN', async () => {
      const kid = await kidToken();
      const res = await putPin(kid, { pin: '1111' });
      expect(res.status).toBe(403);
      expect(res.body.data).toEqual({ reason: 'kid_session' });
    });
  });

  it('needs a signed-in device', async () => {
    expect((await request(app).get('/account/pin')).status).toBe(401);
    expect((await request(app).put('/account/pin').send({ pin: '2580' })).status).toBe(401);
  });
});
