// APITestingService.ts - Frontend API testing without affecting demo data
import AsyncStorage from '@react-native-async-storage/async-storage';

import API_CONFIG from '../config/api';

// API Test Result Interface
export interface APITestResult {
  endpoint: string;
  method: string;
  success: boolean;
  status?: number;
  response?: unknown;
  error?: string;
  timestamp: Date;
  responseTime?: number;
}

// API Test Suite Interface
export interface APITestSuite {
  name: string;
  tests: APITestResult[];
  overallSuccess: boolean;
  timestamp: Date;
}

/**
 * APITestingService - Test backend APIs without affecting demo data
 *
 * This service allows us to:
 * 1. Test real API endpoints independently
 * 2. Keep mock data intact for demos
 * 3. Validate backend response formats
 * 4. Generate API compatibility reports
 */
class APITestingService {
  private static instance: APITestingService;
  private baseUrl = API_CONFIG.BASE_URL;
  private testResults: APITestResult[] = [];
  private testSuites: APITestSuite[] = [];

  constructor() {
    this.loadTestHistory();
  }

  static getInstance(): APITestingService {
    if (!APITestingService.instance) {
      APITestingService.instance = new APITestingService();
    }
    return APITestingService.instance;
  }

  // Test individual API endpoint
  async testEndpoint(
    endpoint: string,
    method: string = 'GET',
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<APITestResult> {
    const startTime = Date.now();
    const url = `${this.baseUrl}${endpoint}`;

    const testResult: APITestResult = {
      endpoint,
      method,
      success: false,
      timestamp: new Date(),
    };

    try {
      const requestOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...headers,
        },
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        requestOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, requestOptions);
      const endTime = Date.now();

      testResult.status = response.status;
      testResult.responseTime = endTime - startTime;

      try {
        testResult.response = await response.json();
      } catch {
        testResult.response = await response.text();
      }

      testResult.success = response.ok;

      if (!response.ok) {
        testResult.error = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (error) {
      const endTime = Date.now();
      testResult.responseTime = endTime - startTime;
      testResult.error = error instanceof Error ? error.message : 'Unknown error';
      testResult.success = false;
    }

    this.testResults.push(testResult);
    await this.saveTestHistory();
    return testResult;
  }

  // Test authentication flow
  async testAuthenticationFlow(): Promise<APITestSuite> {
    const suite: APITestSuite = {
      name: 'Authentication Flow',
      tests: [],
      overallSuccess: true,
      timestamp: new Date(),
    };

    // Test health endpoint first
    const healthTest = await this.testEndpoint('/health');
    suite.tests.push(healthTest);

    // Test login endpoint
    const loginTest = await this.testEndpoint('/api/v1/auth/login', 'POST', {
      email: 'test@example.com',
      password: 'password123',
    });
    suite.tests.push(loginTest);

    // Test logout endpoint (if login was successful)
    if (loginTest.success && loginTest.response?.data?.access_token) {
      const logoutTest = await this.testEndpoint('/api/v1/auth/logout', 'POST', null, {
        Authorization: `Bearer ${loginTest.response.data.access_token}`,
      });
      suite.tests.push(logoutTest);
    }

    suite.overallSuccess = suite.tests.every((test) => test.success);
    this.testSuites.push(suite);
    return suite;
  }

  // Test products endpoints
  async testProductsEndpoints(): Promise<APITestSuite> {
    const suite: APITestSuite = {
      name: 'Products API',
      tests: [],
      overallSuccess: true,
      timestamp: new Date(),
    };

    // Test mobile products endpoint
    const mobileProductsTest = await this.testEndpoint('/api/v1/products/mobile');
    suite.tests.push(mobileProductsTest);

    // Test categories endpoint
    const categoriesTest = await this.testEndpoint('/api/v1/categories');
    suite.tests.push(categoriesTest);

    // Test products by category (if categories exist)
    if (categoriesTest.success && categoriesTest.response?.data?.length > 0) {
      const firstCategoryId = categoriesTest.response.data[0].id;
      const categoryProductsTest = await this.testEndpoint(
        `/api/v1/products/category/${firstCategoryId}`
      );
      suite.tests.push(categoryProductsTest);
    }

    suite.overallSuccess = suite.tests.every((test) => test.success);
    this.testSuites.push(suite);
    return suite;
  }

  // Test POS sessions endpoints
  async testPOSSessionsEndpoints(): Promise<APITestSuite> {
    const suite: APITestSuite = {
      name: 'POS Sessions API',
      tests: [],
      overallSuccess: true,
      timestamp: new Date(),
    };

    // Test current session endpoint
    const currentSessionTest = await this.testEndpoint('/api/v1/pos/sessions/current');
    suite.tests.push(currentSessionTest);

    // Test create session endpoint
    const createSessionTest = await this.testEndpoint('/api/v1/pos/sessions', 'POST', {
      config_id: 1,
    });
    suite.tests.push(createSessionTest);

    suite.overallSuccess = suite.tests.every((test) => test.success);
    this.testSuites.push(suite);
    return suite;
  }

  // Test restaurant endpoints
  async testRestaurantEndpoints(): Promise<APITestSuite> {
    const suite: APITestSuite = {
      name: 'Restaurant API',
      tests: [],
      overallSuccess: true,
      timestamp: new Date(),
    };

    // Test floor plan and restaurant data
    const floorPlanTest = await this.testEndpoint('/api/v1/restaurants/floor-plan');
    suite.tests.push(floorPlanTest);

    const sectionsTest = await this.testEndpoint('/api/v1/restaurants/sections');
    suite.tests.push(sectionsTest);

    suite.overallSuccess = suite.tests.every((test) => test.success);
    this.testSuites.push(suite);
    return suite;
  }

  // Test orders endpoints
  async testOrdersEndpoints(): Promise<APITestSuite> {
    const suite: APITestSuite = {
      name: 'Orders API',
      tests: [],
      overallSuccess: true,
      timestamp: new Date(),
    };

    // Test recent orders endpoint
    const recentOrdersTest = await this.testEndpoint('/api/v1/orders/recent?limit=5');
    suite.tests.push(recentOrdersTest);

    // Test create order endpoint
    const createOrderTest = await this.testEndpoint('/api/v1/orders', 'POST', {
      date_order: new Date().toISOString(),
      state: 'draft',
      amount_total: 25.99,
      session_id: 1,
      lines: [
        {
          product_id: 1,
          product_name: 'Test Product',
          qty: 1,
          price_unit: 25.99,
          price_subtotal: 25.99,
        },
      ],
    });
    suite.tests.push(createOrderTest);

    suite.overallSuccess = suite.tests.every((test) => test.success);
    this.testSuites.push(suite);
    return suite;
  }

  // Test payments endpoints
  async testPaymentsEndpoints(): Promise<APITestSuite> {
    const suite: APITestSuite = {
      name: 'Payments API',
      tests: [],
      overallSuccess: true,
      timestamp: new Date(),
    };

    // Test payment processing endpoint
    const paymentTest = await this.testEndpoint('/api/v1/payments', 'POST', {
      order_id: 1,
      payment_method: 'cash',
      amount: 25.99,
    });
    suite.tests.push(paymentTest);

    suite.overallSuccess = suite.tests.every((test) => test.success);
    this.testSuites.push(suite);
    return suite;
  }

  // Run comprehensive API test suite
  async runFullAPITestSuite(): Promise<APITestSuite[]> {
    logger.info('🧪 Starting comprehensive API test suite...');

    const allSuites: APITestSuite[] = [];

    try {
      // Test authentication first
      const authSuite = await this.testAuthenticationFlow();
      allSuites.push(authSuite);
      logger.info(`✅ Authentication tests: ${authSuite.overallSuccess ? 'PASSED' : 'FAILED'}`);

      // Test products
      const productsSuite = await this.testProductsEndpoints();
      allSuites.push(productsSuite);
      logger.info(`✅ Products tests: ${productsSuite.overallSuccess ? 'PASSED' : 'FAILED'}`);

      // Test POS sessions
      const sessionsSuite = await this.testPOSSessionsEndpoints();
      allSuites.push(sessionsSuite);
      logger.info(`✅ POS Sessions tests: ${sessionsSuite.overallSuccess ? 'PASSED' : 'FAILED'}`);

      // Test restaurant
      const restaurantSuite = await this.testRestaurantEndpoints();
      allSuites.push(restaurantSuite);
      logger.info(`✅ Restaurant tests: ${restaurantSuite.overallSuccess ? 'PASSED' : 'FAILED'}`);

      // Test orders
      const ordersSuite = await this.testOrdersEndpoints();
      allSuites.push(ordersSuite);
      logger.info(`✅ Orders tests: ${ordersSuite.overallSuccess ? 'PASSED' : 'FAILED'}`);

      // Test payments
      const paymentsSuite = await this.testPaymentsEndpoints();
      allSuites.push(paymentsSuite);
      logger.info(`✅ Payments tests: ${paymentsSuite.overallSuccess ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
      logger.error('❌ API test suite failed:', error);
    }

    logger.info('🎯 API test suite completed');
    return allSuites;
  }

  // Validate response format matches frontend expectations
  validateResponseFormat(response: unknown, endpoint: string): boolean {
    if (!response) return false;

    // Check for standardized response format
    const hasSuccessField = typeof response.success === 'boolean';
    const hasDataOrError = response.data !== undefined || response.error !== undefined;

    if (!hasSuccessField || !hasDataOrError) {
      logger.warn(`⚠️ ${endpoint}: Response format doesn't match frontend expectations`);
      return false;
    }

    return true;
  }

  // Get test results
  getTestResults(): APITestResult[] {
    return [...this.testResults];
  }

  getTestSuites(): APITestSuite[] {
    return [...this.testSuites];
  }

  // Get API health summary
  getAPIHealthSummary(): {
    totalTests: number;
    successfulTests: number;
    failedTests: number;
    successRate: number;
    lastTestTime: Date | null;
  } {
    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter((test) => test.success).length;
    const failedTests = totalTests - successfulTests;
    const successRate = totalTests > 0 ? (successfulTests / totalTests) * 100 : 0;
    const lastTestTime =
      totalTests > 0 ? this.testResults[this.testResults.length - 1].timestamp : null;

    return {
      totalTests,
      successfulTests,
      failedTests,
      successRate,
      lastTestTime,
    };
  }

  // Clear test history
  async clearTestHistory(): Promise<void> {
    this.testResults = [];
    this.testSuites = [];
    await AsyncStorage.removeItem('api_test_results');
    await AsyncStorage.removeItem('api_test_suites');
  }

  // Save test history
  private async saveTestHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem('api_test_results', JSON.stringify(this.testResults));
      await AsyncStorage.setItem('api_test_suites', JSON.stringify(this.testSuites));
    } catch (error) {
      logger.error('Failed to save test history:', error);
    }
  }

  // Load test history
  private async loadTestHistory(): Promise<void> {
    try {
      const results = await AsyncStorage.getItem('api_test_results');
      const suites = await AsyncStorage.getItem('api_test_suites');

      if (results) {
        this.testResults = JSON.parse(results).map((result: unknown) => ({
          ...result,
          timestamp: new Date(result.timestamp),
        }));
      }

      if (suites) {
        this.testSuites = JSON.parse(suites).map((suite: unknown) => ({
          ...suite,
          timestamp: new Date(suite.timestamp),
        }));
      }
    } catch (error) {
      logger.error('Failed to load test history:', error);
    }
  }
}

export default APITestingService;
