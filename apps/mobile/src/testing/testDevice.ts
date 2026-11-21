/**
 * Seam B: one simulated device. The app's real auth session, local store and
 * sync engine, on an in-memory better-sqlite3 database. Test-only.
 */
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createApiClient } from '@/api/client';
import { requestCode, verifyCode } from '@/api/auth';
import { createAuthSession, type AuthSession, type AuthedResult } from '@/auth/authSession';
import type { SessionStore, StoredSession } from '@/auth/tokenStore';
import { categoriesQuery, expensesQuery, recordExpense, type NewExpense } from '@/data/transactions';
import { createLocalStore } from '@/db/localStore';
import { migrate } from '@/db/migrations';
import { schema } from '@/db/schema';
import type { LocalDb } from '@/db/types';
import { createSyncEngine, type SyncOutcome } from '@/sync/syncEngine';
import {
  createParentPinGate,
  forgetPinOnSignOut,
  type Biometrics,
  type ParentPinGate,
  type PinGateState,
  type PinGateStore,
} from '@/pin/parentPinGate';
import type { AxiosRequestConfig } from 'axios';
import type { TestServer } from './testServer';

/** Holds the session in memory, the way SecureStore would on a device. */
function memorySessionStore(initial: StoredSession | null = null): SessionStore {
  let current = initial;
  return {
    load: async () => current,
    save: async (session) => {
      current = session;
    },
    clear: async () => {
      current = null;
    },
  };
}

function memoryPinGateStore(): PinGateStore {
  let current: PinGateState | null = null;
  return {
    load: async () => current,
    save: async (state) => {
      current = state;
    },
    clear: async () => {
      current = null;
    },
  };
}

export async function createTestDevice(server: TestServer) {
  const db: LocalDb = drizzle(new Database(':memory:'), { schema });
  migrate(db);
  const store = createLocalStore({ db, now: Date.now, randomBytes: (n) => new Uint8Array(randomBytes(n)) });
  const client = createApiClient(server.url);
  let online = true;

  async function startAuth(sessionStore: SessionStore): Promise<AuthSession> {
    const session = createAuthSession({ client, store: sessionStore, localData: store });
    await session.start();
    return session;
  }

  let auth = await startAuth(memorySessionStore());
  const request = (config: AxiosRequestConfig): Promise<AuthedResult> =>
    online ? auth.request(config) : Promise.resolve({ status: 'unreachable' });
  const engine = createSyncEngine({ store, request });

  // The Parent PIN gate: its store outlives app restarts, like SecureStore.
  let clock = Date.now();
  const pinStore = memoryPinGateStore();
  const biometrics = { enrolled: true, nextResult: true };
  const fakeBiometrics: Biometrics = {
    isEnrolled: async () => biometrics.enrolled,
    authenticate: async () => biometrics.nextResult,
  };
  const startPinGate = (): ParentPinGate => {
    const gate = createParentPinGate({
      request,
      accountId: () => auth.account()?.id ?? null,
      store: pinStore,
      biometrics: fakeBiometrics,
      now: () => clock,
    });
    forgetPinOnSignOut(auth, gate);
    return gate;
  };
  let pinGate = startPinGate();

  return {
    store,
    accountId: () => store.accountId(),

    /** Signs in with an emailed code, like the sign-in screens do. */
    async signIn(email: string): Promise<void> {
      server.nextMinute();
      const sent = await requestCode(client, email, 'en');
      if (sent.status !== 'ok') throw new Error(`requestCode: ${JSON.stringify(sent)}`);
      const verified = await verifyCode(client, { email, code: server.mailer.lastCodeFor(email) });
      if (verified.status !== 'ok') throw new Error(`verifyCode: ${JSON.stringify(verified)}`);
      await auth.signedIn(verified.data);
    },

    signOut: () => auth.signOut(),

    /** The app restarting with `account` in SecureStore (e.g. changed while the local DB was kept). */
    async restartAs(account: StoredSession['account']): Promise<void> {
      auth = await startAuth(memorySessionStore({ account, tokens: null }));
    },

    goOffline: () => {
      online = false;
    },
    goOnline: () => {
      online = true;
    },
    sync: (): Promise<SyncOutcome> => engine.sync(),

    recordExpense: (expense: NewExpense) => recordExpense(store, expense),
    expenses: () => expensesQuery(db).all(),
    categories: () => categoriesQuery(db).all(),
    pendingChanges: () => store.pendingCount(),

    get pinGate(): ParentPinGate {
      return pinGate;
    },
    /** The app restarting: a new gate over the same stored state. */
    restartPinGate: () => {
      pinGate = startPinGate();
    },
    /** Set `enrolled` / `nextResult` to change what the device's biometrics do. */
    biometrics,
    advanceClock: (ms: number) => {
      clock += ms;
    },
  };
}

export type TestDevice = Awaited<ReturnType<typeof createTestDevice>>;
