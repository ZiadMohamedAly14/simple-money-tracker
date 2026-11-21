import type { SyncOutcome } from './syncEngine';

/** How long after the last local write sync waits, so a burst of edits goes out in one round trip. */
export const SYNC_DEBOUNCE_MS = 2000;

/**
 * When sync runs on its own (ADR-0007): after local writes (debounced), when
 * the app comes to the foreground, when the connection returns, and on
 * pull-to-refresh. There is no background sync: `stop()` when the app goes
 * away. The platform wiring (AppState, network events) is in `appSync.ts`.
 */
export function createSyncTriggers({ sync }: { sync: () => Promise<SyncOutcome> }) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function cancelWaiting(): void {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function syncNow(): Promise<SyncOutcome> {
    cancelWaiting();
    return sync();
  }

  /** Fire-and-forget: the outcome shows up in the local data and the pending indicator. */
  const trigger = (): void => {
    if (!stopped) void syncNow().catch(() => undefined);
  };

  return {
    localWrite(): void {
      if (stopped) return;
      cancelWaiting();
      timer = setTimeout(() => {
        timer = null;
        trigger();
      }, SYNC_DEBOUNCE_MS);
    },
    foreground: trigger,
    reconnected: trigger,
    /** Pull-to-refresh: syncs now and resolves with how it went. */
    refresh: syncNow,
    stop(): void {
      stopped = true;
      cancelWaiting();
    },
  };
}

export type SyncTriggers = ReturnType<typeof createSyncTriggers>;
