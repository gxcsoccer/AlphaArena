/**
 * Cache Service Tests
 */

import { CacheService, CacheNamespaces, CacheTTL } from '../CacheService';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    // Create a fresh instance for each test
    cache = CacheService.getInstance({
      maxSize: 100,
      defaultTTL: 1000, // 1 second for faster tests
      cleanupInterval: 100, // Clean up every 100ms
    });
    cache.clear();
  });

  afterEach(() => {
    cache.clear();
    cache.stopCleanupTimer();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', async () => {
      await cache.set('test', 'key1', { value: 'test-data' });
      const result = await cache.get('test', 'key1');
      
      expect(result).toEqual({ value: 'test-data' });
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('test', 'non-existent');
      
      expect(result).toBeNull();
    });

    it('should respect TTL and expire entries', async () => {
      await cache.set('test', 'key1', 'value', 100); // 100ms TTL
      
      // Should exist immediately
      let result = await cache.get('test', 'key1');
      expect(result).toBe('value');
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired
      result = await cache.get('test', 'key1');
      expect(result).toBeNull();
    });

    it('should overwrite existing keys', async () => {
      await cache.set('test', 'key1', 'value1');
      await cache.set('test', 'key1', 'value2');
      
      const result = await cache.get('test', 'key1');
      expect(result).toBe('value2');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      await cache.set('test', 'key1', 'cached');
      
      const fallback = jest.fn().mockResolvedValue('fallback');
      const result = await cache.getOrSet('test', 'key1', fallback);
      
      expect(result).toBe('cached');
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should call fallback and cache result if not exists', async () => {
      const fallback = jest.fn().mockResolvedValue('fallback-value');
      const result = await cache.getOrSet('test', 'key1', fallback);
      
      expect(result).toBe('fallback-value');
      expect(fallback).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      const result2 = await cache.getOrSet('test', 'key1', fallback);
      expect(result2).toBe('fallback-value');
      expect(fallback).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      await cache.set('test', 'key1', 'value');
      await cache.delete('test', 'key1');
      
      const result = await cache.get('test', 'key1');
      expect(result).toBeNull();
    });

    it('should return false for non-existent key', async () => {
      const result = await cache.delete('test', 'non-existent');
      expect(result).toBe(false);
    });
  });

  describe('deleteNamespace', () => {
    it('should delete all keys in a namespace', async () => {
      await cache.set('ns1', 'key1', 'value1');
      await cache.set('ns1', 'key2', 'value2');
      await cache.set('ns2', 'key1', 'value3');
      
      const deleted = await cache.deleteNamespace('ns1');
      
      expect(deleted).toBe(2);
      expect(await cache.get('ns1', 'key1')).toBeNull();
      expect(await cache.get('ns1', 'key2')).toBeNull();
      expect(await cache.get('ns2', 'key1')).toBe('value3');
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      await cache.set('test', 'key1', 'value1');
      await cache.get('test', 'key1'); // Hit
      await cache.get('test', 'non-existent'); // Miss
      
      const stats = cache.getStats();
      
      expect(stats.totalKeys).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entries when max size reached', async () => {
      // Create a fresh cache with small size
      const testCache = new (CacheService as any)({
        maxSize: 3,
        defaultTTL: 60000,
        cleanupInterval: 0, // Disable cleanup timer for test
      });
      
      await testCache.set('test', 'key1', 'value1');
      await testCache.set('test', 'key2', 'value2');
      await testCache.set('test', 'key3', 'value3');
      await testCache.set('test', 'key4', 'value4'); // Should evict key1
      
      expect(await testCache.get('test', 'key1')).toBeNull();
      expect(await testCache.get('test', 'key2')).toBe('value2');
      expect(await testCache.get('test', 'key3')).toBe('value3');
      expect(await testCache.get('test', 'key4')).toBe('value4');
      
      testCache.clear();
      testCache.stopCleanupTimer();
    });
  });
});

describe('CacheNamespaces', () => {
  it('should have all required namespaces', () => {
    expect(CacheNamespaces.LEADERBOARD).toBe('leaderboard');
    expect(CacheNamespaces.STRATEGY).toBe('strategy');
    expect(CacheNamespaces.TRADE).toBe('trade');
    expect(CacheNamespaces.USER).toBe('user');
    expect(CacheNamespaces.MARKET).toBe('market');
    expect(CacheNamespaces.PORTFOLIO).toBe('portfolio');
    expect(CacheNamespaces.STATS).toBe('stats');
    expect(CacheNamespaces.API_RESPONSE).toBe('api');
  });
});

describe('CacheTTL', () => {
  it('should have reasonable default TTLs', () => {
    expect(CacheTTL.LEADERBOARD).toBe(60000);
    expect(CacheTTL.MARKET_DATA).toBe(5000);
    expect(CacheTTL.USER_PROFILE).toBe(300000);
    expect(CacheTTL.STRATEGY).toBe(60000);
    expect(CacheTTL.TRADES).toBe(30000);
    expect(CacheTTL.STATS).toBe(60000);
    expect(CacheTTL.API_RESPONSE).toBe(30000);
  });
});