import type { ElevateErrorData, ElevatedAccessData, KidSessionData, KidSessionErrorData } from '@money-tracker/shared';
import { Account } from '../models/account.model';
import { KidProfile } from '../models/synced.model';
import { AppError } from '../utils/AppError';
import type { ParentPinService } from './parentPin.service';
import type { AuthContext, TokenService } from './token.service';

type Reason = KidSessionErrorData['reason'] | ElevateErrorData['reason'];

const refused = (message: string, status: number, reason: Reason): AppError => new AppError(message, status, { reason });

/**
 * Kid-Mode devices (ADR-0002). Setting one up swaps the parent's full session
 * on that device for a Kid Session limited to one Kid Profile. The parent can
 * later elevate it with the PIN, list Kid-Mode devices and revoke them.
 */
export function createKidDeviceService({ tokens, pins }: { tokens: TokenService; pins: ParentPinService }) {
  async function requirePin(accountId: string): Promise<void> {
    const account = await Account.findById(accountId).select({ parentPinHash: 1 }).lean();
    if (!account?.parentPinHash) throw refused('Set a Parent PIN first', 409, 'no_pin');
  }

  return {
    /**
     * Checks the Kid Profile is this Account's and live, then the Parent PIN
     * (throttled like the PIN gate), then starts the Kid Session and ends the
     * full session the request came from, so its tokens stop working.
     */
    async start(auth: AuthContext, kidProfileId: string, pin: string, deviceLabel: string | null): Promise<KidSessionData> {
      const kid = await KidProfile.exists({ _id: kidProfileId, accountId: auth.accountId, deletedAt: null, archivedAt: null });
      if (!kid) throw refused('No such Kid Profile', 404, 'kid_not_found');

      await requirePin(auth.accountId);
      await pins.checkPin(auth.accountId, pin);

      const issued = await tokens.startKidSession(auth.accountId, kidProfileId, deviceLabel);
      await tokens.endSession(auth.sessionId);
      return { ...issued, kidProfileId };
    },

    /**
     * PIN elevation (ADR-0002): a Kid Session confirms the Parent PIN (throttled
     * like the PIN gate) and gets a short-lived full access token with no refresh.
     */
    async elevate(auth: AuthContext, pin: string): Promise<ElevatedAccessData> {
      if (auth.scope !== 'kid') throw refused('Only a Kid-Mode device elevates', 403, 'not_kid_session');
      await requirePin(auth.accountId);
      await pins.checkPin(auth.accountId, pin);
      return tokens.startElevatedSession(auth);
    },
  };
}

export type KidDeviceService = ReturnType<typeof createKidDeviceService>;
