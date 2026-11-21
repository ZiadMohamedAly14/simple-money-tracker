/**
 * Seam A: archiving a Kid Profile. The parent pushes the Kid Profile with
 * `archivedAt` set; its history stays, and its Kid-Mode devices are signed out.
 */
import request from 'supertest';
import type { Express } from 'express';
import { defaultJarId, type PushedChange, type SyncResponseData } from '@money-tracker/shared';
import { MINUTE, buildTestApp, createTestClock, createTestMailer, type TestClock, type TestMailer } from './helpers/testApp';
import { useTestDatabase } from './helpers/testDatabase';

const OMAR = '019ca8a0-3e80-7000-8000-0000000000c1';
const LINA = '019ca8a0-3e80-7000-8000-0000000000c2';
const T0 = 1772355600000;
const PIN = '2580';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const kidProfile = (id: string, name: string, patch: object = {}): PushedChange =>
  ({ entity: 'kidProfile', record: { id, updatedAt: T0, deletedAt: null, name, avatar: null, archivedAt: null, ...patch } }) as PushedChange;

describe('Archiving a Kid Profile (Seam A)', () => {
  useTestDatabase();

  let mailer: TestMailer;
  let clock: TestClock;
  let app: Express;

  beforeEach(() => {
    mailer = createTestMailer();
    clock = createTestClock();
    app = buildTestApp({}, { mailer, now: clock });
  });

  async function signIn(email = 'sara@example.com'): Promise<Tokens & { accountId: string }> {
    clock.advance(MINUTE);
    await request(app).post('/auth/code').send({ email, language: 'en' });
    const res = await request(app).post('/auth/verify').send({ email, code: mailer.lastCodeFor(email) });
    const { accessToken, refreshToken, account } = res.body.data;
    return { accessToken, refreshToken, accountId: account.id };
  }

  const sync = (who: Tokens, changes: unknown[] = [], cursor = 0) =>
    request(app).post('/sync').set('Authorization', `Bearer ${who.accessToken}`).send({ cursor, changes });

  /** Sara with Omar and Lina, each with a Top-up, and a Kid-Mode device for each. */
  async function family() {
    const parent = await signIn();
    await request(app).put('/account/pin').set('Authorization', `Bearer ${parent.accessToken}`).send({ pin: PIN });
    const changes: PushedChange[] = [];
    for (const [kid, name] of [[OMAR, 'Omar'], [LINA, 'Lina']] as const) {
      const spend = defaultJarId(parent.accountId, kid, 'spend');
      changes.push(
        kidProfile(kid, name),
        { entity: 'jar', record: { id: spend, updatedAt: T0, deletedAt: null, kidProfileId: kid, name: 'spend', order: 0, archivedAt: null } },
        {
          entity: 'kidTransaction',
          record: {
            id: kid.replace(/c(\d)$/, 'd$1'),
            updatedAt: T0,
            deletedAt: null,
            kidProfileId: kid,
            kind: 'topUp',
            amount: 5000,
            splits: [{ jarId: spend, amount: 5000 }],
            jarId: null,
            toJarId: null,
            date: '2026-03-02',
            note: null,
          },
        } as unknown as PushedChange,
      );
    }
    expect((await sync(parent, changes)).status).toBe(200);
    const kidDevice = async (kidProfileId: string): Promise<Tokens> => {
      const phone = await signIn();
      const res = await request(app).post('/kid-devices').set('Authorization', `Bearer ${phone.accessToken}`).send({ kidProfileId, pin: PIN });
      expect(res.status).toBe(200);
      return res.body.data;
    };
    return { parent, omarsPhone: await kidDevice(OMAR), linasPhone: await kidDevice(LINA) };
  }

  it("signs out the archived kid's Kid-Mode devices, and only theirs", async () => {
    const { parent, omarsPhone, linasPhone } = await family();

    const res = await sync(parent, [kidProfile(OMAR, 'Omar', { updatedAt: T0 + 1, archivedAt: T0 + 1 })]);
    expect(res.status).toBe(200);

    const kicked = await sync(omarsPhone);
    expect(kicked.status).toBe(401);
    expect(kicked.body.data).toEqual({ reason: 'session_ended' });
    expect((await request(app).post('/auth/refresh').send({ refreshToken: omarsPhone.refreshToken })).status).toBe(401);
    expect((await sync(linasPhone)).status).toBe(200);
    expect((await sync(parent)).status).toBe(200);
  });

  it('keeps the archived kid’s history for the parent', async () => {
    const { parent } = await family();
    await sync(parent, [kidProfile(OMAR, 'Omar', { updatedAt: T0 + 1, archivedAt: T0 + 1 })]);

    const pulled: SyncResponseData = (await sync(parent)).body.data;
    expect(pulled.changes).toContainEqual(
      expect.objectContaining({ entity: 'kidProfile', record: expect.objectContaining({ id: OMAR, archivedAt: T0 + 1, deletedAt: null }) }),
    );
    expect(pulled.changes.filter((c) => c.entity === 'kidTransaction' && c.record.kidProfileId === OMAR)).toHaveLength(1);
  });

  it('an archive that loses to a later edit leaves the devices signed in', async () => {
    const { parent, omarsPhone } = await family();
    await sync(parent, [kidProfile(OMAR, 'Omar K', { updatedAt: T0 + 10 })]);

    await sync(parent, [kidProfile(OMAR, 'Omar', { updatedAt: T0 + 5, archivedAt: T0 + 5 })]);

    expect((await sync(omarsPhone)).status).toBe(200);
  });

  it('deleting a Kid Profile signs its devices out too', async () => {
    const { parent, omarsPhone } = await family();
    await sync(parent, [kidProfile(OMAR, 'Omar', { updatedAt: T0 + 1, deletedAt: T0 + 1 })]);
    expect((await sync(omarsPhone)).status).toBe(401);
  });

  it('an archived kid gets no new Kid-Mode device until restored', async () => {
    const { parent } = await family();
    await sync(parent, [kidProfile(OMAR, 'Omar', { updatedAt: T0 + 1, archivedAt: T0 + 1 })]);
    const phone = await signIn();
    const refused = await request(app).post('/kid-devices').set('Authorization', `Bearer ${phone.accessToken}`).send({ kidProfileId: OMAR, pin: PIN });
    expect(refused.status).toBe(404);

    await sync(parent, [kidProfile(OMAR, 'Omar', { updatedAt: T0 + 2, archivedAt: null })]);
    const allowed = await request(app).post('/kid-devices').set('Authorization', `Bearer ${phone.accessToken}`).send({ kidProfileId: OMAR, pin: PIN });
    expect(allowed.status).toBe(200);
  });
});
