import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { isApiEnvelope, type RefreshBody, type TokenPair, type VerifyCodeData } from '@money-tracker/shared';
import type { SessionStore, StoredSession } from './tokenStore';

/**
 * - `loading`: not started yet.
 * - `signedOut`: nothing stored; show sign-in.
 * - `signedIn`: tokens stored. They may be expired; the app works offline regardless.
 * - `needsSignIn`: the server ended the session (refresh token expired or revoked).
 *   The Account and its local data stay visible; syncing waits for a new code.
 */
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'needsSignIn';

/** How an authenticated call ended. Only `ok` means the server answered (with any HTTP status). */
export type AuthedResult =
  | { status: 'ok'; httpStatus: number; body: unknown }
  | { status: 'unreachable' }
  | { status: 'session_ended' };

type RefreshOutcome = 'refreshed' | 'unreachable' | 'session_ended';

const reasonOf = (body: unknown): unknown =>
  isApiEnvelope(body) && typeof body.data === 'object' && body.data !== null
    ? (body.data as { reason?: unknown }).reason
    : undefined;

/**
 * The device's sign-in: keeps tokens in `store`, attaches the access token to
 * calls, refreshes it when the API says it is no longer valid (one refresh at a
 * time, since reusing a replaced refresh token revokes the session), and never
 * needs the network to say who is signed in.
 */
export function createAuthSession({ client, store }: { client: AxiosInstance; store: SessionStore }) {
  let current: StoredSession | null = null;
  let status: AuthStatus = 'loading';
  let refreshing: Promise<RefreshOutcome> | null = null;
  const listeners = new Set<() => void>();

  function setStatus(next: AuthStatus): void {
    if (next === status) return;
    status = next;
    listeners.forEach((listener) => listener());
  }

  async function sessionEnded(): Promise<void> {
    if (!current) return;
    current = { account: current.account, tokens: null };
    await store.save(current);
    setStatus('needsSignIn');
  }

  async function sendRefresh(refreshToken: string): Promise<RefreshOutcome> {
    let httpStatus: number;
    let body: unknown;
    try {
      const payload: RefreshBody = { refreshToken };
      ({ status: httpStatus, data: body } = await client.post<unknown>('/auth/refresh', payload));
    } catch {
      return 'unreachable';
    }
    if (httpStatus === 401) {
      await sessionEnded();
      return 'session_ended';
    }
    if (!isApiEnvelope(body) || !body.success || !current) return 'unreachable'; // a server hiccup: try again later
    current = { account: current.account, tokens: body.data as TokenPair };
    await store.save(current);
    return 'refreshed';
  }

  /** Refreshes unless another call already replaced `staleAccessToken`. Shares one refresh between callers. */
  function refresh(staleAccessToken: string): Promise<RefreshOutcome> {
    const tokens = current?.tokens;
    if (!tokens) return Promise.resolve('session_ended');
    if (tokens.accessToken !== staleAccessToken) return Promise.resolve('refreshed');
    if (!refreshing) {
      refreshing = sendRefresh(tokens.refreshToken).finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  async function send(config: AxiosRequestConfig, accessToken: string): Promise<AuthedResult> {
    try {
      const response = await client.request<unknown>({
        ...config,
        headers: { ...config.headers, Authorization: `Bearer ${accessToken}` },
      });
      return { status: 'ok', httpStatus: response.status, body: response.data };
    } catch {
      return { status: 'unreachable' };
    }
  }

  return {
    /** Reads the stored session. Call once at app start, before rendering signed-in screens. */
    async start(): Promise<void> {
      current = await store.load();
      setStatus(current === null ? 'signedOut' : current.tokens ? 'signedIn' : 'needsSignIn');
    },

    status: (): AuthStatus => status,

    /** The signed-in (or waiting-for-a-code) Account, or null when signed out. */
    account: (): StoredSession['account'] | null => current?.account ?? null,

    /** Calls `listener` whenever `status()` changes. Returns an unsubscribe function. */
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Stores the tokens from a verified email code. */
    async signedIn({ accessToken, refreshToken, account }: VerifyCodeData): Promise<void> {
      current = { account, tokens: { accessToken, refreshToken } };
      await store.save(current);
      setStatus('signedIn');
    },

    /**
     * An API call with the access token. On `token_invalid` it refreshes once and
     * retries; `session_ended` means a new code is needed before calling again.
     */
    async request(config: AxiosRequestConfig): Promise<AuthedResult> {
      const tokens = current?.tokens;
      if (!tokens) return { status: 'session_ended' };

      const first = await send(config, tokens.accessToken);
      if (first.status !== 'ok' || first.httpStatus !== 401) return first;

      if (reasonOf(first.body) !== 'token_invalid') {
        await sessionEnded();
        return { status: 'session_ended' };
      }
      const outcome = await refresh(tokens.accessToken);
      if (outcome !== 'refreshed') return { status: outcome };
      const fresh = current?.tokens;
      return fresh ? send(config, fresh.accessToken) : { status: 'session_ended' };
    },

    /** Ends the session on the server if it can be reached, and always forgets it on this device. */
    async signOut(): Promise<void> {
      if (current?.tokens) await this.request({ method: 'POST', url: '/auth/logout' });
      current = null;
      await store.clear();
      setStatus('signedOut');
    },
  };
}

export type AuthSession = ReturnType<typeof createAuthSession>;
