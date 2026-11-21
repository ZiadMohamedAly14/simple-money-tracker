import { Router } from 'express';
import { body } from 'express-validator';
import { isValidParentPin } from '@money-tracker/shared';
import { createParentPinController } from '../controllers/parentPin.controller';
import { requireAuth, requireFullScope } from '../middleware/requireAuth';
import { validate } from '../middleware/validate';
import type { ParentPinService } from '../services/parentPin.service';
import type { TokenService } from '../services/token.service';
import { asyncHandler } from '../utils/asyncHandler';

const pinField = (field: string) => body(field).custom((value) => isValidParentPin(value)).withMessage('The PIN is 4 to 6 digits');

/**
 * Mounted at `/account/pin`. Full sessions only: a Kid-Mode device never gets the hash (ADR-0002).
 * - `GET` → `{ pinHash }` (null if not set).
 * - `PUT { pin, currentPin? }` → `{ pinHash }`; `currentPin` is needed once a PIN exists.
 */
export function parentPinRoutes(pins: ParentPinService, tokens: TokenService): Router {
  const router = Router();
  const controller = createParentPinController(pins);

  router.use(requireAuth(tokens), requireFullScope);
  router.get('/', asyncHandler(controller.get));
  router.put('/', [pinField('pin'), pinField('currentPin').optional()], validate, asyncHandler(controller.set));

  return router;
}
