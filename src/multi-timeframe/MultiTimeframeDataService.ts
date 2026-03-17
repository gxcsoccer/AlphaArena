/**
 * Multi-Timeframe Data Service
 * 
 * Provides K-line data for multiple timeframes with caching and optimization
 */

import { 
  Timeframe, 
  KLineDataPoint, 
  MultiTimeframeKLineData,
  ALL_TIMEFRAMES,
  TIMEFRAME_DURATIONS,
} from './types';
import { createLogger } from '../utils/logger';

const log = createLogger('MultiTimeframeDataService');

/**
 * Cache entry for K-line data
 */
interface CacheEntry {
  data: KLineDataPoint[];
  timestamp: number;
  symbol: string;
  timeframe: Timeframe;
}

/**
 * Configuration for the data service
 */
export interface MultiTimeframeDataServiceConfig {
  /** Cache TTL in milliseconds (default: 60 seconds for 1m timeframe, scales up for longer timeframes) */
  cacheTTL?: number;
  /** Maximum number of candles to keep in memory per timeframe */
  maxCandles?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Multi-Timeframe Data Service
 * 
 * Manages K-line data for multiple timeframes with intelligent caching
 */
export class MultiTimeframeDataService {
  private cache: Map<string, CacheEntry> = new Map();
  private config: Required<MultiTimeframeDataServiceConfig>;
  private dataGenerators: Map<Timeframe, () => KLineDataPoint[]> = new Map();

  constructor(config: MultiTimeframeDataServiceConfig = {}) {
    this.config = {
      cacheTTL: config.cacheTTL ?? 60000,
      maxCandles: config.maxCandles ?? 1000,
      debug: config.debug ?? false,
    };

    if (this.config.debug) {
      log.info('MultiTimeframeDataService initialized', this.config);
    }
  }

  /**
   * Register a data generator for a specific timeframe
   * This allows external data sources to provide K-line data
   */
  registerDataGenerator(timeframe: Timeframe, generator: () => KLineDataPoint[]): void {
    this.dataGenerators.set(timeframe, generator);
    log.info(`Registered data generator for timeframe: ${timeframe}`);
  }

  /**
   * Get K-line data for a single timeframe
   */
  async getKLineData(
    symbol: string,
    timeframe: Timeframe,
    limit?: number
  ): Promise<KLineDataPoint[]> {
    const cacheKey = `${symbol}:${timeframe}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      if (this.config.debug) {
        log.debug(`Cache hit for ${cacheKey}`);
      }
      return this.limitData(cached.data, limit);
    }

    // Generate or fetch data
    const data = await this.fetchOrGenerateData(symbol, timeframe);
    
    // Update cache
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      symbol,
      timeframe,
    });

    return this.limitData(data, limit);
  }

  /**
   * Get K-line data for multiple timeframes
   */
  async getMultiTimeframeData(
    symbol: string,
    timeframes: Timeframe[],
    limit?: number
  ): Promise<MultiTimeframeKLineData> {
    const dataMap = new Map<Timeframe, KLineDataPoint[]>();

    // Fetch data for all timeframes in parallel
    const promises = timeframes.map(async (timeframe) => {
      const data = await this.getKLineData(symbol, timeframe, limit);
      dataMap.set(timeframe, data);
    });

    await Promise.all(promises);

    return {
      symbol,
      data: dataMap,
      timestamp: Date.now(),
    };
  }

  /**
   * Clear cache for a specific symbol
   */
  clearCache(symbol?: string): void {
    if (symbol) {
      // Clear only entries for this symbol
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${symbol}:`)) {
          this.cache.delete(key);
        }
      }
      log.info(`Cleared cache for symbol: ${symbol}`);
    } else {
      // Clear all cache
      this.cache.clear();
      log.info('Cleared all cache');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    entries: number;
    symbols: Set<string>;
    timeframes: Set<Timeframe>;
    totalDataPoints: number;
  } {
    const symbols = new Set<string>();
    const timeframes = new Set<Timeframe>();
    let totalDataPoints = 0;

    for (const entry of this.cache.values()) {
      symbols.add(entry.symbol);
      timeframes.add(entry.timeframe);
      totalDataPoints += entry.data.length;
    }

    return {
      entries: this.cache.size,
      symbols,
      timeframes,
      totalDataPoints,
    };
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(entry: CacheEntry): boolean {
    const timeframeDuration = TIMEFRAME_DURATIONS[entry.timeframe];
    // Cache TTL scales with timeframe (longer timeframes have longer TTL)
    const adjustedTTL = Math.max(
      this.config.cacheTTL,
      timeframeDuration / 10 // At least 1/10 of the timeframe duration
    );
    
    return Date.now() - entry.timestamp < adjustedTTL;
  }

  /**
   * Fetch from generator or generate simulated data
   */
  private async fetchOrGenerateData(
    symbol: string,
    timeframe: Timeframe
  ): Promise<KLineDataPoint[]> {
    // Check if there's a registered generator
    const generator = this.dataGenerators.get(timeframe);
    if (generator) {
      return generator();
    }

    // Generate simulated data for demo/testing
    return this.generateSimulatedData(symbol, timeframe);
  }

  /**
   * Generate simulated K-line data
   * Used for testing and demo purposes
   */
  private generateSimulatedData(symbol: string, timeframe: Timeframe): KLineDataPoint[] {
    const duration = TIMEFRAME_DURATIONS[timeframe];
    const numCandles = this.config.maxCandles;
    const data: KLineDataPoint[] = [];

    // Use symbol hash as seed for reproducible randomness
    let seed = this.hashString(symbol + timeframe);
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    const now = Math.floor(Date.now() / 1000);
    let price = 100 + (this.hashString(symbol) % 90000); // Price between 100 and 90100

    for (let i = numCandles - 1; i >= 0; i--) {
      const timestamp = now - Math.floor((i * duration) / 1000);
      
      // Generate OHLCV data
      const volatility = 0.02 + random() * 0.03; // 2-5% volatility
      const change = (random() - 0.5) * 2 * volatility * price;
      
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + random() * volatility * price * 0.5;
      const low = Math.min(open, close) - random() * volatility * price * 0.5;
      const volume = Math.floor(random() * 1000000) + 10000;

      data.push({
        time: timestamp,
        open,
        high,
        low,
        close,
        volume,
      });

      price = close;
    }

    if (this.config.debug) {
      log.debug(`Generated ${data.length} candles for ${symbol} ${timeframe}`);
    }

    return data;
  }

  /**
   * Limit data to specified number of candles
   */
  private limitData(data: KLineDataPoint[], limit?: number): KLineDataPoint[] {
    if (!limit || limit >= data.length) {
      return data;
    }
    return data.slice(-limit);
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Singleton instance
 */
let instance: MultiTimeframeDataService | null = null;

/**
 * Get singleton instance of the data service
 */
export function getMultiTimeframeDataService(
  config?: MultiTimeframeDataServiceConfig
): MultiTimeframeDataService {
  if (!instance) {
    instance = new MultiTimeframeDataService(config);
  }
  return instance;
}
