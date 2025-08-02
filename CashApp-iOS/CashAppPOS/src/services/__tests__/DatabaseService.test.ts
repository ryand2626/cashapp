/**
 * Unit Tests for DatabaseService
 * Testing API interactions, error handling, and data management
 */

import { mockApiResponses, mockMenuItems, mockCategories } from '../../__tests__/fixtures/mockData';
import { createMockFetch } from '../../__tests__/utils/testUtils';
import DatabaseService from '../DatabaseService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock fetch globally
global.fetch = jest.fn();

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(() => {
    service = DatabaseService.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();

      // Both should reference the same object
      expect(instance1).toEqual(instance2);
    });
  });

  describe('Authentication', () => {
    it('should login successfully with valid credentials', async () => {
      const mockFetch = createMockFetch([mockApiResponses.loginSuccess]);
      global.fetch = mockFetch;

      const result = await service.login('test@example.com', 'password123');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/web/session/authenticate'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should fail login with invalid credentials', async () => {
      const mockFetch = createMockFetch([mockApiResponses.loginFailure]);
      global.fetch = mockFetch;

      const result = await service.login('wrong@example.com', 'wrongpassword');

      expect(result).toBe(false);
    });

    it('should handle network errors during login', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.login('test@example.com', 'password123');

      expect(result).toBe(false);
    });

    it('should logout successfully', async () => {
      const mockFetch = createMockFetch([{ ok: true }]);
      global.fetch = mockFetch;

      await service.logout();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/web/session/destroy'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle logout errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // Should not throw error
      await expect(service.logout()).resolves.toBeUndefined();
    });
  });

  describe('Products API', () => {
    it('should fetch products successfully', async () => {
      const mockFetch = createMockFetch([mockApiResponses.productsSuccess]);
      global.fetch = mockFetch;

      const products = await service.getProducts();

      expect(products).toEqual(mockMenuItems);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/products/mobile'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should return mock data when API fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));

      const products = await service.getProducts();

      // Should return mock data as fallback
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
      expect(products[0]).toHaveProperty('id');
      expect(products[0]).toHaveProperty('name');
      expect(products[0]).toHaveProperty('price');
    });

    it('should fetch products by category', async () => {
      const mockFetch = createMockFetch([mockApiResponses.productsSuccess]);
      global.fetch = mockFetch;

      const _products = await service.getProductsByCategory(1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/products/category/1'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should handle empty products response', async () => {
      const mockFetch = createMockFetch([{ success: true, data: [] }]);
      global.fetch = mockFetch;

      const products = await service.getProducts();

      expect(products).toEqual([]);
    });
  });

  describe('Categories API', () => {
    it('should fetch categories successfully', async () => {
      const mockFetch = createMockFetch([mockApiResponses.categoriesSuccess]);
      global.fetch = mockFetch;

      const categories = await service.getCategories();

      expect(categories).toEqual(mockCategories);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/categories'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should return mock categories when API fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));

      const categories = await service.getCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0]).toHaveProperty('id');
      expect(categories[0]).toHaveProperty('name');
    });
  });

  describe('Session Management', () => {
    it('should get current session', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 1,
          name: 'Test Session',
          state: 'opened',
          user_id: 1,
        },
      };
      const mockFetch = createMockFetch([mockResponse]);
      global.fetch = mockFetch;

      const session = await service.getCurrentSession();

      expect(session).toEqual(mockResponse.data);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/pos/sessions/current'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should create new session', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 2,
          name: 'New Session',
          state: 'opened',
          config_id: 1,
        },
      };
      const mockFetch = createMockFetch([mockResponse]);
      global.fetch = mockFetch;

      const session = await service.createSession(1);

      expect(session).toEqual(mockResponse.data);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/pos/sessions'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ config_id: 1 }),
        })
      );
    });

    it('should handle session creation failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Session creation failed'));

      const session = await service.createSession(1);

      expect(session).toBeNull();
    });
  });

  describe('Order Management', () => {
    it('should create order successfully', async () => {
      const mockOrder = {
        items: [{ product_id: 1, quantity: 2 }],
        table_id: 5,
      };
      const mockResponse = {
        success: true,
        data: {
          id: 1,
          ...mockOrder,
          date_order: expect.any(String),
          state: 'draft',
        },
      };
      const mockFetch = createMockFetch([mockResponse]);
      global.fetch = mockFetch;

      const order = await service.createOrder(mockOrder);

      expect(order).toEqual(mockResponse.data);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/orders'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should update order successfully', async () => {
      const updates = { state: 'confirmed' };
      const mockResponse = {
        success: true,
        data: { id: 1, state: 'confirmed' },
      };
      const mockFetch = createMockFetch([mockResponse]);
      global.fetch = mockFetch;

      const order = await service.updateOrder(1, updates);

      expect(order).toEqual(mockResponse.data);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/orders/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updates),
        })
      );
    });

    it('should fetch recent orders', async () => {
      const mockResponse = {
        success: true,
        data: [{ id: 1 }, { id: 2 }],
      };
      const mockFetch = createMockFetch([mockResponse]);
      global.fetch = mockFetch;

      const orders = await service.getRecentOrders(10);

      expect(orders).toEqual(mockResponse.data);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/orders/recent?limit=10'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should use default limit for recent orders', async () => {
      const mockFetch = createMockFetch([{ success: true, data: [] }]);
      global.fetch = mockFetch;

      await service.getRecentOrders();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'), // Default limit
        expect.any(Object)
      );
    });
  });

  describe('Payment Processing', () => {
    it('should process payment successfully', async () => {
      const mockFetch = createMockFetch([mockApiResponses.paymentSuccess]);
      global.fetch = mockFetch;

      const result = await service.processPayment(1, 'card', 25.99);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/payments'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            order_id: 1,
            payment_method: 'card',
            amount: 25.99,
          }),
        })
      );
    });

    it('should handle payment failure', async () => {
      const mockFetch = createMockFetch([mockApiResponses.paymentFailure]);
      global.fetch = mockFetch;

      const result = await service.processPayment(1, 'card', 25.99);

      expect(result).toBe(false);
    });

    it('should handle payment processing errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Payment error'));

      const result = await service.processPayment(1, 'card', 25.99);

      expect(result).toBe(false);
    });
  });

  describe('Offline Data Sync', () => {
    it('should sync offline data when available', async () => {
      // Mock AsyncStorage with offline orders
      import mockAsyncStorage from '@react-native-async-storage/async-storage';
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify([
          { items: [{ product_id: 1, quantity: 1 }] },
          { items: [{ product_id: 2, quantity: 2 }] },
        ])
      );

      const mockFetch = createMockFetch([
        { success: true, data: { id: 1 } },
        { success: true, data: { id: 2 } },
      ]);
      global.fetch = mockFetch;

      await service.syncOfflineData();

      // Should create orders for each offline order
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('offline_orders');
    });

    it('should handle sync when no offline data exists', async () => {
      import mockAsyncStorage from '@react-native-async-storage/async-storage';
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await service.syncOfflineData();

      // Should not make any API calls
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      import mockAsyncStorage from '@react-native-async-storage/async-storage';
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      // Should not throw error
      await expect(service.syncOfflineData()).resolves.toBeUndefined();
    });
  });

  describe('API Request Helper', () => {
    it('should include authentication headers when token is available', async () => {
      // Set auth token
      const mockAsyncStorage = require('@react-native-async-storage/async-storage');
      mockAsyncStorage.getItem.mockResolvedValue('test-token-123');

      // Reinitialize service to load token
      service = DatabaseService.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for token loading

      const mockFetch = createMockFetch([{ success: true, data: [] }]);
      global.fetch = mockFetch;

      await service.getProducts();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should handle HTTP error responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const products = await service.getProducts();

      // Should fall back to mock data
      expect(Array.isArray(products)).toBe(true);
    });

    it('should handle malformed JSON responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const products = await service.getProducts();

      // Should fall back to mock data
      expect(Array.isArray(products)).toBe(true);
    });
  });
});
