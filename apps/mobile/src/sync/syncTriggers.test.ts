import { createSyncTriggers, SYNC_DEBOUNCE_MS } from './syncTriggers';
import type { SyncOutcome } from './syncEngine';

describe('when sync runs on its own (ADR-0007)', () => {
  let syncs: number;
  const sync = async (): Promise<SyncOutcome> => {
    syncs += 1;
    return 'synced';
  };

  beforeEach(() => {
    jest.useFakeTimers();
    syncs = 0;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('syncs about 2 seconds after a local write', () => {
    const triggers = createSyncTriggers({ sync });
    triggers.localWrite();

    jest.advanceTimersByTime(SYNC_DEBOUNCE_MS - 1);
    expect(syncs).toBe(0);
    jest.advanceTimersByTime(1);
    expect(syncs).toBe(1);
    expect(SYNC_DEBOUNCE_MS).toBe(2000);
  });

  it('syncs once for a burst of writes, 2 seconds after the last one', () => {
    const triggers = createSyncTriggers({ sync });
    triggers.localWrite();
    jest.advanceTimersByTime(1500);
    triggers.localWrite();
    jest.advanceTimersByTime(1500);
    triggers.localWrite();

    jest.advanceTimersByTime(SYNC_DEBOUNCE_MS);
    expect(syncs).toBe(1);
  });

  it('syncs right away when the app comes to the foreground, replacing a waiting write sync', () => {
    const triggers = createSyncTriggers({ sync });
    triggers.localWrite();
    triggers.foreground();
    expect(syncs).toBe(1);

    jest.advanceTimersByTime(SYNC_DEBOUNCE_MS);
    expect(syncs).toBe(1);
  });

  it('syncs right away when the connection returns', () => {
    const triggers = createSyncTriggers({ sync });
    triggers.reconnected();
    expect(syncs).toBe(1);
  });

  it('syncs right away on pull-to-refresh and reports how it went', async () => {
    const triggers = createSyncTriggers({ sync });
    await expect(triggers.refresh()).resolves.toBe('synced');
    expect(syncs).toBe(1);
  });

  it('does nothing once stopped (no background sync)', () => {
    const triggers = createSyncTriggers({ sync });
    triggers.localWrite();
    triggers.stop();

    jest.advanceTimersByTime(10 * SYNC_DEBOUNCE_MS);
    triggers.foreground();
    triggers.reconnected();
    expect(syncs).toBe(0);
  });
});
