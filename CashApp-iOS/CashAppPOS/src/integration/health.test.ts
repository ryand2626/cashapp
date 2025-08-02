// @ts-nocheck
import fetchMock from 'jest-fetch-mock';

describe('Backend Health Endpoint', () => {
  beforeAll(() => {
    // Disable fetch mocking so we hit the real backend running via Docker
    fetchMock.disableMocks();
  });

  it('should return healthy status', async () => {
    const res = await fetch('http://localhost:8000/health');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('success', true);
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('status', 'healthy');
  });
});
