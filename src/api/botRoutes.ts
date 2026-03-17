/**
 * Bot API Routes
 *
 * REST endpoints for trading bot management
 */

import { Router, Request, Response } from 'express';
import { BotManager, BotConfig, BotState, CreateBotRequest, UpdateBotRequest, StrategyType, TradingMode, TimeInterval } from '../bot';
import { apiKeyAuthMiddleware, requireApiPermission } from './apiKeyMiddleware';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('BotRoutes');

/**
 * Helper to get string param from req.params or req.query
 */
function getStringParam(value: any): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;
  return undefined;
}

/**
 * Create bot router
 */
export function createBotRouter(botManager: BotManager): Router {
  const router = Router();

  // Apply authentication - support both JWT and API key
  // JWT users can use internal API, API keys for external access

  /**
   * GET /api/bot
   * List all bots
   * Permission: read
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const bots = await botManager.getAllBots();
      
      res.json({
        success: true,
        data: bots,
        count: bots.length,
      });
    } catch (error: any) {
      log.error('Failed to list bots', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/bot
   * Create a new bot
   * Permission: trade
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const request: CreateBotRequest = {
        name: req.body.name,
        description: req.body.description,
        strategy: req.body.strategy as StrategyType,
        strategyParams: req.body.strategyParams,
        tradingPair: req.body.tradingPair,
        interval: req.body.interval as TimeInterval,
        mode: req.body.mode as TradingMode,
        riskSettings: req.body.riskSettings,
        initialCapital: req.body.initialCapital,
      };

      // Validation
      if (!request.name) {
        return res.status(400).json({
          success: false,
          error: 'Bot name is required',
        });
      }

      if (!request.strategy) {
        return res.status(400).json({
          success: false,
          error: 'Strategy is required',
        });
      }

      if (!request.tradingPair || !request.tradingPair.symbol) {
        return res.status(400).json({
          success: false,
          error: 'Trading pair is required',
        });
      }

      if (!request.initialCapital || request.initialCapital <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Initial capital must be positive',
        });
      }

      const config = await botManager.createBot(request);

      log.info('Bot created via API', { 
        id: config.id, 
        name: config.name, 
        strategy: config.strategy,
        tradingPair: config.tradingPair.symbol,
      });

      res.status(201).json({
        success: true,
        data: config,
        message: 'Bot created successfully',
      });
    } catch (error: any) {
      log.error('Failed to create bot', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/bot/:id
   * Get bot details
   * Permission: read
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing bot ID' });
      }

      const config = await botManager.getBot(id);
      
      if (!config) {
        return res.status(404).json({ 
          success: false, 
          error: 'Bot not found',
          code: 'BOT_NOT_FOUND',
        });
      }

      // Also get the state
      const state = await botManager.getBotState(id);

      res.json({
        success: true,
        data: {
          config,
          state,
        },
      });
    } catch (error: any) {
      log.error('Failed to get bot', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/bot/:id
   * Update bot configuration
   * Permission: trade
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing bot ID' });
      }

      const request: UpdateBotRequest = {
        name: req.body.name,
        description: req.body.description,
        strategyParams: req.body.strategyParams,
        riskSettings: req.body.riskSettings,
        enabled: req.body.enabled,
      };

      const config = await botManager.updateBot(id, request);

      log.info('Bot updated via API', { id, updates: Object.keys(request) });

      res.json({
        success: true,
        data: config,
        message: 'Bot updated successfully',
      });
    } catch (error: any) {
      log.error('Failed to update bot', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ 
          success: false, 
          error: error.message,
          code: 'BOT_NOT_FOUND',
        });
      }
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/bot/:id
   * Stop and delete a bot
   * Permission: trade
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing bot ID' });
      }

      await botManager.deleteBot(id);

      log.info('Bot deleted via API', { id });

      res.json({
        success: true,
        message: 'Bot deleted successfully',
      });
    } catch (error: any) {
      log.error('Failed to delete bot', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ 
          success: false, 
          error: error.message,
          code: 'BOT_NOT_FOUND',
        });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/bot/:id/start
   * Start a bot
   * Permission: trade
   */
  router.post('/:id/start', async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing bot ID' });
      }

      await botManager.startBot(id);

      log.info('Bot started via API', { id });

      res.json({
        success: true,
        message: 'Bot started successfully',
      });
    } catch (error: any) {
      log.error('Failed to start bot', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ 
          success: false, 
          error: error.message,
          code: 'BOT_NOT_FOUND',
        });
      }
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/bot/:id/stop
   * Stop a bot
   * Permission: trade
   */
  router.post('/:id/stop', async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing bot ID' });
      }

      await botManager.stopBot(id);

      log.info('Bot stopped via API', { id });

      res.json({
        success: true,
        message: 'Bot stopped successfully',
      });
    } catch (error: any) {
      log.error('Failed to stop bot', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ 
          success: false, 
          error: error.message,
          code: 'BOT_NOT_FOUND',
        });
      }
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/bot/:id/pause
   * Pause a bot
   * Permission: trade
   */
  router.post('/:id/pause', async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing bot ID' });
      }

      await botManager.pauseBot(id);

      log.info('Bot paused via API', { id });

      res.json({
        success: true,
        message: 'Bot paused successfully',
      });
    } catch (error: any) {
      log.error('Failed to pause bot', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ 
          success: false, 
          error: error.message,
          code: 'BOT_NOT_FOUND',
        });
      }
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/bot/:id/resume
   * Resume a paused bot
   * Permission: trade
   */
  router.post('/:id/resume', async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing bot ID' });
      }

      await botManager.resumeBot(id);

      log.info('Bot resumed via API', { id });

      res.json({
        success: true,
        message: 'Bot resumed successfully',
      });
    } catch (error: any) {
      log.error('Failed to resume bot', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ 
          success: false, 
          error: error.message,
          code: 'BOT_NOT_FOUND',
        });
      }
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/bot/:id/state
   * Get bot state
   * Permission: read
   */
  router.get('/:id/state', async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing bot ID' });
      }

      const state = await botManager.getBotState(id);
      
      if (!state) {
        return res.status(404).json({ 
          success: false, 
          error: 'Bot state not found',
          code: 'BOT_NOT_FOUND',
        });
      }

      res.json({
        success: true,
        data: state,
      });
    } catch (error: any) {
      log.error('Failed to get bot state', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/bot/running
   * Get list of running bots
   * Permission: read
   */
  router.get('/running/list', async (req: Request, res: Response) => {
    try {
      const runningBots = botManager.getRunningBots();

      res.json({
        success: true,
        data: runningBots,
        count: runningBots.length,
      });
    } catch (error: any) {
      log.error('Failed to get running bots', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/bot/start-all
   * Start all bots
   * Permission: admin
   */
  router.post('/start-all', async (req: Request, res: Response) => {
    try {
      await botManager.startAllBots();

      log.info('All bots started via API');

      res.json({
        success: true,
        message: 'All bots started successfully',
      });
    } catch (error: any) {
      log.error('Failed to start all bots', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/bot/stop-all
   * Stop all bots
   * Permission: admin
   */
  router.post('/stop-all', async (req: Request, res: Response) => {
    try {
      await botManager.stopAllBots();

      log.info('All bots stopped via API');

      res.json({
        success: true,
        message: 'All bots stopped successfully',
      });
    } catch (error: any) {
      log.error('Failed to stop all bots', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export default createBotRouter;
