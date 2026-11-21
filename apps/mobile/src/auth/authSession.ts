import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  isApiEnvelope,
  type ElevateBody,
  type ElevateErrorData,
  type ElevatedAccessData,
  type KidSessionData,
  type KidSessionErrorData,
  type RefreshBody,
  type StartKidSessionBody,
  type TokenPair,
  type VerifyCodeData,
} from '@money-tracker/shared';
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

/** How swapping this device's full session for a Kid Session ended (`becomeKidDevice`). */
export type KidSessionResult =
  | { status: 'ok' }
  | { status: 'wrong_pin'; attemptsRemaining: number }
  | { status: 'pin_locked'; retryAfterSeconds: number }
  | { status: 'no_pin' | 'kid_not_found' | 'unreachable' | 'session_ended' | 'failed' };

/** How entering the Parent PIN on a Kid-Mode device ended (`elevate`). */
export type ElevateResult =
  | { status: 'ok' }
  | { status: 'wrong_pin'; attemptsRemaining: number }
  | { status: 'pin_locked'; retryAfterSeconds: number }
  | { status: 'no_pin' | 'unreachable' | 'session_ended' | 'failed' };

/** An elevated token is dropped this long before it expires, so a call never goes out with one about to lapse. */
export const ELEVATION_MARGIN_MS = 30_000;

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
/**
 * The device's local records. They belong to one Account: signing in as a
 * different Account, or signing out, empties them first (see `LocalStore`).
 */
export interface LocalAccountData {
  /** `onboardingCompleted`: the server says the Account has finished onboarding. */
  /** `kidProfileId`: the device is in Kid Mode for this Kid Profile and holds only its records. */
  claimAccount(accountId: string, options?: { onboardingCompleted?: boolean; kidProfileId?: string | null }): void;
  wipe(): void;
}

export interface AuthSessionDeps {
  client: AxiosInstance;
  store: SessionStore;
  localData: LocalAccountData;
  /** The device clock (epoch ms), for when an elevated token runs out. */
  now?: () => number;
}

export function createAuthSession({ client, store, localData, now = Date.now }: AuthSessionDeps) {
  let current: StoredSession | null = null;
  let status: AuthStatus = 'loading';
  let refreshing: Promise<RefreshOutcome> | null = null;
  /**
   * The short-lived full access token from entering the Parent PIN on a
   * Kid-Mode device. Kept in memory only, never stored (ADR-0002): an app
   * restart asks for the PIN again.
   */
  let elevation: { accessToken: string; usableUntil: number } | null = null;
  const listeners = new Set<() => void>();

  const notify = (): void => listeners.forEach((listener) => listener());

  function setStatus(next: AuthStatus): void {
    if (next === status) return;
    status = next;
    notify();
  }

  function endElevation(): void {
    if (!elevation) return;
    elevation = null;
    notify();
  }

  /**
   * Forgets the session and every local record. Screens hear "signed out"
   * first and leave for sign-in, so none of them reads the emptied database
   * while it still looks signed in (that crashed home on leaving Kid Mode).
   */
  async function forget(): Promise<void> {
    elevation = null;
    current = null;
    status = 'signedOut';
    notify(); // even if already signed out: the session and elevation just changed
    await store.clear();
    localData.wipe();
  }

  /**
   * The server ended the session. A Personal-Mode device keeps its data and
   * waits for a new code; a Kid-Mode device (revoked by the parent) is signed
   * out, so the kid's wallet doesn't stay on a lost phone. When the server
   * says the Account itself was deleted (`account_deleted`, from another
   * device), every device wipes its copy and goes back to sign-in.
   */
  async function sessionEnded(reason: unknown): Promise<void> {
    if (!current) return;
    if (current.kidProfileId || reason === 'account_deleted') return forget();
    current = { ...current, tokens: null };
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
      await sessionEnded(reasonOf(body));
      return 'session_ended';
    }
    if (!isApiEnvelope(body) || !body.success || !current) return 'unreachable'; // a server hiccup: try again later
    current = { ...current, tokens: body.data as TokenPair };
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
      if (current) localData.claimAccount(current.account.id, { kidProfileId: current.kidProfileId ?? null });
      else localData.wipe();
      setStatus(current === null ? 'signedOut' : current.tokens ? 'signedIn' : 'needsSignIn');
    },

    status: (): AuthStatus => status,

    /** The signed-in (or waiting-for-a-code) Account, or null when signed out. */
    account: (): StoredSession['account'] | null => current?.account ?? null,

    /** The Kid Profile a Kid-Mode device is for, or null on a Personal-Mode device. */
    kidProfileId: (): string | null => current?.kidProfileId ?? null,

    /** A Kid-Mode device elevated with the Parent PIN, and the token still usable. */
    elevated: (): boolean => elevation !== null && elevation.usableUntil > now(),

    /** Ends PIN elevation on this device (the Parent Area locked). */
    endElevation,

    /** When the elevated token stops being used (epoch ms), or null. */
    elevationEndsAt: (): number | null => elevation?.usableUntil ?? null,

    /** Calls `listener` whenever `status()`, `kidProfileId()` or `elevated()` changes. Returns an unsubscribe function. */
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Stores the tokens from a verified email code. */
    async signedIn({ accessToken, refreshToken, account, onboardingCompleted }: VerifyCodeData): Promise<void> {
      localData.claimAccount(account.id, { onboardingCompleted, kidProfileId: null });
      current = { account, tokens: { accessToken, refreshToken }, kidProfileId: null };
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

      if (elevation && elevation.usableUntil > now()) {
        const elevated = await send(config, elevation.accessToken);
        if (elevated.status !== 'ok' || elevated.httpStatus !== 401) return elevated;
        // The elevation ended on the server: carry on as the Kid Session, which tells whether the device was revoked.
      }
      endElevation();

      const first = await send(config, tokens.accessToken);
      if (first.status !== 'ok' || first.httpStatus !== 401) return first;

      if (reasonOf(first.body) !== 'token_invalid') {
        await sessionEnded(reasonOf(first.body));
        return { status: 'session_ended' };
      }
      const outcome = await refresh(tokens.accessToken);
      if (outcome !== 'refreshed') return { status: outcome };
      const fresh = current?.tokens;
      return fresh ? send(config, fresh.accessToken) : { status: 'session_ended' };
    },

    /**
     * Turns this device into a Kid-Mode device (ADR-0002): the server checks
     * the Parent PIN and swaps the full session for a Kid Session. The full
     * tokens are then replaced by the Kid Session's, and the local records the
     * full session downloaded are deleted, so the device holds only what the
     * Kid Session pulls. Anything else leaves the device as it was.
     */
    async becomeKidDevice(body: StartKidSessionBody): Promise<KidSessionResult> {
      if (!current?.tokens || current.kidProfileId) return { status: 'session_ended' };
      const result = await this.request({ method: 'POST', url: '/kid-devices', data: body });
      if (result.status !== 'ok') return { status: result.status };
      if (!isApiEnvelope(result.body)) return { status: 'failed' };
      if (!result.body.success) {
        const data = (result.body.data ?? {}) as Partial<KidSessionErrorData>;
        switch (data.reason) {
          case 'wrong_pin':
            return { status: 'wrong_pin', attemptsRemaining: data.attemptsRemaining ?? 0 };
          case 'pin_locked':
            return { status: 'pin_locked', retryAfterSeconds: data.retryAfterSeconds ?? 0 };
          case 'no_pin':
          case 'kid_not_found':
            return { status: data.reason };
          default:
            return { status: 'failed' };
        }
      }
      const { accessToken, refreshToken, kidProfileId } = result.body.data as KidSessionData;
      current = { account: current.account, tokens: { accessToken, refreshToken }, kidProfileId };
      await store.save(current);
      localData.claimAccount(current.account.id, { kidProfileId });
      notify();
      return { status: 'ok' };
    },

    /**
     * PIN elevation on a Kid-Mode device (ADR-0002): the server checks the
     * Parent PIN (with its throttle) and returns a short-lived full access token
     * with no refresh. Calls use it until it runs out or `endElevation`. Needs
     * the internet: `unreachable` means the Parent Area can't open offline.
     */
    async elevate(pin: string): Promise<ElevateResult> {
      if (!current?.tokens || !current.kidProfileId) return { status: 'session_ended' };
      endElevation();
      const body: ElevateBody = { pin };
      const result = await this.request({ method: 'POST', url: '/kid-devices/elevate', data: body });
      if (result.status !== 'ok') return { status: result.status };
      if (!isApiEnvelope(result.body)) return { status: 'failed' };
      if (!result.body.success) {
        const data = (result.body.data ?? {}) as Partial<ElevateErrorData>;
        if (data.reason === 'wrong_pin') return { status: 'wrong_pin', attemptsRemaining: data.attemptsRemaining ?? 0 };
        if (data.reason === 'pin_locked') return { status: 'pin_locked', retryAfterSeconds: data.retryAfterSeconds ?? 0 };
        if (data.reason === 'no_pin') return { status: 'no_pin' };
        return { status: 'failed' };
      }
      const { accessToken, expiresInSeconds } = result.body.data as ElevatedAccessData;
      elevation = { accessToken, usableUntil: now() + expiresInSeconds * 1000 - ELEVATION_MARGIN_MS };
      notify();
      return { status: 'ok' };
    },

    /**
     * Leaves Kid Mode: only while elevated with the Parent PIN. Ends the Kid
     * Session on the server and signs this device out, local records included,
     * so the next person signs in fresh. Sync first (see `leaveKidMode`).
     */
    async leaveKidMode(): Promise<'ok' | 'locked'> {
      if (!current?.kidProfileId || !this.elevated()) return 'locked';
      // Log out as the Kid Session, which ends its elevations too. Dropped
      // quietly: telling the screens now would send the Kid-Mode route guard
      // home mid-sign-out; they hear it once, as "signed out".
      elevation = null;
      await this.signOut();
      return 'ok';
    },

    /**
     * Ends the session on the server if it can be reached, and always forgets
     * it on this device, local records included (unsynced ones too).
     */
    async signOut(): Promise<void> {
      elevation = null; // the screens hear it with "signed out" in forget()
      if (current?.tokens) await this.request({ method: 'POST', url: '/auth/logout' });
      await forget();
    },

    /**
     * Forgets the session and wipes the local records without telling the
     * server, for when the server already ended it (the Account was deleted).
     */
    forget,
  };
}

export type AuthSession = ReturnType<typeof createAuthSession>;
