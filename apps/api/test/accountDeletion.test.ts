/**
 * Seam A: deleting an Account (`POST /account/deletion/code`, then
 * `POST /account/deletion { code }`). Deletion hard-deletes every collection
 * immediately (ADR-0005) and ends every session, Kid Sessions included.
 */
import request from 'supertest';
import type { Express } from 'express';
import mongoose from 'mongoose';
import { accountSettingsId, categoryBudgetId, defaultJarId, monthPlanId, otherCategoryId, type PushedChange } from '@money-tracker/shared';
import { HOUR, MINUTE, buildTestApp, createTestClock, createTestMailer, type TestClock, type TestMailer } from './helpers/testApp';
import { useTestDatabase } from './helpers/testDatabase';
import { Counter } from '../src/models/counter.model';

const OMAR = '019ca8a0-3e80-7000-8000-0000000000b1';
const NOUR = '019ca8a0-3e80-7000-8000-0000000000b2';
const meta = { updatedAt: 1772355600000, deletedAt: null };
const PIN = '2580';

let nextId = 0x200;
const newId = (): string => `019ca8a0-3e80-7000-8000-${(nextId++).toString(16).padStart(12, '0')}`;

interface Signed {
  accessToken: string;
  refreshToken: string;
  accountId: string;
  email: string;
}

/**
 * Collections that hold no Account's data, so the "nothing left" check skips
 * them. Every other model must be filled by `wholeAccount()` below, or the
 * coverage test fails: add data for a new collection there.
 */
const NOT_ACCOUNT_DATA = new Set([Counter.collection.collectionName]);

/** One of each synced record, plus a Kid Expense, for the Account. */
function everyRecord(accountId: string, kidProfileId: string, categoryId = newId()): PushedChange[] {
  const jar = (key: 'save' | 'spend') => defaultJarId(accountId, kidProfileId, key);
  return [
    { entity: 'accountSettings', record: { id: accountSettingsId(accountId), ...meta, currency: 'EGP', numberingSystem: 'western' } },
    { entity: 'category', record: { id: categoryId, ...meta, name: 'Food', order: 1, isOther: false, archivedAt: null } },
    { entity: 'monthPlan', record: { id: monthPlanId(accountId, '2026-03'), ...meta, month: '2026-03', expectedIncome: 800000 } },
    {
      entity: 'categoryBudget',
      record: { id: categoryBudgetId(accountId, '2026-03', categoryId), ...meta, month: '2026-03', categoryId, amount: 100000 },
    },
    {
      entity: 'transaction',
      record: { id: newId(), ...meta, kind: 'expense', amount: 1500, categoryId: otherCategoryId(accountId), date: '2026-03-02', note: null },
    },
    { entity: 'kidProfile', record: { id: kidProfileId, ...meta, name: 'Omar', avatar: null, archivedAt: null } },
    ...(['save', 'spend'] as const).map(
      (key, order) =>
        ({ entity: 'jar', record: { id: jar(key), ...meta, kidProfileId, name: key, order, archivedAt: null } }) as PushedChange,
    ),
    {
      entity: 'kidTransaction',
      record: {
        id: newId(),
        ...meta,
        kidProfileId,
        kind: 'topUp',
        amount: 5000,
        splits: [{ jarId: jar('spend'), amount: 5000 }],
        jarId: null,
        toJarId: null,
        date: '2026-03-02',
        note: null,
      },
    },
  ] as PushedChange[];
}

/** Every document in the database, by collection, whose JSON mentions the Account's id or email. */
async function recordsMentioning({ accountId, email }: { accountId: string; email: string }): Promise<Record<string, number>> {
  const found: Record<string, number> = {};
  const collections = await mongoose.connection.db!.collections();
  for (const collection of collections) {
    const docs = await collection.find({}).toArray();
    const hits = docs.filter((doc) => {
      const json = JSON.stringify(doc).toLowerCase();
      return json.includes(accountId) || json.includes(email);
    }).length;
    if (hits > 0) found[collection.collectionName] = hits;
  }
  return found;
}

/** Every collection behind a registered Mongoose model, so a new model can't be missed. */
const modelCollections = (): string[] =>
  mongoose.modelNames().map((name) => mongoose.model(name).collection.collectionName);

describe('Account deletion (Seam A)', () => {
  useTestDatabase();

  let mailer: TestMailer;
  let clock: TestClock;
  let app: Express;

  beforeEach(() => {
    mailer = createTestMailer();
    clock = createTestClock();
    app = buildTestApp({}, { mailer, now: clock });
  });

  async function signIn(email = 'sara@example.com'): Promise<Signed> {
    clock.advance(MINUTE);
    await request(app).post('/auth/code').send({ email, language: 'en' });
    const res = await request(app).post('/auth/verify').send({ email, code: mailer.lastCodeFor(email) });
    expect(res.status).toBe(200);
    const { accessToken, refreshToken, account } = res.body.data;
    return { accessToken, refreshToken, accountId: account.id, email };
  }

  const as = (who: { accessToken: string }) => `Bearer ${who.accessToken}`;
  const sync = (who: { accessToken: string }, changes: unknown[] = [], cursor = 0) =>
    request(app).post('/sync').set('Authorization', as(who)).send({ cursor, changes });
  const requestDeletionCode = (who: { accessToken: string }, language = 'en') => {
    clock.advance(MINUTE);
    return request(app).post('/account/deletion/code').set('Authorization', as(who)).send({ language });
  };
  const confirmDeletion = (who: { accessToken: string }, code: string) =>
    request(app).post('/account/deletion').set('Authorization', as(who)).send({ code });

  /**
   * An Account with data in every collection: synced records, a PIN, a
   * second phone, a Kid-Mode device, and unused sign-in and deletion codes.
   */
  async function wholeAccount(email = 'sara@example.com', kidProfileId = OMAR) {
    const phone = await signIn(email);
    expect((await request(app).put('/account/pin').set('Authorization', as(phone)).send({ pin: PIN })).status).toBe(200);
    expect((await sync(phone, everyRecord(phone.accountId, kidProfileId))).status).toBe(200);
    const tablet = await signIn(email);
    const kidPhone = await signIn(email);
    const kid = await request(app).post('/kid-devices').set('Authorization', as(kidPhone)).send({ kidProfileId, pin: PIN });
    expect(kid.status).toBe(200);
    const kidDevice = kid.body.data as { accessToken: string; refreshToken: string };
    expect((await sync(kidDevice)).status).toBe(200);
    // A sign-in code someone asked for and never used.
    clock.advance(MINUTE);
    await request(app).post('/auth/code').send({ email, language: 'en' });
    // A deletion code asked for earlier and never used.
    expect((await requestDeletionCode(tablet)).status).toBe(200);
    return { phone, tablet, kidDevice };
  }

  it('emails a deletion code to the Account’s address, in the device’s language', async () => {
    const phone = await signIn();
    const res = await requestDeletionCode(phone, 'ar');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ expiresInSeconds: 600, resendAfterSeconds: 60 });
    const email = mailer.lastTo('sara@example.com');
    expect(email.subject).toMatch(/حذف/);
    expect(email.text).toMatch(/\b\d{6}\b/);
  });

  it('after deletion, no record of the Account remains in any collection', async () => {
    const { phone } = await wholeAccount();
    const sara = { accountId: phone.accountId, email: 'sara@example.com' };
    // Coverage: every collection (other than the server-wide ones) holds some of this Account's data.
    const before = await recordsMentioning(sara);
    const uncovered = modelCollections().filter((name) => !NOT_ACCOUNT_DATA.has(name) && !before[name]);
    expect(uncovered).toEqual([]);

    await requestDeletionCode(phone);
    const res = await confirmDeletion(phone, mailer.lastCodeFor('sara@example.com'));

    expect(res.status).toBe(200);
    expect(await recordsMentioning(sara)).toEqual({});
  });

  it('ends every session, the Kid-Mode device’s included, and leaves other Accounts alone', async () => {
    const { phone, tablet, kidDevice } = await wholeAccount();
    const other = await wholeAccount('hana@example.com', NOUR);
    const otherBefore = await recordsMentioning({ accountId: other.phone.accountId, email: 'hana@example.com' });

    await requestDeletionCode(phone);
    expect((await confirmDeletion(phone, mailer.lastCodeFor('sara@example.com'))).status).toBe(200);

    for (const device of [phone, tablet, kidDevice]) {
      const res = await sync(device);
      expect(res.status).toBe(401);
      expect(res.body.data).toEqual({ reason: 'session_ended' });
      const refreshed = await request(app).post('/auth/refresh').send({ refreshToken: device.refreshToken });
      expect(refreshed.status).toBe(401);
    }
    expect(await recordsMentioning({ accountId: other.phone.accountId, email: 'hana@example.com' })).toEqual(otherBefore);
    expect((await sync(other.kidDevice)).status).toBe(200);
  });

  it('signing in again with the same email starts a new, empty Account', async () => {
    const { phone } = await wholeAccount();
    await requestDeletionCode(phone);
    await confirmDeletion(phone, mailer.lastCodeFor('sara@example.com'));

    clock.advance(HOUR);
    await request(app).post('/auth/code').send({ email: 'sara@example.com', language: 'en' });
    const res = await request(app).post('/auth/verify').send({ email: 'sara@example.com', code: mailer.lastCodeFor('sara@example.com') });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ isNewAccount: true, onboardingCompleted: false });
    expect(res.body.data.account.id).not.toBe(phone.accountId);
    const pulled = await sync(res.body.data);
    // Only the new Account's Other Category.
    expect(pulled.body.data.changes).toEqual([expect.objectContaining({ entity: 'category', record: expect.objectContaining({ isOther: true }) })]);
  });

  describe('the code', () => {
    it('a wrong code deletes nothing and says how many tries are left', async () => {
      const phone = await signIn();
      await requestDeletionCode(phone);
      const right = mailer.lastCodeFor('sara@example.com');
      const wrong = right === '000000' ? '111111' : '000000';

      const res = await confirmDeletion(phone, wrong);

      expect(res.status).toBe(400);
      expect(res.body.data).toEqual({ reason: 'invalid_code', attemptsRemaining: 4 });
      expect((await sync(phone)).status).toBe(200);
    });

    it('five wrong codes use it up, even the right one after that', async () => {
      const phone = await signIn();
      await requestDeletionCode(phone);
      const right = mailer.lastCodeFor('sara@example.com');
      const wrong = right === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i += 1) await confirmDeletion(phone, wrong);

      const res = await confirmDeletion(phone, right);

      expect(res.status).toBe(429);
      expect(res.body.data).toEqual({ reason: 'too_many_guesses' });
      expect((await sync(phone)).status).toBe(200);
    });

    it('expires after 10 minutes', async () => {
      const phone = await signIn();
      await requestDeletionCode(phone);
      clock.advance(10 * MINUTE + 1);

      const res = await confirmDeletion(phone, mailer.lastCodeFor('sara@example.com'));

      expect(res.status).toBe(400);
      expect(res.body.data).toEqual({ reason: 'code_expired' });
    });

    it('a sign-in code is not a deletion code', async () => {
      const phone = await signIn();
      await requestDeletionCode(phone);
      clock.advance(MINUTE);
      await request(app).post('/auth/code').send({ email: 'sara@example.com', language: 'en' });

      const res = await confirmDeletion(phone, mailer.lastCodeFor('sara@example.com'));

      expect(res.status).toBe(400);
      expect((await sync(phone)).status).toBe(200);
    });

    it('a deletion code does not sign in or reset the PIN', async () => {
      const phone = await signIn();
      await requestDeletionCode(phone);
      const code = mailer.lastCodeFor('sara@example.com');

      const verify = await request(app).post('/auth/verify').send({ email: 'sara@example.com', code });
      expect(verify.status).toBe(400);
      const reset = await request(app).post('/account/pin/reset').set('Authorization', as(phone)).send({ code, pin: '1234' });
      expect(reset.status).toBe(400);
      expect((await confirmDeletion(phone, code)).status).toBe(200);
    });

    it('needs a code requested first', async () => {
      const phone = await signIn();
      const res = await confirmDeletion(phone, '123456');
      expect(res.status).toBe(400);
      expect(res.body.data).toEqual({ reason: 'code_expired' });
    });

    it('can’t be resent within a minute', async () => {
      const phone = await signIn();
      await requestDeletionCode(phone);
      const res = await request(app).post('/account/deletion/code').set('Authorization', as(phone)).send({ language: 'en' });
      expect(res.status).toBe(429);
      expect(res.body.data).toMatchObject({ reason: 'resend_too_soon' });
    });

    it('must be 6 digits', async () => {
      const phone = await signIn();
      expect((await confirmDeletion(phone, '12ab')).status).toBe(422);
    });
  });

  it('a Kid-Mode device can neither ask for a code nor delete the Account', async () => {
    const { phone, kidDevice } = await wholeAccount();
    const asked = await requestDeletionCode(kidDevice);
    expect(asked.status).toBe(403);
    expect(asked.body.data).toEqual({ reason: 'kid_session' });

    await requestDeletionCode(phone);
    const res = await confirmDeletion(kidDevice, mailer.lastCodeFor('sara@example.com'));
    expect(res.status).toBe(403);
    expect((await sync(phone)).status).toBe(200);
  });

  it('needs a signed-in device', async () => {
    expect((await request(app).post('/account/deletion/code').send({ language: 'en' })).status).toBe(401);
    expect((await request(app).post('/account/deletion').send({ code: '123456' })).status).toBe(401);
  });
});
