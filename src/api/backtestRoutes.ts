/**
 * Backtest Routes
 * 
 * API endpoints for backtest execution and data retrieval
 * Includes VIP-only features: parameter optimization, strategy comparison, historical data limits
 */

import { Router, Request, Response } from 'express';
import { BacktestEngine } from '../backtest/BacktestEngine';
import { BacktestConfig, BacktestResult } from '../backtest/types';
import { createLogger } from '../utils/logger';
import { requirePlan } from '../middleware/subscription.middleware';
import { 
  checkHistoricalDataPermission, 
  adjustDateRangeToPlan, 
  getUserPlan 
} from '../services/HistoricalDataPermissionService';

const log = createLogger('BacktestRoutes');

const router = Router();

/**
 * POST /api/backtest/run
 * Execute a backtest with the given configuration
 * Includes historical data permission check based on subscription tier
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const config: BacktestConfig = req.body;
    const userId = req.user?.id;
    
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
    
    // Check historical data permission
    if (userId) {
      const permission = await checkHistoricalDataPermission(
        userId,
        new Date(config.startTime),
        new Date(config.endTime)
      );
      
      if (!permission.allowed) {
        log.warn(`User ${userId} denied historical data access: requested ${permission.requestedDays} days, max ${permission.maxDays}`);
        
        return res.status(403).json({
          error: 'Historical data limit exceeded',
          message: permission.message,
          max_days: permission.maxDays,
          requested_days: permission.requestedDays,
          upgrade_url: '/pricing',
        });
      }
      
      // Adjust date range if needed
      const plan = await getUserPlan(userId);
      const adjustedStartTime = adjustDateRangeToPlan(
        plan,
        new Date(config.startTime),
        new Date(config.endTime)
      );
      
      if (adjustedStartTime.getTime() !== config.startTime) {
        log.info(`Adjusted backtest start time for user ${userId}: ${config.startTime} -> ${adjustedStartTime}`);
        config.startTime = adjustedStartTime.getTime();
      }
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
  const { id: _id } = req.params;
  
  // TODO: Implement result storage and retrieval
  res.status(404).json({
    error: 'Result not found',
    message: 'Backtest result storage not implemented yet',
  });
});

/**
 * POST /api/backtest/compare
 * Compare multiple strategies
 * VIP-only feature (Pro and above)
 */
router.post('/compare', requirePlan(['pro', 'enterprise']), async (req: Request, res: Response) => {
  try {
    const { strategies, config } = req.body;
    
    if (!strategies || !Array.isArray(strategies) || strategies.length < 2) {
      return res.status(400).json({ error: 'At least 2 strategies are required for comparison' });
    }
    
    // Limit number of strategies for non-enterprise users
    const userId = req.user?.id;
    const plan = userId ? await getUserPlan(userId) : 'free';
    const maxStrategies = plan === 'enterprise' ? -1 : plan === 'pro' ? 5 : 0;
    
    if (maxStrategies > 0 && strategies.length > maxStrategies) {
      return res.status(400).json({ 
        error: `Strategy limit exceeded`,
        message: `Your plan allows comparing up to ${maxStrategies} strategies. You requested ${strategies.length}.`,
        max_strategies: maxStrategies,
      });
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

/**
 * POST /api/backtest/optimize
 * Parameter optimization for a strategy
 * VIP-only feature (Pro and above)
 */
router.post('/optimize', requirePlan(['pro', 'enterprise']), async (req: Request, res: Response) => {
  try {
    const { strategy, symbol, parameters, config } = req.body;
    
    if (!strategy || !symbol || !parameters) {
      return res.status(400).json({ 
        error: 'Strategy, symbol, and parameters are required' 
      });
    }
    
    log.info(`Running parameter optimization for strategy ${strategy} on ${symbol}`);
    
    // Run optimization across parameter ranges
    const results: Array<{ params: Record<string, number>; metrics: any }> = [];
    
    // This is a simplified implementation
    // In production, this would use a more sophisticated optimization algorithm
    const totalIterations = parameters.reduce((acc: number, p: any) => {
      return acc + Math.ceil((p.max - p.min) / p.step);
    }, 1);
    
    // Limit iterations for non-enterprise users
    const userId = req.user?.id;
    const plan = userId ? await getUserPlan(userId) : 'free';
    const maxIterations = plan === 'enterprise' ? -1 : plan === 'pro' ? 100 : 0;
    
    if (maxIterations > 0 && totalIterations > maxIterations) {
      return res.status(400).json({
        error: 'Optimization limit exceeded',
        message: `Your plan allows up to ${maxIterations} optimization iterations. You requested ${totalIterations}.`,
        max_iterations: maxIterations,
      });
    }
    
    // Run optimization (simplified - in production use parallel processing)
    for (const param of parameters) {
      for (let value = param.min; value <= param.max; value += param.step) {
        const backtestConfig: BacktestConfig = {
          ...config,
          strategy,
          symbol,
          params: { [param.name]: value },
        };
        
        try {
          const engine = new BacktestEngine(backtestConfig);
          const result = await engine.run();
          
          results.push({
            params: { [param.name]: value },
            metrics: result.stats,
          });
        } catch (err) {
          log.warn(`Optimization iteration failed for ${param.name}=${value}:`, err);
        }
      }
    }
    
    // Sort by Sharpe ratio (best first)
    results.sort((a, b) => b.metrics.sharpeRatio - a.metrics.sharpeRatio);
    
    res.json({
      success: true,
      total_iterations: results.length,
      best_result: results[0],
      top_results: results.slice(0, 10),
    });
  } catch (error: any) {
    log.error('Parameter optimization failed:', error);
    res.status(500).json({
      error: error.message || 'Parameter optimization failed',
    });
  }
});

/**
 * GET /api/backtest/export/:id
 * Export backtest report as PDF or Excel
 * VIP-only feature (Pro and above)
 */
router.get('/export/:id', requirePlan(['pro', 'enterprise']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { format = 'pdf' } = req.query;
    
    // TODO: Implement report generation
    // For now, return a placeholder
    res.status(501).json({
      error: 'Not implemented',
      message: 'Report export will be available soon',
    });
  } catch (error: any) {
    log.error('Report export failed:', error);
    res.status(500).json({
      error: error.message || 'Report export failed',
    });
  }
});

/**
 * GET /api/backtest/data-limits
 * Get historical data limits for the current user
 */
router.get('/data-limits', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.json({
        plan: 'free',
        max_days: 7,
        is_unlimited: false,
        description: '最近 7 天历史数据',
      });
    }
    
    const plan = await getUserPlan(userId);
    const maxDays = plan === 'enterprise' ? -1 : plan === 'pro' ? 30 : 7;
    
    res.json({
      plan,
      max_days: maxDays,
      is_unlimited: maxDays === -1,
      description: maxDays === -1 ? '无限历史数据访问' : `最近 ${maxDays} 天历史数据`,
    });
  } catch (error: any) {
    log.error('Failed to get data limits:', error);
    res.status(500).json({
      error: error.message || 'Failed to get data limits',
    });
  }
});

export default router;
