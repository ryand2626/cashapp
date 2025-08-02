/**
 * Menu Loading Performance Test
 * Tests the improved menu loading with timeout, retry, and caching
 */

import DatabaseService from '../DatabaseService';
import DataService from '../DataService';

// Mock fetch for testing
const originalFetch = global.fetch;

describe('Menu Loading Performance', () => {
  let dbService: DatabaseService;
  let dataService: DataService;

  beforeEach(() => {
    dbService = DatabaseService.getInstance();
    dataService = DataService.getInstance();
    // Clear cache before each test
    dbService.clearMenuCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('should handle timeout and retry', async () => {
    let attemptCount = 0;

    // Mock fetch to simulate timeout on first attempt
    global.fetch = jest.fn().mockImplementation(() => {
      attemptCount++;
      if (attemptCount === 1) {
        // First attempt: simulate timeout
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100);
        });
      } else {
        // Second attempt: success
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [{ id: 1, name: 'Test Item', price: 10.99, category: 'Test' }],
            }),
        });
      }
    });

    const items = await dbService.getMenuItems();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Test Item');
    expect(attemptCount).toBe(2); // Should have retried once
  });

  test('should use cache on subsequent calls', async () => {
    let fetchCallCount = 0;

    global.fetch = jest.fn().mockImplementation(() => {
      fetchCallCount++;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [{ id: 1, name: 'Cached Item', price: 5.99, category: 'Test' }],
          }),
      });
    });

    // First call - should hit API
    const items1 = await dbService.getMenuItems();
    expect(fetchCallCount).toBe(1);
    expect(items1[0].name).toBe('Cached Item');

    // Second call - should use cache
    const items2 = await dbService.getMenuItems();
    expect(fetchCallCount).toBe(1); // No additional fetch
    expect(items2[0].name).toBe('Cached Item');
  });

  test('should fall back to Chucho menu on complete failure', async () => {
    // Mock fetch to always fail
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const items = await dbService.getMenuItems();
    expect(items.length).toBeGreaterThan(0);
    // Chucho menu items should have emoji field
    expect(items[0]).toHaveProperty('emoji');
  });

  test('should handle expired cache gracefully', async () => {
    // First call - successful
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: [{ id: 1, name: 'Original Item', price: 7.99, category: 'Test' }],
        }),
    });

    const items1 = await dbService.getMenuItems();
    expect(items1[0].name).toBe('Original Item');

    // Simulate cache expiration by clearing it
    dbService.clearMenuCache();

    // Second call - simulate API failure
    global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));

    // Should fall back to Chucho menu since cache is cleared
    const items2 = await dbService.getMenuItems();
    expect(items2.length).toBeGreaterThan(0);
  });
});

// Run the tests
if (require.main === module) {
  jest.run();
}
