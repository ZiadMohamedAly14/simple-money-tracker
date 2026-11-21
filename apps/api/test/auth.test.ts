import request from 'supertest';
import type { Express } from 'express';
import { REQUEST_CODE_IP_LIMIT, VERIFY_CODE_IP_LIMIT } from '../src/routes/auth.routes';
import {
  MINUTE,
  SECOND,
  buildTestApp,
  createTestClock,
  createTestMailer,
  type TestClock,
  type TestMailer,
} from './helpers/testApp';
import { useTestDatabase } from './helpers/testDatabase';

describe('sign in with an email code', () => {
  useTestDatabase();

  let mailer: TestMailer;
  let clock: TestClock;
  let app: Express;

  beforeEach(() => {
    mailer = createTestMailer();
    clock = createTestClock();
    app = buildTestApp({}, { mailer, now: clock });
  });

  const requestCode = (email: string, language = 'en') =>
    request(app).post('/auth/code').send({ email, language });
  const verify = (email: string, code: string) => request(app).post('/auth/verify').send({ email, code });

  it('creates the Account on the first verify and signs in to it again later', async () => {
    const sent = await requestCode('sara@example.com');
    expect(sent.status).toBe(200);
    expect(sent.body.success).toBe(true);

    const first = await verify('sara@example.com', mailer.lastCodeFor('sara@example.com'));
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      isNewAccount: true,
      onboardingCompleted: false,
      account: { id: expect.any(String), email: 'sara@example.com' },
    });
    expect(first.body.data.accessToken).not.toBe(first.body.data.refreshToken);

    clock.advance(2 * 60 * 1000);
    await requestCode('sara@example.com');
    const second = await verify('sara@example.com', mailer.lastCodeFor('sara@example.com'));
    expect(second.status).toBe(200);
    expect(second.body.data.isNewAccount).toBe(false);
    expect(second.body.data.account.id).toBe(first.body.data.account.id);
  });

  it('treats an email in mixed case as the same Account', async () => {
    await requestCode('  Sara@Example.COM ');
    expect(mailer.lastTo('sara@example.com').to).toBe('sara@example.com');
    const first = await verify('SARA@example.com', mailer.lastCodeFor('sara@example.com'));
    expect(first.status).toBe(200);
    expect(first.body.data.account.email).toBe('sara@example.com');

    clock.advance(MINUTE);
    await requestCode('sara@EXAMPLE.com');
    const second = await verify('sara@example.com', mailer.lastCodeFor('sara@example.com'));
    expect(second.body.data).toMatchObject({ isNewAccount: false, account: { id: first.body.data.account.id } });
  });

  it('sends the code email in the requesting device language', async () => {
    await requestCode('en@example.com', 'en');
    await requestCode('ar@example.com', 'ar');
    expect(mailer.lastTo('en@example.com').subject).toBe('Your Mizan sign-in code');
    expect(mailer.lastTo('ar@example.com').subject).toBe('رمز الدخول إلى ميزان');
    expect(mailer.lastTo('ar@example.com').html).toContain('dir="rtl"');
    expect(mailer.lastTo('en@example.com').text).toContain('Mizan');
    expect(mailer.lastTo('ar@example.com').text).toContain('ميزان');
    expect(mailer.lastCodeFor('ar@example.com')).toMatch(/^\d{6}$/);
  });

  it('rejects an invalid email or language', async () => {
    expect((await requestCode('not-an-email')).status).toBe(422);
    expect((await requestCode('a@example.com', 'fr')).status).toBe(422);
    expect(mailer.sent).toHaveLength(0);
  });

  it('rejects a wrong code and says how many guesses are left', async () => {
    await requestCode('sara@example.com');
    const code = mailer.lastCodeFor('sara@example.com');
    const wrong = code === '000000' ? '111111' : '000000';

    const response = await verify('sara@example.com', wrong);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      data: { reason: 'invalid_code', attemptsRemaining: 4 },
    });

    expect((await verify('sara@example.com', code)).status).toBe(200);
  });

  it('allows at most 5 wrong guesses, then even the right code is refused until a new one is sent', async () => {
    await requestCode('sara@example.com');
    const code = mailer.lastCodeFor('sara@example.com');
    const wrong = code === '000000' ? '111111' : '000000';

    for (let left = 4; left >= 0; left--) {
      const response = await verify('sara@example.com', wrong);
      expect(response.body.data).toEqual({ reason: 'invalid_code', attemptsRemaining: left });
    }
    const blocked = await verify('sara@example.com', code);
    expect(blocked.status).toBe(429);
    expect(blocked.body.data).toEqual({ reason: 'too_many_guesses' });

    clock.advance(MINUTE);
    await requestCode('sara@example.com');
    expect((await verify('sara@example.com', mailer.lastCodeFor('sara@example.com'))).status).toBe(200);
  });

  it('refuses a code after 10 minutes', async () => {
    await requestCode('sara@example.com');
    const code = mailer.lastCodeFor('sara@example.com');

    clock.advance(10 * MINUTE);
    const response = await verify('sara@example.com', code);
    expect(response.status).toBe(400);
    expect(response.body.data).toEqual({ reason: 'code_expired' });
  });

  it('accepts a code just before it expires', async () => {
    await requestCode('sara@example.com');
    clock.advance(10 * MINUTE - SECOND);
    expect((await verify('sara@example.com', mailer.lastCodeFor('sara@example.com'))).status).toBe(200);
  });

  it('uses a code only once, and a resend replaces the previous code', async () => {
    await requestCode('sara@example.com');
    const firstCode = mailer.lastCodeFor('sara@example.com');
    clock.advance(MINUTE);
    await requestCode('sara@example.com');
    const secondCode = mailer.lastCodeFor('sara@example.com');

    if (firstCode !== secondCode) {
      expect((await verify('sara@example.com', firstCode)).body.data.reason).toBe('invalid_code');
    }
    expect((await verify('sara@example.com', secondCode)).status).toBe(200);
    expect((await verify('sara@example.com', secondCode)).body.data).toEqual({ reason: 'code_expired' });
  });

  it('refuses to verify an email that never requested a code (there is no test code)', async () => {
    for (const code of ['000000', '123456', '111111']) {
      const response = await verify('nobody@example.com', code);
      expect(response.status).toBe(400);
      expect(response.body.data).toEqual({ reason: 'code_expired' });
    }
  });

  it('limits resends to one a minute per email', async () => {
    expect((await requestCode('sara@example.com')).status).toBe(200);

    clock.advance(30 * SECOND);
    const tooSoon = await requestCode('SARA@example.com');
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.data).toEqual({ reason: 'resend_too_soon', retryAfterSeconds: 30 });
    expect(mailer.sent).toHaveLength(1);

    expect((await requestCode('other@example.com')).status).toBe(200);
    clock.advance(30 * SECOND);
    expect((await requestCode('sara@example.com')).status).toBe(200);
  });

  it('limits codes to five an hour per email', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await requestCode('sara@example.com')).status).toBe(200);
      clock.advance(MINUTE);
    }
    const sixth = await requestCode('sara@example.com');
    expect(sixth.status).toBe(429);
    expect(sixth.body.data).toEqual({ reason: 'too_many_codes', retryAfterSeconds: 55 * 60 });
    expect(mailer.sent).toHaveLength(5);

    clock.advance(55 * MINUTE);
    expect((await requestCode('sara@example.com')).status).toBe(200);
  });

  it('limits code requests per IP address across emails', async () => {
    const from = (ip: string, email: string) =>
      request(app).post('/auth/code').set('X-Forwarded-For', ip).send({ email, language: 'en' });

    for (let i = 0; i < REQUEST_CODE_IP_LIMIT.max; i++) {
      expect((await from('203.0.113.7', `user${i}@example.com`)).status).toBe(200);
    }
    const blocked = await from('203.0.113.7', 'one-more@example.com');
    expect(blocked.status).toBe(429);
    expect(blocked.body.data).toEqual({ reason: 'too_many_requests', retryAfterSeconds: expect.any(Number) });

    expect((await from('198.51.100.9', 'one-more@example.com')).status).toBe(200);
  });

  it('limits verify attempts per IP address across emails', async () => {
    const from = (ip: string, email: string) =>
      request(app).post('/auth/verify').set('X-Forwarded-For', ip).send({ email, code: '000000' });

    for (let i = 0; i < VERIFY_CODE_IP_LIMIT.max; i++) {
      expect((await from('203.0.113.7', `user${i}@example.com`)).status).toBe(400);
    }
    const blocked = await from('203.0.113.7', 'one-more@example.com');
    expect(blocked.status).toBe(429);
    expect(blocked.body.data.reason).toBe('too_many_requests');

    expect((await from('198.51.100.9', 'one-more@example.com')).status).toBe(400);
  });

  it('returns 503 and no tokens when the email cannot be sent', async () => {
    const failing = buildTestApp({}, { mailer: { send: () => Promise.reject(new Error('SMTP down')) }, now: clock });
    const response = await request(failing).post('/auth/code').send({ email: 'sara@example.com', language: 'en' });
    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
  });
});
