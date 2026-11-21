import type { Request, Response } from 'express';
import type { RequestPinResetBody, ResetParentPinBody, SetParentPinBody } from '@money-tracker/shared';
import { authOf } from '../middleware/requireAuth';
import type { ParentPinService } from '../services/parentPin.service';
import { sendSuccess } from '../utils/response';

export function createParentPinController(pins: ParentPinService) {
  return {
    async get(req: Request, res: Response): Promise<void> {
      sendSuccess(res, await pins.get(authOf(req).accountId));
    },

    async set(req: Request, res: Response): Promise<void> {
      const { pin, currentPin } = req.body as SetParentPinBody;
      sendSuccess(res, await pins.set(authOf(req).accountId, pin, currentPin), 'Parent PIN saved');
    },

    async requestReset(req: Request, res: Response): Promise<void> {
      const { language } = req.body as RequestPinResetBody;
      sendSuccess(res, await pins.requestReset(authOf(req).accountId, language), 'Code sent');
    },

    async reset(req: Request, res: Response): Promise<void> {
      const { code, pin } = req.body as ResetParentPinBody;
      sendSuccess(res, await pins.reset(authOf(req).accountId, code, pin), 'Parent PIN reset');
    },
  };
}
