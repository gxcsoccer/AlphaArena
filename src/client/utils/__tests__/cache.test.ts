/**
 * Tests for Data Cache Utility
 */

import { dataCache, fetchWithCache } from '../cache';

describe('DataCache', () => {
  beforeEach(() => {
    dataCache.clear();
    localStorage.clear();
  });

  describe('get and set', () => {
    it('should store and retrieve data', () => {
      const testData = { name: 'test', value: 123 };
      dataCache.set('test-key', testData);

      const retrieved = dataCache.get<typeof testData>('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent key', () => {
      const result = dataCache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should respect TTL and return null after expiration', (done) => {
      const testData = { name: 'test' };
      dataCache.set('test-key', testData, 100); // 100ms TTL

      // Should exist immediately
      expect(dataCache.get('test-key')).toEqual(testData);

      // Should be expired after TTL
      setTimeout(() => {
        expect(dataCache.get('test-key')).toBeNull();
        done();
      }, 150);
    });
  });

  describe('delete', () => {
    it('should remove cached data', () => {
      const testData = { name: 'test' };
      dataCache.set('test-key', testData);
      expect(dataCache.get('test-key')).toEqual(testData);

      dataCache.delete('test-key');
      expect(dataCache.get('test-key')).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all cached data', () => {
      dataCache.set('key1', { a: 1 });
      dataCache.set('key2', { b: 2 });

      dataCache.clear();

      expect(dataCache.get('key1')).toBeNull();
      expect(dataCache.get('key2')).toBeNull();
    });
  });

  describe('stats', () => {
    it('should track cache hits and misses', () => {
      dataCache.set('key1', { data: 'test' });

      // Hit
      dataCache.get('key1');
      // Miss
      dataCache.get('non-existent');

      const stats = dataCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);
    });
  });

  describe('localStorage persistence', () => {
    it('should persist small items to localStorage', () => {
      const testData = { small: 'data' };
      dataCache.set('persistent-key', testData, 60000);

      const stored = localStorage.getItem('cache:persistent-key');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!).data).toEqual(testData);
    });
  });
});

describe('fetchWithCache', () => {
  beforeEach(() => {
    dataCache.clear();
  });

  it('should return cached data if available', async () => {
    const cachedData = { cached: true };
    dataCache.set('fetch-key', cachedData);

    const fetcher = jest.fn().mockResolvedValue({ fresh: true });

    const result = await fetchWithCache('fetch-key', fetcher);

    expect(result).toEqual(cachedData);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('should fetch fresh data if not cached', async () => {
    const freshData = { fresh: true };
    const fetcher = jest.fn().mockResolvedValue(freshData);

    const result = await fetchWithCache('new-key', fetcher);

    expect(result).toEqual(freshData);
    expect(fetcher).toHaveBeenCalled();
  });

  it('should cache fetched data', async () => {
    const freshData = { fresh: true };
    const fetcher = jest.fn().mockResolvedValue(freshData);

    await fetchWithCache('cache-key', fetcher);

    // Second call should use cache
    const result = await fetchWithCache('cache-key', fetcher);
    expect(result).toEqual(freshData);
    expect(fetcher).toHaveBeenCalledTimes(1); // Only called once
  });
});