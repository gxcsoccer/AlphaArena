/**
 * Live vs Backtest Comparison Routes
 *
 * API endpoints for comparing live trading results with backtest predictions
 *
 * @module api/comparisonRoutes
 */

import { Router, Request, Response } from 'express';
import { backtestLiveComparisonService } from '../backtest-live/BacktestLiveComparisonService';
import { backtestLiveDAO } from '../database/backtest-live.dao';
import { ComparisonReportConfig, ComparisonExportFormat } from '../backtest-live/ComparisonTypes';
import { createLogger } from '../utils/logger';

const log = createLogger('ComparisonRoutes');

const router = Router();

/**
 * Helper to get query param (handles express query type)
 */
function getQueryParam(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

/**
 * Helper to get single string param
 */
function getParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * POST /api/comparison/reports
 * Generate a new comparison report
 */
router.post('/reports', async (req: Request, res: Response) => {
  try {
    const { integrationId, userId, periodStart, periodEnd, options } = req.body;

    if (!integrationId || !userId) {
      return res.status(400).json({
        error: 'Integration ID and User ID are required',
      });
    }

    const config: ComparisonReportConfig = {
      integrationId,
      userId,
      periodStart: periodStart || Date.now() - 30 * 24 * 60 * 60 * 1000, // Default: 30 days ago
      periodEnd: periodEnd || Date.now(),
      includeTradeAnalysis: options?.includeTradeAnalysis ?? true,
      includeMarketEnvironment: options?.includeMarketEnvironment ?? true,
      includeSlippageAnalysis: options?.includeSlippageAnalysis ?? true,
      includeFeeAnalysis: options?.includeFeeAnalysis ?? true,
      includeExecutionDelayAnalysis: options?.includeExecutionDelayAnalysis ?? true,
      maxInsights: options?.maxInsights ?? 10,
    };

    const report = await backtestLiveComparisonService.generateComparisonReport(config);

    log.info(`Generated comparison report ${report.id} for integration ${integrationId}`);

    res.status(201).json({
      success: true,
      report,
    });
  } catch (error: any) {
    log.error('Failed to generate comparison report:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate comparison report',
    });
  }
});

/**
 * GET /api/comparison/reports/:id
 * Get a specific comparison report
 */
router.get('/reports/:id', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Report ID is required' });
    }

    // In production, this would fetch from database
    // For now, regenerate the report
    res.status(404).json({
      error: 'Report not found. Please regenerate the report.',
    });
  } catch (error: any) {
    log.error('Failed to get comparison report:', error);
    res.status(500).json({
      error: error.message || 'Failed to get comparison report',
    });
  }
});

/**
 * GET /api/comparison/integrations/:integrationId/quick
 * Quick comparison summary for an integration
 */
router.get('/integrations/:integrationId/quick', async (req: Request, res: Response) => {
  try {
    const integrationId = getParam(req.params.integrationId);
    if (!integrationId) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }

    // Get latest comparison from performance monitor
    const summary = await backtestLiveDAO.getLatestComparison(integrationId);

    if (!summary) {
      return res.status(404).json({
        error: 'No comparison data available. Run a comparison first.',
      });
    }

    // Generate quick summary
    const quickSummary = {
      integrationId,
      timestamp: summary.timestamp,
      backtestReturn: summary.comparison.backtestMetrics.totalReturn,
      liveReturn: summary.comparison.liveMetrics.totalReturn,
      deviation: summary.comparison.deviation.overallScore,
      status: summary.comparison.deviation.overallScore < 20 ? 'on_track' :
              summary.comparison.deviation.overallScore < 40 ? 'underperforming' : 'critical',
      keyMetrics: {
        sharpe: {
          backtest: summary.comparison.backtestMetrics.sharpeRatio,
          live: summary.comparison.liveMetrics.sharpeRatio,
          deviation: summary.comparison.deviation.sharpeDeviation,
        },
        winRate: {
          backtest: summary.comparison.backtestMetrics.winRate,
          live: summary.comparison.liveMetrics.winRate,
          deviation: summary.comparison.deviation.winRateDeviation,
        },
        maxDrawdown: {
          backtest: summary.comparison.backtestMetrics.maxDrawdown,
          live: summary.comparison.liveMetrics.maxDrawdown,
          deviation: summary.comparison.deviation.drawdownDeviation,
        },
      },
    };

    res.json({
      success: true,
      summary: quickSummary,
    });
  } catch (error: any) {
    log.error('Failed to get quick comparison:', error);
    res.status(500).json({
      error: error.message || 'Failed to get quick comparison',
    });
  }
});

/**
 * GET /api/comparison/integrations/:integrationId/metrics
 * Get detailed metrics comparison for an integration
 */
router.get('/integrations/:integrationId/metrics', async (req: Request, res: Response) => {
  try {
    const integrationId = getParam(req.params.integrationId);
    if (!integrationId) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }

    const integration = await backtestLiveDAO.getIntegration(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Get latest comparison
    const latestComparison = await backtestLiveDAO.getLatestComparison(integrationId);

    if (!latestComparison) {
      return res.status(404).json({
        error: 'No comparison data available',
      });
    }

    const { backtestMetrics, liveMetrics, deviation } = latestComparison.comparison;

    // Format metrics for display
    const metrics = [
      {
        name: 'Total Return',
        key: 'totalReturn',
        backtest: backtestMetrics.totalReturn,
        live: liveMetrics.totalReturn,
        unit: '%',
        deviation: deviation.returnDeviation,
      },
      {
        name: 'Sharpe Ratio',
        key: 'sharpeRatio',
        backtest: backtestMetrics.sharpeRatio,
        live: liveMetrics.sharpeRatio,
        unit: '',
        deviation: deviation.sharpeDeviation,
      },
      {
        name: 'Max Drawdown',
        key: 'maxDrawdown',
        backtest: backtestMetrics.maxDrawdown,
        live: liveMetrics.maxDrawdown,
        unit: '%',
        deviation: deviation.drawdownDeviation,
      },
      {
        name: 'Win Rate',
        key: 'winRate',
        backtest: backtestMetrics.winRate,
        live: liveMetrics.winRate,
        unit: '%',
        deviation: deviation.winRateDeviation,
      },
      {
        name: 'Profit Factor',
        key: 'profitFactor',
        backtest: backtestMetrics.profitFactor,
        live: liveMetrics.profitFactor,
        unit: '',
        deviation: ((liveMetrics.profitFactor - backtestMetrics.profitFactor) / (backtestMetrics.profitFactor || 1)) * 100,
      },
      {
        name: 'Total Trades',
        key: 'totalTrades',
        backtest: backtestMetrics.totalTrades,
        live: liveMetrics.totalTrades,
        unit: '',
        deviation: deviation.tradeCountDeviation,
      },
    ];

    res.json({
      success: true,
      integrationId,
      metrics,
      overallDeviation: deviation.overallScore,
      generatedAt: latestComparison.timestamp,
    });
  } catch (error: any) {
    log.error('Failed to get metrics comparison:', error);
    res.status(500).json({
      error: error.message || 'Failed to get metrics comparison',
    });
  }
});

/**
 * GET /api/comparison/integrations/:integrationId/timeline
 * Get divergence timeline for an integration
 */
router.get('/integrations/:integrationId/timeline', async (req: Request, res: Response) => {
  try {
    const integrationId = getParam(req.params.integrationId);
    const limitStr = getQueryParam(req.query.limit);

    if (!integrationId) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }

    const limit = limitStr ? parseInt(limitStr) : 100;

    const history = await backtestLiveDAO.getHistoricalComparisons(integrationId, limit);

    const timeline = history.map(record => ({
      timestamp: record.timestamp,
      overallDeviation: record.comparison.deviation.overallScore,
      returnDeviation: record.comparison.deviation.returnDeviation,
      sharpeDeviation: record.comparison.deviation.sharpeDeviation,
      drawdownDeviation: record.comparison.deviation.drawdownDeviation,
      winRateDeviation: record.comparison.deviation.winRateDeviation,
    }));

    res.json({
      success: true,
      integrationId,
      timeline,
      count: timeline.length,
    });
  } catch (error: any) {
    log.error('Failed to get divergence timeline:', error);
    res.status(500).json({
      error: error.message || 'Failed to get divergence timeline',
    });
  }
});

/**
 * GET /api/comparison/integrations/:integrationId/insights
 * Get improvement insights for an integration
 */
router.get('/integrations/:integrationId/insights', async (req: Request, res: Response) => {
  try {
    const integrationId = getParam(req.params.integrationId);
    const maxInsightsStr = getQueryParam(req.query.maxInsights);

    if (!integrationId) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }

    const maxInsights = maxInsightsStr ? parseInt(maxInsightsStr) : 10;

    // Generate insights using the comparison service
    const config: ComparisonReportConfig = {
      integrationId,
      userId: 'system',
      periodStart: Date.now() - 30 * 24 * 60 * 60 * 1000,
      periodEnd: Date.now(),
      maxInsights,
    };

    const report = await backtestLiveComparisonService.generateComparisonReport(config);

    res.json({
      success: true,
      integrationId,
      insights: report.insights,
      generatedAt: report.generatedAt,
    });
  } catch (error: any) {
    log.error('Failed to get insights:', error);
    res.status(500).json({
      error: error.message || 'Failed to get insights',
    });
  }
});

/**
 * POST /api/comparison/reports/:id/export
 * Export comparison report
 */
router.post('/reports/:id/export', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Report ID is required' });
    }

    const { format, includeCharts, includeDataTables, language, title } = req.body;

    const exportFormat: ComparisonExportFormat = format || 'json';

    // In production, this would fetch the stored report and generate export
    // For now, return a placeholder response
    res.json({
      success: true,
      message: 'Export feature will be implemented with report storage',
      format: exportFormat,
    });
  } catch (error: any) {
    log.error('Failed to export report:', error);
    res.status(500).json({
      error: error.message || 'Failed to export report',
    });
  }
});

/**
 * GET /api/comparison/dashboard/:userId
 * Get dashboard data for all user's integrations
 */
router.get('/dashboard/:userId', async (req: Request, res: Response) => {
  try {
    const userId = getParam(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get all user's integrations
    const integrations = await backtestLiveDAO.getUserIntegrations(userId);

    // Get summary for each integration
    const dashboardData = await Promise.all(
      integrations.map(async (integration) => {
        const latestComparison = await backtestLiveDAO.getLatestComparison(integration.id);

        return {
          integrationId: integration.id,
          strategyName: integration.strategy.name,
          status: integration.status,
          environment: integration.environment,
          lastComparison: latestComparison ? {
            timestamp: latestComparison.timestamp,
            overallDeviation: latestComparison.comparison.deviation.overallScore,
            returnDeviation: latestComparison.comparison.deviation.returnDeviation,
          } : null,
        };
      })
    );

    // Calculate overall stats
    const stats = {
      totalIntegrations: integrations.length,
      activeIntegrations: integrations.filter(i => i.status === 'live' || i.status === 'paper_trading').length,
      onTrack: dashboardData.filter(d => d.lastComparison && d.lastComparison.overallDeviation < 20).length,
      underperforming: dashboardData.filter(d => d.lastComparison && d.lastComparison.overallDeviation >= 20 && d.lastComparison.overallDeviation < 40).length,
      critical: dashboardData.filter(d => d.lastComparison && d.lastComparison.overallDeviation >= 40).length,
    };

    res.json({
      success: true,
      dashboard: dashboardData,
      stats,
    });
  } catch (error: any) {
    log.error('Failed to get dashboard data:', error);
    res.status(500).json({
      error: error.message || 'Failed to get dashboard data',
    });
  }
});

export default router;