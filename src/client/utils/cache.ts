/**
 * Data Cache Utility
 * Implements a simple in-memory and localStorage cache with TTL support
 * Used for optimizing data loading and reducing API calls
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class DataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, hitRate: 0 };
  private maxMemorySize: number = 100; // Max entries in memory

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    // Check memory cache first
    const memoryEntry = this.cache.get(key);
    if (memoryEntry) {
      if (Date.now() - memoryEntry.timestamp < memoryEntry.ttl) {
        this.stats.hits++;
        this.updateHitRate();
        return memoryEntry.data as T;
      } else {
        // Expired, remove from cache
        this.cache.delete(key);
      }
    }

    // Check localStorage cache
    const localEntry = this.getFromLocalStorage<T>(key);
    if (localEntry) {
      this.stats.hits++;
      this.updateHitRate();
      // Promote to memory cache
      this.set(key, localEntry.data, localEntry.ttl);
      return localEntry.data;
    }

    this.stats.misses++;
    this.updateHitRate();
    return null;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, ttl: number = 30000): void {
    // Enforce max memory size
    if (this.cache.size >= this.maxMemorySize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;

    // Also store in localStorage for persistence
    this.setToLocalStorage(key, entry);
  }

  /**
   * Remove entry from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.stats.size = this.cache.size;
    
    try {
      localStorage.removeItem(`cache:${key}`);
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, size: 0, hitRate: 0 };
    
    try {
      // Clear cache entries from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache:')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  private getFromLocalStorage<T>(key: string): CacheEntry<T> | null {
    try {
      const item = localStorage.getItem(`cache:${key}`);
      if (!item) return null;

      const entry = JSON.parse(item) as CacheEntry<T>;
      if (Date.now() - entry.timestamp < entry.ttl) {
        return entry;
      } else {
        // Expired, remove
        localStorage.removeItem(`cache:${key}`);
        return null;
      }
    } catch (e) {
      return null;
    }
  }

  private setToLocalStorage<T>(key: string, entry: CacheEntry<T>): void {
    try {
      // Only cache small items in localStorage (< 100KB)
      const serialized = JSON.stringify(entry);
      if (serialized.length < 100000) {
        localStorage.setItem(`cache:${key}`, serialized);
      }
    } catch (e) {
      // Ignore localStorage errors (quota exceeded, etc.)
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }
}

// Singleton instance
export const dataCache = new DataCache();

/**
 * Helper to fetch with cache
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 30000
): Promise<T> {
  // Check cache first
  const cached = dataCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();
  
  // Store in cache
  dataCache.set(key, data, ttl);
  
  return data;
}

/**
 * Helper to prefetch data
 */
export async function prefetchData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 30000
): Promise<void> {
  try {
    const data = await fetcher();
    dataCache.set(key, data, ttl);
  } catch (error) {
    console.error(`Prefetch failed for ${key}:`, error);
  }
}

export default dataCache;