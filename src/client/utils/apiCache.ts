/**
 * API Cache Utility
 * 
 * Issue #513: Performance Optimization
 * Provides in-memory caching for API responses to reduce network requests
 * and improve response times.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  etag?: string;
  lastModified?: string;
}

interface CacheOptions {
  /** Time to live in milliseconds (default: 5 minutes) */
  ttl?: number;
  /** Maximum number of entries in cache (default: 100) */
  maxSize?: number;
  /** Enable stale-while-revalidate pattern */
  staleWhileRevalidate?: boolean;
  /** Custom cache key generator */
  keyGenerator?: (url: string, options?: RequestInit) => string;
  /** Debug mode */
  debug?: boolean;
}

interface FetchOptions extends RequestInit {
  /** Cache TTL override */
  cacheTtl?: number;
  /** Skip cache and force fresh fetch */
  forceRefresh?: boolean;
  /** Background revalidation */
  backgroundRevalidate?: boolean;
}

/**
 * In-memory cache for API responses
 */
class ApiCache {
  private cache = new Map<string, CacheEntry<any>>();
  private options: Required<Omit<CacheOptions, 'keyGenerator'>> & { keyGenerator?: CacheOptions['keyGenerator'] };
  private pendingRequests = new Map<string, Promise<any>>();

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl ?? 5 * 60 * 1000, // 5 minutes default
      maxSize: options.maxSize ?? 100,
      staleWhileRevalidate: options.staleWhileRevalidate ?? true,
      debug: options.debug ?? false,
      keyGenerator: options.keyGenerator,
    };

    // Clean up expired entries periodically
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanup(), 60 * 1000); // Every minute
    }
  }

  /**
   * Generate cache key from URL and options
   */
  private generateKey(url: string, options?: RequestInit): string {
    if (this.options.keyGenerator) {
      return this.options.keyGenerator(url, options);
    }
    
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() > entry.expiresAt;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    });

    // Also enforce max size (LRU)
    if (this.cache.size > this.options.maxSize) {
      const entries = Array.from(this.cache.entries());
      const toRemove = entries.slice(0, this.cache.size - this.options.maxSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
      cleaned += toRemove.length;
    }

    if (this.options.debug && cleaned > 0) {
      console.log(`[ApiCache] Cleaned ${cleaned} entries, cache size: ${this.cache.size}`);
    }
  }

  /**
   * Get cached data
   */
  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) return null;
    
    // Check if stale (but still usable with stale-while-revalidate)
    if (this.isExpired(entry)) {
      if (this.options.staleWhileRevalidate) {
        return entry; // Return stale data, caller should revalidate
      }
      return null;
    }
    
    return entry;
  }

  /**
   * Set cache entry
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const entryTtl = ttl ?? this.options.ttl;
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + entryTtl,
    };

    this.cache.set(key, entry);

    if (this.options.debug) {
      console.log(`[ApiCache] Cached ${key}, expires in ${entryTtl / 1000}s`);
    }
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    if (this.options.debug) {
      console.log('[ApiCache] Cache cleared');
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry ? !this.isExpired(entry) : false;
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Fetch with caching
   */
  async fetch<T = any>(
    url: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const {
      cacheTtl,
      forceRefresh = false,
      backgroundRevalidate = true,
      ...fetchOptions
    } = options;

    const key = this.generateKey(url, fetchOptions);
    
    // Check for pending request (deduplication)
    const pendingKey = `pending:${key}`;
    if (this.pendingRequests.has(pendingKey)) {
      if (this.options.debug) {
        console.log(`[ApiCache] Deduplicating request: ${key}`);
      }
      return this.pendingRequests.get(pendingKey)!;
    }

    // Check cache
    const cached = this.get<T>(key);
    
    if (cached && !forceRefresh) {
      // Check if stale but usable
      if (this.isExpired(cached) && backgroundRevalidate) {
        // Return stale data and revalidate in background
        if (this.options.debug) {
          console.log(`[ApiCache] Returning stale data, revalidating: ${key}`);
        }
        this.revalidate(key, url, fetchOptions, cacheTtl);
      } else if (this.options.debug) {
        console.log(`[ApiCache] Cache hit: ${key}`);
      }
      return cached.data;
    }

    // Make the request
    const requestPromise = this.makeRequest<T>(key, url, fetchOptions, cacheTtl);
    this.pendingRequests.set(pendingKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(pendingKey);
    }
  }

  /**
   * Make actual network request
   */
  private async makeRequest<T>(
    key: string,
    url: string,
    options: RequestInit = {},
    ttl?: number
  ): Promise<T> {
    if (this.options.debug) {
      console.log(`[ApiCache] Fetching: ${key}`);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Cache successful response
    this.set(key, data, ttl);

    return data;
  }

  /**
   * Revalidate in background
   */
  private revalidate<T>(
    key: string,
    url: string,
    options: RequestInit,
    ttl?: number
  ): void {
    // Don't await, let it run in background
    this.makeRequest<T>(key, url, options, ttl).catch(error => {
      if (this.options.debug) {
        console.error(`[ApiCache] Revalidation failed for ${key}:`, error);
      }
    });
  }

  /**
   * Prefetch and cache a URL
   */
  async prefetch<T = any>(
    url: string,
    options: FetchOptions = {}
  ): Promise<void> {
    await this.fetch<T>(url, { ...options, backgroundRevalidate: false });
    if (this.options.debug) {
      console.log(`[ApiCache] Prefetched: ${url}`);
    }
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidate(pattern: string | RegExp): number {
    let invalidated = 0;
    
    this.cache.forEach((_, key) => {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          this.cache.delete(key);
          invalidated++;
        }
      } else {
        if (pattern.test(key)) {
          this.cache.delete(key);
          invalidated++;
        }
      }
    });

    if (this.options.debug) {
      console.log(`[ApiCache] Invalidated ${invalidated} entries matching ${pattern}`);
    }

    return invalidated;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    entries: Array<{ key: string; age: number; remainingTtl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      remainingTtl: Math.max(0, entry.expiresAt - now),
    }));

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      entries,
    };
  }
}

// Default cache instance
export const apiCache = new ApiCache({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 100,
  staleWhileRevalidate: true,
  debug: process.env.NODE_ENV === 'development',
});

// Export class for custom instances
export { ApiCache };

// Convenience function for cached fetch
export const cachedFetch = <T = any>(url: string, options?: FetchOptions) => 
  apiCache.fetch<T>(url, options);

export default apiCache;