/**
 * Strategy Portfolio Routes
 * 
 * REST API endpoints for strategy portfolio management.
 */

import { Router, Request, Response } from 'express';
import { strategyPortfolioService } from '../strategy-portfolio/strategyPortfolio.service';
import { signalAggregationService } from '../strategy-portfolio/signalAggregation.service';
import { riskControlService } from '../strategy-portfolio/riskControl.service';
import { correlationAnalysisService } from '../strategy-portfolio/correlationAnalysis.service';
import { portfolioOptimizationService } from '../strategy-portfolio/optimization.service';
import { templateService } from '../strategy-portfolio/template.service';
import { portfolioShareService } from '../strategy-portfolio/share.service';
import { 
  CreatePortfolioInput, 
  UpdatePortfolioInput, 
  SnapshotType,
  StrategySignal,
  SignalAggregationMethod,
  RiskControlConfig,
  CreateTemplateInput,
  ShareConfig,
} from '../strategy-portfolio/types';
import { createLogger } from '../utils/logger';

const log = createLogger('StrategyPortfolioRoutes');

/**
 * Create strategy portfolio router
 */
export function createStrategyPortfolioRouter(): Router {
  const router = Router();

  // ==================== Portfolio CRUD ====================

  /**
   * @openapi
   * /api/strategy-portfolios:
   *   post:
   *     summary: Create a new strategy portfolio
   *     tags: [StrategyPortfolio]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - totalCapital
   *               - strategies
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               totalCapital:
   *                 type: number
   *               allocationMethod:
   *                 type: string
   *                 enum: [equal, custom, risk_parity]
   *               rebalanceConfig:
   *                 type: object
   *               strategies:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     strategyId:
   *                       type: string
   *                     weight:
   *                       type: number
   *     responses:
   *       201:
   *         description: Portfolio created successfully
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      const input: CreatePortfolioInput = req.body;
      const portfolio = await strategyPortfolioService.createPortfolio(userId, input);

      log.info(`Created portfolio ${portfolio.id} for user ${userId}`);
      res.status(201).json(portfolio);
    } catch (error) {
      log.error('Error creating portfolio:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios:
   *   get:
   *     summary: Get all portfolios for the user
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [active, paused, stopped]
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: List of portfolios
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      const { status, limit } = req.query;
      const portfolios = await strategyPortfolioService.getUserPortfolios(userId, {
        status: status as any,
        limit: limit ? parseInt(String(limit), 10) : undefined,
      });

      res.json(portfolios);
    } catch (error) {
      log.error('Error fetching portfolios:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}:
   *   get:
   *     summary: Get portfolio by ID
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Portfolio details
   *       404:
   *         description: Portfolio not found
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      const portfolio = await strategyPortfolioService.getPortfolio(portfolioId);

      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      res.json(portfolio);
    } catch (error) {
      log.error('Error fetching portfolio:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}:
   *   put:
   *     summary: Update portfolio
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               totalCapital:
   *                 type: number
   *               allocationMethod:
   *                 type: string
   *               rebalanceConfig:
   *                 type: object
   *               status:
   *                 type: string
   *     responses:
   *       200:
   *         description: Portfolio updated successfully
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      const input: UpdatePortfolioInput = req.body;

      const portfolio = await strategyPortfolioService.updatePortfolio(portfolioId, input);
      log.info(`Updated portfolio ${id}`);
      res.json(portfolio);
    } catch (error) {
      log.error('Error updating portfolio:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}:
   *   delete:
   *     summary: Delete portfolio
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Portfolio deleted successfully
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      await strategyPortfolioService.deletePortfolio(portfolioId);
      log.info(`Deleted portfolio ${id}`);
      res.status(204).send();
    } catch (error) {
      log.error('Error deleting portfolio:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ==================== Portfolio Operations ====================

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/start:
   *   post:
   *     summary: Start portfolio (activate all strategies)
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Portfolio started successfully
   */
  router.post('/:id/start', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      const portfolio = await strategyPortfolioService.startPortfolio(portfolioId);
      log.info(`Started portfolio ${id}`);
      res.json(portfolio);
    } catch (error) {
      log.error('Error starting portfolio:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/stop:
   *   post:
   *     summary: Stop portfolio (stop all strategies)
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Portfolio stopped successfully
   */
  router.post('/:id/stop', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      const portfolio = await strategyPortfolioService.stopPortfolio(portfolioId);
      log.info(`Stopped portfolio ${id}`);
      res.json(portfolio);
    } catch (error) {
      log.error('Error stopping portfolio:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/pause:
   *   post:
   *     summary: Pause portfolio
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Portfolio paused successfully
   */
  router.post('/:id/pause', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      const portfolio = await strategyPortfolioService.pausePortfolio(portfolioId);
      log.info(`Paused portfolio ${id}`);
      res.json(portfolio);
    } catch (error) {
      log.error('Error pausing portfolio:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ==================== Strategy Management ====================

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/strategies:
   *   post:
   *     summary: Add strategy to portfolio
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - strategyId
   *             properties:
   *               strategyId:
   *                 type: string
   *               weight:
   *                 type: number
   *     responses:
   *       201:
   *         description: Strategy added successfully
   */
  router.post('/:id/strategies', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      const { strategyId, weight } = req.body;

      if (!strategyId) {
        return res.status(400).json({ error: 'Strategy ID required' });
      }

      const strategy = await strategyPortfolioService.addStrategy(portfolioId, strategyId, weight);
      log.info(`Added strategy ${strategyId} to portfolio ${id}`);
      res.status(201).json(strategy);
    } catch (error) {
      log.error('Error adding strategy:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/strategies/{strategyId}:
   *   delete:
   *     summary: Remove strategy from portfolio
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: strategyId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Strategy removed successfully
   */
  router.delete('/:id/strategies/:strategyId', async (req: Request, res: Response) => {
    try {
      const { id, strategyId } = req.params;
      const portfolioId = String(id);
      await strategyPortfolioService.removeStrategy(portfolioId, String(strategyId));
      log.info(`Removed strategy ${strategyId} from portfolio ${portfolioId}`);
      res.status(204).send();
    } catch (error) {
      log.error('Error removing strategy:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/strategies/{strategyId}/weight:
   *   put:
   *     summary: Update strategy weight
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: strategyId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - weight
   *             properties:
   *               weight:
   *                 type: number
   *     responses:
   *       200:
   *         description: Weight updated successfully
   */
  router.put('/:id/strategies/:strategyId/weight', async (req: Request, res: Response) => {
    try {
      const { id, strategyId } = req.params;
      const portfolioId = String(id);
      const { weight } = req.body;

      if (weight === undefined) {
        return res.status(400).json({ error: 'Weight required' });
      }

      await strategyPortfolioService.updateStrategyWeight(portfolioId, String(strategyId), weight);
      log.info(`Updated weight for strategy ${strategyId} in portfolio ${portfolioId}`);
      res.json({ success: true });
    } catch (error) {
      log.error('Error updating strategy weight:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ==================== Rebalancing ====================

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/rebalance/preview:
   *   get:
   *     summary: Preview portfolio rebalance
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Rebalance preview
   */
  router.get('/:id/rebalance/preview', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      const preview = await strategyPortfolioService.checkRebalanceNeeded(portfolioId);
      res.json(preview);
    } catch (error) {
      log.error('Error previewing rebalance:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/rebalance:
   *   post:
   *     summary: Execute portfolio rebalance
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               reason:
   *                 type: string
   *                 enum: [threshold, scheduled, manual, strategy_change]
   *     responses:
   *       200:
   *         description: Rebalance executed successfully
   */
  router.post('/:id/rebalance', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      const { reason } = req.body;
      const result = await strategyPortfolioService.rebalancePortfolio(portfolioId, reason);
      log.info(`Rebalanced portfolio ${id}`);
      res.json(result);
    } catch (error) {
      log.error('Error rebalancing portfolio:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/rebalance/history:
   *   get:
   *     summary: Get rebalance history
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Rebalance history
   */
  router.get('/:id/rebalance/history', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      const { limit } = req.query;
      const history = await strategyPortfolioService.getRebalanceHistory(portfolioId,
        limit ? parseInt(String(limit), 10) : 50
      );
      res.json(history);
    } catch (error) {
      log.error('Error fetching rebalance history:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ==================== Performance ====================

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/performance:
   *   get:
   *     summary: Get portfolio performance
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Portfolio performance metrics
   */
  router.get('/:id/performance', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      const performance = await strategyPortfolioService.calculatePerformance(portfolioId);
      res.json(performance);
    } catch (error) {
      log.error('Error calculating performance:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/performance/history:
   *   get:
   *     summary: Get performance history
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *       - in: query
   *         name: snapshotType
   *         schema:
   *           type: string
   *           enum: [minute, hourly, daily, weekly]
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Performance history
   */
  router.get('/:id/performance/history', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      const { startDate, endDate, snapshotType, limit } = req.query;

      const history = await strategyPortfolioService.getPerformanceHistory(portfolioId,
        startDate ? new Date(String(startDate)) : undefined,
        endDate ? new Date(String(endDate)) : undefined,
        snapshotType as SnapshotType,
        limit ? parseInt(String(limit), 10) : 100
      );
      res.json(history);
    } catch (error) {
      log.error('Error fetching performance history:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/performance/snapshot:
   *   post:
   *     summary: Create performance snapshot
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               snapshotType:
   *                 type: string
   *                 enum: [minute, hourly, daily, weekly]
   *     responses:
   *       201:
   *         description: Snapshot created successfully
   */
  router.post('/:id/performance/snapshot', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      const { snapshotType } = req.body;
      const snapshot = await strategyPortfolioService.createSnapshot(portfolioId,
        snapshotType || 'hourly'
      );
      log.info(`Created snapshot for portfolio ${id}`);
      res.status(201).json(snapshot);
    } catch (error) {
      log.error('Error creating snapshot:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ==================== Risk ====================

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/risk:
   *   get:
   *     summary: Get portfolio risk analysis
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Risk metrics
   */
  router.get('/:id/risk', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      const risk = await strategyPortfolioService.calculateRisk(portfolioId);
      res.json(risk);
    } catch (error) {
      log.error('Error calculating risk:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ==================== Signal Aggregation ====================

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/signals/aggregate:
   *   post:
   *     summary: Aggregate signals from portfolio strategies
   *     tags: [StrategyPortfolio]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               signals:
   *                 type: array
   *                 items:
   *                   type: object
   *               method:
   *                 type: string
   *                 enum: [voting, weighted_average, consensus, best_performer]
   *     responses:
   *       200:
   *         description: Aggregated signal
   */
  router.post('/:id/signals/aggregate', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { signals, method } = req.body;

      const portfolio = await strategyPortfolioService.getPortfolio(String(id));
      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      // Build strategy weights map
      const strategyWeights = new Map<string, number>();
      (portfolio.strategies || []).forEach(s => {
        strategyWeights.set(s.strategyId, s.weight);
      });

      const aggregated = signalAggregationService.aggregateSignals(
        signals as StrategySignal[],
        strategyWeights,
        method as SignalAggregationMethod
      );

      res.json(aggregated);
    } catch (error) {
      log.error('Error aggregating signals:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/signals/config:
   *   put:
   *     summary: Update signal aggregation config
   *     tags: [StrategyPortfolio]
   */
  router.put('/:id/signals/config', async (req: Request, res: Response) => {
    try {
      const config = req.body;
      signalAggregationService.updateConfig(config);
      res.json({ success: true, config: signalAggregationService.getConfig() });
    } catch (error) {
      log.error('Error updating signal config:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ==================== Risk Control ====================

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/risk/check:
   *   post:
   *     summary: Check position limits and detect conflicts
   *     tags: [StrategyPortfolio]
   */
  router.post('/:id/risk/check', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);
      const { signals, positions } = req.body;

      const portfolio = await strategyPortfolioService.getPortfolio(portfolioId);
      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      // Check position limits
      const positionCheck = riskControlService.checkPositionLimits({
        currentTotalPosition: positions?.totalPosition || 0,
        currentPositionByAsset: new Map(Object.entries(positions?.byAsset || {})),
        currentPositionByStrategy: new Map(Object.entries(positions?.byStrategy || {})),
      });

      // Detect conflicts
      const conflicts = riskControlService.detectConflicts(signals || []);

      // Calculate risk score
      const riskScore = riskControlService.calculateRiskScore({
        totalPosition: positions?.totalPosition || 0,
        positionByAsset: new Map(Object.entries(positions?.byAsset || {})),
        positionByStrategy: new Map(Object.entries(positions?.byStrategy || {})),
        conflictCount: conflicts.length,
      });

      res.json({
        positionCheck,
        conflicts,
        riskScore,
      });
    } catch (error) {
      log.error('Error checking risk:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/risk/resolve:
   *   post:
   *     summary: Resolve detected conflicts
   *     tags: [StrategyPortfolio]
   */
  router.post('/:id/risk/resolve', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { conflicts, signals } = req.body;

      const portfolio = await strategyPortfolioService.getPortfolio(String(id));
      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      const strategyWeights = new Map<string, number>();
      (portfolio.strategies || []).forEach(s => {
        strategyWeights.set(s.strategyId, s.weight);
      });

      const { resolvedSignals, resolutions } = riskControlService.resolveConflicts(
        conflicts,
        signals,
        strategyWeights
      );

      res.json({ resolvedSignals, resolutions });
    } catch (error) {
      log.error('Error resolving conflicts:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/risk/config:
   *   put:
   *     summary: Update risk control config
   *     tags: [StrategyPortfolio]
   */
  router.put('/:id/risk/config', async (req: Request, res: Response) => {
    try {
      const config = req.body as RiskControlConfig;
      riskControlService.updateConfig(config);
      res.json({ success: true, config: riskControlService.getConfig() });
    } catch (error) {
      log.error('Error updating risk config:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ==================== Correlation Analysis ====================

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/correlation:
   *   get:
   *     summary: Get strategy correlation analysis
   *     tags: [StrategyPortfolio]
   */
  router.get('/:id/correlation', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);

      // Get performance history to calculate correlations
      const history = await strategyPortfolioService.getPerformanceHistory(portfolioId);
      
      if (history.length < 2) {
        return res.json({
          matrix: { strategyIds: [], matrix: [], period: '30d', calculatedAt: new Date() },
          highCorrelationPairs: [],
          diversificationScore: 100,
          recommendations: ['Not enough data to calculate correlations. Continue running strategies to generate history.'],
        });
      }

      // Calculate returns from snapshots
      const strategyReturns = correlationAnalysisService.calculateFromSnapshots(history);
      
      // Perform analysis
      const analysis = correlationAnalysisService.analyzeCorrelations(strategyReturns);
      
      // Add summary
      const summary = correlationAnalysisService.getCorrelationSummary(analysis);

      res.json({ ...analysis, summary });
    } catch (error) {
      log.error('Error analyzing correlations:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ==================== Optimization ====================

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/optimization:
   *   get:
   *     summary: Get optimization suggestions for portfolio
   *     tags: [StrategyPortfolio]
   */
  router.get('/:id/optimization', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolioId = String(id);

      const portfolio = await strategyPortfolioService.getPortfolio(portfolioId);
      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      // Get correlation analysis if available
      const history = await strategyPortfolioService.getPerformanceHistory(portfolioId);
      let correlationAnalysis;
      if (history.length >= 2) {
        const strategyReturns = correlationAnalysisService.calculateFromSnapshots(history);
        correlationAnalysis = correlationAnalysisService.analyzeCorrelations(strategyReturns);
      }

      // Analyze portfolio
      const optimization = portfolioOptimizationService.analyzePortfolio(
        portfolio,
        correlationAnalysis
      );

      res.json(optimization);
    } catch (error) {
      log.error('Error analyzing optimization:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ==================== Templates ====================

  /**
   * @openapi
   * /api/strategy-portfolios/templates:
   *   get:
   *     summary: Get available portfolio templates
   *     tags: [StrategyPortfolio]
   */
  router.get('/templates', async (req: Request, res: Response) => {
    try {
      const { category, riskLevel, limit } = req.query;
      const templates = await templateService.getTemplates({
        category: category as string,
        riskLevel: riskLevel as string,
        limit: limit ? parseInt(String(limit), 10) : undefined,
      });
      res.json(templates);
    } catch (error) {
      log.error('Error fetching templates:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/templates/{templateId}:
   *   get:
   *     summary: Get template by ID
   *     tags: [StrategyPortfolio]
   */
  router.get('/templates/:templateId', async (req: Request, res: Response) => {
    try {
      const { templateId } = req.params;
      const template = await templateService.getTemplateById(String(templateId));
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json(template);
    } catch (error) {
      log.error('Error fetching template:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/templates:
   *   post:
   *     summary: Create custom template
   *     tags: [StrategyPortfolio]
   */
  router.post('/templates', async (req: Request, res: Response) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      const input = req.body as CreateTemplateInput;
      const template = await templateService.createTemplate(userId, input);
      
      log.info(`Created template ${template.id} for user ${userId}`);
      res.status(201).json(template);
    } catch (error) {
      log.error('Error creating template:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/templates/recommendations:
   *   get:
   *     summary: Get recommended templates based on preferences
   *     tags: [StrategyPortfolio]
   */
  router.get('/templates/recommendations', async (req: Request, res: Response) => {
    try {
      const { riskTolerance, targetReturn, capitalAmount } = req.query;
      
      const recommendations = await templateService.getRecommendedTemplates({
        riskTolerance: riskTolerance as 'low' | 'medium' | 'high',
        targetReturn: targetReturn ? parseFloat(String(targetReturn)) : undefined,
        capitalAmount: capitalAmount ? parseFloat(String(capitalAmount)) : undefined,
      });

      res.json(recommendations);
    } catch (error) {
      log.error('Error getting recommendations:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/templates/{templateId}/rate:
   *   post:
   *     summary: Rate a template
   *     tags: [StrategyPortfolio]
   */
  router.post('/templates/:templateId/rate', async (req: Request, res: Response) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { templateId } = req.params;
      const { rating } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      const success = await templateService.rateTemplate(String(templateId), userId, rating);
      
      if (!success) {
        return res.status(400).json({ error: 'Failed to rate template' });
      }

      res.json({ success: true });
    } catch (error) {
      log.error('Error rating template:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ==================== Sharing ====================

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/share:
   *   post:
   *     summary: Create a share for portfolio
   *     tags: [StrategyPortfolio]
   */
  router.post('/:id/share', async (req: Request, res: Response) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      const { id } = req.params;
      const config = req.body as ShareConfig;

      const share = await portfolioShareService.createShare(String(id), userId, config);
      
      log.info(`Created share ${share.shareCode} for portfolio ${id}`);
      res.status(201).json(share);
    } catch (error) {
      log.error('Error creating share:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/shared/{code}:
   *   get:
   *     summary: Get shared portfolio by code
   *     tags: [StrategyPortfolio]
   */
  router.get('/shared/:code', async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const share = await portfolioShareService.getShareByCode(String(code));
      
      if (!share) {
        return res.status(404).json({ error: 'Share not found or expired' });
      }

      // Increment view count
      await portfolioShareService.incrementViewCount(String(code));

      // Get portfolio
      const portfolio = await strategyPortfolioService.getPortfolio(share.portfolioId);
      
      res.json({ share, portfolio });
    } catch (error) {
      log.error('Error fetching shared portfolio:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/{id}/shares:
   *   get:
   *     summary: Get all shares for a portfolio
   *     tags: [StrategyPortfolio]
   */
  router.get('/:id/shares', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const shares = await portfolioShareService.getPortfolioShares(String(id));
      res.json(shares);
    } catch (error) {
      log.error('Error fetching shares:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @openapi
   * /api/strategy-portfolios/shares/{shareId}:
   *   delete:
   *     summary: Revoke a share
   *     tags: [StrategyPortfolio]
   */
  router.delete('/shares/:shareId', async (req: Request, res: Response) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      const { shareId } = req.params;
      const success = await portfolioShareService.revokeShare(String(shareId), userId);
      
      if (!success) {
        return res.status(400).json({ error: 'Failed to revoke share' });
      }

      res.status(204).send();
    } catch (error) {
      log.error('Error revoking share:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  return router;
}