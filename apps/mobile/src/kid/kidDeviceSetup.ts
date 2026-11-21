import type { AuthSession, KidSessionResult } from '@/auth/authSession';
import type { SyncOutcome } from '@/sync/syncEngine';

export interface KidDeviceSetupDeps {
  auth: Pick<AuthSession, 'becomeKidDevice'>;
  sync: () => Promise<SyncOutcome>;
}

export interface KidDeviceChoice {
  kidProfileId: string;
  pin: string;
  deviceLabel?: string;
}

/**
 * The last step of setting up a kid's phone (spec, Kid-Mode device): after the
 * parent signed in, chose "This device is for a kid" and picked or created a
 * Kid Profile. It needs the internet:
 *
 * 1. Sync first, so a Kid Profile created on this phone (and anything else
 *    still waiting) reaches the server before the full session ends.
 * 2. Swap the full session for a Kid Session (the server checks the PIN). The
 *    full tokens and the local records are deleted.
 * 3. Sync again, to download the kid's wallet. If that fails the wallet
 *    arrives on the next sync.
 */
export async function setUpKidDevice({ auth, sync }: KidDeviceSetupDeps, choice: KidDeviceChoice): Promise<KidSessionResult> {
  const before = await sync();
  if (before === 'offline') return { status: 'unreachable' };
  if (before === 'needs_sign_in' || before === 'signed_out') return { status: 'session_ended' };
  if (before !== 'synced') return { status: 'failed' };

  const swapped = await auth.becomeKidDevice(choice);
  if (swapped.status === 'ok') await sync();
  return swapped;
}
