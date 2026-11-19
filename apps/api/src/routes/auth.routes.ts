import { Router } from 'express';
import { body } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import { SUPPORTED_LANGUAGES, normalizeEmail, type AuthErrorData } from '@money-tracker/shared';
import { createAuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import type { AuthService } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { TooManyRequestsError } from '../utils/AppError';

/** Per-IP limits, on top of the per-email limits in the auth service. In memory: one API instance. */
export const REQUEST_CODE_IP_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 };
export const VERIFY_CODE_IP_LIMIT = { max: 50, windowMs: 15 * 60 * 1000 };

function perIpLimit({ max, windowMs }: { max: number; windowMs: number }) {
  return rateLimit({
    limit: max,
    windowMs,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, _res, next) => {
      const resetTime = (req as { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const data: AuthErrorData = {
        reason: 'too_many_requests',
        retryAfterSeconds: resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000)) : undefined,
      };
      next(new TooManyRequestsError('Too many requests. Try again later', data));
    },
  });
}

const emailField = () =>
  body('email')
    .isString()
    .bail()
    .customSanitizer((value: string) => normalizeEmail(value))
    .isEmail()
    .withMessage('Enter a valid email address');

export function authRoutes(auth: AuthService): Router {
  const router = Router();
  const controller = createAuthController(auth);

  router.post(
    '/code',
    perIpLimit(REQUEST_CODE_IP_LIMIT),
    [emailField(), body('language').default('en').isIn([...SUPPORTED_LANGUAGES])],
    validate,
    asyncHandler(controller.requestCode),
  );

  router.post(
    '/verify',
    perIpLimit(VERIFY_CODE_IP_LIMIT),
    [
      emailField(),
      body('code').isString().matches(/^\d{6}$/).withMessage('The code is 6 digits'),
      body('deviceLabel').optional().isString().trim().isLength({ max: 100 }),
    ],
    validate,
    asyncHandler(controller.verifyCode),
  );

  return router;
}
