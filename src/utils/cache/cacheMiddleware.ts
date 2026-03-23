/**
 * Cache Middleware - API 响应缓存中间件
 * 
 * Automatically caches API responses based on:
 * - Request path
 * - Query parameters
 * - User ID (if authenticated)
 * 
 * Supports cache invalidation via headers and manual clearing
 */

import { Request, Response, NextFunction } from 'express';
import { cacheService, CacheNamespaces, CacheTTL } from './CacheService';
import { createLogger } from '../logger';

const log = createLogger('CacheMiddleware');

/**
 * Cache configuration for routes
 */
export interface CacheRouteConfig {
  enabled: boolean;
  ttl?: number;
  namespace?: string;
  varyByUser?: boolean;
  varyByQuery?: string[];
  skipIf?: (req: Request) => boolean;
}

/**
 * Default cache configurations for different route patterns
 */
const routeCacheConfigs: Map<RegExp, CacheRouteConfig> = new Map([
  // Leaderboard - cache for 1 minute, shared across users
  [/^\/api\/leaderboard/, { 
    enabled: true, 
    ttl: CacheTTL.LEADERBOARD,
    namespace: CacheNamespaces.LEADERBOARD,
    varyByUser: false,
  }],
  
  // Market data - cache for 5 seconds
  [/^\/api\/market/, { 
    enabled: true, 
    ttl: CacheTTL.MARKET_DATA,
    namespace: CacheNamespaces.MARKET,
    varyByUser: false,
  }],
  
  // Strategy data - cache for 1 minute
  [/^\/api\/strategies\/[^/]+$/, { 
    enabled: true, 
    ttl: CacheTTL.STRATEGY,
    namespace: CacheNamespaces.STRATEGY,
    varyByUser: true,
  }],
  
  // User profile - cache for 5 minutes
  [/^\/api\/users\/[^/]+$/, { 
    enabled: true, 
    ttl: CacheTTL.USER_PROFILE,
    namespace: CacheNamespaces.USER,
    varyByUser: true,
  }],
  
  // Stats - cache for 1 minute
  [/^\/api\/stats/, { 
    enabled: true, 
    ttl: CacheTTL.STATS,
    namespace: CacheNamespaces.STATS,
    varyByUser: false,
  }],
  
  // Metrics - cache for 1 minute
  [/^\/metrics/, { 
    enabled: true, 
    ttl: CacheTTL.STATS,
    namespace: CacheNamespaces.STATS,
    varyByUser: false,
  }],
]);

/**
 * Generate cache key for request
 */
function generateCacheKey(req: Request, config: CacheRouteConfig): string {
  const parts: string[] = [req.method, req.path];
  
  // Add user ID if varyByUser is enabled
  if (config.varyByUser && req.user?.id) {
    parts.push(`user:${req.user.id}`);
  }
  
  // Add specified query parameters
  if (config.varyByQuery && req.query) {
    const queryParts: string[] = [];
    for (const param of config.varyByQuery) {
      if (req.query[param]) {
        queryParts.push(`${param}=${req.query[param]}`);
      }
    }
    if (queryParts.length > 0) {
      parts.push(`query:${queryParts.join('&')}`);
    }
  } else if (Object.keys(req.query).length > 0) {
    // Include all query params if not specified
    const queryString = Object.entries(req.query)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    parts.push(`query:${queryString}`);
  }
  
  return parts.join(':');
}

/**
 * Get cache config for route
 */
function getCacheConfig(req: Request): CacheRouteConfig | null {
  for (const [pattern, config] of routeCacheConfigs) {
    if (pattern.test(req.path)) {
      return config;
    }
  }
  return null;
}

/**
 * Cache middleware factory
 */
export function cacheMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Check if client wants to bypass cache
    if (req.headers['cache-control'] === 'no-cache' || req.headers['pragma'] === 'no-cache') {
      log.debug(`Cache bypass requested: ${req.path}`);
      return next();
    }
    
    // Get cache config for this route
    const config = getCacheConfig(req);
    if (!config || !config.enabled) {
      return next();
    }
    
    // Check skip condition
    if (config.skipIf?.(req)) {
      return next();
    }
    
    const cacheKey = generateCacheKey(req, config);
    const namespace = config.namespace || CacheNamespaces.API_RESPONSE;
    
    try {
      // Try to get from cache
      const cachedResponse = await cacheService.get<{ 
        status: number; 
        body: any; 
        headers: Record<string, string>;
      }>(namespace, cacheKey);
      
      if (cachedResponse) {
        // Set cached headers
        for (const [key, value] of Object.entries(cachedResponse.headers)) {
          res.setHeader(key, value);
        }
        
        // Add cache hit header
        res.setHeader('X-Cache', 'HIT');
        
        log.debug(`Cache HIT: ${req.path}`);
        res.status(cachedResponse.status).json(cachedResponse.body);
        return;
      }
      
      // Cache miss - intercept response
      log.debug(`Cache MISS: ${req.path}`);
      res.setHeader('X-Cache', 'MISS');
      
      // Store original json method
      const originalJson = res.json.bind(res);
      
      // Override json method to cache the response
      res.json = (body: any): Response => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const headers: Record<string, string> = {};
          
          // Preserve important headers
          if (res.getHeader('Content-Type')) {
            headers['Content-Type'] = res.getHeader('Content-Type') as string;
          }
          
          // Cache the response
          cacheService.set(
            namespace,
            cacheKey,
            {
              status: res.statusCode,
              body,
              headers,
            },
            config.ttl
          ).catch(err => {
            log.error(`Failed to cache response: ${err.message}`);
          });
        }
        
        return originalJson(body);
      };
      
      next();
    } catch (error: any) {
      log.error(`Cache middleware error: ${error.message}`);
      next();
    }
  };
}

/**
 * Invalidate cache for a namespace
 */
export async function invalidateCache(namespace: string): Promise<void> {
  await cacheService.deleteNamespace(namespace);
  log.info(`Cache invalidated for namespace: ${namespace}`);
}

/**
 * Invalidate cache for specific key
 */
export async function invalidateCacheKey(namespace: string, key: string): Promise<void> {
  await cacheService.delete(namespace, key);
  log.debug(`Cache invalidated: ${namespace}:${key}`);
}

/**
 * Add custom route cache configuration
 */
export function addCacheRoute(pattern: RegExp, config: CacheRouteConfig): void {
  routeCacheConfigs.set(pattern, config);
  log.info(`Added cache config for pattern: ${pattern}`);
}

/**
 * Get cache statistics endpoint handler
 */
export function cacheStatsHandler(req: Request, res: Response): void {
  const stats = cacheService.getStats();
  res.json({
    success: true,
    data: {
      ...stats,
      memoryUsageMB: stats.memoryUsage / (1024 * 1024),
    },
  });
}

/**
 * Clear cache endpoint handler (for admin use)
 */
export async function clearCacheHandler(req: Request, res: Response): Promise<void> {
  try {
    await cacheService.clear();
    res.json({
      success: true,
      message: 'Cache cleared successfully',
    });
  } catch (error: any) {
    log.error(`Failed to clear cache: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
    });
  }
}

export default cacheMiddleware;