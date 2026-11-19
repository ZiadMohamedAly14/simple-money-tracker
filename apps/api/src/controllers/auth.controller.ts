import type { Request, Response } from 'express';
import type { Language, RefreshBody, TokenPair } from '@money-tracker/shared';
import { authOf } from '../middleware/requireAuth';
import type { AuthService } from '../services/auth.service';
import type { TokenService } from '../services/token.service';
import { sendSuccess } from '../utils/response';

export function createAuthController(auth: AuthService, tokens: TokenService) {
  return {
    async requestCode(req: Request, res: Response): Promise<void> {
      const { email, language } = req.body as { email: string; language: Language };
      sendSuccess(res, await auth.requestCode(email, language), 'Code sent');
    },

    async verifyCode(req: Request, res: Response): Promise<void> {
      const { email, code, deviceLabel } = req.body as { email: string; code: string; deviceLabel?: string };
      sendSuccess(res, await auth.verifyCode(email, code, deviceLabel ?? null), 'Signed in');
    },

    async refresh(req: Request, res: Response): Promise<void> {
      const { refreshToken } = req.body as RefreshBody;
      const pair: TokenPair = await tokens.rotate(refreshToken);
      sendSuccess(res, pair, 'Tokens refreshed');
    },

    async logout(req: Request, res: Response): Promise<void> {
      await tokens.endSession(authOf(req).sessionId);
      sendSuccess(res, null, 'Signed out');
    },
  };
}
