import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApiClient } from '@/api/client';
import { createAuthSession, type AuthSession, type LocalAccountData } from './authSession';
import type { SessionStore, StoredSession } from './tokenStore';

const account = { id: 'acc-1', email: 'sara@example.com' };

/** Local records are covered by the Seam B tests (sync.seamB.test.ts). */
const noLocalData: LocalAccountData = { claimAccount: () => undefined, wipe: () => undefined };

/** Holds the session in memory, the way SecureStore would on a device. */
function memoryStore(initial: StoredSession | null): SessionStore & { current: StoredSession | null } {
  const store = {
    current: initial,
    async load() {
      return store.current;
    },
    async save(session: StoredSession) {
      store.current = session;
    },
    async clear() {
      store.current = null;
    },
  };
  return store;
}

type Reply = { status: number; body: unknown };
const envelope = (data: unknown, success = true) => ({ message: '', data, success });
const sessionEnded = { status: 401, body: envelope({ reason: 'session_ended' }, false) };
const tokenInvalid = { status: 401, body: envelope({ reason: 'token_invalid' }, false) };

/** A fake API: `/auth/refresh`, `/auth/logout` and a protected `/things`, scripted per test. */
/** 'drop' closes the connection without answering, like a network failure. */
async function fakeApi(handlers: Record<string, (auth: string | undefined, body: any) => Reply | 'drop'>) {
  const calls: { path: string; auth?: string; body: any }[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : undefined;
      const path = req.url ?? '';
      calls.push({ path, auth: req.headers.authorization, body });
      const handler = handlers[path];
      const reply = handler ? handler(req.headers.authorization, body) : { status: 404, body: envelope(null, false) };
      if (reply === 'drop') {
        req.socket.destroy();
        return;
      }
      // A small delay so parallel requests overlap.
      setTimeout(() => {
        res.writeHead(reply.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reply.body));
      }, 10);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    count: (path: string) => calls.filter((c) => c.path === path).length,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe('auth session on the device', () => {
  let api: Awaited<ReturnType<typeof fakeApi>>;
  afterEach(async () => {
    await api?.close();
  });

  async function startSession(store: SessionStore, url: string): Promise<AuthSession> {
    const session = createAuthSession({ client: createApiClient(url), store, localData: noLocalData });
    await session.start();
    return session;
  }

  const signedIn = (): StoredSession => ({ account, tokens: { accessToken: 'access-1', refreshToken: 'refresh-1' } });

  it('starts signed out with nothing stored, and signed in with a stored session', async () => {
    api = await fakeApi({});
    expect((await startSession(memoryStore(null), api.url)).status()).toBe('signedOut');
    const session = await startSession(memoryStore(signedIn()), api.url);
    expect(session.status()).toBe('signedIn');
    expect(session.account()).toEqual(account);
  });

  it('sends the access token with requests', async () => {
    api = await fakeApi({ '/things': () => ({ status: 200, body: envelope(['a']) }) });
    const session = await startSession(memoryStore(signedIn()), api.url);

    const result = await session.request({ method: 'GET', url: '/things' });
    expect(result).toEqual({ status: 'ok', httpStatus: 200, body: envelope(['a']) });
    expect(api.calls[0]!.auth).toBe('Bearer access-1');
  });

  it('refreshes an expired access token, stores the new pair and retries once', async () => {
    api = await fakeApi({
      '/things': (auth) => (auth === 'Bearer access-2' ? { status: 200, body: envelope('ok') } : tokenInvalid),
      '/auth/refresh': (_auth, body) =>
        body.refreshToken === 'refresh-1'
          ? { status: 200, body: envelope({ accessToken: 'access-2', refreshToken: 'refresh-2' }) }
          : sessionEnded,
    });
    const store = memoryStore(signedIn());
    const session = await startSession(store, api.url);

    const result = await session.request({ method: 'GET', url: '/things' });
    expect(result).toMatchObject({ status: 'ok', httpStatus: 200 });
    expect(store.current?.tokens).toEqual({ accessToken: 'access-2', refreshToken: 'refresh-2' });
    expect(session.status()).toBe('signedIn');
  });

  it('sends a refresh token only once even when several requests need a refresh at the same time', async () => {
    api = await fakeApi({
      '/things': (auth) => (auth === 'Bearer access-2' ? { status: 200, body: envelope('ok') } : tokenInvalid),
      '/auth/refresh': (_auth, body) =>
        body.refreshToken === 'refresh-1'
          ? { status: 200, body: envelope({ accessToken: 'access-2', refreshToken: 'refresh-2' }) }
          : sessionEnded,
    });
    const session = await startSession(memoryStore(signedIn()), api.url);

    const results = await Promise.all([1, 2, 3].map(() => session.request({ method: 'GET', url: '/things' })));
    expect(results.map((r) => r.status)).toEqual(['ok', 'ok', 'ok']);
    expect(api.count('/auth/refresh')).toBe(1);
  });

  it('keeps the Account but asks for a new code when the refresh token is refused', async () => {
    api = await fakeApi({ '/things': () => tokenInvalid, '/auth/refresh': () => sessionEnded });
    const store = memoryStore(signedIn());
    const session = await startSession(store, api.url);
    const statuses: string[] = [];
    session.subscribe(() => statuses.push(session.status()));

    const result = await session.request({ method: 'GET', url: '/things' });
    expect(result).toEqual({ status: 'session_ended' });
    expect(session.status()).toBe('needsSignIn');
    expect(statuses).toEqual(['needsSignIn']);
    // Local data stays: the Account is remembered, only the tokens are gone.
    expect(store.current).toEqual({ account, tokens: null });

    // After a restart it is still waiting for a new code, and makes no calls.
    const restarted = await startSession(store, api.url);
    expect(restarted.status()).toBe('needsSignIn');
    expect(restarted.account()).toEqual(account);
    const before = api.calls.length;
    expect(await restarted.request({ method: 'GET', url: '/things' })).toEqual({ status: 'session_ended' });
    expect(api.calls.length).toBe(before);
  });

  it('signs in again after a new code and works as before', async () => {
    api = await fakeApi({ '/things': (auth) => ({ status: auth === 'Bearer access-9' ? 200 : 401, body: envelope(null) }) });
    const store = memoryStore({ account, tokens: null });
    const session = await startSession(store, api.url);

    await session.signedIn({ accessToken: 'access-9', refreshToken: 'refresh-9', isNewAccount: false, onboardingCompleted: false, account });
    expect(session.status()).toBe('signedIn');
    expect(await session.request({ method: 'GET', url: '/things' })).toMatchObject({ status: 'ok', httpStatus: 200 });
  });

  it('works offline: an unreachable server changes nothing', async () => {
    api = await fakeApi({});
    const store = memoryStore(signedIn());
    const session = createAuthSession({ client: createApiClient('http://127.0.0.1:1'), store, localData: noLocalData });
    await session.start();

    expect(await session.request({ method: 'GET', url: '/things' })).toEqual({ status: 'unreachable' });
    expect(session.status()).toBe('signedIn');
    expect(store.current).toEqual(signedIn());
  });

  it('keeps the tokens when the refresh call itself cannot reach the server', async () => {
    api = await fakeApi({ '/things': () => tokenInvalid, '/auth/refresh': () => 'drop' });
    const store = memoryStore(signedIn());
    const session = await startSession(store, api.url);

    expect(await session.request({ method: 'GET', url: '/things' })).toEqual({ status: 'unreachable' });
    expect(session.status()).toBe('signedIn');
    expect(store.current).toEqual(signedIn());
  });

  it('signs out: tells the server and forgets everything, even offline', async () => {
    api = await fakeApi({ '/auth/logout': () => ({ status: 200, body: envelope(null) }) });
    const store = memoryStore(signedIn());
    const session = await startSession(store, api.url);

    await session.signOut();
    expect(api.calls).toEqual([{ path: '/auth/logout', auth: 'Bearer access-1', body: undefined }]);
    expect(store.current).toBeNull();
    expect(session.status()).toBe('signedOut');

    const offlineStore = memoryStore(signedIn());
    const offline = createAuthSession({ client: createApiClient('http://127.0.0.1:1'), store: offlineStore, localData: noLocalData });
    await offline.start();
    await offline.signOut();
    expect(offlineStore.current).toBeNull();
    expect(offline.status()).toBe('signedOut');
  });

  it('signing out tells the screens before it wipes the local records, so no screen reads an empty database while still signed in', async () => {
    api = await fakeApi({ '/auth/logout': () => ({ status: 200, body: envelope(null) }) });
    const seen: string[] = [];
    let session!: AuthSession;
    const localData: LocalAccountData = { claimAccount: () => undefined, wipe: () => seen.push(`wipe while ${session.status()}`) };
    session = createAuthSession({ client: createApiClient(api.url), store: memoryStore(signedIn()), localData });
    await session.start();
    session.subscribe(() => seen.push(session.status()));

    await session.signOut();
    expect(seen).toEqual(['signedOut', 'wipe while signedOut']);
  });
});
