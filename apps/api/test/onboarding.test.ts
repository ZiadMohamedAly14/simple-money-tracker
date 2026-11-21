import request from 'supertest';
import type { Express } from 'express';
import { MINUTE, buildTestApp, createTestClock, createTestMailer, type TestClock, type TestMailer } from './helpers/testApp';
import { useTestDatabase } from './helpers/testDatabase';

describe('onboarding', () => {
  useTestDatabase();

  let mailer: TestMailer;
  let clock: TestClock;
  let app: Express;

  beforeEach(() => {
    mailer = createTestMailer();
    clock = createTestClock();
    app = buildTestApp({}, { mailer, now: clock });
  });

  async function verify(email = 'sara@example.com') {
    clock.advance(MINUTE);
    await request(app).post('/auth/code').send({ email, language: 'en' });
    const res = await request(app).post('/auth/verify').send({ email, code: mailer.lastCodeFor(email) });
    expect(res.status).toBe(200);
    return res.body.data as { accessToken: string; onboardingCompleted: boolean };
  }

  const complete = (accessToken: string) =>
    request(app).post('/account/onboarding').set('Authorization', `Bearer ${accessToken}`).send({});

  it('a new Account has not finished onboarding', async () => {
    expect((await verify()).onboardingCompleted).toBe(false);
  });

  it('once marked complete, every later sign-in says so, so a second device skips onboarding', async () => {
    const phone = await verify();
    const res = await complete(phone.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ onboardingCompleted: true });

    expect((await verify()).onboardingCompleted).toBe(true);
  });

  it('marking it complete again is harmless', async () => {
    const phone = await verify();
    await complete(phone.accessToken);
    const again = await complete(phone.accessToken);
    expect(again.status).toBe(200);
    expect(again.body.data).toEqual({ onboardingCompleted: true });
  });

  it("only changes the caller's Account", async () => {
    const sara = await verify('sara@example.com');
    await complete(sara.accessToken);
    expect((await verify('omar@example.com')).onboardingCompleted).toBe(false);
  });

  it('needs a signed-in device', async () => {
    expect((await request(app).post('/account/onboarding').send({})).status).toBe(401);
  });
});
