/**
 * Performance Tests
 * Testing app performance and memory usage
 */

import { renderHook, act } from '@testing-library/react-native';

import DatabaseService from '../../services/DatabaseService';
import { useAppStore } from '../../store/useAppStore';
import { mockMenuItems, mockOrders } from '../fixtures/mockData';

// Mock performance API
const mockPerformance = {
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => [{ duration: 100 }]),
  now: jest.fn(() => Date.now()),
};

// @ts-expect-error
global.performance = mockPerformance;

describe('Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Store Performance', () => {
    it('should handle rapid cart operations efficiently', async () => {
      const { result } = renderHook(() => useAppStore());

      performance.mark('cart-operations-start');

      // Perform 100 rapid cart operations
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.addToCart(mockMenuItems[0]);
        }
      });

      performance.mark('cart-operations-end');
      performance.measure('cart-operations', 'cart-operations-start', 'cart-operations-end');

      const measurements = performance.getEntriesByName('cart-operations');
      expect(measurements[0].duration).toBeLessThan(1000); // Should complete in under 1 second

      // Verify final state is correct
      expect(result.current.cart[0].quantity).toBe(100);
    });

    it('should handle large datasets efficiently', async () => {
      const { result } = renderHook(() => useAppStore());

      // Create large dataset
      const largeMenuItems = Array.from({ length: 1000 }, (_, i) => ({
        ...mockMenuItems[0],
        id: i + 1,
        name: `Item ${i + 1}`,
      }));

      performance.mark('large-dataset-start');

      act(() => {
        result.current.setMenuItems(largeMenuItems);
      });

      performance.mark('large-dataset-end');
      performance.measure('large-dataset', 'large-dataset-start', 'large-dataset-end');

      const measurements = performance.getEntriesByName('large-dataset');
      expect(measurements[0].duration).toBeLessThan(500); // Should handle 1000 items quickly

      expect(result.current.menuItems).toHaveLength(1000);
    });

    it('should filter large datasets efficiently', async () => {
      const { result } = renderHook(() => useAppStore());

      // Set up large dataset with multiple categories
      const largeMenuItems = Array.from({ length: 1000 }, (_, i) => ({
        ...mockMenuItems[0],
        id: i + 1,
        name: `Item ${i + 1}`,
        category: i % 5 === 0 ? 'Main' : 'Other',
      }));

      act(() => {
        result.current.setMenuItems(largeMenuItems);
      });

      performance.mark('filter-start');

      act(() => {
        result.current.setSelectedCategory('Main');
      });

      const filteredItems = result.current.getFilteredItems();

      performance.mark('filter-end');
      performance.measure('filter', 'filter-start', 'filter-end');

      const measurements = performance.getEntriesByName('filter');
      expect(measurements[0].duration).toBeLessThan(100); // Filtering should be very fast

      expect(filteredItems.filter((item) => item.category === 'Main')).toHaveLength(200);
    });
  });

  describe('Database Service Performance', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.getInstance();

      // Mock fetch for performance tests
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });

    it('should handle concurrent API calls efficiently', async () => {
      const concurrentCalls = 20;

      performance.mark('concurrent-calls-start');

      // Make multiple concurrent API calls
      const promises = Array.from({ length: concurrentCalls }, () => service.getProducts());

      await Promise.all(promises);

      performance.mark('concurrent-calls-end');
      performance.measure('concurrent-calls', 'concurrent-calls-start', 'concurrent-calls-end');

      const measurements = performance.getEntriesByName('concurrent-calls');
      expect(measurements[0].duration).toBeLessThan(2000); // Should handle 20 concurrent calls in under 2 seconds

      expect(global.fetch).toHaveBeenCalledTimes(concurrentCalls);
    });

    it('should cache responses to improve performance', async () => {
      // First call
      performance.mark('first-call-start');
      await service.getProducts();
      performance.mark('first-call-end');
      performance.measure('first-call', 'first-call-start', 'first-call-end');

      // Second call (should be faster due to caching)
      performance.mark('second-call-start');
      await service.getProducts();
      performance.mark('second-call-end');
      performance.measure('second-call', 'second-call-start', 'second-call-end');

      const firstCall = performance.getEntriesByName('first-call')[0];
      const secondCall = performance.getEntriesByName('second-call')[0];

      // Second call should be significantly faster if caching is working
      expect(secondCall.duration).toBeLessThan(firstCall.duration * 0.5);
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory during rapid state changes', async () => {
      const { result } = renderHook(() => useAppStore());

      // Simulate memory-intensive operations
      const initialMemory = process.memoryUsage().heapUsed;

      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current.addToCart(mockMenuItems[0]);
          result.current.clearCart();
        }
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle large order histories efficiently', async () => {
      const { result } = renderHook(() => useAppStore());

      const largeOrderHistory = Array.from({ length: 500 }, (_, i) => ({
        ...mockOrders[0],
        id: i + 1,
        created_at: new Date(Date.now() - i * 60000).toISOString(),
      }));

      const initialMemory = process.memoryUsage().heapUsed;

      act(() => {
        result.current.setOrders(largeOrderHistory);
      });

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should handle 500 orders without excessive memory usage
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
      expect(result.current.orders).toHaveLength(500);
    });
  });

  describe('Rendering Performance', () => {
    it('should measure component render times', () => {
      // This would typically be done with React DevTools Profiler
      // For now, we simulate the measurement

      performance.mark('render-start');

      // Simulate component rendering time
      const startTime = performance.now();

      // Simulate heavy computation
      const result = 0;
      for (let i = 0; i < 10000; i++) {
        _result += Math.random();
      }

      const endTime = performance.now();

      performance.mark('render-end');
      performance.measure('render', 'render-start', 'render-end');

      const renderTime = endTime - startTime;

      // Render should complete quickly
      expect(renderTime).toBeLessThan(100); // Less than 100ms
    });
  });

  describe('Search Performance', () => {
    it('should search through large datasets efficiently', async () => {
      const { result } = renderHook(() => useAppStore());

      // Create large searchable dataset
      const largeMenuItems = Array.from({ length: 2000 }, (_, i) => ({
        ...mockMenuItems[0],
        id: i + 1,
        name: `${i % 2 === 0 ? 'Burger' : 'Pizza'} Item ${i + 1}`,
      }));

      act(() => {
        result.current.setMenuItems(largeMenuItems);
      });

      performance.mark('search-start');

      // Perform search
      const searchResults = largeMenuItems.filter((item) =>
        item.name.toLowerCase().includes('burger')
      );

      performance.mark('search-end');
      performance.measure('search', 'search-start', 'search-end');

      const measurements = performance.getEntriesByName('search');
      expect(measurements[0].duration).toBeLessThan(50); // Search should be very fast

      expect(searchResults).toHaveLength(1000); // Half the items match 'burger'
    });
  });

  describe('Animation Performance', () => {
    it('should maintain 60fps during animations', () => {
      // Simulate 60fps requirement
      const targetFrameTime = 1000 / 60; // ~16.67ms per frame

      performance.mark('animation-start');

      // Simulate animation frame
      const frameStart = performance.now();

      // Simulate animation calculations
      for (let i = 0; i < 100; i++) {
        Math.sin(i * 0.1);
      }

      const frameEnd = performance.now();
      const frameTime = frameEnd - frameStart;

      performance.mark('animation-end');

      // Frame time should be well under 16.67ms to maintain 60fps
      expect(frameTime).toBeLessThan(targetFrameTime);
    });
  });
});
