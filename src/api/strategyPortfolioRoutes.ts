/**
 * Strategy Portfolio Routes
 * 
 * REST API endpoints for strategy portfolio management.
 */

import { Router, Request, Response } from 'express';
import { strategyPortfolioService } from '../strategy-portfolio/strategyPortfolio.service';
import { CreatePortfolioInput, UpdatePortfolioInput, SnapshotType } from '../strategy-portfolio/types';
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

  return router;
}