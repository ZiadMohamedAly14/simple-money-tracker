import { Router } from 'express';
import { body } from 'express-validator';
import { MAX_PULLED_CHANGES, MAX_PUSHED_CHANGES } from '@money-tracker/shared';
import { createSyncController } from '../controllers/sync.controller';
import { requireAuth } from '../middleware/requireAuth';
import { validate } from '../middleware/validate';
import type { SyncService } from '../services/sync.service';
import type { TokenService } from '../services/token.service';
import { asyncHandler } from '../utils/asyncHandler';

/** `POST /sync { cursor, changes, limit? }` → `{ cursor, changes, hasMore }` (ADR-0007). Each change is checked in the service. */
export function syncRoutes(sync: SyncService, tokens: TokenService): Router {
  const router = Router();
  const controller = createSyncController(sync);

  router.post(
    '/',
    requireAuth(tokens),
    [
      body('cursor').isInt({ min: 0 }).withMessage('must be a server version (0 or more)').toInt(),
      body('changes').isArray({ max: MAX_PUSHED_CHANGES }).withMessage(`must be a list of at most ${MAX_PUSHED_CHANGES} changes`),
      body('limit')
        .optional()
        .isInt({ min: 1, max: MAX_PULLED_CHANGES })
        .withMessage(`must be a page size of 1 to ${MAX_PULLED_CHANGES}`)
        .toInt(),
    ],
    validate,
    asyncHandler(controller.sync),
  );

  return router;
}
