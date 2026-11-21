import type { Request, Response } from 'express';
import type { SetParentPinBody } from '@money-tracker/shared';
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
  };
}
