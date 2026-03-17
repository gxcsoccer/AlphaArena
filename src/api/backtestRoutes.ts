/**
 * Backtest Routes
 * 
 * API endpoints for backtest execution and data retrieval
 */

import { Router, Request, Response } from 'express';
import { BacktestEngine } from '../backtest/BacktestEngine';
import { BacktestConfig, BacktestResult } from '../backtest/types';
import { createLogger } from '../utils/logger';

const log = createLogger('BacktestRoutes');

const router = Router();

/**
 * POST /api/backtest/run
 * Execute a backtest with the given configuration
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const config: BacktestConfig = req.body;
    
    log.info('Running backtest with config:', config);
    
    // Validate config
    if (!config.capital || config.capital < 100) {
      return res.status(400).json({ error: 'Initial capital must be at least 100' });
    }
    
    if (!config.symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    if (!config.strategy) {
      return res.status(400).json({ error: 'Strategy is required' });
    }
    
    if (!config.startTime || !config.endTime) {
      return res.status(400).json({ error: 'Start and end times are required' });
    }
    
    if (config.startTime >= config.endTime) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }
    
    // Create and run backtest
    const engine = new BacktestEngine(config);
    const result = await engine.run();
    
    log.info('Backtest completed:', result.stats);
    
    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    log.error('Backtest failed:', error);
    res.status(500).json({
      error: error.message || 'Backtest execution failed',
    });
  }
});

/**
 * GET /api/backtest/strategies
 * Get list of available strategies
 */
router.get('/strategies', (req: Request, res: Response) => {
  res.json({
    strategies: [
      { id: 'sma', name: 'SMA 均线交叉', description: '简单移动平均线交叉策略' },
      { id: 'rsi', name: 'RSI 相对强弱指标', description: '基于RSI超买超卖信号' },
      { id: 'macd', name: 'MACD 指标', description: 'MACD金叉死叉策略' },
      { id: 'bollinger', name: '布林带策略', description: '布林带突破策略' },
      { id: 'atr', name: 'ATR 策略', description: '平均真实波幅策略' },
    ],
  });
});

/**
 * GET /api/backtest/symbols
 * Get list of available trading symbols
 */
router.get('/symbols', (req: Request, res: Response) => {
  res.json({
    symbols: [
      { id: 'BTC/USDT', name: 'Bitcoin', category: 'crypto' },
      { id: 'ETH/USDT', name: 'Ethereum', category: 'crypto' },
      { id: 'AAPL', name: 'Apple Inc.', category: 'stock' },
      { id: 'GOOGL', name: 'Alphabet Inc.', category: 'stock' },
      { id: 'TSLA', name: 'Tesla Inc.', category: 'stock' },
      { id: 'MSFT', name: 'Microsoft Corp.', category: 'stock' },
    ],
  });
});

/**
 * GET /api/backtest/result/:id
 * Get a previously run backtest result
 */
router.get('/result/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // TODO: Implement result storage and retrieval
  res.status(404).json({
    error: 'Result not found',
    message: 'Backtest result storage not implemented yet',
  });
});

/**
 * POST /api/backtest/compare
 * Compare multiple strategies
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { strategies, config } = req.body;
    
    if (!strategies || !Array.isArray(strategies) || strategies.length < 2) {
      return res.status(400).json({ error: 'At least 2 strategies are required for comparison' });
    }
    
    const results: Array<{ strategy: string; result: BacktestResult }> = [];
    
    for (const strategy of strategies) {
      const backtestConfig: BacktestConfig = {
        ...config,
        strategy,
      };
      
      const engine = new BacktestEngine(backtestConfig);
      const result = await engine.run();
      
      results.push({
        strategy,
        result,
      });
    }
    
    res.json({
      success: true,
      comparison: results,
    });
  } catch (error: any) {
    log.error('Strategy comparison failed:', error);
    res.status(500).json({
      error: error.message || 'Strategy comparison failed',
    });
  }
});

export default router;
