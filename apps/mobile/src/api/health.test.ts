import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApiClient } from './client';
import { checkHealth } from './health';

/** A throwaway HTTP server that answers every request with the given status and body. */
async function serve(status: number, body: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((_req, res) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

describe('checkHealth', () => {
  it('reports ok when the API reports ok', async () => {
    const api = await serve(
      200,
      JSON.stringify({ message: 'ok', data: { status: 'ok', database: 'connected' }, success: true }),
    );
    try {
      expect(await checkHealth(createApiClient(api.url))).toEqual({ status: 'ok' });
    } finally {
      await api.close();
    }
  });

  it("passes on the API's error message when it reports a failure", async () => {
    const api = await serve(503, JSON.stringify({ message: 'Database unavailable', data: null, success: false }));
    try {
      expect(await checkHealth(createApiClient(api.url))).toEqual({
        status: 'error',
        message: 'Database unavailable',
      });
    } finally {
      await api.close();
    }
  });

  it('reports an unexpected response when the body is not an API envelope', async () => {
    const api = await serve(502, '<html>Bad gateway</html>');
    try {
      expect(await checkHealth(createApiClient(api.url))).toEqual({ status: 'unexpected' });
    } finally {
      await api.close();
    }
  });

  it('reports unreachable when nothing answers', async () => {
    const api = await serve(200, '{}');
    await api.close();

    expect(await checkHealth(createApiClient(api.url))).toEqual({ status: 'unreachable' });
  });
});
