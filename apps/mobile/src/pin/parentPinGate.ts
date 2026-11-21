import {
  isApiEnvelope,
  pinRetryAfterSeconds,
  secondsUntil,
  verifyParentPin,
  type AuthErrorData,
  type Language,
  type ParentPinData,
  type ParentPinErrorData,
  type RequestCodeData,
  type RequestPinResetBody,
  type ResetParentPinBody,
  type SetParentPinBody,
} from '@money-tracker/shared';
import type { AuthSession, AuthedResult } from '@/auth/authSession';
import type { AxiosRequestConfig } from 'axios';

/**
 * What this device remembers for the Parent Area gate, for one Account: its
 * copy of the PIN hash (Personal-Mode devices only, ADR-0002), the wrong-PIN
 * count and wait (so restarting the app doesn't reset the throttle), and
 * whether biometrics may stand in for the PIN on this device.
 */
export interface PinGateState {
  accountId: string;
  pinHash: string | null;
  failures: number;
  /** Epoch ms before which no PIN is checked. */
  lockedUntil: number | null;
  biometrics: boolean;
}

/** SecureStore on the device; in memory in tests. */
export interface PinGateStore {
  load(): Promise<PinGateState | null>;
  save(state: PinGateState): Promise<void>;
  clear(): Promise<void>;
}

/** The device's biometrics (expo-local-authentication on the device). */
export interface Biometrics {
  /** Hardware present and at least one fingerprint or face enrolled. */
  isEnrolled(): Promise<boolean>;
  /** Shows the system prompt; true only on a successful scan. */
  authenticate(prompt: string): Promise<boolean>;
}

export interface ParentPinGateDeps {
  request: (config: AxiosRequestConfig) => Promise<AuthedResult>;
  /** The signed-in Account, so another Account's leftovers are never used. */
  accountId: () => string | null;
  store: PinGateStore;
  biometrics: Biometrics;
  now: () => number;
}

export type CheckPinResult =
  | { status: 'ok' }
  /** `retryAfterSeconds` is the wait before the next try (0 while free tries remain). */
  | { status: 'wrong'; retryAfterSeconds: number }
  | { status: 'locked'; retryAfterSeconds: number }
  | { status: 'no_pin' };

export type SetPinResult =
  | { status: 'ok' }
  | { status: 'wrong_pin'; attemptsRemaining: number }
  | { status: 'locked'; retryAfterSeconds: number }
  | { status: 'unreachable' }
  | { status: 'session_ended' }
  | { status: 'failed' };

/** Asking for a PIN reset code. `wait`: a code was sent recently; try again after `retryAfterSeconds`. */
export type RequestResetResult =
  | { status: 'ok'; resendAfterSeconds: number }
  | { status: 'wait'; retryAfterSeconds: number }
  | { status: 'unreachable' | 'session_ended' | 'failed' };

/** Setting a new PIN with the emailed code. */
export type ResetPinResult =
  | { status: 'ok' }
  | { status: 'invalid_code'; attemptsRemaining: number }
  | { status: 'code_expired' | 'too_many_guesses' | 'unreachable' | 'session_ended' | 'failed' };

const errorData = (body: unknown): Partial<ParentPinErrorData> =>
  isApiEnvelope(body) && typeof body.data === 'object' && body.data !== null ? (body.data as ParentPinErrorData) : {};

/**
 * The Parent Area gate on a Personal-Mode device. The PIN is set on the server
 * (which keeps only its hash); the device keeps a copy of that hash so the gate
 * opens offline. Wrong PINs are throttled on the device with the same rule as
 * the server (`pinRetryAfterSeconds`). Biometrics are an optional shortcut; the
 * PIN always works.
 */
export function createParentPinGate({ request, accountId, store, biometrics, now }: ParentPinGateDeps) {
  /** The stored state for the signed-in Account, or a fresh one. */
  async function load(): Promise<PinGateState | null> {
    const id = accountId();
    if (!id) return null;
    const stored = await store.load();
    if (stored?.accountId === id) return stored;
    return { accountId: id, pinHash: null, failures: 0, lockedUntil: null, biometrics: false };
  }

  async function update(changes: Partial<Omit<PinGateState, 'accountId'>>): Promise<void> {
    const state = await load();
    if (state) await store.save({ ...state, ...changes });
  }

  return {
    /** Fetches the current PIN hash (e.g. changed on another device). Offline keeps the last copy. */
    async refresh(): Promise<'updated' | 'unreachable'> {
      const result = await request({ method: 'GET', url: '/account/pin' });
      if (result.status !== 'ok' || result.httpStatus !== 200 || !isApiEnvelope(result.body)) return 'unreachable';
      await update({ pinHash: (result.body.data as ParentPinData).pinHash });
      return 'updated';
    },

    async hasPin(): Promise<boolean> {
      return !!(await load())?.pinHash;
    },

    /** Sets the first PIN, or changes it (`currentPin` needed then). Needs the internet. */
    async setPin(pin: string, currentPin?: string): Promise<SetPinResult> {
      const body: SetParentPinBody = currentPin === undefined ? { pin } : { pin, currentPin };
      const result = await request({ method: 'PUT', url: '/account/pin', data: body });
      if (result.status !== 'ok') return { status: result.status };
      if (result.httpStatus === 200 && isApiEnvelope(result.body) && result.body.success) {
        await update({ pinHash: (result.body.data as ParentPinData).pinHash, failures: 0, lockedUntil: null });
        return { status: 'ok' };
      }
      const data = errorData(result.body);
      if (data.reason === 'wrong_pin') return { status: 'wrong_pin', attemptsRemaining: data.attemptsRemaining ?? 0 };
      if (data.reason === 'pin_locked') return { status: 'locked', retryAfterSeconds: data.retryAfterSeconds ?? 60 };
      return { status: 'failed' };
    },

    /** Emails a code for resetting a forgotten PIN to the Account's address. Needs the internet; not on a Kid-Mode device. */
    async requestReset(language: Language): Promise<RequestResetResult> {
      const body: RequestPinResetBody = { language };
      const result = await request({ method: 'POST', url: '/account/pin/reset-code', data: body });
      if (result.status !== 'ok') return { status: result.status };
      if (result.httpStatus === 200 && isApiEnvelope(result.body) && result.body.success) {
        return { status: 'ok', resendAfterSeconds: (result.body.data as RequestCodeData).resendAfterSeconds };
      }
      const data = errorData(result.body) as Partial<AuthErrorData>;
      if (result.httpStatus === 429 && data.retryAfterSeconds) return { status: 'wait', retryAfterSeconds: data.retryAfterSeconds };
      return { status: 'failed' };
    },

    /** Sets a new PIN with the emailed code in place of the forgotten one; clears this device's wrong-PIN wait. */
    async resetPin(code: string, pin: string): Promise<ResetPinResult> {
      const body: ResetParentPinBody = { code, pin };
      const result = await request({ method: 'POST', url: '/account/pin/reset', data: body });
      if (result.status !== 'ok') return { status: result.status };
      if (result.httpStatus === 200 && isApiEnvelope(result.body) && result.body.success) {
        await update({ pinHash: (result.body.data as ParentPinData).pinHash, failures: 0, lockedUntil: null });
        return { status: 'ok' };
      }
      const data = errorData(result.body) as Partial<AuthErrorData>;
      if (data.reason === 'invalid_code') return { status: 'invalid_code', attemptsRemaining: data.attemptsRemaining ?? 0 };
      if (data.reason === 'code_expired' || data.reason === 'too_many_guesses') return { status: data.reason };
      return { status: 'failed' };
    },

    /** Checks the PIN against this device's copy of the hash. Works offline. */
    async checkPin(pin: string): Promise<CheckPinResult> {
      const state = await load();
      if (!state?.pinHash) return { status: 'no_pin' };
      if (state.lockedUntil !== null && state.lockedUntil > now()) {
        return { status: 'locked', retryAfterSeconds: secondsUntil(now(), state.lockedUntil) };
      }
      if (await verifyParentPin(pin, state.pinHash)) {
        await store.save({ ...state, failures: 0, lockedUntil: null });
        return { status: 'ok' };
      }
      const failures = state.failures + 1;
      const wait = pinRetryAfterSeconds(failures);
      await store.save({ ...state, failures, lockedUntil: wait ? now() + wait * 1000 : null });
      return { status: 'wrong', retryAfterSeconds: wait };
    },

    /** Whether to show the "use biometrics instead?" offer: only with biometrics enrolled. */
    canOfferBiometrics: (): Promise<boolean> => biometrics.isEnrolled(),

    /** On for this device, and the device still has biometrics enrolled. */
    async biometricsEnabled(): Promise<boolean> {
      return !!(await load())?.biometrics && (await biometrics.isEnrolled());
    },

    /**
     * What the Settings switch shows: `hidden` until a Parent PIN exists, or on
     * a device without biometrics enrolled; otherwise whether it is on.
     */
    async biometricsSetting(): Promise<'hidden' | 'on' | 'off'> {
      const state = await load();
      if (!state?.pinHash || !(await biometrics.isEnrolled())) return 'hidden';
      return state.biometrics ? 'on' : 'off';
    },

    /** Turns biometrics on for this device, after one successful scan. True if it is now on. */
    async enableBiometrics(prompt: string): Promise<boolean> {
      if (!(await biometrics.isEnrolled()) || !(await biometrics.authenticate(prompt))) return false;
      await update({ biometrics: true });
      return true;
    },

    disableBiometrics: (): Promise<void> => update({ biometrics: false }),

    /** Opens the gate with a scan, if biometrics are on. A cancelled or failed scan leaves the PIN. */
    async unlockWithBiometrics(prompt: string): Promise<boolean> {
      const state = await load();
      if (!state?.pinHash || !state.biometrics || !(await biometrics.isEnrolled())) return false;
      if (!(await biometrics.authenticate(prompt))) return false;
      await store.save({ ...state, failures: 0, lockedUntil: null });
      return true;
    },

    /** Forgets everything (the device signed out). */
    forget: (): Promise<void> => store.clear(),
  };
}

export type ParentPinGate = ReturnType<typeof createParentPinGate>;

/**
 * Wires the gate to the auth session: forget the PIN copy on sign-out, and
 * when the device becomes a Kid-Mode device, which must never hold the hash
 * (ADR-0002). Returns an unsubscribe function.
 */
export function forgetPinOnSignOutOrKidMode(
  auth: Pick<AuthSession, 'subscribe' | 'status' | 'kidProfileId'>,
  gate: ParentPinGate,
): () => void {
  return auth.subscribe(() => {
    if (auth.status() === 'signedOut' || auth.kidProfileId()) void gate.forget();
  });
}

