import type { HealthData } from '@money-tracker/shared';
import { isDatabaseConnected } from '../config/database';
import { ServiceUnavailableError } from '../utils/AppError';

export function getHealth(): HealthData {
  if (!isDatabaseConnected()) throw new ServiceUnavailableError('Database unavailable');
  return { status: 'ok', database: 'connected' };
}
