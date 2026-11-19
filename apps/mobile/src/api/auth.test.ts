import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApiClient } from './client';
import { requestCode, verifyCode } from './auth';

/** A throwaway HTTP server that answers every request with the given status and envelope. */
async function serve(status: number, body: unknown): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((_req, res) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

async function withApi<T>(status: number, body: unknown, run: (url: string) => Promise<T>): Promise<T> {
  const api = await serve(status, body);
  try {
    return await run(api.url);
  } finally {
    await api.close();
  }
}

describe('sign-in calls', () => {
  it('returns the tokens when verify succeeds', async () => {
    const data = {
      accessToken: 'a',
      refreshToken: 'r',
      isNewAccount: true,
      account: { id: '1', email: 'sara@example.com' },
    };
    const result = await withApi(200, { message: 'Signed in', data, success: true }, (url) =>
      verifyCode(createApiClient(url), { email: 'sara@example.com', code: '123456' }),
    );
    expect(result).toEqual({ status: 'ok', data });
  });

  it('passes on the reason and guesses left for a wrong code', async () => {
    const result = await withApi(
      400,
      { message: 'That code is not right', data: { reason: 'invalid_code', attemptsRemaining: 3 }, success: false },
      (url) => verifyCode(createApiClient(url), { email: 'sara@example.com', code: '000000' }),
    );
    expect(result).toEqual({ status: 'rejected', reason: 'invalid_code', attemptsRemaining: 3, retryAfterSeconds: undefined });
  });

  it('passes on how long to wait when codes are rate-limited', async () => {
    const result = await withApi(
      429,
      { message: 'Too many', data: { reason: 'too_many_codes', retryAfterSeconds: 1200 }, success: false },
      (url) => requestCode(createApiClient(url), 'sara@example.com', 'ar'),
    );
    expect(result).toMatchObject({ status: 'rejected', reason: 'too_many_codes', retryAfterSeconds: 1200 });
  });

  it('reports invalid input for a validation failure', async () => {
    const result = await withApi(
      422,
      { message: 'Validation failed', data: [{ field: 'email', message: 'Enter a valid email address' }], success: false },
      (url) => requestCode(createApiClient(url), 'nope', 'en'),
    );
    expect(result).toEqual({ status: 'rejected', reason: 'invalid_input' });
  });

  it('reports unreachable when there is no server', async () => {
    const result = await requestCode(createApiClient('http://127.0.0.1:1'), 'sara@example.com', 'en');
    expect(result).toEqual({ status: 'unreachable' });
  });
});
