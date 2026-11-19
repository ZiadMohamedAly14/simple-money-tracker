import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { useTestDatabase } from './helpers/testDatabase';

describe('GET /health', () => {
  describe('with the database connected', () => {
    useTestDatabase();

    it('reports ok in the standard envelope', async () => {
      const response = await request(buildTestApp()).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'ok',
        data: { status: 'ok', database: 'connected' },
        success: true,
      });
    });
  });

  describe('without a database connection', () => {
    it('responds 503 with an error envelope', async () => {
      const response = await request(buildTestApp()).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ message: 'Database unavailable', data: null, success: false });
    });
  });
});
