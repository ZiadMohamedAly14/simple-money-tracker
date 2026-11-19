import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Env } from './config/env';
import { apiRoutes } from './routes';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler';
import { createMailer, type Mailer } from './email/mailer';
import { systemClock, type Clock } from './utils/clock';

/** The outside world the app talks to; tests replace these. */
export interface AppDeps {
  mailer: Mailer;
  now: Clock;
}

/**
 * Builds the Express app without listening or connecting to Mongo, so tests
 * can use it in process with supertest. Middleware order matters:
 * security headers → CORS → body parsing → routes → 404 → central error handler.
 */
export function createApp(env: Env, deps: Partial<AppDeps> = {}): Express {
  const fullDeps: AppDeps = {
    mailer: deps.mailer ?? createMailer(env),
    now: deps.now ?? systemClock,
  };
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Railway sits behind one proxy; needed for per-IP rate limits.

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use(apiRoutes(env, fullDeps));

  app.use(notFoundHandler);
  app.use(createErrorHandler({ exposeInternals: env.nodeEnv !== 'production' }));

  return app;
}
