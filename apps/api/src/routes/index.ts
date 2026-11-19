import { Router } from 'express';
import type { Env } from '../config/env';
import { healthRoutes } from './health.routes';

/** Mounts every feature router. Add new feature routers here. */
export function apiRoutes(_env: Env): Router {
  const router = Router();
  router.use('/health', healthRoutes());
  return router;
}
