/**
 * Build-time configuration. `EXPO_PUBLIC_*` variables are inlined by Metro
 * from apps/mobile/.env (local) or the EAS build profile's `env` (eas.json).
 */
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';
