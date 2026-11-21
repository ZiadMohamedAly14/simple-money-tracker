import { Router, type Request, type Response } from 'express';
import { body } from 'express-validator';
import { isUuid, isValidParentPin, type StartKidSessionBody } from '@money-tracker/shared';
import { authOf, requireAuth, requireFullScope } from '../middleware/requireAuth';
import { validate } from '../middleware/validate';
import type { KidDeviceService } from '../services/kidDevice.service';
import type { TokenService } from '../services/token.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

/**
 * Mounted at `/kid-devices`.
 * - `POST { kidProfileId, pin, deviceLabel? }` → `{ accessToken, refreshToken, kidProfileId }`:
 *   swaps the calling full session for a Kid Session (ADR-0002).
 */
export function kidDeviceRoutes(kidDevices: KidDeviceService, tokens: TokenService): Router {
  const router = Router();

  router.post(
    '/',
    requireAuth(tokens),
    requireFullScope,
    [
      body('kidProfileId').custom((value) => isUuid(value)).withMessage('must be a Kid Profile ID'),
      body('pin').custom((value) => isValidParentPin(value)).withMessage('The PIN is 4 to 6 digits'),
      body('deviceLabel').optional().isString().trim().isLength({ max: 100 }),
    ],
    validate,
    asyncHandler(async (req: Request, res: Response) => {
      const { kidProfileId, pin, deviceLabel } = req.body as StartKidSessionBody;
      sendSuccess(res, await kidDevices.start(authOf(req), kidProfileId, pin, deviceLabel ?? null), 'Kid-Mode device set up');
    }),
  );

  return router;
}
