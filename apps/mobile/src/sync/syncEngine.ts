import type { AxiosRequestConfig } from 'axios';
import { MAX_PUSHED_CHANGES, isApiEnvelope, type SyncRequestBody, type SyncResponseData } from '@money-tracker/shared';
import type { AuthedResult } from '@/auth/authSession';
import type { LocalStore } from '@/db/localStore';

/**
 * - `synced`: pushed everything queued and pulled everything new.
 * - `offline`: the server couldn't be reached; nothing changed locally.
 * - `needs_sign_in`: the session ended; local data stays until a new code.
 * - `signed_out`: no Account on this device.
 * - `failed`: the server refused the sync; the outbox is kept for next time.
 */
export type SyncOutcome = 'synced' | 'offline' | 'needs_sign_in' | 'signed_out' | 'failed';

export interface SyncEngineDeps {
  store: LocalStore;
  /** An authenticated API call (`authSession.request`). */
  request: (config: AxiosRequestConfig) => Promise<AuthedResult>;
}

/**
 * Pushes the outbox and pulls newer changes through `POST /sync` (ADR-0007).
 * One sync runs at a time: a call made while one is running waits for it and
 * then runs once more, so writes made meanwhile still go out. Ticket 06 adds
 * the triggers (debounced after writes, foreground, reconnect).
 */
export function createSyncEngine({ store, request }: SyncEngineDeps) {
  let running: Promise<SyncOutcome> | null = null;
  let queued: Promise<SyncOutcome> | null = null;

  async function roundTrip(): Promise<SyncOutcome | 'more'> {
    const accountId = store.accountId();
    if (!accountId) return 'signed_out';
    const push = store.pendingPush(MAX_PUSHED_CHANGES);
    const body: SyncRequestBody = { cursor: store.cursor(), changes: push.changes };

    const result = await request({ method: 'POST', url: '/sync', data: body });
    if (result.status === 'unreachable') return 'offline';
    if (result.status === 'session_ended') return 'needs_sign_in';
    if (result.httpStatus !== 200 || !isApiEnvelope(result.body) || !result.body.success) return 'failed';

    if (!store.completeSync(accountId, push.upTo, result.body.data as SyncResponseData)) return 'signed_out';
    return push.hasMore ? 'more' : 'synced';
  }

  /**
   * Onboarding finished on this device but the server hasn't recorded it yet
   * (e.g. it happened offline): tell it now. Tried again on the next sync if
   * it doesn't go through.
   */
  async function reportOnboarding(): Promise<void> {
    const accountId = store.accountId();
    if (!accountId || store.onboarding() !== 'unreported') return;
    const result = await request({ method: 'POST', url: '/account/onboarding', data: {} });
    if (result.status === 'ok' && result.httpStatus === 200) store.onboardingReported(accountId);
  }

  async function run(): Promise<SyncOutcome> {
    for (;;) {
      const outcome = await roundTrip();
      if (outcome === 'more') continue;
      if (outcome === 'synced') await reportOnboarding();
      return outcome;
    }
  }

  function sync(): Promise<SyncOutcome> {
    if (!running) {
      running = run().finally(() => {
        running = null;
      });
      return running;
    }
    if (!queued) {
      const next = (): Promise<SyncOutcome> => {
        queued = null;
        return sync();
      };
      queued = running.then(next, next);
    }
    return queued;
  }

  return { sync };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
