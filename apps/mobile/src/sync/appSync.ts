import { AppState } from 'react-native';
import { addNetworkStateListener } from 'expo-network';
import { authSession } from '@/auth/appSession';
import { localStore } from '@/db/appDatabase';
import { createSyncEngine, kidSessionHoldsBack } from './syncEngine';
import { createSyncTriggers } from './syncTriggers';

/** The app's sync engine. Screens use `syncTriggers` instead of calling it directly. */
export const syncEngine = createSyncEngine({
  store: localStore,
  request: (config) =>
    authSession.status() === 'signedIn' ? authSession.request(config) : Promise.resolve({ status: 'session_ended' }),
  holdBack: (change) => authSession.kidProfileId() !== null && !authSession.elevated() && kidSessionHoldsBack(change),
});

/** When sync runs (ADR-0007). Pull-to-refresh calls `syncTriggers.refresh()`. */
export const syncTriggers = createSyncTriggers({ sync: () => syncEngine.sync() });

/**
 * Connects the triggers to the app: local writes, coming to the foreground,
 * the connection returning, and signing in (a new device downloads
 * everything right away). Syncs once now, for the app opening. Nothing runs
 * while the app is in the background. Returns a function that disconnects.
 */
export function startAutoSync(): () => void {
  let connected: boolean | null = null;
  let status = authSession.status();

  const subscriptions = [
    localStore.onWrite(syncTriggers.localWrite),
    authSession.subscribe(() => {
      const next = authSession.status();
      if (next === 'signedIn' && status !== 'signedIn') syncTriggers.foreground();
      status = next;
    }),
  ];
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') syncTriggers.foreground();
  });
  const network = addNetworkStateListener(({ isConnected, isInternetReachable }) => {
    const online = Boolean(isConnected) && isInternetReachable !== false;
    if (online && connected === false) syncTriggers.reconnected();
    connected = online;
  });

  syncTriggers.foreground();
  return () => {
    subscriptions.forEach((unsubscribe) => unsubscribe());
    appState.remove();
    network.remove();
  };
}
