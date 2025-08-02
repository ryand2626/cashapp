// DataService.ts - Unified data service with mock/real data switching
import AsyncStorage from '@react-native-async-storage/async-storage';

import API_CONFIG from '../config/api';
// TODO: Unused import - import { AUTH_CONFIG } from '../config/auth.config';
import { envBool, IS_DEV } from '../env';
// TODO: Unused import - import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { logger } from '../utils/logger';
import tokenManager from '../utils/tokenManager';

import APITestingService from './APITestingService';
import authInterceptor from './auth/AuthInterceptor';
import BackendCompatibilityService from './BackendCompatibilityService';
import DatabaseService from './DatabaseService';

// Feature flags for controlling data sources
export interface FeatureFlags {
  USE_REAL_API: boolean;
  TEST_API_MODE: boolean;
  ENABLE_PAYMENTS: boolean;
  ENABLE_HARDWARE: boolean;
  SHOW_DEV_MENU: boolean;
  MOCK_AUTHENTICATION: boolean;
}

// -----------------------------------------------------------------------------
// Stage-0 default flags
// – Keep EXACTLY the same behaviour as today so CI stays green.
// – Each flag first checks an env variable so we can flip them in future stages
//   without code changes.
// -----------------------------------------------------------------------------
const DEFAULT_FLAGS: FeatureFlags = {
  USE_REAL_API: envBool('USE_REAL_API', true), // Should use real API with seed data
  TEST_API_MODE: envBool('TEST_API_MODE', false), // Default to false for production
  ENABLE_PAYMENTS: envBool('ENABLE_PAYMENTS', false),
  ENABLE_HARDWARE: envBool('ENABLE_HARDWARE', false),
  SHOW_DEV_MENU: envBool('SHOW_DEV_MENU', IS_DEV),
  MOCK_AUTHENTICATION: envBool('MOCK_AUTHENTICATION', false), // Default to false for production
};

/**
 * DataService - Unified service that intelligently switches between mock and real data
 *
 * This allows us to:
 * 1. Keep beautiful mock data for client demos
 * 2. Gradually implement real API integration
 * 3. Fall back to mock data if API fails
 * 4. Test both modes in parallel
 */
class DataService {
  private static instance: DataService;
  private featureFlags: FeatureFlags = DEFAULT_FLAGS;
  private databaseService: DatabaseService;
  private apiTestingService: APITestingService;
  private isBackendAvailable: boolean = false;
  private db: ReturnType<typeof DatabaseService.getInstance>;

  constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.apiTestingService = APITestingService.getInstance();
    this.loadFeatureFlags();
    this.checkBackendAvailability();
    this.db = DatabaseService.getInstance();

    // Configure authInterceptor with base URL
    authInterceptor.configure({
      baseURL: API_CONFIG.FULL_API_URL,
      excludePaths: ['/auth/login', '/auth/register', '/health'], // Public endpoints
    });
  }

  static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  // Feature flag management
  private async loadFeatureFlags(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('feature_flags');
      if (stored) {
        this.featureFlags = { ...DEFAULT_FLAGS, ...JSON.parse(stored) };
      }
    } catch (_error) {
      logger.info('Using default feature flags');
    }
  }

  async updateFeatureFlag(flag: keyof FeatureFlags, value: boolean): Promise<void> {
    this.featureFlags[flag] = value;
    await AsyncStorage.setItem('feature_flags', JSON.stringify(this.featureFlags));
  }

  // Helper method to get auth token using unified token manager
  private async getAuthToken(): Promise<string | null> {
    return await tokenManager.getTokenWithRefresh();
  }

  getFeatureFlags(): FeatureFlags {
    return { ...this.featureFlags };
  }

  // API Testing Service access
  getAPITestingService(): APITestingService {
    return this.apiTestingService;
  }

  // Test API endpoint in background without affecting UI
  private async testAPIEndpoint(
    endpoint: string,
    method: string = 'GET',
    data?: unknown
  ): Promise<void> {
    if (this.featureFlags.TEST_API_MODE) {
      try {
        await this.apiTestingService.testEndpoint(endpoint, method, data);
      } catch (error) {
        logger.info(`API test failed for ${endpoint}:`, error);
      }
    }
  }

  // Get backend availability status for UI
  isBackendConnected(): boolean {
    return this.isBackendAvailable;
  }

  // Force check backend availability
  async forceCheckBackend(): Promise<boolean> {
    await this.checkBackendAvailability();
    return this.isBackendAvailable;
  }

  // Backend availability check - Enhanced with API testing support
  private async checkBackendAvailability(): Promise<void> {
    if (!this.featureFlags.USE_REAL_API && !this.featureFlags.TEST_API_MODE) {
      return;
    }

    try {
      // Use AbortController for timeout instead of timeout property
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${API_CONFIG.BASE_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);
      const wasAvailable = this.isBackendAvailable;
      this.isBackendAvailable = response.ok;

      // Test health endpoint when in test mode
      if (this.featureFlags.TEST_API_MODE && this.isBackendAvailable) {
        await this.testAPIEndpoint('/health');
      }

      // Log status changes
      if (wasAvailable !== this.isBackendAvailable) {
        logger.info(
          `Backend status changed: ${this.isBackendAvailable ? 'Available' : 'Unavailable'}`
        );
      }
    } catch (_error) {
      this.isBackendAvailable = false;
      logger.info('Backend not available, using mock data');

      // Still test the endpoint in test mode to record the failure
      if (this.featureFlags.TEST_API_MODE) {
        await this.testAPIEndpoint('/health');
      }
    }

    // Recheck every 30 seconds
    setTimeout(() => this.checkBackendAvailability(), 30000);
  }

  // Authentication methods - Updated to use Supabase
  async login(username: string, password: string): Promise<boolean> {
    // Always use Supabase authentication now
    try {
      const authStore = useAuthStore.getState();
      await authStore.signIn(username, password);
      return true;
    } catch (error) {
      logger.error('Supabase login failed:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      const authStore = useAuthStore.getState();
      await authStore.signOut();
    } catch (error) {
      logger.error('Logout failed:', error);
    }
    // Clear any legacy tokens
    await AsyncStorage.multiRemove(['auth_token', 'user_data']);
  }

  // Product operations
  async getProducts(): Promise<any[]> {
    // Test products endpoint in background when in test mode
    if (this.featureFlags.TEST_API_MODE) {
      await this.testAPIEndpoint('/api/v1/products/mobile');
    }

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const products = await this.db.getProducts();
        if (products && products.length > 0) {
          return products;
        }
      } catch (_error) {
        logger.info('Failed to fetch products from API, using mock data');
      }
    }
    return this.db.getProducts();
  }

  async getProductsByCategory(categoryId: number): Promise<any[]> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.getProductsByCategory(categoryId);
      } catch (_error) {
        logger.info('Failed to fetch products by category, using mock data');
      }
    }
    return this.db.getProductsByCategory(categoryId);
  }

  // Category operations
  async getCategories(): Promise<any[]> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const categories = await this.db.getCategories();
        if (!categories) {
          logger.warn('⚠️ API returned null/undefined categories');
          return [];
        }
        logger.info('✅ Loaded categories from API:', categories.length);
        return categories;
      } catch (error) {
        logger.error('❌ Failed to fetch categories from API:', error);
        throw error;
      }
    }

    if (!this.featureFlags.USE_REAL_API) {
      throw new Error('Real API is disabled. Enable USE_REAL_API flag to access category data.');
    } else {
      throw new Error('Backend service unavailable. Please check your connection and try again.');
    }
  }

  // Menu operations - Get complete menu with items and categories
  async getMenuItems(): Promise<any[]> {
    // Test menu endpoint in background when in test mode
    if (this.featureFlags.TEST_API_MODE) {
      await this.testAPIEndpoint('/api/v1/menu/items');
    }

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const menuItems = await this.db.getMenuItems();
        if (menuItems && menuItems.length > 0) {
          // Apply compatibility transformation if needed
          if (BackendCompatibilityService.needsMenuTransformation(menuItems)) {
            logger.info('🔄 Applying menu compatibility transformation');
            return BackendCompatibilityService.transformMenuItems(menuItems);
          }
          return menuItems;
        }
      } catch (_error) {
        logger.info('Failed to fetch menu items from API, using mock data');
      }
    }
    return this.db.getMenuItems();
  }

  async getMenuCategories(): Promise<any[]> {
    // Test menu categories endpoint in background when in test mode
    if (this.featureFlags.TEST_API_MODE) {
      await this.testAPIEndpoint('/api/v1/menu/categories');
    }

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const categories = await this.db.getMenuCategories();
        if (categories && categories.length > 0) {
          return categories;
        }
      } catch (_error) {
        logger.info('Failed to fetch menu categories from API, using mock data');
      }
    }
    return this.db.getMenuCategories();
  }

  // Category CRUD operations
  async createCategory(categoryData: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    sort_order?: number;
  }): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const result = await this.db.createCategory(categoryData);
        logger.info('✅ Category created via API:', result);
        return result;
      } catch (error) {
        logger.error('❌ API category creation failed:', error);
        throw error;
      }
    }
    if (!this.featureFlags.USE_REAL_API) {
      throw new Error('Real API is disabled. Enable USE_REAL_API flag to create categories.');
    } else {
      throw new Error('Backend service unavailable. Please check your connection and try again.');
    }
  }

  async updateCategory(
    categoryId: string,
    categoryData: Partial<{
      name: string;
      description?: string;
      color?: string;
      icon?: string;
      sort_order?: number;
      is_active?: boolean;
    }>
  ): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const result = await this.db.updateCategory(categoryId, categoryData);
        logger.info('✅ Category updated via API:', result);
        return result;
      } catch (error) {
        logger.error('❌ API category update failed:', error);
        throw error;
      }
    }
    if (!this.featureFlags.USE_REAL_API) {
      throw new Error('Real API is disabled. Enable USE_REAL_API flag to update categories.');
    } else {
      throw new Error('Backend service unavailable. Please check your connection and try again.');
    }
  }

  async deleteCategory(categoryId: string): Promise<void> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        await this.db.deleteCategory(categoryId);
        logger.info('✅ Category deleted via API:', categoryId);
        return;
      } catch (error) {
        logger.error('❌ API category deletion failed:', error);
        throw error;
      }
    }
    if (!this.featureFlags.USE_REAL_API) {
      throw new Error('Real API is disabled. Enable USE_REAL_API flag to delete categories.');
    } else {
      throw new Error('Backend service unavailable. Please check your connection and try again.');
    }
  }

  // Product CRUD operations
  async createProduct(productData: {
    category_id: string;
    name: string;
    description?: string;
    price: number;
    cost?: number;
    image_url?: string;
    barcode?: string;
    sku?: string;
    prep_time?: number;
    dietary_info?: string[];
    modifiers?: unknown[];
    stock_tracking?: boolean;
    stock_quantity?: number;
  }): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.createProduct(productData);
      } catch (error) {
        logger.error('Failed to create product:', error);
        throw error;
      }
    }
    if (!this.featureFlags.USE_REAL_API) {
      throw new Error('Real API is disabled. Enable USE_REAL_API flag to create products.');
    } else {
      throw new Error('Backend service unavailable. Please check your connection and try again.');
    }
  }

  async updateProduct(
    productId: string,
    productData: Partial<{
      category_id?: string;
      name?: string;
      description?: string;
      price?: number;
      cost?: number;
      image_url?: string;
      barcode?: string;
      sku?: string;
      prep_time?: number;
      dietary_info?: string[];
      modifiers?: unknown[];
      stock_tracking?: boolean;
      stock_quantity?: number;
      is_active?: boolean;
    }>
  ): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.updateProduct(productId, productData);
      } catch (error) {
        logger.error('Failed to update product:', error);
        throw error;
      }
    }
    if (!this.featureFlags.USE_REAL_API) {
      throw new Error('Real API is disabled. Enable USE_REAL_API flag to update products.');
    } else {
      throw new Error('Backend service unavailable. Please check your connection and try again.');
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        await this.db.deleteProduct(productId);
      } catch (error) {
        logger.error('Failed to delete product:', error);
        throw error;
      }
    } else {
      if (!this.featureFlags.USE_REAL_API) {
        throw new Error('Real API is disabled. Enable USE_REAL_API flag to delete products.');
      } else {
        throw new Error('Backend service unavailable. Please check your connection and try again.');
      }
    }
  }

  // Order operations
  async createOrder(order: unknown): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const result = await this.db.createOrder(order);
        if (result) return result;
      } catch (_error) {
        logger.info('Failed to create order via API, using mock');
      }
    }
    return this.db.createOrder(order);
  }

  async updateOrder(orderId: number, updates: unknown): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.updateOrder(orderId, updates);
      } catch (_error) {
        logger.info('Failed to update order via API');
      }
    }
    return this.db.updateOrder(orderId, updates);
  }

  async getRecentOrders(limit: number = 20): Promise<any[]> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const orders = await this.db.getRecentOrders(limit);
        if (orders && orders.length > 0) {
          return orders;
        }
      } catch (_error) {
        logger.info('Failed to fetch orders from API, using mock data');
      }
    }
    return this.db.getRecentOrders(limit);
  }

  // Payment processing - PHASE 3: Fix SumUp integration
  async processPayment(orderId: number, paymentMethod: string, amount: number): Promise<boolean> {
    // Test payment endpoint in background when in test mode
    if (this.featureFlags.TEST_API_MODE) {
      await this.testAPIEndpoint('/api/v1/payments/process', 'POST', {
        orderId,
        paymentMethod,
        amount,
      });
    }

    if (
      this.featureFlags.ENABLE_PAYMENTS &&
      this.featureFlags.USE_REAL_API &&
      this.isBackendAvailable
    ) {
      try {
        logger.info(`Processing real payment: ${paymentMethod} for £${amount} (Order: ${orderId})`);
        const result = await this.db.processPayment(orderId, paymentMethod, amount);

        if (result) {
          logger.info('✅ Real payment processed successfully');
          return true;
        } else {
          logger.info('❌ Real payment failed - no result returned');
          throw new Error('Payment processing failed');
        }
      } catch (error) {
        logger.info('❌ Real payment failed, falling back to mock:', error);
        // Don't fall back for payment processing - we want to see the real error
        throw error;
      }
    }

    // If payments disabled or no backend, simulate success for demo
    if (!this.featureFlags.ENABLE_PAYMENTS) {
      logger.info(`🎭 Demo mode payment: ${paymentMethod} for £${amount}`);
      return this.db.processPayment(orderId, paymentMethod, amount);
    }

    // Fallback to mock if no backend available
    logger.info(`⚠️  No backend available, using mock payment: ${paymentMethod} for £${amount}`);
    return this.db.processPayment(orderId, paymentMethod, amount);
  }

  // Restaurant operations
  async getRestaurantFloorPlan(sectionId?: string | null): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const floorPlan = await this.db.getRestaurantFloorPlan(sectionId ?? undefined);
        if (floorPlan && floorPlan.tables && floorPlan.tables.length > 0) {
          return floorPlan;
        }
      } catch (_error) {
        logger.info('Failed to fetch floor plan from API, using mock data');
      }
    }
    return this.db.getRestaurantFloorPlan(sectionId ?? undefined);
  }

  async updateTableStatus(
    tableId: string,
    status: string,
    additionalData?: unknown
  ): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.updateTableStatus(tableId, status, additionalData);
      } catch (_error) {
        logger.info('Failed to update table status via API');
      }
    }
    return this.db.updateTableStatus(tableId, status, additionalData);
  }

  // Analytics and Reporting
  async getDailySalesReport(date?: string): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const report = await this.db.getDailySalesReport(date);
        if (report && report.summary) {
          return report;
        }
      } catch (_error) {
        logger.info('Failed to fetch daily report from API, using mock data');
      }
    }
    return this.db.getDailySalesReport(date);
  }

  async getSalesSummary(dateFrom?: string, dateTo?: string): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const summary = await this.db.getSalesSummary(dateFrom ?? undefined, dateTo ?? undefined);
        if (summary && summary.summary) {
          return summary;
        }
      } catch (_error) {
        logger.info('Failed to fetch sales summary from API, using mock data');
      }
    }
    return this.db.getSalesSummary(dateFrom ?? undefined, dateTo ?? undefined);
  }

  // Session management
  async getCurrentSession(): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.getCurrentSession();
      } catch (_error) {
        logger.info('Failed to get session from API');
      }
    }
    return this.db.getCurrentSession();
  }

  async createSession(configId: number): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.createSession(configId);
      } catch (_error) {
        logger.info('Failed to create session via API');
      }
    }
    return this.db.createSession(configId);
  }

  // Hardware operations (always mock for now)
  async printReceipt(order: unknown): Promise<boolean> {
    if (this.featureFlags.ENABLE_HARDWARE) {
      logger.info('Hardware printing not yet implemented');
    }
    return this.db.printReceipt(order);
  }

  async openCashDrawer(): Promise<boolean> {
    if (this.featureFlags.ENABLE_HARDWARE) {
      logger.info('Hardware cash drawer not yet implemented');
    }
    return this.db.openCashDrawer();
  }

  async scanBarcode(): Promise<string | null> {
    if (this.featureFlags.ENABLE_HARDWARE) {
      logger.info('Hardware barcode scanning not yet implemented');
    }
    return this.db.scanBarcode();
  }

  // Sync and offline support
  async syncOfflineData(): Promise<void> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      await this.db.syncOfflineData();
    }
    // Also sync mock data if needed
    await this.db.syncOfflineData();
  }

  // Development utilities
  async resetToMockData(): Promise<void> {
    await this.updateFeatureFlag('USE_REAL_API', false);
    await this.updateFeatureFlag('ENABLE_PAYMENTS', false);
    await this.updateFeatureFlag('ENABLE_HARDWARE', false);
    logger.info('Reset to mock data mode');
  }

  async enableRealAPI(): Promise<void> {
    await this.updateFeatureFlag('USE_REAL_API', true);
    await this.checkBackendAvailability();
    logger.info('Enabled real API mode');
  }

  getConnectionStatus(): { mode: string; backend: boolean; flags: FeatureFlags } {
    return {
      mode: this.featureFlags.USE_REAL_API ? 'REAL' : 'MOCK',
      backend: this.isBackendAvailable,
      flags: this.getFeatureFlags(),
    };
  }

  // --- Stubs for new methods ---
  // TODO(real API): Implement actual API calls for these methods

  async getCustomers(): Promise<any[]> {
    logger.info('🌐 DataService.getCustomers - fetching from API');

    try {
      const response = await authInterceptor.get(`${API_CONFIG.FULL_API_URL}/customers`);

      if (response.ok) {
        const result = await response.json();
        const customers = result.data || result;
        logger.info(
          '✅ API customers received:',
          Array.isArray(customers) ? customers.length : 'not an array'
        );
        return Array.isArray(customers) ? customers : [];
      } else {
        logger.error('❌ API error:', response.status, response.statusText);
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      logger.error('❌ Failed to fetch customers from API:', error);
      throw error; // No fallback - API must work for production readiness
    }
  }

  async getInventory(): Promise<any[]> {
    logger.info('🌐 DataService.getInventory - fetching from API');

    try {
      const inventoryItems = await this.db.getInventoryItems();
      if (inventoryItems && inventoryItems.length >= 0) {
        // Allow empty arrays
        logger.info('✅ API inventory received:', inventoryItems.length, 'items');
        return inventoryItems;
      } else {
        throw new Error('Invalid inventory data received from API');
      }
    } catch (error) {
      logger.error('❌ Failed to fetch inventory from API:', error);
      throw error; // No fallback - API must work for production readiness
    }
  }

  async getEmployees(): Promise<any[]> {
    logger.info('🌐 DataService.getEmployees - fetching from API');

    try {
      const response = await authInterceptor.get(`${API_CONFIG.FULL_API_URL}/employees`);

      if (response.ok) {
        const result = await response.json();
        const employees = result.data || result;
        logger.info(
          '✅ API employees received:',
          Array.isArray(employees) ? employees.length : 'not an array'
        );

        // Apply compatibility transformation if needed
        if (
          Array.isArray(employees) &&
          BackendCompatibilityService.needsEmployeeTransformation(employees)
        ) {
          logger.info('🔄 Applying employee compatibility transformation');
          return BackendCompatibilityService.transformEmployees(employees);
        }

        return Array.isArray(employees) ? employees : [];
      } else {
        logger.error('❌ API error:', response.status, response.statusText);
        throw new Error(`API error: ${response.status} - ${response.statusText}`);
      }
    } catch (error) {
      logger.error('❌ Failed to fetch employees from API:', error);
      logger.warn('🚨 Production Mode: Returning empty employee list instead of mock data');

      // PRODUCTION READY: Return empty array instead of mock data
      // Screens should handle empty state gracefully with EmptyState component
      return [];
    }
  }

  async getWeekSchedule(weekStart: Date, employees: unknown[]): Promise<any | null> {
    logger.info('🌐 DataService.getWeekSchedule - fetching from API', { weekStart });

    try {
      const schedule = await this.db.getWeekSchedule(weekStart, employees);
      logger.info('✅ API schedule received:', schedule?.shifts?.length || 0, 'shifts');
      return schedule;
    } catch (error) {
      logger.error('❌ Failed to fetch schedule from API:', error);
      throw error; // No fallback - API must work for production readiness
    }
  }

  async getOrders(dateRange: string): Promise<any[]> {
    logger.info('DataService.getOrders called', {
      dateRange,
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable,
    });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        logger.info('🌐 Attempting to fetch orders from API...');
        const authToken = await this.getAuthToken();
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/orders?date_range=${dateRange}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
        });

        if (response.ok) {
          const result = await response.json();
          const orders = result.data || result;
          logger.info(
            '✅ API orders received:',
            Array.isArray(orders) ? orders.length : 'not an array'
          );
          return Array.isArray(orders) ? orders : [];
        } else {
          logger.error('❌ API error:', response.status, response.statusText);
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        logger.error('❌ Failed to fetch orders from API:', error);
        throw error; // No fallback - API must work for production readiness
      }
    }
  }

  async getFinancialReportDetail(period: string): Promise<any | null> {
    logger.info('DataService.getFinancialReportDetail called', {
      period,
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable,
    });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        logger.info('🌐 Attempting to fetch financial data from API...');
        const authToken = await this.getAuthToken();
        const response = await fetch(
          `${API_CONFIG.FULL_API_URL}/analytics/financial?period=${period}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          const financialData = result.data || result; // Handle both wrapped and unwrapped responses
          logger.info('✅ API financial data received');
          return financialData;
        } else {
          logger.error('❌ API error:', response.status, response.statusText);
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        logger.error('❌ Failed to fetch financial data from API:', error);
        throw error; // No fallback - API must work for production readiness
      }
    }
  }

  async getSalesReportDetail(period: string): Promise<any[]> {
    logger.info('🌐 DataService.getSalesReportDetail - fetching from API', { period });

    try {
      const authToken = await this.getAuthToken();
      const response = await fetch(
        `${API_CONFIG.FULL_API_URL}/analytics/sales?timeframe=${period}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        const salesData = result.data || result;

        // Transform API data to match frontend SalesData[] interface
        if (salesData && !Array.isArray(salesData)) {
          // Convert API format to SalesData array format
          const transformedData = this.transformApiDataToArray(salesData, period);
          logger.info('✅ API sales data transformed for frontend');
          return transformedData;
        } else if (Array.isArray(salesData)) {
          logger.info('✅ API sales data received in array format');
          return salesData;
        } else {
          throw new Error('Invalid sales data format received from API');
        }
      } else {
        logger.error('❌ API error:', response.status, response.statusText);
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      logger.error('❌ Failed to fetch sales data from API:', error);
      throw error; // No fallback - API must work for production readiness
    }
  }

  /**
   * Transform API response data to SalesData array format
   * Handles various API response formats and converts to frontend interface
   */
  private transformApiDataToArray(apiData: unknown, _period: string): unknown[] {
    try {
      // If API returns object with sales data, extract it
      if (apiData && typeof apiData === 'object') {
        // Check for common API response patterns
        if (apiData.sales_data && Array.isArray(apiData.sales_data)) {
          return apiData.sales_data;
        }
        if (apiData.sales && Array.isArray(apiData.sales)) {
          return apiData.sales;
        }
        if (apiData.data && Array.isArray(apiData.data)) {
          return apiData.data;
        }

        // Convert single object to array format
        return [apiData];
      }

      // Return empty array if no valid data
      return [];
    } catch (error) {
      logger.error('❌ Error transforming API data:', error);
      return [];
    }
  }

  async getStaffReportDetail(period: string): Promise<any[]> {
    // Should return StaffMember[]
    logger.info('DataService.getStaffReportDetail called', {
      period,
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable,
    });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        logger.info('🌐 Attempting to fetch staff data from API...');
        const authToken = await this.getAuthToken();
        const response = await fetch(
          `${API_CONFIG.FULL_API_URL}/analytics/employees?timeframe=${period}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          const staffData = result.data || result; // Handle both wrapped and unwrapped responses
          logger.info('✅ API staff data received');
          return staffData;
        } else {
          logger.error('❌ API error:', response.status, response.statusText);
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        logger.error('❌ Failed to fetch staff data from API:', error);
        throw error; // No fallback - API must work for production readiness
      }
    }
  }

  async getLaborReport(period: string): Promise<unknown> {
    logger.info('DataService.getLaborReport called', {
      period,
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable,
    });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        logger.info('🌐 Attempting to fetch labor data from API...');
        const authToken = await this.getAuthToken();
        const response = await fetch(
          `${API_CONFIG.FULL_API_URL}/analytics/labor?period=${period}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          const laborData = result.data || result; // Handle both wrapped and unwrapped responses
          logger.info('✅ API labor data received');
          return laborData;
        } else {
          logger.error('❌ API error:', response.status, response.statusText);
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        logger.error('❌ Failed to fetch labor data from API:', error);
        throw error; // No fallback - API must work for production readiness
      }
    }

    // This should never be reached in production
    throw new Error('Labor report requires backend API connection');
  }

  async getReportsDashboardData(): Promise<any | null> {
    logger.info('DataService.getReportsDashboardData called', {
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable,
    });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        logger.info('🌐 Attempting to fetch reports from API...');
        const authToken = await this.getAuthToken();
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/analytics/dashboard/mobile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
        });

        if (response.ok) {
          const result = await response.json();
          const dashboardData = result.data || result; // Handle both wrapped and unwrapped responses
          logger.info('✅ API reports received');
          return dashboardData;
        } else {
          logger.error('❌ API error:', response.status, response.statusText);
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        logger.error('❌ Failed to fetch reports dashboard from API:', error);
        throw error; // No fallback - API must work for production readiness
      }
    }

    // This should never be reached in production
    throw new Error('Reports dashboard requires backend API connection');
  }

  async getUserProfile(): Promise<any | null> {
    logger.warn('DataService.getUserProfile is a stub and not implemented.');
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      // return this.db.getUserProfile();
      throw new Error('DataService.getUserProfile not implemented yet');
    }
    return Promise.resolve({
      id: 1,
      name: 'Default User',
      email: 'user@example.com',
      role: 'admin',
    });
  }

  /**
   * Create a new employee (like a real restaurant would do)
   * This tests the complete flow from frontend → API → database
   */
  async createEmployee(employeeData: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: string;
    hourlyRate?: number;
    startDate?: string;
    permissions?: string[];
  }): Promise<unknown> {
    logger.info('🌐 DataService.createEmployee - creating employee via API', employeeData);

    try {
      const response = await authInterceptor.post(`${API_CONFIG.FULL_API_URL}/employees`, {
        first_name: employeeData.firstName,
        last_name: employeeData.lastName,
        email: employeeData.email,
        phone: employeeData.phone,
        role: employeeData.role,
        hourly_rate: employeeData.hourlyRate,
        start_date: employeeData.startDate,
        permissions: employeeData.permissions || [],
        is_active: true,
      });

      if (response.ok) {
        const result = await response.json();
        const newEmployee = result.data || result;
        logger.info('✅ Employee created successfully:', newEmployee.id);
        return newEmployee;
      } else {
        const errorText = await response.text();
        logger.error('❌ Failed to create employee:', response.status, errorText);
        throw new Error(`Failed to create employee: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      logger.error('❌ Employee creation failed:', error);
      throw new Error(`Employee creation failed: ${error.message}`);
    }
  }

  /**
   * Delete an employee from the system
   */
  async deleteEmployee(employeeId: number | string): Promise<void> {
    logger.info('🌐 DataService.deleteEmployee - deleting employee via API', { employeeId });

    try {
      const response = await authInterceptor.delete(
        `${API_CONFIG.FULL_API_URL}/employees/${employeeId}`
      );

      if (response.ok) {
        logger.info('✅ Employee deleted successfully');
        return;
      } else {
        const errorText = await response.text();
        logger.error('❌ Failed to delete employee:', response.status, errorText);
        throw new Error(`Failed to delete employee: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      logger.error('❌ Employee deletion failed:', error);
      throw new Error(`Employee deletion failed: ${error.message}`);
    }
  }

  async getInventoryReport(): Promise<any[]> {
    logger.info('DataService.getInventoryReport called', {
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable,
    });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        logger.info('🌐 Attempting to fetch inventory data from API...');
        const authToken = await this.getAuthToken();
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/inventory`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
        });

        if (response.ok) {
          const result = await response.json();
          const inventoryData = result.data || result;
          logger.info('✅ API inventory data received');
          return Array.isArray(inventoryData) ? inventoryData : [];
        } else {
          logger.error('❌ API error:', response.status, response.statusText);
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        logger.error('❌ Failed to fetch inventory data from API:', error);
        throw error; // No fallback - API must work for production readiness
      }
    }

    // Throw error if not using real API
    throw new Error('Inventory data requires API connection');
  }

  // ===========================================================================
  // SUBSCRIPTION MANAGEMENT METHODS
  // ===========================================================================

  async getSubscriptionPlans(): Promise<unknown> {
    logger.info('DataService.getSubscriptionPlans called');

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/subscriptions/plans`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
        });

        if (response.ok) {
          const result = await response.json();
          return {
            success: true,
            data: result.data || result,
            message: 'Plans retrieved successfully',
          };
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        logger.error('❌ Failed to fetch subscription plans:', error);
        throw error;
      }
    }

    throw new Error('Subscription plans require API connection');
  }

  async getCurrentSubscription(restaurantId: number): Promise<unknown> {
    logger.info('DataService.getCurrentSubscription called', { restaurantId });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(
          `${API_CONFIG.FULL_API_URL}/subscriptions/current?restaurant_id=${restaurantId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          return {
            success: true,
            data: result.data || result,
            message: 'Subscription retrieved successfully',
          };
        } else if (response.status === 404) {
          return {
            success: false,
            data: null,
            message: 'No active subscription found',
          };
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        logger.error('❌ Failed to fetch current subscription:', error);
        throw error;
      }
    }

    throw new Error('Subscription data requires API connection');
  }

  async createSubscription(subscriptionData: unknown): Promise<unknown> {
    logger.info('DataService.createSubscription called', subscriptionData);

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/subscriptions/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
          body: JSON.stringify(subscriptionData),
        });

        if (response.ok) {
          const result = await response.json();
          return {
            success: true,
            data: result.data || result,
            message: result.message || 'Subscription created successfully',
          };
        } else {
          const errorData = await response.json();
          return {
            success: false,
            data: null,
            message: errorData.message || `Failed to create subscription: ${response.status}`,
          };
        }
      } catch (error) {
        logger.error('❌ Failed to create subscription:', error);
        return {
          success: false,
          data: null,
          message: error.message || 'Failed to create subscription',
        };
      }
    }

    throw new Error('Subscription creation requires API connection');
  }

  async changeSubscriptionPlan(changeData: unknown): Promise<unknown> {
    logger.info('DataService.changeSubscriptionPlan called', changeData);

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/subscriptions/change-plan`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
          body: JSON.stringify(changeData),
        });

        if (response.ok) {
          const result = await response.json();
          return {
            success: true,
            data: result.data || result,
            message: result.message || 'Plan changed successfully',
          };
        } else {
          const errorData = await response.json();
          return {
            success: false,
            data: null,
            message: errorData.message || `Failed to change plan: ${response.status}`,
          };
        }
      } catch (error) {
        logger.error('❌ Failed to change subscription plan:', error);
        return {
          success: false,
          data: null,
          message: error.message || 'Failed to change subscription plan',
        };
      }
    }

    throw new Error('Plan change requires API connection');
  }

  async cancelSubscription(restaurantId: number): Promise<unknown> {
    logger.info('DataService.cancelSubscription called', { restaurantId });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(
          `${API_CONFIG.FULL_API_URL}/subscriptions/cancel?restaurant_id=${restaurantId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          return {
            success: true,
            data: result.data || result,
            message: result.message || 'Subscription cancelled successfully',
          };
        } else {
          const errorData = await response.json();
          return {
            success: false,
            data: null,
            message: errorData.message || `Failed to cancel subscription: ${response.status}`,
          };
        }
      } catch (error) {
        logger.error('❌ Failed to cancel subscription:', error);
        return {
          success: false,
          data: null,
          message: error.message || 'Failed to cancel subscription',
        };
      }
    }

    throw new Error('Subscription cancellation requires API connection');
  }

  async incrementUsage(
    restaurantId: number,
    usageType: string,
    amount: number = 1
  ): Promise<unknown> {
    logger.info('DataService.incrementUsage called', { restaurantId, usageType, amount });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(
          `${API_CONFIG.FULL_API_URL}/subscriptions/usage/increment?restaurant_id=${restaurantId}&usage_type=${usageType}&amount=${amount}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          return {
            success: true,
            data: result.data || result,
            message: result.message || 'Usage incremented successfully',
          };
        } else {
          const errorData = await response.json();
          return {
            success: false,
            data: null,
            message: errorData.message || `Failed to increment usage: ${response.status}`,
          };
        }
      } catch (error) {
        logger.error('❌ Failed to increment usage:', error);
        return {
          success: false,
          data: null,
          message: error.message || 'Failed to increment usage',
        };
      }
    }

    throw new Error('Usage tracking requires API connection');
  }
}

export default DataService;
