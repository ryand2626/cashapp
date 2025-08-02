/**
 * Authentication Interceptor for Global Request/Response Handling
 *
 * This interceptor provides centralized authentication handling for all API requests:
 * - Automatically adds authentication tokens to requests
 * - Handles 401 responses by refreshing tokens
 * - Queues requests during token refresh
 * - Prevents multiple simultaneous refresh attempts
 * - Provides hooks for request/response transformation
 */

import tokenManager from '../../utils/tokenManager';

interface RequestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

interface QueuedRequest {
  config: RequestConfig;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
}

interface InterceptorOptions {
  baseURL?: string;
  excludePaths?: string[]; // Paths to exclude from auth (e.g., public endpoints)
  onUnauthorized?: () => void; // Callback when user is permanently unauthorized
}

class AuthInterceptor {
  private static instance: AuthInterceptor;
  private isRefreshing = false;
  private failedQueue: QueuedRequest[] = [];
  private options: InterceptorOptions;

  private constructor(options: InterceptorOptions = {}) {
    this.options = options;

    // Listen to token events
    tokenManager.on('token:refreshed', () => {
      this.processQueue(null);
    });

    tokenManager.on('token:refresh:failed', (error: Error) => {
      this.processQueue(error);
    });
  }

  static getInstance(options?: InterceptorOptions): AuthInterceptor {
    if (!AuthInterceptor.instance) {
      AuthInterceptor.instance = new AuthInterceptor(options);
    }
    return AuthInterceptor.instance;
  }

  /**
   * Configure interceptor options
   */
  configure(options: Partial<InterceptorOptions>) {
    this.options = { ...this.options, ...options };
  }

  /**
   * Process queued requests after token refresh
   */
  private processQueue(error: Error | null) {
    const queue = [...this.failedQueue];
    this.failedQueue = [];

    queue.forEach(({ config, resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        // Retry the request with new token
        this.makeAuthenticatedRequest(config).then(resolve).catch(reject);
      }
    });

    this.isRefreshing = false;
  }

  /**
   * Check if a path should be excluded from authentication
   */
  private shouldExcludeAuth(url: string): boolean {
    if (!this.options.excludePaths) return false;

    const path = url.replace(this.options.baseURL || '', '');
    return this.options.excludePaths.some((excludePath) => path.startsWith(excludePath));
  }

  /**
   * Make an authenticated request
   */
  private async makeAuthenticatedRequest(config: RequestConfig): Promise<Response> {
    // Get token if not excluded
    if (!this.shouldExcludeAuth(config.url)) {
      const token = await tokenManager.getTokenWithRefresh();

      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
    }

    // Make the request
    const response = await fetch(config.url, {
      method: config.method,
      headers: config.headers,
      body: config.body,
      signal: config.signal,
    });

    return response;
  }

  /**
   * Main request method with authentication handling
   */
  async request(config: RequestConfig): Promise<Response> {
    try {
      // First attempt
      const response = await this.makeAuthenticatedRequest(config);

      // Check if token refresh is needed
      if (response.status === 401 && !this.shouldExcludeAuth(config.url)) {
        // If already refreshing, queue this request
        if (this.isRefreshing) {
          return new Promise<Response>((resolve, reject) => {
            this.failedQueue.push({ config, resolve, reject });
          });
        }

        // Start refresh process
        this.isRefreshing = true;

        try {
          // Attempt to refresh token
          const newToken = await tokenManager.refreshAuthToken();

          if (newToken) {
            // Retry with new token
            return await this.makeAuthenticatedRequest(config);
          } else {
            // No new token - user is logged out
            if (this.options.onUnauthorized) {
              this.options.onUnauthorized();
            }
            throw new Error('Authentication failed - please log in again');
          }
        } catch (error) {
          // Refresh failed
          this.isRefreshing = false;

          if (this.options.onUnauthorized) {
            this.options.onUnauthorized();
          }

          throw error;
        } finally {
          this.isRefreshing = false;
        }
      }

      return response;
    } catch (error) {
      logger.error('Request failed:', error);
      throw error;
    }
  }

  /**
   * Convenience method for GET requests
   */
  async get(
    url: string,
    headers: Record<string, string> = {},
    timeoutMs: number = 10000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.request({
        url,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Convenience method for POST requests
   */
  async post(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
    timeoutMs: number = 10000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.request({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Convenience method for PUT requests
   */
  async put(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
    timeoutMs: number = 10000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.request({
        url,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Convenience method for DELETE requests
   */
  async delete(
    url: string,
    headers: Record<string, string> = {},
    timeoutMs: number = 10000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.request({
        url,
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Convenience method for PATCH requests
   */
  async patch(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
    timeoutMs: number = 10000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.request({
        url,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }
}

// Create and export singleton instance
const authInterceptor = AuthInterceptor.getInstance();

// Export both the instance and the class
export { authInterceptor, AuthInterceptor };
export default authInterceptor;
