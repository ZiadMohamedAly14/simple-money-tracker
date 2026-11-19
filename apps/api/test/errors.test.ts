import request from 'supertest';
import { buildTestApp } from './helpers/testApp';

describe('central error handling', () => {
  it('answers unknown routes with a 404 error envelope', async () => {
    const response = await request(buildTestApp()).get('/no-such-route');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: 'Route not found: GET /no-such-route',
      data: null,
      success: false,
    });
  });

  it('answers a malformed JSON body with a 400 error envelope', async () => {
    const response = await request(buildTestApp())
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{"not json');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Malformed request body', data: null, success: false });
  });
});
