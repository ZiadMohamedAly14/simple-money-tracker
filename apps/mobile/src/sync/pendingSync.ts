/** Unsynced changes only count as waiting too long after this (spec: a subtle indicator, no nagging). */
export const PENDING_SYNC_GRACE_MS = 60_000;

/**
 * Whether to show the "pending sync" indicator: only when the oldest change
 * not yet on the server has waited more than a minute.
 */
export function isSyncOverdue(oldestPendingAt: number | null, nowMs: number): boolean {
  return oldestPendingAt !== null && nowMs - oldestPendingAt > PENDING_SYNC_GRACE_MS;
}
