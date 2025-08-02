import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  persistToStorage?: boolean; // Whether to persist to AsyncStorage
}

class CacheManager {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private maxMemorySize = 100;

  /**
   * Set a value in cache
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    const {
      ttl = this.defaultTTL,
      maxSize = this.maxMemorySize,
      persistToStorage = false,
    } = options;

    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    };

    // Store in memory cache
    this.memoryCache.set(key, entry);

    // Enforce memory cache size limit
    if (this.memoryCache.size > maxSize) {
      this.evictOldestEntries(maxSize);
    }

    // Optionally persist to AsyncStorage
    if (persistToStorage) {
      try {
        await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(entry));
      } catch (error) {
        console.warn('Failed to persist cache entry to storage:', error);
      }
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const { persistToStorage = false } = options;
    const now = Date.now();

    // Check memory cache first
    let entry = this.memoryCache.get(key);

    // If not in memory and persistence is enabled, check AsyncStorage
    if (!entry && persistToStorage) {
      try {
        const storedData = await AsyncStorage.getItem(`cache_${key}`);
        if (storedData) {
          entry = JSON.parse(storedData);
          // Restore to memory cache if still valid
          if (entry && now < entry.expiresAt) {
            this.memoryCache.set(key, entry);
          }
        }
      } catch (error) {
        console.warn('Failed to retrieve cache entry from storage:', error);
      }
    }

    // Check if entry exists and is not expired
    if (entry && now < entry.expiresAt) {
      return entry.data;
    }

    // Clean up expired entry
    if (entry) {
      this.delete(key);
    }

    return null;
  }

  /**
   * Delete a cache entry
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);

    try {
      await AsyncStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.warn('Failed to remove cache entry from storage:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn('Failed to clear cache from storage:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number;
    memoryKeys: string[];
    memoryUsage: number;
  } {
    const memoryKeys = Array.from(this.memoryCache.keys());
    const memoryUsage = JSON.stringify(Array.from(this.memoryCache.values())).length;

    return {
      memorySize: this.memoryCache.size,
      memoryKeys,
      memoryUsage,
    };
  }

  /**
   * Check if a key exists and is valid
   */
  async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  /**
   * Get or set pattern - retrieve from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    computeFn: () => Promise<T> | T,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options);

    if (cached !== null) {
      return cached;
    }

    const computed = await computeFn();
    await this.set(key, computed, options);
    return computed;
  }

  /**
   * Batch operations for better performance
   */
  async setMany<T>(
    entries: Array<{ key: string; data: T; options?: CacheOptions }>
  ): Promise<void> {
    const promises = entries.map(({ key, data, options }) => this.set(key, data, options));
    await Promise.all(promises);
  }

  /**
   * Evict oldest entries to maintain cache size
   */
  private evictOldestEntries(maxSize: number): void {
    if (this.memoryCache.size <= maxSize) return;

    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, this.memoryCache.size - maxSize);
    toRemove.forEach(([key]) => this.memoryCache.delete(key));
  }

  /**
   * Clean up expired entries
   */
  cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now >= entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => this.memoryCache.delete(key));
  }

  /**
   * Auto cleanup interval - call this to start automatic cleanup
   */
  startAutoCleanup(intervalMs: number = 60000): () => void {
    const interval = setInterval(() => {
      this.cleanupExpired();
    }, intervalMs);

    return () => clearInterval(interval);
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

// Utility functions for common caching patterns
export const cacheUtils = {
  // Cache menu items with shorter TTL
  cacheMenuItems: async (items: any[]) => {
    await cacheManager.set('menu_items', items, {
      ttl: 10 * 60 * 1000, // 10 minutes
      persistToStorage: true,
    });
  },

  // Cache user data with longer TTL
  cacheUserData: async (userData: any) => {
    await cacheManager.set('user_data', userData, {
      ttl: 60 * 60 * 1000, // 1 hour
      persistToStorage: true,
    });
  },

  // Cache reports data with medium TTL
  cacheReportsData: async (reports: any) => {
    await cacheManager.set('reports_data', reports, {
      ttl: 30 * 60 * 1000, // 30 minutes
      persistToStorage: true,
    });
  },

  // Cache images with long TTL
  cacheImageData: async (imageUrl: string, imageData: any) => {
    await cacheManager.set(`image_${imageUrl}`, imageData, {
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      persistToStorage: true,
    });
  },

  // Generate cache key from multiple parameters
  generateKey: (...params: (string | number | boolean)[]): string => {
    return params.join('_').replace(/[^a-zA-Z0-9_]/g, '_');
  },
};

export default cacheManager;
