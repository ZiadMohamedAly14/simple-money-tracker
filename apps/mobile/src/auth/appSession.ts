import { useSyncExternalStore } from 'react';
import { createApiClient } from '@/api/client';
import { API_URL } from '@/config';
import { localStore } from '@/db/appDatabase';
import { createAccountDeletion } from './accountDeletion';
import { createAuthSession, type AuthStatus } from './authSession';
import { secureSessionStore } from './tokenStore';

/**
 * The app's one auth session. Every authenticated API call goes through
 * `authSession.request`. Signing in as another Account, or signing out,
 * empties the local database.
 */
export const authSession = createAuthSession({
  client: createApiClient(API_URL),
  store: secureSessionStore,
  localData: localStore,
});

/** Settings → Delete account. */
export const accountDeletion = createAccountDeletion({ request: (config) => authSession.request(config), auth: authSession });

/** Re-renders when the device signs in, out, or needs a new code. */
export function useAuthStatus(): AuthStatus {
  return useSyncExternalStore(authSession.subscribe, authSession.status);
}

/** The Kid Profile this device is in Kid Mode for, or null on a Personal-Mode device (ADR-0002). */
export function useKidModeProfileId(): string | null {
  return useSyncExternalStore(authSession.subscribe, authSession.kidProfileId);
}
