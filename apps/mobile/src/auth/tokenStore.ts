import * as SecureStore from 'expo-secure-store';
import type { VerifyCodeData } from '@money-tracker/shared';

/** The signed-in Account's tokens, kept only in SecureStore (never AsyncStorage or SQLite). */
export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  account: { id: string; email: string };
}

const KEYS = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
  account: 'auth.account',
} as const;

export async function saveSession({ accessToken, refreshToken, account }: VerifyCodeData): Promise<void> {
  await SecureStore.setItemAsync(KEYS.accessToken, accessToken);
  await SecureStore.setItemAsync(KEYS.refreshToken, refreshToken);
  await SecureStore.setItemAsync(KEYS.account, JSON.stringify(account));
}

/** The stored session, or null if this device has never signed in (or signed out). */
export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken, account] = await Promise.all([
    SecureStore.getItemAsync(KEYS.accessToken),
    SecureStore.getItemAsync(KEYS.refreshToken),
    SecureStore.getItemAsync(KEYS.account),
  ]);
  if (!accessToken || !refreshToken || !account) return null;
  try {
    return { accessToken, refreshToken, account: JSON.parse(account) as StoredSession['account'] };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all(Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key)));
}
