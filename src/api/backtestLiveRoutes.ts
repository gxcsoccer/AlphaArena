/**
 * Backtest-Live Integration Routes
 *
 * API endpoints for backtest-to-live trading integration
 *
 * @module api/backtestLiveRoutes
 */

import { Router, Request, Response } from 'express';
import { backtestLiveIntegration } from '../backtest-live/BacktestLiveIntegration';
import { backtestLiveDAO } from '../database/backtest-live.dao';
import { TradingEnvironment } from '../backtest-live/types';
import { createLogger } from '../utils/logger';

const log = createLogger('BacktestLiveRoutes');

const router = Router();

/**
 * Helper to get single string param
 */
function getParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Helper to get query param (handles express query type)
 */
function getQueryParam(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

/**
 * POST /api/backtest-live/strategies
 * Create a new integrated strategy
 */
router.post('/strategies', async (req: Request, res: Response) => {
  try {
    const { userId, strategy, backtestConfig } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!strategy || !strategy.name || !strategy.type) {
      return res.status(400).json({ error: 'Strategy name and type are required' });
    }

    if (!backtestConfig) {
      return res.status(400).json({ error: 'Backtest configuration is required' });
    }

    const integration = await backtestLiveIntegration.createStrategy(
      userId,
      strategy,
      backtestConfig
    );

    log.info(`Created integration ${integration.id} for user ${userId}`);

    res.status(201).json({
      success: true,
      integration,
    });
  } catch (error: any) {
    log.error('Failed to create strategy:', error);
    res.status(500).json({
      error: error.message || 'Failed to create strategy',
    });
  }
});

/**
 * GET /api/backtest-live/strategies
 * Get all strategies for a user
 */
router.get('/strategies', async (req: Request, res: Response) => {
  try {
    const userId = getQueryParam(req.query.userId);
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const integrations = await backtestLiveIntegration.getUserIntegrations(userId);

    res.json({
      success: true,
      integrations,
      count: integrations.length,
    });
  } catch (error: any) {
    log.error('Failed to get strategies:', error);
    res.status(500).json({
      error: error.message || 'Failed to get strategies',
    });
  }
});

/**
 * GET /api/backtest-live/strategies/:id
 * Get a specific strategy
 */
router.get('/strategies/:id', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }
    
    const status = await backtestLiveIntegration.getStatus(id);

    if (!status.integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    log.error('Failed to get strategy:', error);
    res.status(500).json({
      error: error.message || 'Failed to get strategy',
    });
  }
});

/**
 * PUT /api/backtest-live/strategies/:id
 * Update a strategy
 */
router.put('/strategies/:id', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }
    
    const { params, riskManagement, monitoring } = req.body;

    let integration;

    if (params) {
      integration = await backtestLiveIntegration.updateParameters(id, params);
    }

    if (riskManagement) {
      integration = await backtestLiveIntegration.updateRiskManagement(id, riskManagement);
    }

    if (monitoring) {
      integration = await backtestLiveDAO.updateIntegration(id, { monitoring });
    }

    if (!integration) {
      return res.status(400).json({ error: 'No update data provided' });
    }

    res.json({
      success: true,
      integration,
    });
  } catch (error: any) {
    log.error('Failed to update strategy:', error);
    res.status(500).json({
      error: error.message || 'Failed to update strategy',
    });
  }
});

/**
 * DELETE /api/backtest-live/strategies/:id
 * Delete a strategy
 */
router.delete('/strategies/:id', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }

    await backtestLiveIntegration.deleteIntegration(id);

    res.json({
      success: true,
      message: 'Integration deleted successfully',
    });
  } catch (error: any) {
    log.error('Failed to delete strategy:', error);
    res.status(500).json({
      error: error.message || 'Failed to delete strategy',
    });
  }
});

/**
 * POST /api/backtest-live/strategies/:id/backtest
 * Run backtest for a strategy
 */
router.post('/strategies/:id/backtest', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }
    
    const config = req.body;

    const result = await backtestLiveIntegration.runBacktest(id, config);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    res.json({
      success: true,
      result: result.result,
      record: result.record,
    });
  } catch (error: any) {
    log.error('Failed to run backtest:', error);
    res.status(500).json({
      error: error.message || 'Failed to run backtest',
    });
  }
});

/**
 * POST /api/backtest-live/strategies/:id/migrate
 * Migrate strategy to a new environment
 */
router.post('/strategies/:id/migrate', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }
    
    const { targetEnvironment, liveConfig } = req.body;

    if (!targetEnvironment) {
      return res.status(400).json({ error: 'Target environment is required' });
    }

    let result;

    switch (targetEnvironment as TradingEnvironment) {
      case 'paper':
        result = await backtestLiveIntegration.migrateToPaper(id);
        break;
      case 'live':
        if (!liveConfig) {
          return res.status(400).json({ error: 'Live trading configuration is required' });
        }
        result = await backtestLiveIntegration.migrateToLive(id, liveConfig);
        break;
      default:
        return res.status(400).json({ error: 'Invalid target environment' });
    }

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        warnings: result.warnings,
      });
    }

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    log.error('Failed to migrate strategy:', error);
    res.status(500).json({
      error: error.message || 'Failed to migrate strategy',
    });
  }
});

/**
 * POST /api/backtest-live/strategies/:id/pause
 * Pause a strategy
 */
router.post('/strategies/:id/pause', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }

    await backtestLiveIntegration.pauseIntegration(id);

    res.json({
      success: true,
      message: 'Integration paused successfully',
    });
  } catch (error: any) {
    log.error('Failed to pause strategy:', error);
    res.status(500).json({
      error: error.message || 'Failed to pause strategy',
    });
  }
});

/**
 * POST /api/backtest-live/strategies/:id/resume
 * Resume a paused strategy
 */
router.post('/strategies/:id/resume', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }

    await backtestLiveIntegration.resumeIntegration(id);

    res.json({
      success: true,
      message: 'Integration resumed successfully',
    });
  } catch (error: any) {
    log.error('Failed to resume strategy:', error);
    res.status(500).json({
      error: error.message || 'Failed to resume strategy',
    });
  }
});

/**
 * POST /api/backtest-live/strategies/:id/stop
 * Stop a strategy permanently
 */
router.post('/strategies/:id/stop', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }

    await backtestLiveIntegration.stopIntegration(id);

    res.json({
      success: true,
      message: 'Integration stopped successfully',
    });
  } catch (error: any) {
    log.error('Failed to stop strategy:', error);
    res.status(500).json({
      error: error.message || 'Failed to stop strategy',
    });
  }
});

/**
 * GET /api/backtest-live/strategies/:id/performance
 * Get performance comparison history
 */
router.get('/strategies/:id/performance', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }
    
    const limitStr = getQueryParam(req.query.limit);
    const limit = limitStr ? parseInt(limitStr) : 100;

    const history = await backtestLiveIntegration.getPerformanceHistory(id, limit);

    res.json({
      success: true,
      history,
      count: history.length,
    });
  } catch (error: any) {
    log.error('Failed to get performance history:', error);
    res.status(500).json({
      error: error.message || 'Failed to get performance history',
    });
  }
});

/**
 * GET /api/backtest-live/strategies/:id/performance/summary
 * Get performance summary
 */
router.get('/strategies/:id/performance/summary', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }

    const summary = await backtestLiveIntegration.getPerformanceSummary(id);

    res.json({
      success: true,
      ...summary,
    });
  } catch (error: any) {
    log.error('Failed to get performance summary:', error);
    res.status(500).json({
      error: error.message || 'Failed to get performance summary',
    });
  }
});

/**
 * POST /api/backtest-live/strategies/:id/optimization/analyze
 * Run optimization analysis
 */
router.post('/strategies/:id/optimization/analyze', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }

    const result = await backtestLiveIntegration.analyzeOptimization(id);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    log.error('Failed to analyze optimization:', error);
    res.status(500).json({
      error: error.message || 'Failed to analyze optimization',
    });
  }
});

/**
 * GET /api/backtest-live/strategies/:id/optimization/suggestions
 * Get pending optimization suggestions
 */
router.get('/strategies/:id/optimization/suggestions', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }
    
    const includeApplied = getQueryParam(req.query.includeApplied);

    const suggestions = await backtestLiveDAO.getOptimizationSuggestions(
      id,
      includeApplied === 'true'
    );

    res.json({
      success: true,
      suggestions,
      count: suggestions.length,
    });
  } catch (error: any) {
    log.error('Failed to get optimization suggestions:', error);
    res.status(500).json({
      error: error.message || 'Failed to get optimization suggestions',
    });
  }
});

/**
 * POST /api/backtest-live/strategies/:id/optimization/apply
 * Apply an optimization suggestion
 */
router.post('/strategies/:id/optimization/apply', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }
    
    const { suggestionId } = req.body;

    if (!suggestionId) {
      return res.status(400).json({ error: 'Suggestion ID is required' });
    }

    const result = await backtestLiveIntegration.applyOptimization(id, suggestionId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      success: true,
      message: result.message,
      integration: result.integration,
    });
  } catch (error: any) {
    log.error('Failed to apply optimization:', error);
    res.status(500).json({
      error: error.message || 'Failed to apply optimization',
    });
  }
});

/**
 * GET /api/backtest-live/strategies/:id/validate
 * Validate configuration consistency
 */
router.get('/strategies/:id/validate', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }

    const validation = await backtestLiveIntegration.validateConfiguration(id);

    res.json({
      success: true,
      ...validation,
    });
  } catch (error: any) {
    log.error('Failed to validate configuration:', error);
    res.status(500).json({
      error: error.message || 'Failed to validate configuration',
    });
  }
});

/**
 * GET /api/backtest-live/backtest-results
 * Get backtest results for a user
 */
router.get('/backtest-results', async (req: Request, res: Response) => {
  try {
    const userId = getQueryParam(req.query.userId);
    const limitStr = getQueryParam(req.query.limit);
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const limit = limitStr ? parseInt(limitStr) : 20;

    const results = await backtestLiveDAO.getUserBacktestResults(userId, limit);

    res.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error: any) {
    log.error('Failed to get backtest results:', error);
    res.status(500).json({
      error: error.message || 'Failed to get backtest results',
    });
  }
});

/**
 * GET /api/backtest-live/backtest-results/:id
 * Get a specific backtest result
 */
router.get('/backtest-results/:id', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Backtest result ID is required' });
    }

    const result = await backtestLiveDAO.getBacktestResult(id);

    if (!result) {
      return res.status(404).json({ error: 'Backtest result not found' });
    }

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    log.error('Failed to get backtest result:', error);
    res.status(500).json({
      error: error.message || 'Failed to get backtest result',
    });
  }
});

/**
 * DELETE /api/backtest-live/backtest-results/:id
 * Delete a backtest result
 */
router.delete('/backtest-results/:id', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Backtest result ID is required' });
    }

    await backtestLiveDAO.deleteBacktestResult(id);

    res.json({
      success: true,
      message: 'Backtest result deleted successfully',
    });
  } catch (error: any) {
    log.error('Failed to delete backtest result:', error);
    res.status(500).json({
      error: error.message || 'Failed to delete backtest result',
    });
  }
});

export default router;