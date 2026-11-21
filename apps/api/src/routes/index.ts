import { Router } from 'express';
import type { AppDeps } from '../app';
import type { Env } from '../config/env';
import { createAuthService } from '../services/auth.service';
import { createTokenService } from '../services/token.service';
import { authRoutes } from './auth.routes';
import { healthRoutes } from './health.routes';
import { createOnboardingService } from '../services/onboarding.service';
import { onboardingRoutes } from './onboarding.routes';
import { createSyncService } from '../services/sync.service';
import { syncRoutes } from './sync.routes';

/** Mounts every feature router. Add new feature routers here. */
export function apiRoutes(env: Env, { mailer, now }: AppDeps): Router {
  const tokens = createTokenService(env, now);
  const auth = createAuthService({ env, mailer, now, tokens });

  const router = Router();
  router.use('/health', healthRoutes());
  router.use('/auth', authRoutes(auth, tokens));
  router.use('/sync', syncRoutes(createSyncService({ now }), tokens));
  router.use('/account/onboarding', onboardingRoutes(createOnboardingService({ now }), tokens));
  return router;
}
