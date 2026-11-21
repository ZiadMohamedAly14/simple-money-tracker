import { useEffect, useState } from 'react';
import { min } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { localDb } from '@/db/appDatabase';
import { outbox } from '@/db/schema';
import { isSyncOverdue } from './pendingSync';

/** How often to re-check while changes are waiting (the minute can pass with no database change). */
const RECHECK_MS = 10_000;

/**
 * Whether to show "Pending sync" (`PendingSyncLabel`): only once a change has
 * waited more than a minute to reach the server.
 */
export function useSyncOverdue(): boolean {
  const { data } = useLiveQuery(localDb.select({ at: min(outbox.queuedAt) }).from(outbox));
  const oldestPendingAt = data[0]?.at ?? null;
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    setNow(Date.now());
    if (oldestPendingAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), RECHECK_MS);
    return () => clearInterval(timer);
  }, [oldestPendingAt]);

  return isSyncOverdue(oldestPendingAt, now);
}
