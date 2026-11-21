import type { KidSessionData, KidSessionErrorData } from '@money-tracker/shared';
import { Account } from '../models/account.model';
import { KidProfile } from '../models/synced.model';
import { AppError } from '../utils/AppError';
import type { ParentPinService } from './parentPin.service';
import type { AuthContext, TokenService } from './token.service';

const refused = (message: string, status: number, reason: KidSessionErrorData['reason']): AppError =>
  new AppError(message, status, { reason } satisfies KidSessionErrorData);

/**
 * Kid-Mode devices (ADR-0002). Setting one up swaps the parent's full session
 * on that device for a Kid Session limited to one Kid Profile. Ticket 15 adds
 * PIN elevation, listing and revoking here.
 */
export function createKidDeviceService({ tokens, pins }: { tokens: TokenService; pins: ParentPinService }) {
  return {
    /**
     * Checks the Kid Profile is this Account's and live, then the Parent PIN
     * (throttled like the PIN gate), then starts the Kid Session and ends the
     * full session the request came from, so its tokens stop working.
     */
    async start(auth: AuthContext, kidProfileId: string, pin: string, deviceLabel: string | null): Promise<KidSessionData> {
      const kid = await KidProfile.exists({ _id: kidProfileId, accountId: auth.accountId, deletedAt: null, archivedAt: null });
      if (!kid) throw refused('No such Kid Profile', 404, 'kid_not_found');

      const account = await Account.findById(auth.accountId).select({ parentPinHash: 1 }).lean();
      if (!account?.parentPinHash) throw refused('Set a Parent PIN first', 409, 'no_pin');
      await pins.checkPin(auth.accountId, pin);

      const issued = await tokens.startKidSession(auth.accountId, kidProfileId, deviceLabel);
      await tokens.endSession(auth.sessionId);
      return { ...issued, kidProfileId };
    },
  };
}

export type KidDeviceService = ReturnType<typeof createKidDeviceService>;
