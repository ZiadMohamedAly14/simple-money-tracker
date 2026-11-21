import { Router, type Request, type Response } from 'express';
import { body } from 'express-validator';
import { SUPPORTED_LANGUAGES, type ConfirmDeletionBody, type RequestDeletionCodeBody } from '@money-tracker/shared';
import { authOf, requireAuth, requireFullScope } from '../middleware/requireAuth';
import { validate } from '../middleware/validate';
import type { AccountDeletionService } from '../services/accountDeletion.service';
import type { TokenService } from '../services/token.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

/**
 * Mounted at `/account/deletion`. Full sessions only; a Kid Session gets 403 `kid_session`.
 * - `POST /code { language }` → `{ expiresInSeconds, resendAfterSeconds }`: emails a deletion code.
 * - `POST / { code }` → null: hard-deletes the Account and all its data, and ends every session.
 */
export function accountDeletionRoutes(deletion: AccountDeletionService, tokens: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokens), requireFullScope);

  router.post(
    '/code',
    [body('language').default('en').isIn([...SUPPORTED_LANGUAGES])],
    validate,
    asyncHandler(async (req: Request, res: Response) => {
      const { language } = req.body as RequestDeletionCodeBody;
      sendSuccess(res, await deletion.requestCode(authOf(req).accountId, language), 'Code sent');
    }),
  );

  router.post(
    '/',
    [body('code').isString().matches(/^\d{6}$/).withMessage('The code is 6 digits')],
    validate,
    asyncHandler(async (req: Request, res: Response) => {
      const { code } = req.body as ConfirmDeletionBody;
      await deletion.confirm(authOf(req).accountId, code);
      sendSuccess(res, null, 'Account deleted');
    }),
  );

  return router;
}
