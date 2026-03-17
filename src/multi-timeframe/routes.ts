/**
 * Multi-Timeframe API Routes
 * 
 * REST API endpoints for multi-timeframe analysis
 */

import { Router, Request, Response } from 'express';
import { 
  Timeframe, 
  MultiTimeframeKLineResponse,
  KLineDataPoint,
  ALL_TIMEFRAMES,
  isValidTimeframe,
} from './types';
import { getMultiTimeframeDataService } from './MultiTimeframeDataService';
import { createLogger } from '../utils/logger';

const log = createLogger('MultiTimeframeRoutes');

const router = Router();

/**
 * GET /api/multi-timeframe/kline/:symbol
 * Get K-line data for multiple timeframes
 * 
 * Query params:
 * - timeframes: comma-separated list of timeframes (e.g., "1h,4h,1d")
 * - limit: number of candles per timeframe (optional, default: 100)
 */
router.get('/kline/:symbol', async (req: Request, res: Response) => {
  try {
    const symbolParam = req.params.symbol;
    const symbol = Array.isArray(symbolParam) ? symbolParam[0] : symbolParam;
    const timeframesParam = req.query.timeframes as string;
    const limit = parseInt(req.query.limit as string) || 100;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol is required',
        timestamp: Date.now(),
      } as MultiTimeframeKLineResponse);
    }

    // Parse timeframes
    let timeframes: Timeframe[] = [];
    if (timeframesParam) {
      const parsed = timeframesParam.split(',').map(t => t.trim());
      for (const tf of parsed) {
        if (!isValidTimeframe(tf)) {
          return res.status(400).json({
            success: false,
            symbol,
            error: `Invalid timeframe: ${tf}. Valid timeframes: ${ALL_TIMEFRAMES.join(', ')}`,
            data: {},
            timestamp: Date.now(),
          } as MultiTimeframeKLineResponse);
        }
        timeframes.push(tf as Timeframe);
      }
    } else {
      // Default to all timeframes
      timeframes = [...ALL_TIMEFRAMES];
    }

    log.info(`Fetching multi-timeframe data for ${symbol}`, { timeframes, limit });

    // Get data service
    const dataService = getMultiTimeframeDataService();

    // Fetch data for all timeframes
    const mtfData = await dataService.getMultiTimeframeData(symbol, timeframes, limit);

    // Convert Map to Record for JSON response
    const dataRecord: Record<string, KLineDataPoint[]> = {};
    for (const [tf, data] of mtfData.data) {
      dataRecord[tf] = data;
    }

    const response: MultiTimeframeKLineResponse = {
      success: true,
      symbol,
      data: dataRecord,
      timestamp: mtfData.timestamp,
    };

    res.json(response);
  } catch (error: any) {
    log.error('Failed to fetch multi-timeframe K-line data', error);
    const symbolParam = req.params.symbol;
    const symbol = Array.isArray(symbolParam) ? symbolParam[0] : symbolParam || '';
    res.status(500).json({
      success: false,
      symbol,
      error: error.message || 'Internal server error',
      data: {},
      timestamp: Date.now(),
    } as MultiTimeframeKLineResponse);
  }
});

/**
 * GET /api/multi-timeframe/timeframes
 * Get list of supported timeframes
 */
router.get('/timeframes', (req: Request, res: Response) => {
  res.json({
    success: true,
    timeframes: ALL_TIMEFRAMES.map(tf => ({
      id: tf,
      label: getLabel(tf),
      duration: getDuration(tf),
    })),
    timestamp: Date.now(),
  });
});

/**
 * GET /api/multi-timeframe/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', (req: Request, res: Response) => {
  try {
    const dataService = getMultiTimeframeDataService();
    const stats = dataService.getCacheStats();
    
    res.json({
      success: true,
      stats: {
        ...stats,
        symbols: Array.from(stats.symbols),
        timeframes: Array.from(stats.timeframes),
      },
      timestamp: Date.now(),
    });
  } catch (error: any) {
    log.error('Failed to get cache stats', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now(),
    });
  }
});

/**
 * DELETE /api/multi-timeframe/cache/:symbol?
 * Clear cache for a specific symbol or all symbols
 */
router.delete('/cache/:symbol?', (req: Request, res: Response) => {
  try {
    const symbolParam = req.params.symbol;
    const symbol = symbolParam ? (Array.isArray(symbolParam) ? symbolParam[0] : symbolParam) : undefined;
    const dataService = getMultiTimeframeDataService();
    
    dataService.clearCache(symbol);
    
    res.json({
      success: true,
      message: symbol ? `Cache cleared for ${symbol}` : 'All cache cleared',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    log.error('Failed to clear cache', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now(),
    });
  }
});

/**
 * Helper function to get timeframe label
 */
function getLabel(tf: Timeframe): string {
  const labels: Record<Timeframe, string> = {
    '1m': '1分钟',
    '5m': '5分钟',
    '15m': '15分钟',
    '1h': '1小时',
    '4h': '4小时',
    '1d': '1天',
  };
  return labels[tf];
}

/**
 * Helper function to get timeframe duration in milliseconds
 */
function getDuration(tf: Timeframe): number {
  const durations: Record<Timeframe, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };
  return durations[tf];
}

export default router;
