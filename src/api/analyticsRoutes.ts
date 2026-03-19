/**
 * Analytics Routes
 *
 * API endpoints for strategy performance analytics
 *
 * @module api/analyticsRoutes
 */

import { Router, Request, Response } from 'express';
import { performanceAnalyticsService } from '../analytics/PerformanceAnalytics';
import { performanceDAO } from '../database/performance.dao';
import {
  AnalyticsQueryOptions,
  PerformanceReport,
} from '../analytics/types';
import { createLogger } from '../utils/logger';

const log = createLogger('AnalyticsRoutes');

const router = Router();

/**
 * GET /api/analytics/strategies
 * Get list of available strategies for analytics
 */
router.get('/strategies', async (req: Request, res: Response) => {
  try {
    // This would typically fetch from a strategies table
    res.json({
      strategies: [
        { id: 'sma', name: 'SMA 均线交叉', category: 'trend' },
        { id: 'rsi', name: 'RSI 相对强弱指标', category: 'oscillator' },
        { id: 'macd', name: 'MACD 指标', category: 'trend' },
        { id: 'bollinger', name: '布林带策略', category: 'volatility' },
        { id: 'atr', name: 'ATR 策略', category: 'volatility' },
        { id: 'stochastic', name: '随机指标策略', category: 'oscillator' },
        { id: 'ichimoku', name: '一目均衡表', category: 'trend' },
        { id: 'fibonacci', name: '斐波那契策略', category: 'support' },
        { id: 'elliott', name: '艾略特波浪', category: 'advanced' },
        { id: 'vwap', name: 'VWAP策略', category: 'volume' },
      ],
    });
  } catch (error: any) {
    log.error('Failed to get strategies:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/benchmark
 * Get benchmark data for comparison
 */
router.get('/benchmark', async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || 'SPY';
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    // Generate simulated benchmark data
    // In production, this would fetch real market data
    const benchmarkData = generateBenchmarkData(symbol, startDate, endDate);

    res.json({
      success: true,
      benchmark: benchmarkData,
    });
  } catch (error: any) {
    log.error('Failed to get benchmark data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/performance/:strategyId
 * Get performance metrics for a strategy
 */
router.get('/performance/:strategyId', async (req: Request, res: Response) => {
  try {
    const strategyId = Array.isArray(req.params.strategyId) ? req.params.strategyId[0] : req.params.strategyId;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    // Get performance snapshot from database
    const snapshots = await performanceDAO.getPerformanceSnapshotsByStrategy(strategyId);

    if (snapshots.length === 0) {
      return res.status(404).json({
        error: 'No performance data found',
        message: `No performance data found for strategy: ${strategyId}`,
      });
    }

    // Filter by date range if provided
    let filteredSnapshots = snapshots;
    if (startDate) {
      filteredSnapshots = filteredSnapshots.filter((s) => s.periodEnd >= startDate);
    }
    if (endDate) {
      filteredSnapshots = filteredSnapshots.filter((s) => s.periodStart <= endDate);
    }

    res.json({
      success: true,
      strategyId,
      snapshots: filteredSnapshots,
      latest: filteredSnapshots[0] || null,
    });
  } catch (error: any) {
    log.error('Failed to get performance data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/analytics/performance/:strategyId/calculate
 * Calculate and store performance metrics for a strategy
 */
router.post('/performance/:strategyId/calculate', async (req: Request, res: Response) => {
  try {
    const strategyId = Array.isArray(req.params.strategyId) ? req.params.strategyId[0] : req.params.strategyId;
    const { snapshots, trades, initialCapital, periodStart, periodEnd, userId } = req.body;

    if (!snapshots || !Array.isArray(snapshots)) {
      return res.status(400).json({ error: 'Snapshots array is required' });
    }

    if (!initialCapital || typeof initialCapital !== 'number') {
      return res.status(400).json({ error: 'Initial capital is required' });
    }

    // Calculate performance metrics
    const metrics = performanceAnalyticsService.calculatePerformanceMetrics(
      snapshots,
      trades || [],
      initialCapital
    );

    // Store performance snapshot
    const snapshot = await performanceDAO.createPerformanceSnapshot({
      strategyId,
      userId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      totalReturn: metrics.returns.totalReturn,
      annualizedReturn: metrics.returns.annualizedReturn,
      sharpeRatio: metrics.riskAdjusted.sharpeRatio,
      maxDrawdown: metrics.risk.maxDrawdown,
      winRate: metrics.returns.winRate,
      profitFactor: metrics.returns.avgLoss > 0
        ? metrics.returns.avgWin / metrics.returns.avgLoss
        : 0,
      totalTrades: metrics.trading.totalTrades,
      additionalMetrics: {
        sortinoRatio: metrics.riskAdjusted.sortinoRatio,
        calmarRatio: metrics.riskAdjusted.calmarRatio,
        volatility: metrics.risk.volatility,
        downsideRisk: metrics.risk.downsideRisk,
        var95: metrics.risk.var95,
        cvar: metrics.risk.cvar,
        profitLossRatio: metrics.returns.profitLossRatio,
        avgHoldingTime: metrics.trading.avgHoldingTime,
        maxConsecutiveWins: metrics.trading.maxConsecutiveWins,
        maxConsecutiveLosses: metrics.trading.maxConsecutiveLosses,
      },
    });

    log.info('Performance metrics calculated and stored', {
      strategyId,
      snapshotId: snapshot.id,
      totalReturn: metrics.returns.totalReturn,
    });

    res.json({
      success: true,
      snapshot,
      metrics,
    });
  } catch (error: any) {
    log.error('Failed to calculate performance:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/report/:strategyId
 * Generate a complete performance report for a strategy
 */
router.get('/report/:strategyId', async (req: Request, res: Response) => {
  try {
    const strategyId = Array.isArray(req.params.strategyId) ? req.params.strategyId[0] : req.params.strategyId;
    const strategyName = (req.query.name as string) || strategyId;
    const _includeTrades = req.query.includeTrades === 'true';
    const _includeBenchmark = req.query.includeBenchmark === 'true';

    // Get performance snapshots
    const snapshots = await performanceDAO.getPerformanceSnapshotsByStrategy(strategyId);

    if (snapshots.length === 0) {
      return res.status(404).json({
        error: 'No data found',
        message: `No performance data found for strategy: ${strategyId}`,
      });
    }

    // In a real implementation, we would fetch the actual snapshots and trades
    // For now, we'll use the stored performance data
    const latestSnapshot = snapshots[0];

    const report: Partial<PerformanceReport> = {
      id: `report-${strategyId}-${Date.now()}`,
      strategyId,
      strategyName,
      period: {
        start: latestSnapshot.periodStart,
        end: latestSnapshot.periodEnd,
        duration: formatDuration(latestSnapshot.periodStart, latestSnapshot.periodEnd),
      },
      summary: {
        totalReturn: latestSnapshot.totalReturn,
        annualizedReturn: latestSnapshot.annualizedReturn,
        sharpeRatio: latestSnapshot.sharpeRatio,
        maxDrawdown: latestSnapshot.maxDrawdown,
        winRate: latestSnapshot.winRate,
        profitFactor: latestSnapshot.profitFactor,
      },
      generatedAt: new Date(),
    };

    res.json({
      success: true,
      report,
    });
  } catch (error: any) {
    log.error('Failed to generate report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/analytics/report/:strategyId/generate
 * Generate a detailed performance report with custom data
 */
router.post('/report/:strategyId/generate', async (req: Request, res: Response) => {
  try {
    const strategyId = Array.isArray(req.params.strategyId) ? req.params.strategyId[0] : req.params.strategyId;
    const {
      strategyName,
      snapshots,
      trades,
      initialCapital,
      options,
    } = req.body;

    if (!snapshots || !Array.isArray(snapshots)) {
      return res.status(400).json({ error: 'Snapshots array is required' });
    }

    if (!initialCapital || typeof initialCapital !== 'number') {
      return res.status(400).json({ error: 'Initial capital is required' });
    }

    const queryOptions: AnalyticsQueryOptions = {
      includeTrades: options?.includeTrades,
      includeBenchmark: options?.includeBenchmark,
      granularity: options?.granularity,
    };

    // Generate comprehensive performance report
    const report = performanceAnalyticsService.generatePerformanceReport(
      strategyId,
      strategyName || strategyId,
      snapshots,
      trades || [],
      initialCapital,
      queryOptions
    );

    log.info('Performance report generated', {
      strategyId,
      reportId: report.id,
      totalReturn: report.summary.totalReturn,
    });

    res.json({
      success: true,
      report,
    });
  } catch (error: any) {
    log.error('Failed to generate report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/comparison
 * Get comparison data for multiple strategies
 */
router.get('/comparison', async (req: Request, res: Response) => {
  try {
    const strategyIds = req.query.strategies
      ? (req.query.strategies as string).split(',')
      : [];

    if (strategyIds.length < 2) {
      return res.status(400).json({
        error: 'At least 2 strategies required for comparison',
      });
    }

    // Get performance summary for all strategies
    const summary = await performanceDAO.getPerformanceSummary(strategyIds);

    // Convert to comparison format
    const comparisons = strategyIds.map((id) => {
      const snapshot = summary.get(id);
      return {
        strategyId: id,
        strategyName: id, // Would be fetched from strategies table
        metrics: snapshot ? {
          totalReturn: snapshot.totalReturn,
          annualizedReturn: snapshot.annualizedReturn,
          sharpeRatio: snapshot.sharpeRatio,
          maxDrawdown: snapshot.maxDrawdown,
          winRate: snapshot.winRate,
          profitFactor: snapshot.profitFactor,
          totalTrades: snapshot.totalTrades,
        } : null,
      };
    });

    // Calculate rankings
    const rankings = calculateStrategyRankings(comparisons);

    res.json({
      success: true,
      comparisons,
      rankings,
    });
  } catch (error: any) {
    log.error('Failed to get comparison:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/analytics/daily-values
 * Store daily account values
 */
router.post('/daily-values', async (req: Request, res: Response) => {
  try {
    const { accountId, values } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    if (!values || !Array.isArray(values)) {
      return res.status(400).json({ error: 'Values array is required' });
    }

    // Batch create daily values
    const dailyValues = values.map((v) => ({
      accountId,
      date: new Date(v.date),
      cash: v.cash,
      positionsValue: v.positionsValue,
      totalValue: v.totalValue,
      dailyReturn: v.dailyReturn || 0,
      cumulativeReturn: v.cumulativeReturn || 0,
    }));

    const created = await performanceDAO.batchCreateDailyAccountValues(dailyValues);

    log.info('Daily account values stored', {
      accountId,
      count: created.length,
    });

    res.json({
      success: true,
      count: created.length,
      values: created,
    });
  } catch (error: any) {
    log.error('Failed to store daily values:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/daily-values/:accountId
 * Get daily account values for an account
 */
router.get('/daily-values/:accountId', async (req: Request, res: Response) => {
  try {
    const accountId = Array.isArray(req.params.accountId) ? req.params.accountId[0] : req.params.accountId;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const values = await performanceDAO.getDailyAccountValues(accountId, startDate, endDate);

    res.json({
      success: true,
      accountId,
      values,
      count: values.length,
    });
  } catch (error: any) {
    log.error('Failed to get daily values:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/analytics/performance/:id
 * Delete a performance snapshot
 */
router.delete('/performance/:id', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    await performanceDAO.deletePerformanceSnapshot(id);

    res.json({
      success: true,
      message: 'Performance snapshot deleted',
    });
  } catch (error: any) {
    log.error('Failed to delete performance snapshot:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============== Helper Functions ==============

function generateBenchmarkData(symbol: string, startDate: Date, endDate: Date) {
  const data: { timestamp: number; value: number; return: number }[] = [];
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  
  let value = 100;
  let totalReturn = 0;

  for (let i = 0; i < days; i++) {
    const timestamp = startDate.getTime() + i * 24 * 60 * 60 * 1000;
    const dailyReturn = (Math.random() - 0.48) * 0.02; // Slight positive bias
    const returnPct = dailyReturn * 100;
    
    value *= (1 + dailyReturn);
    totalReturn += returnPct;

    data.push({
      timestamp,
      value,
      return: ((value - 100) / 100) * 100,
    });
  }

  const volatility = calculateVolatility(data.map((d) => d.return));
  const annualizedReturn = (totalReturn / days) * 252;

  return {
    symbol,
    name: getBenchmarkName(symbol),
    data,
    totalReturn: ((value - 100) / 100) * 100,
    annualizedReturn,
    volatility,
  };
}

function calculateVolatility(returns: number[]): number {
  if (returns.length === 0) return 0;
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  
  return Math.sqrt(variance) * Math.sqrt(252);
}

function getBenchmarkName(symbol: string): string {
  const names: Record<string, string> = {
    SPY: 'S&P 500 ETF',
    QQQ: 'NASDAQ 100 ETF',
    DIA: 'Dow Jones ETF',
    BTC: 'Bitcoin',
    ETH: 'Ethereum',
  };
  return names[symbol] || symbol;
}

function formatDuration(start: Date, end: Date): string {
  const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  
  if (days < 30) return `${Math.round(days)} days`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  
  const years = Math.floor(days / 365);
  const months = Math.round((days % 365) / 30);
  
  if (months === 0) return `${years} year${years > 1 ? 's' : ''}`;
  return `${years} year${years > 1 ? 's' : ''} ${months} months`;
}

function calculateStrategyRankings(
  comparisons: Array<{
    strategyId: string;
    strategyName: string;
    metrics: any;
  }>
): Array<{
  strategyId: string;
  strategyName: string;
  overallRank: number;
  metricRanks: Record<string, number>;
  compositeScore: number;
}> {
  if (comparisons.length === 0) return [];

  // Filter out strategies without metrics
  const validComparisons = comparisons.filter((c) => c.metrics);

  // Calculate rankings for each metric
  const metrics = ['totalReturn', 'annualizedReturn', 'sharpeRatio', 'winRate', 'profitFactor'];
  const reverseMetrics = ['maxDrawdown']; // Lower is better

  const rankings = validComparisons.map((comparison) => {
    const metricRanks: Record<string, number> = {};

    for (const metric of metrics) {
      const sorted = [...validComparisons].sort((a, b) =>
        (b.metrics?.[metric] || 0) - (a.metrics?.[metric] || 0)
      );
      metricRanks[metric] = sorted.findIndex((c) => c.strategyId === comparison.strategyId) + 1;
    }

    for (const metric of reverseMetrics) {
      const sorted = [...validComparisons].sort((a, b) =>
        (a.metrics?.[metric] || 0) - (b.metrics?.[metric] || 0)
      );
      metricRanks[metric] = sorted.findIndex((c) => c.strategyId === comparison.strategyId) + 1;
    }

    // Calculate composite score
    const weights = {
      totalReturn: 0.25,
      sharpeRatio: 0.25,
      maxDrawdown: 0.2,
      winRate: 0.15,
      profitFactor: 0.15,
    };

    let weightedRank = 0;
    for (const [metric, weight] of Object.entries(weights)) {
      weightedRank += (metricRanks[metric] || validComparisons.length) * weight;
    }

    const compositeScore = 100 - (weightedRank / validComparisons.length) * 100;

    return {
      strategyId: comparison.strategyId,
      strategyName: comparison.strategyName,
      overallRank: 0,
      metricRanks,
      compositeScore: Math.max(0, compositeScore),
    };
  });

  // Sort by composite score and assign overall rank
  rankings.sort((a, b) => b.compositeScore - a.compositeScore);
  rankings.forEach((r, i) => {
    r.overallRank = i + 1;
  });

  return rankings;
}

export default router;