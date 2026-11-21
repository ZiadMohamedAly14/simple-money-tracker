import { Router, type Request, type Response } from 'express';
import { type ConfirmDeletionBody, type RequestDeletionCodeBody } from '@money-tracker/shared';
import { authOf, requireAuth, requireFullScope } from '../middleware/requireAuth';
import { validate } from '../middleware/validate';
import { codeField, languageField } from './fields';
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
    [languageField()],
    validate,
    asyncHandler(async (req: Request, res: Response) => {
      const { language } = req.body as RequestDeletionCodeBody;
      sendSuccess(res, await deletion.requestCode(authOf(req).accountId, language), 'Code sent');
    }),
  );

  router.post(
    '/',
    [codeField()],
    validate,
    asyncHandler(async (req: Request, res: Response) => {
      const { code } = req.body as ConfirmDeletionBody;
      await deletion.confirm(authOf(req).accountId, code);
      sendSuccess(res, null, 'Account deleted');
    }),
  );

  return router;
}
