import * as SecureStore from 'expo-secure-store';
import type { TokenPair } from '@money-tracker/shared';

/**
 * What this device remembers about its sign-in. `tokens` is null when the
 * session has ended (refresh token expired or revoked): the Account and its
 * local data stay, and the app asks for a new code before syncing again.
 */
export interface StoredSession {
  account: { id: string; email: string };
  tokens: TokenPair | null;
  /**
   * Set on a Kid-Mode device: its tokens are a Kid Session's for this Kid
   * Profile, and the full tokens are gone (ADR-0002). Absent or null on a
   * Personal-Mode device.
   */
  kidProfileId?: string | null;
}

/** Where the session lives. SecureStore on the device; in memory in tests. */
export interface SessionStore {
  /** The stored session, or null if this device has never signed in (or signed out). */
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

const KEYS = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
  account: 'auth.account',
  kidProfileId: 'auth.kidProfileId',
} as const;

/** Tokens are kept only in SecureStore (never AsyncStorage or SQLite). */
export const secureSessionStore: SessionStore = {
  async load() {
    const [accessToken, refreshToken, account, kidProfileId] = await Promise.all([
      SecureStore.getItemAsync(KEYS.accessToken),
      SecureStore.getItemAsync(KEYS.refreshToken),
      SecureStore.getItemAsync(KEYS.account),
      SecureStore.getItemAsync(KEYS.kidProfileId),
    ]);
    if (!account) return null;
    try {
      return {
        account: JSON.parse(account) as StoredSession['account'],
        tokens: accessToken && refreshToken ? { accessToken, refreshToken } : null,
        kidProfileId: kidProfileId || null,
      };
    } catch {
      return null;
    }
  },

  async save({ account, tokens, kidProfileId }) {
    // Kid Mode first: a crash between writes must never leave Kid tokens marked as a Personal-Mode device.
    if (kidProfileId) await SecureStore.setItemAsync(KEYS.kidProfileId, kidProfileId);
    if (tokens) {
      await SecureStore.setItemAsync(KEYS.accessToken, tokens.accessToken);
      await SecureStore.setItemAsync(KEYS.refreshToken, tokens.refreshToken);
    } else {
      await SecureStore.deleteItemAsync(KEYS.accessToken);
      await SecureStore.deleteItemAsync(KEYS.refreshToken);
    }
    await SecureStore.setItemAsync(KEYS.account, JSON.stringify(account));
    if (!kidProfileId) await SecureStore.deleteItemAsync(KEYS.kidProfileId);
  },

  async clear() {
    await Promise.all(Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key)));
  },
};
