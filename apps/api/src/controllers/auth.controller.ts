import type { Request, Response } from 'express';
import type { Language } from '@money-tracker/shared';
import type { AuthService } from '../services/auth.service';
import { sendSuccess } from '../utils/response';

export function createAuthController(auth: AuthService) {
  return {
    async requestCode(req: Request, res: Response): Promise<void> {
      const { email, language } = req.body as { email: string; language: Language };
      sendSuccess(res, await auth.requestCode(email, language), 'Code sent');
    },

    async verifyCode(req: Request, res: Response): Promise<void> {
      const { email, code, deviceLabel } = req.body as { email: string; code: string; deviceLabel?: string };
      sendSuccess(res, await auth.verifyCode(email, code, deviceLabel ?? null), 'Signed in');
    },
  };
}
