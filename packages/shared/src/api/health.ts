/** Body of `GET /health` inside the envelope's `data`. */
export interface HealthData {
  status: 'ok';
  database: 'connected';
}
