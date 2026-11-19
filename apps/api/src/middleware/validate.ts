import type { RequestHandler } from 'express';
import { validationResult } from 'express-validator';
import { ValidationError } from '../utils/AppError';

/**
 * Put after a route's express-validator chains:
 *   router.post('/x', [body('email').isEmail()], validate, asyncHandler(controller.x))
 * Fails with 422 and `data: [{ field, message }]`.
 */
export const validate: RequestHandler = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((error) => ({
    field: error.type === 'field' ? error.path : error.type,
    message: String(error.msg),
  }));
  next(new ValidationError(errors));
};
