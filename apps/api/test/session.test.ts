import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import {
  HOUR,
  MINUTE,
  buildTestApp,
  createTestClock,
  createTestMailer,
  testEnv,
  type TestClock,
  type TestMailer,
} from './helpers/testApp';
import { useTestDatabase } from './helpers/testDatabase';

const DAY = 24 * HOUR;

describe('session lifecycle', () => {
  useTestDatabase();

  let mailer: TestMailer;
  let clock: TestClock;
  let app: Express;

  beforeEach(() => {
    mailer = createTestMailer();
    clock = createTestClock();
    app = buildTestApp({}, { mailer, now: clock });
  });

  async function signIn(email = 'sara@example.com'): Promise<{ accessToken: string; refreshToken: string }> {
    await request(app).post('/auth/code').send({ email, language: 'en' });
    const res = await request(app).post('/auth/verify').send({ email, code: mailer.lastCodeFor(email) });
    expect(res.status).toBe(200);
    return res.body.data;
  }

  const refresh = (refreshToken: string) => request(app).post('/auth/refresh').send({ refreshToken });
  const logout = (accessToken: string) =>
    request(app).post('/auth/logout').set('Authorization', `Bearer ${accessToken}`);

  it('swaps a refresh token for a new token pair', async () => {
    const first = await signIn();
    clock.advance(MINUTE);

    const res = await refresh(first.refreshToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    expect(res.body.data.refreshToken).not.toBe(first.refreshToken);

    expect((await logout(res.body.data.accessToken)).status).toBe(200);
  });

  it('keeps rotating: each new refresh token works', async () => {
    let tokens = await signIn();
    for (let i = 0; i < 3; i += 1) {
      clock.advance(10 * DAY);
      const res = await refresh(tokens.refreshToken);
      expect(res.status).toBe(200);
      tokens = res.body.data;
    }
  });

  it('revokes the whole session when a replaced refresh token is used again', async () => {
    const first = await signIn();
    const rotated = (await refresh(first.refreshToken)).body.data;

    const reused = await refresh(first.refreshToken);
    expect(reused.status).toBe(401);
    expect(reused.body.data).toEqual({ reason: 'session_ended' });

    // The holder of the newest tokens is signed out too.
    expect((await refresh(rotated.refreshToken)).status).toBe(401);
    const denied = await logout(rotated.accessToken);
    expect(denied.status).toBe(401);
    expect(denied.body.data).toEqual({ reason: 'session_ended' });
  });

  it('lets only one of two parallel refreshes with the same token through', async () => {
    const { refreshToken } = await signIn();
    const results = await Promise.all([refresh(refreshToken), refresh(refreshToken)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it('leaves the Account\'s other sessions alone when one is revoked for reuse', async () => {
    const phone = await signIn();
    clock.advance(2 * MINUTE);
    const tablet = await signIn();

    await refresh(phone.refreshToken);
    await refresh(phone.refreshToken); // reuse: the phone session is revoked

    expect((await refresh(tablet.refreshToken)).status).toBe(200);
  });

  it('signs out: the session ends and its tokens stop working', async () => {
    const tokens = await signIn();

    const res = await logout(tokens.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect((await refresh(tokens.refreshToken)).body.data).toEqual({ reason: 'session_ended' });
    expect((await logout(tokens.accessToken)).status).toBe(401);
  });

  it('expires access tokens after 15 minutes', async () => {
    const tokens = await signIn();
    clock.advance(15 * MINUTE + 1000);
    const res = await logout(tokens.accessToken);
    expect(res.status).toBe(401);
    expect(res.body.data).toEqual({ reason: 'token_invalid' });
  });

  it('accepts a refresh token for 90 days, then the session has ended', async () => {
    const early = await signIn('early@example.com');
    const late = await signIn('late@example.com');

    clock.advance(89 * DAY);
    expect((await refresh(early.refreshToken)).status).toBe(200);

    clock.advance(DAY + 1000);
    const expired = await refresh(late.refreshToken);
    expect(expired.status).toBe(401);
    expect(expired.body.data).toEqual({ reason: 'session_ended' });
  });

  it('extends the session by 90 days with every refresh', async () => {
    let tokens = await signIn();
    clock.advance(60 * DAY);
    tokens = (await refresh(tokens.refreshToken)).body.data;
    clock.advance(60 * DAY);
    expect((await refresh(tokens.refreshToken)).status).toBe(200);
  });

  describe('token-type confusion', () => {
    it('rejects a refresh token where an access token is expected', async () => {
      const { refreshToken } = await signIn();
      const res = await logout(refreshToken);
      expect(res.status).toBe(401);
      expect(res.body.data).toEqual({ reason: 'token_invalid' });
    });

    it('rejects an access token where a refresh token is expected', async () => {
      const { accessToken } = await signIn();
      const res = await refresh(accessToken);
      expect(res.status).toBe(401);
      expect(res.body.data).toEqual({ reason: 'session_ended' });
    });

    it('rejects a token marked as the other type even when signed with the expected secret', async () => {
      const { accessToken, refreshToken } = await signIn();
      const { jwtAccessSecret, jwtRefreshSecret } = testEnv();
      const access = jwt.decode(accessToken) as Record<string, unknown>;
      const refreshClaims = jwt.decode(refreshToken) as Record<string, unknown>;

      const refreshTypedAccess = jwt.sign({ ...access, typ: 'refresh' }, jwtAccessSecret);
      expect((await logout(refreshTypedAccess)).status).toBe(401);

      const accessTypedRefresh = jwt.sign({ ...refreshClaims, typ: 'access', scope: 'full' }, jwtRefreshSecret);
      expect((await refresh(accessTypedRefresh)).status).toBe(401);
    });
  });

  it('rejects a missing or malformed token', async () => {
    expect((await request(app).post('/auth/logout')).status).toBe(401);
    expect((await logout('not-a-jwt')).status).toBe(401);
    expect((await refresh('not-a-jwt')).status).toBe(401);
    expect((await request(app).post('/auth/refresh').send({})).status).toBe(422);
  });
});
