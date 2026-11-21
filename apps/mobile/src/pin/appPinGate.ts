import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { authSession } from '@/auth/appSession';
import { createParentPinGate, forgetPinOnSignOutOrKidMode, type Biometrics, type PinGateState, type PinGateStore } from './parentPinGate';

const STATE_KEY = 'parentPin.state';

/** The PIN hash copy and throttle live in SecureStore, like the tokens. */
const securePinGateStore: PinGateStore = {
  async load() {
    const raw = await SecureStore.getItemAsync(STATE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PinGateState;
    } catch {
      return null;
    }
  },
  save: (state) => SecureStore.setItemAsync(STATE_KEY, JSON.stringify(state)),
  clear: () => SecureStore.deleteItemAsync(STATE_KEY),
};

const deviceBiometrics: Biometrics = {
  async isEnrolled() {
    try {
      return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
    } catch {
      return false;
    }
  },
  async authenticate(prompt) {
    try {
      // The PIN is the fallback, in the app: no device passcode fallback.
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, disableDeviceFallback: true });
      return result.success;
    } catch {
      return false;
    }
  },
};

/**
 * The app's Parent Area gate (Personal-Mode device). Its PIN hash copy is
 * refreshed whenever the device is signed in (app start, sign-in) and
 * forgotten on sign-out or on becoming a Kid-Mode device (ADR-0002).
 */
export const parentPinGate = createParentPinGate({
  request: (config) =>
    authSession.status() === 'signedIn' ? authSession.request(config) : Promise.resolve({ status: 'session_ended' }),
  accountId: () => authSession.account()?.id ?? null,
  store: securePinGateStore,
  biometrics: deviceBiometrics,
  now: Date.now,
});

forgetPinOnSignOutOrKidMode(authSession, parentPinGate);
authSession.subscribe(() => {
  if (authSession.status() === 'signedIn' && !authSession.kidProfileId()) void parentPinGate.refresh();
});

/**
 * Whether the Parent Area is open right now. It closes when the app leaves the
 * foreground, when the parent locks it, and on sign-out.
 */
let unlocked = false;
const listeners = new Set<() => void>();

function setUnlocked(next: boolean): void {
  if (next === unlocked) return;
  unlocked = next;
  listeners.forEach((listener) => listener());
}

export const parentArea = {
  unlock: (): void => setUnlocked(true),
  lock: (): void => setUnlocked(false),
};

AppState.addEventListener('change', (state) => {
  if (state === 'background') parentArea.lock();
});
authSession.subscribe(() => {
  if (authSession.status() === 'signedOut') parentArea.lock();
});

export function useParentAreaUnlocked(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => unlocked,
  );
}
