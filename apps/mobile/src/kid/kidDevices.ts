import type { AxiosRequestConfig } from 'axios';
import { isApiEnvelope, type KidDeviceSummary, type KidDevicesData } from '@money-tracker/shared';
import type { AuthedResult } from '@/auth/authSession';

type Request = (config: AxiosRequestConfig) => Promise<AuthedResult>;

/**
 * How a Kid-Mode devices call ended. `refused`: this device has no full access
 * (a Kid-Mode device whose PIN elevation ran out). These calls need the internet.
 */
type Failure = { status: 'refused' | 'unreachable' | 'session_ended' | 'failed' };

export type KidDevicesResult = { status: 'ok'; devices: KidDeviceSummary[] } | Failure;
export type RevokeKidDeviceResult = { status: 'ok' | 'not_found' } | Failure;

function failure(result: AuthedResult): Failure {
  if (result.status !== 'ok') return { status: result.status };
  return { status: result.httpStatus === 403 ? 'refused' : 'failed' };
}

/** The Account's Kid-Mode devices, newest first (`GET /kid-devices`). */
export async function listKidDevices(request: Request): Promise<KidDevicesResult> {
  const result = await request({ method: 'GET', url: '/kid-devices' });
  if (result.status === 'ok' && result.httpStatus === 200 && isApiEnvelope(result.body) && result.body.success) {
    return { status: 'ok', devices: (result.body.data as KidDevicesData).devices };
  }
  return failure(result);
}

/** Revokes a Kid-Mode device: it is signed out on its next sync (`DELETE /kid-devices/:id`). */
export async function revokeKidDevice(request: Request, id: string): Promise<RevokeKidDeviceResult> {
  const result = await request({ method: 'DELETE', url: `/kid-devices/${encodeURIComponent(id)}` });
  if (result.status === 'ok' && result.httpStatus === 200) return { status: 'ok' };
  if (result.status === 'ok' && result.httpStatus === 404) return { status: 'not_found' };
  return failure(result);
}
