/**
 * Cache Service - 缓存服务
 * 
 * Provides a unified caching layer with:
 * - In-memory LRU cache for fast local access
 * - Optional Redis support for distributed caching
 * - Automatic cache invalidation and TTL management
 * - Cache statistics and monitoring
 */

import { createLogger } from '../logger';

const log = createLogger('CacheService');

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hitCount: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
  avgAccessTime: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize?: number;
  defaultTTL?: number;
  cleanupInterval?: number;
  enableStats?: boolean;
}

/**
 * LRU Cache with TTL support
 */
class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private defaultTTL: number;
  private stats = {
    hits: 0,
    misses: 0,
    totalAccessTime: 0,
    accessCount: 0,
  };

  constructor(maxSize: number = 1000, defaultTTL: number = 300000) { // 5 minutes default
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const startTime = Date.now();
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update hit count and move to end (LRU)
    entry.hitCount++;
    this.stats.hits++;
    this.stats.totalAccessTime += Date.now() - startTime;
    this.stats.accessCount++;

    // Move to end for LRU (delete and re-add)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + (ttl || this.defaultTTL),
      createdAt: Date.now(),
      hitCount: 0,
    };

    this.cache.set(key, entry);
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, totalAccessTime: 0, accessCount: 0 };
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      totalKeys: this.cache.size,
      memoryUsage: this.estimateMemoryUsage(),
      avgAccessTime: this.stats.accessCount > 0 
        ? this.stats.totalAccessTime / this.stats.accessCount 
        : 0,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let bytes = 0;
    for (const [key, entry] of this.cache.entries()) {
      bytes += key.length * 2; // String characters
      bytes += JSON.stringify(entry.value).length * 2;
      bytes += 64; // Metadata overhead
    }
    return bytes;
  }
}

/**
 * Cache Service - Singleton
 */
export class CacheService {
  private static instance: CacheService;
  private cache: LRUCache<any>;
  private cleanupTimer?: NodeJS.Timeout;
  private config: CacheConfig;
  private prefix: string;

  private constructor(config: CacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize || 1000,
      defaultTTL: config.defaultTTL || 300000, // 5 minutes
      cleanupInterval: config.cleanupInterval || 60000, // 1 minute
      enableStats: config.enableStats ?? true,
    };
    this.prefix = 'aa:cache:'; // AlphaArena cache prefix
    this.cache = new LRUCache(this.config.maxSize, this.config.defaultTTL);
    
    this.startCleanupTimer();
    log.info(`Cache service initialized with max size: ${this.config.maxSize}, TTL: ${this.config.defaultTTL}ms`);
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: CacheConfig): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService(config);
    }
    return CacheService.instance;
  }

  /**
   * Generate cache key
   */
  private generateKey(namespace: string, key: string): string {
    return `${this.prefix}${namespace}:${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(namespace: string, key: string): Promise<T | null> {
    const fullKey = this.generateKey(namespace, key);
    const value = this.cache.get(fullKey);
    
    if (value !== null) {
      log.debug(`Cache HIT: ${fullKey}`);
    } else {
      log.debug(`Cache MISS: ${fullKey}`);
    }
    
    return value;
  }

  /**
   * Set value in cache
   */
  async set<T>(namespace: string, key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.generateKey(namespace, key);
    this.cache.set(fullKey, value, ttl);
    log.debug(`Cache SET: ${fullKey}, TTL: ${ttl || this.config.defaultTTL}ms`);
  }

  /**
   * Delete value from cache
   */
  async delete(namespace: string, key: string): Promise<boolean> {
    const fullKey = this.generateKey(namespace, key);
    return this.cache.delete(fullKey);
  }

  /**
   * Delete all keys in a namespace (pattern-based deletion)
   */
  async deleteNamespace(namespace: string): Promise<number> {
    const prefix = this.generateKey(namespace, '');
    let deleted = 0;
    
    // LRU cache doesn't support pattern matching, so we iterate
    for (const key of this.cache['cache'].keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    log.info(`Deleted ${deleted} keys from namespace: ${namespace}`);
    return deleted;
  }

  /**
   * Get or set value with fallback function
   */
  async getOrSet<T>(
    namespace: string,
    key: string,
    fallback: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(namespace, key);
    if (cached !== null) {
      return cached;
    }

    const value = await fallback();
    await this.set(namespace, key, value, ttl);
    return value;
  }

  /**
   * Check if key exists
   */
  async has(namespace: string, key: string): Promise<boolean> {
    const fullKey = this.generateKey(namespace, key);
    return this.cache.has(fullKey);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    log.info('Cache cleared');
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.config.cleanupInterval && this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        const removed = this.cache.cleanup();
        if (removed > 0) {
          log.debug(`Cleanup removed ${removed} expired entries`);
        }
      }, this.config.cleanupInterval);
    }
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}

// Cache namespaces for different data types
export const CacheNamespaces = {
  LEADERBOARD: 'leaderboard',
  STRATEGY: 'strategy',
  TRADE: 'trade',
  USER: 'user',
  MARKET: 'market',
  PORTFOLIO: 'portfolio',
  STATS: 'stats',
  API_RESPONSE: 'api',
} as const;

// Default TTL for different data types (in milliseconds)
export const CacheTTL = {
  LEADERBOARD: 60000, // 1 minute - frequently updated
  MARKET_DATA: 5000, // 5 seconds - real-time data
  USER_PROFILE: 300000, // 5 minutes
  STRATEGY: 60000, // 1 minute
  TRADES: 30000, // 30 seconds
  STATS: 60000, // 1 minute
  API_RESPONSE: 30000, // 30 seconds for general API
} as const;

// Export singleton instance
export const cacheService = CacheService.getInstance();

export default cacheService;