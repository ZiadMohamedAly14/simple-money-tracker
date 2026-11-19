import { Router } from 'express';
import * as healthController from '../controllers/health.controller';

export function healthRoutes(): Router {
  const router = Router();
  router.get('/', healthController.getHealth);
  return router;
}
