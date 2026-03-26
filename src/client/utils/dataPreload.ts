/**
 * Data Preload Utilities
 * 
 * Issue #631: Mobile Performance Optimization
 * Provides intelligent data preloading strategies for:
 * - Critical path optimization
 * - Predictive prefetching
 * - Network-aware loading
 */

import { cachedFetch, apiCache } from './apiCache';

/**
 * Network connection info
 */
interface NetworkInfo {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  downlink: number;
  rtt: number;
  saveData: boolean;
}

/**
 * Get network information
 */
export function getNetworkInfo(): NetworkInfo {
  if (typeof navigator === 'undefined') {
    return {
      effectiveType: 'unknown',
      downlink: 10,
      rtt: 50,
      saveData: false,
    };
  }

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  if (connection) {
    return {
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 10,
      rtt: connection.rtt || 50,
      saveData: connection.saveData || false,
    };
  }

  return {
    effectiveType: 'unknown',
    downlink: 10,
    rtt: 50,
    saveData: false,
  };
}

/**
 * Check if network is fast enough for prefetching
 */
export function shouldPrefetch(): boolean {
  const network = getNetworkInfo();
  
  // Don't prefetch if user has data saver enabled
  if (network.saveData) {
    return false;
  }
  
  // Only prefetch on 3G or better
  if (network.effectiveType === 'slow-2g' || network.effectiveType === '2g') {
    return false;
  }
  
  return true;
}

/**
 * Get delay for prefetch based on network conditions
 */
export function getPrefetchDelay(): number {
  const network = getNetworkInfo();
  
  if (network.effectiveType === '4g') {
    return 100; // Fast network, prefetch quickly
  }
  
  if (network.effectiveType === '3g') {
    return 500; // Medium network, delay a bit
  }
  
  return 1000; // Slow or unknown network, delay more
}

/**
 * Preload priority levels
 */
export enum PreloadPriority {
  CRITICAL = 'critical',    // Load immediately
  HIGH = 'high',           // Load after critical
  MEDIUM = 'medium',       // Load after high
  LOW = 'low',             // Load when idle
  DEFERRED = 'deferred',   // Load only when needed
}

/**
 * Preload configuration
 */
interface PreloadConfig {
  priority: PreloadPriority;
  delay?: number;
  condition?: () => boolean;
  retries?: number;
  retryDelay?: number;
}

/**
 * Preload queue manager
 */
class PreloadQueue {
  private queue: Map<string, { url: string; config: PreloadConfig; fetch: () => Promise<any> }> = new Map();
  private pending: Set<string> = new Set();
  private loaded: Set<string> = new Set();

  /**
   * Add item to preload queue
   */
  enqueue(
    key: string,
    url: string,
    config: PreloadConfig,
    fetch: () => Promise<any>
  ): void {
    if (this.loaded.has(key) || this.pending.has(key)) {
      return; // Already loaded or pending
    }

    this.queue.set(key, { url, config, fetch });
    this.scheduleProcessing();
  }

  /**
   * Process queue based on priority
   */
  private scheduleProcessing(): void {
    if (typeof window === 'undefined') return;

    // Process critical items immediately
    this.processByPriority(PreloadPriority.CRITICAL);

    // Process high priority items with small delay
    requestAnimationFrame(() => {
      this.processByPriority(PreloadPriority.HIGH);

      // Process medium priority after high
      setTimeout(() => {
        this.processByPriority(PreloadPriority.MEDIUM);

        // Process low priority when idle
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            this.processByPriority(PreloadPriority.LOW);
          }, { timeout: 5000 });
        } else {
          setTimeout(() => {
            this.processByPriority(PreloadPriority.LOW);
          }, 2000);
        }
      }, getPrefetchDelay());
    });
  }

  /**
   * Process items by priority
   */
  private processByPriority(priority: PreloadPriority): void {
    const items = Array.from(this.queue.entries())
      .filter(([_, item]) => item.config.priority === priority)
      .filter(([_, item]) => !item.config.condition || item.config.condition());

    items.forEach(([key, { config, fetch }]) => {
      if (this.pending.has(key)) return;

      this.pending.add(key);
      
      const delay = config.delay ?? 0;
      
      setTimeout(async () => {
        try {
          await fetch();
          this.loaded.add(key);
        } catch (error) {
          // Silent fail for preloading
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[Preload] Failed to load ${key}:`, error);
          }
        } finally {
          this.pending.delete(key);
          this.queue.delete(key);
        }
      }, delay);
    });
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue.clear();
    this.pending.clear();
  }

  /**
   * Get queue stats
   */
  getStats(): { queued: number; pending: number; loaded: number } {
    return {
      queued: this.queue.size,
      pending: this.pending.size,
      loaded: this.loaded.size,
    };
  }
}

// Global preload queue instance
export const preloadQueue = new PreloadQueue();

/**
 * Preload API endpoint
 */
export function preloadApiEndpoint(
  endpoint: string,
  options: {
    priority?: PreloadPriority;
    delay?: number;
    condition?: () => boolean;
  } = {}
): void {
  const {
    priority = PreloadPriority.MEDIUM,
    delay = 0,
    condition,
  } = options;

  // Check if we should prefetch based on network
  if (!shouldPrefetch() && priority !== PreloadPriority.CRITICAL) {
    return;
  }

  preloadQueue.enqueue(
    `api:${endpoint}`,
    endpoint,
    { priority, delay, condition },
    async () => {
      await cachedFetch(endpoint, { cacheTtl: 5 * 60 * 1000 });
    }
  );
}

/**
 * Preload multiple endpoints in sequence
 */
export async function preloadSequence(
  endpoints: Array<{ url: string; priority?: PreloadPriority }>,
  options: { delayBetween?: number } = {}
): Promise<void> {
  const { delayBetween = 100 } = options;

  for (const { url, priority = PreloadPriority.MEDIUM } of endpoints) {
    if (!shouldPrefetch() && priority !== PreloadPriority.CRITICAL) {
      continue;
    }

    try {
      await cachedFetch(url, { cacheTtl: 5 * 60 * 1000 });
    } catch (error) {
      // Continue with next endpoint
    }

    if (delayBetween > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetween));
    }
  }
}

/**
 * Critical path preloader for initial page load
 */
export function preloadCriticalData(userId?: string): void {
  // Preload user-specific data immediately
  if (userId) {
    preloadApiEndpoint('/api/user/profile', { priority: PreloadPriority.CRITICAL });
    preloadApiEndpoint('/api/user/balance', { priority: PreloadPriority.CRITICAL });
  }

  // Preload market data with high priority
  preloadApiEndpoint('/api/market/tickers', { priority: PreloadPriority.HIGH });
  
  // Preload strategies if user is logged in
  if (userId) {
    preloadApiEndpoint('/api/strategies', { 
      priority: PreloadPriority.HIGH,
      delay: 500,
    });
  }
}

/**
 * Predictive preloader based on user behavior
 */
export class PredictivePreloader {
  private navigationHistory: string[] = [];
  private maxHistory = 10;

  /**
   * Track navigation
   */
  trackNavigation(path: string): void {
    this.navigationHistory.push(path);
    if (this.navigationHistory.length > this.maxHistory) {
      this.navigationHistory.shift();
    }

    // Trigger predictive preload
    this.predictivePreload(path);
  }

  /**
   * Predict and preload based on current path
   */
  private predictivePreload(currentPath: string): void {
    // Don't predict if network is slow
    if (!shouldPrefetch()) return;

    // Common navigation patterns
    const patterns: Record<string, string[]> = {
      '/': ['/api/market/tickers', '/api/market/klines'],
      '/dashboard': ['/api/strategies', '/api/trades', '/api/portfolio'],
      '/strategies': ['/api/strategies', '/api/backtest'],
      '/holdings': ['/api/portfolio', '/api/trades'],
      '/trades': ['/api/trades', '/api/orders'],
    };

    const predictedEndpoints = patterns[currentPath] || [];

    predictedEndpoints.forEach((endpoint, index) => {
      preloadApiEndpoint(endpoint, {
        priority: PreloadPriority.MEDIUM,
        delay: 200 * (index + 1),
      });
    });
  }

  /**
   * Get navigation history
   */
  getHistory(): string[] {
    return [...this.navigationHistory];
  }
}

// Global predictive preloader instance
export const predictivePreloader = new PredictivePreloader();

/**
 * Initialize data preloading
 */
export function initDataPreloading(): void {
  // Track navigation for predictive preloading
  if (typeof window !== 'undefined') {
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      predictivePreloader.trackNavigation(args[2] as string);
      return originalPushState.apply(this, args);
    };

    // Track initial page
    predictivePreloader.trackNavigation(window.location.pathname);
  }
}

export default {
  getNetworkInfo,
  shouldPrefetch,
  getPrefetchDelay,
  preloadApiEndpoint,
  preloadSequence,
  preloadCriticalData,
  predictivePreloader,
  initDataPreloading,
  PreloadPriority,
};