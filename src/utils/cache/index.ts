/**
 * Cache Module - 缓存模块
 * 
 * Exports all caching and optimization utilities
 */

export {
  CacheService,
  CacheNamespaces,
  CacheTTL,
  cacheService,
  type CacheStats,
  type CacheConfig,
} from './CacheService';

export {
  cacheMiddleware,
  invalidateCache,
  invalidateCacheKey,
  addCacheRoute,
  cacheStatsHandler,
  clearCacheHandler,
  type CacheRouteConfig,
} from './cacheMiddleware';

export {
  BatchQueryOptimizer,
  CachedQuery,
} from './batchQueryOptimizer';

export {
  OptimizedLeaderboardService,
  optimizedLeaderboardService,
  type StrategyMetrics,
  type LeaderboardEntry,
  type SortCriterion,
} from './optimizedLeaderboard';

export {
  responseCompressionMiddleware,
  getCompressionStats,
  resetCompressionStats,
  type CompressionStats,
} from './responseCompression';