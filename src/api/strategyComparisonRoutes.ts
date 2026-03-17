/**
 * Strategy Comparison Routes
 *
 * API endpoints for strategy comparison and analysis
 */

import { Router, Request, Response } from 'express';
import {
  strategyComparisonService,
  ComparisonConfig,
  StrategyComparisonResult,
} from '../strategy/StrategyComparisonService';
import { createLogger } from '../utils/logger';

const log = createLogger('StrategyComparisonRoutes');

const router = Router();

/**
 * GET /api/strategies/compare/strategies
 * Get list of available strategies for comparison
 */
router.get('/strategies', (req: Request, res: Response) => {
  res.json({
    strategies: [
      { id: 'sma', name: 'SMA 均线交叉', description: '简单移动平均线交叉策略', category: 'trend' },
      { id: 'rsi', name: 'RSI 相对强弱指标', description: '基于RSI超买超卖信号', category: 'oscillator' },
      { id: 'macd', name: 'MACD 指标', description: 'MACD金叉死叉策略', category: 'trend' },
      { id: 'bollinger', name: '布林带策略', description: '布林带突破策略', category: 'volatility' },
      { id: 'atr', name: 'ATR 策略', description: '平均真实波幅策略', category: 'volatility' },
      { id: 'stochastic', name: '随机指标策略', description: 'KDJ随机指标策略', category: 'oscillator' },
      { id: 'ichimoku', name: '一目均衡表', description: 'Ichimoku Cloud策略', category: 'trend' },
      { id: 'fibonacci', name: '斐波那契策略', description: '斐波那契回撤策略', category: 'support' },
      { id: 'elliott', name: '艾略特波浪', description: 'Elliott Wave策略', category: 'advanced' },
      { id: 'vwap', name: 'VWAP策略', description: '成交量加权平均价策略', category: 'volume' },
    ],
  });
});

/**
 * GET /api/strategies/compare/symbols
 * Get list of available trading symbols
 */
router.get('/symbols', (req: Request, res: Response) => {
  res.json({
    symbols: [
      { id: 'BTC/USDT', name: 'Bitcoin', category: 'crypto' },
      { id: 'ETH/USDT', name: 'Ethereum', category: 'crypto' },
      { id: 'SOL/USDT', name: 'Solana', category: 'crypto' },
      { id: 'AAPL', name: 'Apple Inc.', category: 'stock' },
      { id: 'GOOGL', name: 'Alphabet Inc.', category: 'stock' },
      { id: 'TSLA', name: 'Tesla Inc.', category: 'stock' },
      { id: 'MSFT', name: 'Microsoft Corp.', category: 'stock' },
      { id: 'NVDA', name: 'NVIDIA Corp.', category: 'stock' },
    ],
  });
});

/**
 * POST /api/strategies/compare
 * Execute a strategy comparison
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const config: ComparisonConfig = req.body;

    log.info('Starting strategy comparison with config:', {
      strategies: config.strategies?.map((s) => s.name),
      symbol: config.symbol,
      capital: config.capital,
    });

    // Validate required fields
    if (!config.strategies || !Array.isArray(config.strategies)) {
      return res.status(400).json({ error: 'Strategies array is required' });
    }

    if (config.strategies.length < 2) {
      return res.status(400).json({ error: 'At least 2 strategies are required for comparison' });
    }

    if (config.strategies.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 strategies can be compared at once' });
    }

    if (!config.capital || config.capital < 100) {
      return res.status(400).json({ error: 'Initial capital must be at least 100' });
    }

    if (!config.symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    if (!config.startTime || !config.endTime) {
      return res.status(400).json({ error: 'Start time and end time are required' });
    }

    if (config.startTime >= config.endTime) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }

    // Execute comparison
    const result = await strategyComparisonService.compare(config);

    log.info('Strategy comparison completed:', {
      id: result.id,
      executionTime: result.executionTime,
      topStrategy: result.rankings[0]?.strategyName,
    });

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    log.error('Strategy comparison failed:', error);
    res.status(500).json({
      error: error.message || 'Strategy comparison failed',
    });
  }
});

/**
 * GET /api/strategies/compare/:id
 * Get a comparison result by ID
 */
router.get('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = strategyComparisonService.getComparison(id);

  if (!result) {
    return res.status(404).json({
      error: 'Comparison not found',
      message: `No comparison found with ID: ${id}`,
    });
  }

  res.json({
    success: true,
    result,
  });
});

/**
 * GET /api/strategies/compare
 * Get all comparison results
 */
router.get('/', (req: Request, res: Response) => {
  const results = strategyComparisonService.getAllComparisons();

  res.json({
    success: true,
    results,
    count: results.length,
  });
});

/**
 * DELETE /api/strategies/compare/:id
 * Delete a comparison result
 */
router.delete('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = strategyComparisonService.deleteComparison(id);

  if (!deleted) {
    return res.status(404).json({
      error: 'Comparison not found',
      message: `No comparison found with ID: ${id}`,
    });
  }

  res.json({
    success: true,
    message: 'Comparison deleted successfully',
  });
});

/**
 * GET /api/strategies/compare/:id/export/csv
 * Export comparison result as CSV
 */
router.get('/:id/export/csv', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = strategyComparisonService.getComparison(id);

  if (!result) {
    return res.status(404).json({
      error: 'Comparison not found',
      message: `No comparison found with ID: ${id}`,
    });
  }

  const csv = strategyComparisonService.exportToCSV(result);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="strategy-comparison-${id}.csv"`);
  res.send(csv);
});

/**
 * GET /api/strategies/compare/:id/export/equity-curves
 * Export equity curves as CSV
 */
router.get('/:id/export/equity-curves', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = strategyComparisonService.getComparison(id);

  if (!result) {
    return res.status(404).json({
      error: 'Comparison not found',
      message: `No comparison found with ID: ${id}`,
    });
  }

  const csv = strategyComparisonService.exportEquityCurvesToCSV(result);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="equity-curves-${id}.csv"`);
  res.send(csv);
});

export default router;
