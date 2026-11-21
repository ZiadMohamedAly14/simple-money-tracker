/**
 * Seam A: Kid Profiles, Jars and Top-ups through `POST /sync`.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { defaultJarId, type PushedChange, type SyncResponseData } from '@money-tracker/shared';
import { Account } from '../src/models/account.model';
import { Session } from '../src/models/session.model';
import { MINUTE, buildTestApp, createTestClock, createTestMailer, testEnv, type TestClock, type TestMailer } from './helpers/testApp';
import { useTestDatabase } from './helpers/testDatabase';

interface SignedIn {
  accessToken: string;
  accountId: string;
}

const KID_ID = '019ca8a0-3e80-7000-8000-0000000000a1';
const SECOND_KID_ID = '019ca8a0-3e80-7000-8000-0000000000a2';
const TOP_UP_ID = '019ca8a0-3e80-7000-8000-0000000000b1';
const meta = { updatedAt: 1772355600000, deletedAt: null };

const kidProfile = (id = KID_ID, patch: object = {}): PushedChange =>
  ({ entity: 'kidProfile', record: { id, ...meta, name: 'Omar', avatar: '🦊', archivedAt: null, ...patch } }) as PushedChange;

const jar = (id: string, kidProfileId: string, name: string, order: number): PushedChange =>
  ({ entity: 'jar', record: { id, ...meta, kidProfileId, name, order, archivedAt: null } }) as PushedChange;

const defaultJars = (accountId: string, kidProfileId = KID_ID) => {
  const ids = {
    save: defaultJarId(accountId, kidProfileId, 'save'),
    spend: defaultJarId(accountId, kidProfileId, 'spend'),
    give: defaultJarId(accountId, kidProfileId, 'give'),
  };
  return { ids, changes: [jar(ids.save, kidProfileId, 'Save', 0), jar(ids.spend, kidProfileId, 'Spend', 1), jar(ids.give, kidProfileId, 'Give', 2)] };
};

const topUp = (amount: number, splits: { jarId: string; amount: number }[], patch: object = {}): PushedChange =>
  ({
    entity: 'kidTransaction',
    record: { id: TOP_UP_ID, ...meta, kidProfileId: KID_ID, kind: 'topUp', amount, splits, date: '2026-03-01', note: null, ...patch },
  }) as PushedChange;

describe('Kid Wallet sync (Seam A)', () => {
  useTestDatabase();

  let mailer: TestMailer;
  let clock: TestClock;
  let app: Express;

  beforeEach(() => {
    mailer = createTestMailer();
    clock = createTestClock();
    app = buildTestApp({}, { mailer, now: clock });
  });

  async function signIn(email = 'sara@example.com'): Promise<SignedIn> {
    clock.advance(MINUTE);
    await request(app).post('/auth/code').send({ email, language: 'en' });
    const res = await request(app).post('/auth/verify').send({ email, code: mailer.lastCodeFor(email) });
    expect(res.status).toBe(200);
    return { accessToken: res.body.data.accessToken, accountId: res.body.data.account.id };
  }

  const sync = (who: { accessToken: string }, cursor: number, changes: unknown[] = []) =>
    request(app).post('/sync').set('Authorization', `Bearer ${who.accessToken}`).send({ cursor, changes });

  const data = (res: request.Response): SyncResponseData => res.body.data;

  it("stores a Kid Profile, its Jars and a split Top-up, and the Account's other device pulls them", async () => {
    const phone = await signIn();
    const tablet = await signIn();
    const { ids, changes } = defaultJars(phone.accountId);
    const split = [
      { jarId: ids.save, amount: 3000 },
      { jarId: ids.spend, amount: 7000 },
    ];

    const res = await sync(phone, 0, [topUp(10000, split), ...changes, kidProfile()]);
    expect(res.status).toBe(200);

    const pulled = data(await sync(tablet, 0)).changes;
    expect(pulled.filter((c) => c.entity === 'kidProfile').map((c) => c.record)).toEqual([
      expect.objectContaining({ id: KID_ID, name: 'Omar', avatar: '🦊', accountId: phone.accountId }),
    ]);
    expect(pulled.filter((c) => c.entity === 'jar').map((c) => c.record.id).sort()).toEqual(Object.values(ids).sort());
    expect(pulled.find((c) => c.entity === 'kidTransaction')?.record).toMatchObject({
      id: TOP_UP_ID,
      kind: 'topUp',
      amount: 10000,
      splits: split,
    });
  });

  it('rejects a Top-up whose split does not add up to its total', async () => {
    const sara = await signIn();
    const { ids, changes } = defaultJars(sara.accountId);
    await sync(sara, 0, [kidProfile(), ...changes]);

    const res = await sync(sara, 0, [topUp(10000, [{ jarId: ids.spend, amount: 9000 }])]);
    expect(res.status).toBe(422);
    expect(res.body.data).toEqual([{ field: 'changes[0].record.splits', message: 'must add up to the total' }]);
  });

  it("rejects a Top-up into another Kid Profile's Jar", async () => {
    const sara = await signIn();
    const omar = defaultJars(sara.accountId, KID_ID);
    const lina = defaultJars(sara.accountId, SECOND_KID_ID);
    await sync(sara, 0, [kidProfile(), kidProfile(SECOND_KID_ID, { name: 'Lina' }), ...omar.changes, ...lina.changes]);

    const res = await sync(sara, 0, [
      topUp(10000, [
        { jarId: omar.ids.spend, amount: 5000 },
        { jarId: lina.ids.spend, amount: 5000 },
      ]),
    ]);
    expect(res.status).toBe(422);
    expect(res.body.data).toEqual([{ field: 'changes[0].record.splits', message: expect.stringContaining('Jar') }]);
  });

  it('rejects a Top-up into a Jar that does not exist', async () => {
    const sara = await signIn();
    await sync(sara, 0, [kidProfile()]);
    const res = await sync(sara, 0, [topUp(10000, [{ jarId: '019ca8a0-3e80-7000-8000-0000000000ff', amount: 10000 }])]);
    expect(res.status).toBe(422);
    expect(res.body.data).toEqual([{ field: 'changes[0].record.splits', message: expect.any(String) }]);
  });

  it("rejects a Jar or Top-up for another Account's Kid Profile", async () => {
    const sara = await signIn('sara@example.com');
    const omar = await signIn('omar@example.com');
    const omarsJars = defaultJars(omar.accountId);
    await sync(omar, 0, [kidProfile(), ...omarsJars.changes]);

    const jarRes = await sync(sara, 0, [jar('019ca8a0-3e80-7000-8000-0000000000c1', KID_ID, 'Save', 0)]);
    expect(jarRes.status).toBe(422);
    expect(jarRes.body.data).toEqual([{ field: 'changes[0].record.kidProfileId', message: expect.any(String) }]);

    const topUpRes = await sync(sara, 0, [topUp(10000, [{ jarId: omarsJars.ids.spend, amount: 10000 }])]);
    expect(topUpRes.status).toBe(422);
  });

  it('a parent can edit and delete a Top-up, and the other device sees each change', async () => {
    const phone = await signIn();
    const tablet = await signIn();
    const { ids, changes } = defaultJars(phone.accountId);
    await sync(phone, 0, [kidProfile(), ...changes, topUp(10000, [{ jarId: ids.spend, amount: 10000 }])]);

    const edited = topUp(
      12000,
      [
        { jarId: ids.save, amount: 2000 },
        { jarId: ids.spend, amount: 10000 },
      ],
      { updatedAt: meta.updatedAt + 1000 },
    );
    expect((await sync(phone, 0, [edited])).status).toBe(200);
    const afterEdit = data(await sync(tablet, 0)).changes.find((c) => c.entity === 'kidTransaction');
    expect(afterEdit?.record).toMatchObject({ amount: 12000 });

    const deleted = topUp(12000, (edited.record as unknown as { splits: { jarId: string; amount: number }[] }).splits, { updatedAt: meta.updatedAt + 2000, deletedAt: meta.updatedAt + 2000 });
    expect((await sync(phone, 0, [deleted])).status).toBe(200);
    const afterDelete = data(await sync(tablet, 0)).changes.find((c) => c.entity === 'kidTransaction');
    expect(afterDelete?.record.deletedAt).toBe(meta.updatedAt + 2000);
  });

  it('a Kid Session cannot create Kid Profiles, Jars or Top-ups (ADR-0002)', async () => {
    const sara = await signIn();
    const account = await Account.findById(sara.accountId).lean();
    const session = await Session.create({
      accountId: account!._id,
      scope: 'kid',
      kidProfileId: KID_ID,
      refreshTokenHash: 'unused',
      expiresAt: new Date(clock().getTime() + 60 * MINUTE),
    });
    const kid = {
      accessToken: jwt.sign(
        { typ: 'access', sid: session.id, scope: 'kid', iat: Math.floor(clock().getTime() / 1000) },
        testEnv().jwtAccessSecret,
        { subject: sara.accountId, expiresIn: 15 * 60 },
      ),
    };
    const { ids, changes } = defaultJars(sara.accountId);
    for (const change of [kidProfile(), changes[0], topUp(10000, [{ jarId: ids.spend, amount: 10000 }])]) {
      expect((await sync(kid, 0, [change])).status).toBe(403);
    }
  });
});
