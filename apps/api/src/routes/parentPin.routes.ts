import { Router } from 'express';
import { createParentPinController } from '../controllers/parentPin.controller';
import { requireAuth, requireFullScope } from '../middleware/requireAuth';
import { validate } from '../middleware/validate';
import { codeField, languageField, pinField } from './fields';
import type { ParentPinService } from '../services/parentPin.service';
import type { TokenService } from '../services/token.service';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Mounted at `/account/pin`. Full sessions only: a Kid-Mode device never gets the hash (ADR-0002).
 * - `GET` → `{ pinHash }` (null if not set).
 * - `PUT { pin, currentPin? }` → `{ pinHash }`; `currentPin` is needed once a PIN exists.
 * - `POST /reset-code { language }` → `{ expiresInSeconds, resendAfterSeconds }`: emails a reset code.
 * - `POST /reset { code, pin }` → `{ pinHash }`: a forgotten PIN replaced with the emailed code.
 */
export function parentPinRoutes(pins: ParentPinService, tokens: TokenService): Router {
  const router = Router();
  const controller = createParentPinController(pins);

  router.use(requireAuth(tokens), requireFullScope);
  router.get('/', asyncHandler(controller.get));
  router.put('/', [pinField(), pinField('currentPin').optional()], validate, asyncHandler(controller.set));
  router.post('/reset-code', [languageField()], validate, asyncHandler(controller.requestReset));
  router.post(
    '/reset',
    [codeField(), pinField()],
    validate,
    asyncHandler(controller.reset),
  );

  return router;
}
