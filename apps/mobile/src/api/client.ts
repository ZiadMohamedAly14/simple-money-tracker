import axios, { type AxiosInstance } from 'axios';

/**
 * The one axios instance shape the app uses to talk to the API. Callers
 * interpret responses themselves: every status resolves (no throw on 4xx/5xx),
 * so the `{ message, data, success }` envelope is always readable. Network
 * failures still reject.
 */
export function createApiClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 10_000,
    validateStatus: () => true,
  });
}
