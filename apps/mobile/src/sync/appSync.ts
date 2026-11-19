import { authSession } from '@/auth/appSession';
import { localStore } from '@/db/appDatabase';
import { createSyncEngine } from './syncEngine';

/**
 * The app's sync engine. Call `syncEngine.sync()` to sync now; it is safe to
 * call often. Ticket 06 adds the automatic triggers.
 */
export const syncEngine = createSyncEngine({
  store: localStore,
  request: (config) =>
    authSession.status() === 'signedIn' ? authSession.request(config) : Promise.resolve({ status: 'session_ended' }),
});
