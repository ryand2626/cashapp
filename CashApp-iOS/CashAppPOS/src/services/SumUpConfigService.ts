import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_CONFIG } from '../config/api';
import { logger } from '../utils/logger';
import tokenManager from '../utils/tokenManager';

export interface SumUpConfig {
  appId: string;
  environment: 'sandbox' | 'production';
  merchantCode?: string;
  currency: string;
}

export interface SumUpInitResponse {
  success: boolean;
  data: {
    config: SumUpConfig;
    sdkInitialized: boolean;
    enabled: boolean;
    features: Record<string, boolean>;
  };
  message?: string;
  timestamp?: string;
}

class SumUpConfigService {
  private static instance: SumUpConfigService;
  private cachedConfig: SumUpConfig | null = null;
  private configCacheKey = 'sumup_config_cache';
  private configCacheDuration = 3600000; // 1 hour in milliseconds

  private constructor() {}

  static getInstance(): SumUpConfigService {
    if (!SumUpConfigService.instance) {
      SumUpConfigService.instance = new SumUpConfigService();
    }
    return SumUpConfigService.instance;
  }

  /**
   * Fetch SumUp configuration from backend
   */
  async fetchConfiguration(): Promise<SumUpConfig> {
    try {
      // Check cache first
      const cached = await this.getCachedConfig();
      if (cached) {
        logger.info('📦 Using cached SumUp configuration');
        return cached;
      }

      // Get auth token
      const token = await tokenManager.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Fetch from backend
      logger.info('🔄 Fetching SumUp configuration from backend...');
      const response = await fetch(`${API_CONFIG.FULL_API_URL}/sumup/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'production' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch SumUp configuration');
      }

      const result: SumUpInitResponse = await response.json();

      // Check for success using the actual API response format
      if (result.success && result.data?.config) {
        const config = result.data.config;

        // Cache the configuration
        await this.cacheConfig(config);

        logger.info('✅ SumUp configuration fetched successfully');
        return config;
      } else {
        throw new Error(result.message || 'Invalid response from server');
      }
    } catch (error) {
      logger.error('❌ Failed to fetch SumUp configuration:', error);
      throw error;
    }
  }

  /**
   * Get SumUp status from backend
   */
  async getStatus(): Promise<any> {
    try {
      const token = await tokenManager.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${API_CONFIG.FULL_API_URL}/sumup/status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch SumUp status');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      logger.error('❌ Failed to fetch SumUp status:', error);
      throw error;
    }
  }

  /**
   * Validate merchant code
   */
  async validateMerchantCode(merchantCode: string): Promise<boolean> {
    try {
      const token = await tokenManager.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${API_CONFIG.FULL_API_URL}/sumup/validate-merchant`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ merchant_code: merchantCode }),
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.data?.valid === true;
    } catch (error) {
      logger.error('❌ Failed to validate merchant code:', error);
      return false;
    }
  }

  /**
   * Clear cached configuration
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.configCacheKey);
      this.cachedConfig = null;
      logger.info('🧹 SumUp configuration cache cleared');
    } catch (error) {
      logger.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get cached configuration
   */
  private async getCachedConfig(): Promise<SumUpConfig | null> {
    try {
      // Check in-memory cache first
      if (this.cachedConfig) {
        return this.cachedConfig;
      }

      // Check AsyncStorage
      const cached = await AsyncStorage.getItem(this.configCacheKey);
      if (!cached) {
        return null;
      }

      const { config, timestamp } = JSON.parse(cached);

      // Check if cache is expired
      if (Date.now() - timestamp > this.configCacheDuration) {
        await AsyncStorage.removeItem(this.configCacheKey);
        return null;
      }

      this.cachedConfig = config;
      return config;
    } catch (error) {
      logger.error('Failed to get cached config:', error);
      return null;
    }
  }

  /**
   * Cache configuration
   */
  private async cacheConfig(config: SumUpConfig): Promise<void> {
    try {
      const cacheData = {
        config,
        timestamp: Date.now(),
      };

      await AsyncStorage.setItem(this.configCacheKey, JSON.stringify(cacheData));
      this.cachedConfig = config;
    } catch (error) {
      logger.error('Failed to cache config:', error);
    }
  }
}

export default SumUpConfigService.getInstance();
