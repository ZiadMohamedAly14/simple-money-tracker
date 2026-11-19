import type { Request, Response } from 'express';
import type { SyncRequestBody } from '@money-tracker/shared';
import { authOf } from '../middleware/requireAuth';
import type { SyncService } from '../services/sync.service';
import { sendSuccess } from '../utils/response';

export function createSyncController(sync: SyncService) {
  return {
    async sync(req: Request, res: Response): Promise<void> {
      sendSuccess(res, await sync.sync(authOf(req), req.body as SyncRequestBody), 'Synced');
    },
  };
}
