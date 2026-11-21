import { Router, type Request, type Response } from 'express';
import { authOf, requireAuth } from '../middleware/requireAuth';
import type { OnboardingService } from '../services/onboarding.service';
import type { TokenService } from '../services/token.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

/** `POST /account/onboarding` → `{ onboardingCompleted: true }`. No body. */
export function onboardingRoutes(onboarding: OnboardingService, tokens: TokenService): Router {
  const router = Router();

  router.post(
    '/',
    requireAuth(tokens),
    asyncHandler(async (req: Request, res: Response) => {
      sendSuccess(res, await onboarding.complete(authOf(req)), 'Onboarding complete');
    }),
  );

  return router;
}
