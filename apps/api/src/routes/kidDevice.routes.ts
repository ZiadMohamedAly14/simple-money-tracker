import { Router, type Request, type Response } from 'express';
import { body } from 'express-validator';
import { isUuid, isValidParentPin, type ElevateBody, type StartKidSessionBody } from '@money-tracker/shared';
import { authOf, requireAuth, requireFullScope } from '../middleware/requireAuth';
import { validate } from '../middleware/validate';
import type { KidDeviceService } from '../services/kidDevice.service';
import type { TokenService } from '../services/token.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

const pinField = body('pin').custom((value) => isValidParentPin(value)).withMessage('The PIN is 4 to 6 digits');

/**
 * Mounted at `/kid-devices`.
 * - `POST { kidProfileId, pin, deviceLabel? }` → `{ accessToken, refreshToken, kidProfileId }`:
 *   swaps the calling full session for a Kid Session (ADR-0002).
 * - `POST /elevate { pin }` (Kid Session) → `{ accessToken, expiresInSeconds }`: short-lived full access, no refresh.
 */
export function kidDeviceRoutes(kidDevices: KidDeviceService, tokens: TokenService): Router {
  const router = Router();

  router.post(
    '/',
    requireAuth(tokens),
    requireFullScope,
    [
      body('kidProfileId').custom((value) => isUuid(value)).withMessage('must be a Kid Profile ID'),
      pinField,
      body('deviceLabel').optional().isString().trim().isLength({ max: 100 }),
    ],
    validate,
    asyncHandler(async (req: Request, res: Response) => {
      const { kidProfileId, pin, deviceLabel } = req.body as StartKidSessionBody;
      sendSuccess(res, await kidDevices.start(authOf(req), kidProfileId, pin, deviceLabel ?? null), 'Kid-Mode device set up');
    }),
  );

  router.post(
    '/elevate',
    requireAuth(tokens),
    [pinField],
    validate,
    asyncHandler(async (req: Request, res: Response) => {
      const { pin } = req.body as ElevateBody;
      sendSuccess(res, await kidDevices.elevate(authOf(req), pin), 'Parent Area unlocked');
    }),
  );

  return router;
}
