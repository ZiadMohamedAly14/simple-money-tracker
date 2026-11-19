import type { Request, Response } from 'express';
import * as healthService from '../services/health.service';
import { sendSuccess } from '../utils/response';

export function getHealth(_req: Request, res: Response): void {
  sendSuccess(res, healthService.getHealth());
}
