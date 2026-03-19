/**
 * Public API Routes
 *
 * RESTful API endpoints for third-party developers and advanced users.
 * Provides access to strategy execution, backtesting, account queries, and market data.
 *
 * Authentication: API Key (X-API-Key header)
 * Rate Limiting: Based on API key permission level
 * Documentation: Swagger UI at /docs/api
 */

import { Router, Request, Response } from 'express';
import { apiKeyAuthMiddleware, requireApiPermission } from './apiKeyMiddleware';
import { StrategiesDAO } from '../database/strategies.dao';
import { TradesDAO } from '../database/trades.dao';
import { PortfoliosDAO } from '../database/portfolios.dao';
import { LeaderboardService, SortCriterion } from '../strategy/LeaderboardService';
import { BacktestEngine } from '../backtest/BacktestEngine';
import { BacktestConfig } from '../backtest/types';
import {
  VirtualAccountDAO,
  VirtualAccount,
  VirtualPosition,
  VirtualOrder,
  CreateOrderData,
} from '../database/virtual-account.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('PublicApiRoutes');

/**
 * Helper to get string param from req.params or req.query
 */
function getStringParam(value: any): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;
  return undefined;
}

const router = Router();
const strategiesDAO = new StrategiesDAO();
const tradesDAO = new TradesDAO();
const portfoliosDAO = new PortfoliosDAO();
const leaderboardService = new LeaderboardService();

// ============================================
// Authentication Middleware
// ============================================

// All public API endpoints require API key authentication
router.use(apiKeyAuthMiddleware);

// ============================================
// API Info
// ============================================

/**
 * @openapi
 * /public/v1:
 *   get:
 *     summary: Get public API information
 *     description: Returns information about the public API including version and available endpoints
 *     operationId: getPublicApiInfo
 *     tags:
 *       - Public API
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     version:
 *                       type: string
 *                       example: "1.0.0"
 *                     endpoints:
 *                       type: object
 *                       properties:
 *                         strategies:
 *                           type: string
 *                           example: "/public/v1/strategies"
 *                         backtest:
 *                           type: string
 *                           example: "/public/v1/backtest"
 *                         account:
 *                           type: string
 *                           example: "/public/v1/account"
 *                         market:
 *                           type: string
 *                           example: "/public/v1/market"
 *                     rateLimits:
 *                       type: object
 *                       properties:
 *                         remaining:
 *                           type: integer
 *                         resetAt:
 *                           type: string
 *                           format: date-time
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      version: '1.0.0',
      endpoints: {
        strategies: '/public/v1/strategies',
        backtest: '/public/v1/backtest',
        account: '/public/v1/account',
        market: '/public/v1/market',
        leaderboard: '/public/v1/leaderboard',
      },
      authentication: 'API Key (X-API-Key header)',
      documentation: '/docs/api',
      rateLimits: {
        remaining: req.apiKeyUser?.rateLimit.remainingMinute,
        resetAt: req.apiKeyUser?.rateLimit.resetAtMinute,
      },
    },
  });
});

// ============================================
// Strategy Endpoints
// ============================================

/**
 * @openapi
 * /public/v1/strategies:
 *   get:
 *     summary: List all strategies
 *     description: Retrieve a list of all trading strategies for the authenticated user
 *     operationId: publicListStrategies
 *     tags:
 *       - Strategies
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [active, paused, stopped]
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of strategies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Strategy'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 */
router.get('/strategies', requireApiPermission('read'), async (req: Request, res: Response) => {
  try {
    const userId = req.apiKeyUser?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const status = req.query.status as 'active' | 'paused' | 'stopped' | undefined;
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const offset = parseInt((req.query.offset as string) || '0', 10);

    let strategies;
    if (status) {
      // Filter by status
      const allStrategies = await strategiesDAO.getAll();
      strategies = allStrategies.filter((s) => s.status === status);
    } else {
      strategies = await strategiesDAO.getAll();
    }

    // Apply pagination
    const paginatedStrategies = strategies.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginatedStrategies,
      pagination: {
        total: strategies.length,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    log.error('Failed to list strategies', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /public/v1/strategies/{id}:
 *   get:
 *     summary: Get strategy details
 *     description: Retrieve detailed information about a specific strategy
 *     operationId: publicGetStrategy
 *     tags:
 *       - Strategies
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Strategy ID
 *     responses:
 *       200:
 *         description: Strategy details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Strategy'
 *       404:
 *         description: Strategy not found
 */
router.get('/strategies/:id', requireApiPermission('read'), async (req: Request, res: Response) => {
  try {
    const id = getStringParam(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: 'Missing strategy ID' });
    }
    const strategy = await strategiesDAO.getById(id);

    if (!strategy) {
      return res.status(404).json({ success: false, error: 'Strategy not found' });
    }

    res.json({ success: true, data: strategy });
  } catch (error: any) {
    log.error('Failed to get strategy', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /public/v1/strategies:
 *   post:
 *     summary: Create a new strategy
 *     description: Create a new trading strategy
 *     operationId: publicCreateStrategy
 *     tags:
 *       - Strategies
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - symbol
 *             properties:
 *               name:
 *                 type: string
 *                 description: Strategy name
 *               symbol:
 *                 type: string
 *                 description: Trading symbol (e.g., BTC/USDT)
 *               description:
 *                 type: string
 *                 description: Strategy description
 *               config:
 *                 type: object
 *                 description: Strategy configuration parameters
 *     responses:
 *       201:
 *         description: Strategy created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Strategy'
 */
router.post('/strategies', requireApiPermission('trade'), async (req: Request, res: Response) => {
  try {
    const { name, symbol, description, config } = req.body;

    if (!name || !symbol) {
      return res.status(400).json({
        success: false,
        error: 'name and symbol are required',
      });
    }

    const strategy = await strategiesDAO.create(name, symbol, description, config);

    log.info('Strategy created via public API', {
      id: strategy.id,
      name: strategy.name,
      userId: req.apiKeyUser?.id,
    });

    res.status(201).json({ success: true, data: strategy });
  } catch (error: any) {
    log.error('Failed to create strategy', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /public/v1/strategies/{id}/status:
 *   put:
 *     summary: Update strategy status
 *     description: Update the status of a trading strategy (start, pause, stop)
 *     operationId: publicUpdateStrategyStatus
 *     tags:
 *       - Strategies
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, paused, stopped]
 *     responses:
 *       200:
 *         description: Status updated
 *       404:
 *         description: Strategy not found
 */
router.put(
  '/strategies/:id/status',
  requireApiPermission('trade'),
  async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing strategy ID' });
      }
      const { status } = req.body;

      if (!['active', 'paused', 'stopped'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be: active, paused, or stopped',
        });
      }

      const strategy = await strategiesDAO.getById(id);
      if (!strategy) {
        return res.status(404).json({ success: false, error: 'Strategy not found' });
      }

      const updatedStrategy = await strategiesDAO.updateStatus(id, status);

      log.info('Strategy status updated via public API', {
        id,
        status,
        userId: req.apiKeyUser?.id,
      });

      res.json({ success: true, data: updatedStrategy });
    } catch (error: any) {
      log.error('Failed to update strategy status', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ============================================
// Backtest Endpoints
// ============================================

/**
 * @openapi
 * /public/v1/backtest/run:
 *   post:
 *     summary: Run a backtest
 *     description: Execute a backtest with the specified configuration
 *     operationId: publicRunBacktest
 *     tags:
 *       - Backtest
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbol
 *               - strategy
 *               - capital
 *               - startTime
 *               - endTime
 *             properties:
 *               symbol:
 *                 type: string
 *                 description: Trading symbol (e.g., BTC/USDT)
 *               strategy:
 *                 type: string
 *                 enum: [sma, rsi, macd, bollinger, atr]
 *                 description: Strategy type
 *               capital:
 *                 type: number
 *                 description: Initial capital
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               params:
 *                 type: object
 *                 description: Strategy-specific parameters
 *     responses:
 *       200:
 *         description: Backtest result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 result:
 *                   type: object
 *                   properties:
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalReturn:
 *                           type: number
 *                         winRate:
 *                           type: number
 *                         profitFactor:
 *                           type: number
 *                         maxDrawdown:
 *                           type: number
 *                         sharpeRatio:
 *                           type: number
 *                     trades:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.post('/backtest/run', requireApiPermission('read'), async (req: Request, res: Response) => {
  try {
    const config: BacktestConfig = req.body;

    // Validate config
    if (!config.capital || config.capital < 100) {
      return res.status(400).json({
        success: false,
        error: 'Initial capital must be at least 100',
      });
    }

    if (!config.symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol is required',
      });
    }

    if (!config.strategy) {
      return res.status(400).json({
        success: false,
        error: 'Strategy is required',
      });
    }

    if (!config.startTime || !config.endTime) {
      return res.status(400).json({
        success: false,
        error: 'Start and end times are required',
      });
    }

    if (new Date(config.startTime) >= new Date(config.endTime)) {
      return res.status(400).json({
        success: false,
        error: 'Start time must be before end time',
      });
    }

    // Convert string dates to timestamps (Unix milliseconds)
    const backtestConfig: BacktestConfig = {
      ...config,
      startTime: new Date(config.startTime).getTime(),
      endTime: new Date(config.endTime).getTime(),
    };

    log.info('Running backtest via public API', {
      symbol: backtestConfig.symbol,
      strategy: backtestConfig.strategy,
      userId: req.apiKeyUser?.id,
    });

    const engine = new BacktestEngine(backtestConfig);
    const result = await engine.run();

    log.info('Backtest completed via public API', {
      symbol: backtestConfig.symbol,
      return: result.stats.totalReturn,
      userId: req.apiKeyUser?.id,
    });

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    log.error('Backtest failed', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Backtest execution failed',
    });
  }
});

/**
 * @openapi
 * /public/v1/backtest/strategies:
 *   get:
 *     summary: List available backtest strategies
 *     description: Get a list of all available strategies for backtesting
 *     operationId: publicListBacktestStrategies
 *     tags:
 *       - Backtest
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of strategies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 */
router.get(
  '/backtest/strategies',
  requireApiPermission('read'),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: [
        { id: 'sma', name: 'SMA 均线交叉', description: '简单移动平均线交叉策略' },
        { id: 'rsi', name: 'RSI 相对强弱指标', description: '基于RSI超买超卖信号' },
        { id: 'macd', name: 'MACD 指标', description: 'MACD金叉死叉策略' },
        { id: 'bollinger', name: '布林带策略', description: '布林带突破策略' },
        { id: 'atr', name: 'ATR 策略', description: '平均真实波幅策略' },
      ],
    });
  }
);

/**
 * @openapi
 * /public/v1/backtest/symbols:
 *   get:
 *     summary: List available symbols
 *     description: Get a list of all available trading symbols for backtesting
 *     operationId: publicListBacktestSymbols
 *     tags:
 *       - Backtest
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of symbols
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       category:
 *                         type: string
 */
router.get(
  '/backtest/symbols',
  requireApiPermission('read'),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: [
        { id: 'BTC/USDT', name: 'Bitcoin', category: 'crypto' },
        { id: 'ETH/USDT', name: 'Ethereum', category: 'crypto' },
        { id: 'AAPL', name: 'Apple Inc.', category: 'stock' },
        { id: 'GOOGL', name: 'Alphabet Inc.', category: 'stock' },
        { id: 'TSLA', name: 'Tesla Inc.', category: 'stock' },
        { id: 'MSFT', name: 'Microsoft Corp.', category: 'stock' },
      ],
    });
  }
);

// ============================================
// Account Endpoints
// ============================================

/**
 * @openapi
 * /public/v1/account:
 *   get:
 *     summary: Get account information
 *     description: Retrieve the virtual trading account information for the authenticated user
 *     operationId: publicGetAccount
 *     tags:
 *       - Account
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Account information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     balance:
 *                       type: number
 *                     initial_capital:
 *                       type: number
 *                     frozen_balance:
 *                       type: number
 *                     total_realized_pnl:
 *                       type: number
 *                     total_trades:
 *                       type: integer
 *                     winning_trades:
 *                       type: integer
 *                     losing_trades:
 *                       type: integer
 *       404:
 *         description: Account not found
 */
router.get('/account', requireApiPermission('read'), async (req: Request, res: Response) => {
  try {
    const userId = req.apiKeyUser?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Get or create account
    let account = await VirtualAccountDAO.getAccountByUserId(userId);
    if (!account) {
      // Create default account if not exists
      account = await VirtualAccountDAO.createAccount({
        user_id: userId,
        initial_capital: 100000, // Default 100,000 USDT
      });
    }

    res.json({ success: true, data: account });
  } catch (error: any) {
    log.error('Failed to get account', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /public/v1/account/positions:
 *   get:
 *     summary: List account positions
 *     description: Retrieve all positions for the authenticated user's account
 *     operationId: publicListPositions
 *     tags:
 *       - Account
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of positions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       symbol:
 *                         type: string
 *                       quantity:
 *                         type: number
 *                       average_cost:
 *                         type: number
 *                       current_price:
 *                         type: number
 *                       market_value:
 *                         type: number
 *                       unrealized_pnl:
 *                         type: number
 */
router.get('/account/positions', requireApiPermission('read'), async (req: Request, res: Response) => {
  try {
    const userId = req.apiKeyUser?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const account = await VirtualAccountDAO.getAccountByUserId(userId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const positions = await VirtualAccountDAO.getPositions(account.id);

    res.json({ success: true, data: positions });
  } catch (error: any) {
    log.error('Failed to list positions', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /public/v1/account/orders:
 *   get:
 *     summary: List account orders
 *     description: Retrieve all orders for the authenticated user's account
 *     operationId: publicListOrders
 *     tags:
 *       - Account
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, open, partial, filled, cancelled, rejected]
 *       - name: symbol
 *         in: query
 *         schema:
 *           type: string
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of orders
 */
router.get('/account/orders', requireApiPermission('read'), async (req: Request, res: Response) => {
  try {
    const userId = req.apiKeyUser?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const account = await VirtualAccountDAO.getAccountByUserId(userId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const statusParam = req.query.status as VirtualOrder['status'] | undefined;
    const symbol = req.query.symbol as string | undefined;
    const limit = parseInt((req.query.limit as string) || '50', 10);

    const { orders } = await VirtualAccountDAO.getOrders(account.id, {
      status: statusParam ? [statusParam] : undefined,
      symbol,
      limit,
    });

    res.json({ success: true, data: orders });
  } catch (error: any) {
    log.error('Failed to list orders', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /public/v1/account/orders:
 *   post:
 *     summary: Create an order
 *     description: Submit a new trading order
 *     operationId: publicCreateOrder
 *     tags:
 *       - Account
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbol
 *               - side
 *               - order_type
 *               - quantity
 *             properties:
 *               symbol:
 *                 type: string
 *                 description: Trading symbol
 *               side:
 *                 type: string
 *                 enum: [buy, sell]
 *               order_type:
 *                 type: string
 *                 enum: [market, limit, stop_market, stop_limit]
 *               quantity:
 *                 type: number
 *               price:
 *                 type: number
 *                 description: Required for limit and stop_limit orders
 *               stop_price:
 *                 type: number
 *                 description: Required for stop_market and stop_limit orders
 *               time_in_force:
 *                 type: string
 *                 enum: [GTC, IOC, FOK, GTD]
 *                 default: GTC
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Order created
 */
router.post('/account/orders', requireApiPermission('trade'), async (req: Request, res: Response) => {
  try {
    const userId = req.apiKeyUser?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const account = await VirtualAccountDAO.getAccountByUserId(userId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const { symbol, side, order_type, quantity, price, stop_price, time_in_force, expires_at } = req.body;

    // Validation
    if (!symbol || !side || !order_type || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'symbol, side, order_type, and quantity are required',
      });
    }

    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({
        success: false,
        error: 'side must be "buy" or "sell"',
      });
    }

    if (!['market', 'limit', 'stop_market', 'stop_limit'].includes(order_type)) {
      return res.status(400).json({
        success: false,
        error: 'order_type must be one of: market, limit, stop_market, stop_limit',
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'quantity must be positive',
      });
    }

    if ((order_type === 'limit' || order_type === 'stop_limit') && !price) {
      return res.status(400).json({
        success: false,
        error: 'price is required for limit and stop_limit orders',
      });
    }

    if ((order_type === 'stop_market' || order_type === 'stop_limit') && !stop_price) {
      return res.status(400).json({
        success: false,
        error: 'stop_price is required for stop_market and stop_limit orders',
      });
    }

    const orderData: CreateOrderData = {
      account_id: account.id,
      symbol,
      side,
      order_type,
      quantity,
      price,
      stop_price,
      time_in_force: time_in_force || 'GTC',
      expires_at: expires_at ? new Date(expires_at) : undefined,
    };

    const order = await VirtualAccountDAO.createOrder(orderData);

    log.info('Order created via public API', {
      orderId: order.id,
      symbol,
      side,
      type: order_type,
      quantity,
      userId,
    });

    res.status(201).json({ success: true, data: order });
  } catch (error: any) {
    log.error('Failed to create order', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /public/v1/account/orders/{orderId}/cancel:
 *   post:
 *     summary: Cancel an order
 *     description: Cancel an open order
 *     operationId: publicCancelOrder
 *     tags:
 *       - Account
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: orderId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order cancelled
 *       400:
 *         description: Order cannot be cancelled
 *       404:
 *         description: Order not found
 */
router.post(
  '/account/orders/:orderId/cancel',
  requireApiPermission('trade'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.apiKeyUser?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const orderId = getStringParam(req.params.orderId);
      if (!orderId) {
        return res.status(400).json({ success: false, error: 'Missing order ID' });
      }

      const order = await VirtualAccountDAO.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      // Verify ownership
      const account = await VirtualAccountDAO.getAccountByUserId(userId);
      if (!account || order.account_id !== account.id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      // Check if order can be cancelled
      if (!['pending', 'open', 'partial'].includes(order.status)) {
        return res.status(400).json({
          success: false,
          error: `Cannot cancel order with status: ${order.status}`,
        });
      }

      const cancelledOrder = await VirtualAccountDAO.cancelOrder(orderId);

      log.info('Order cancelled via public API', {
        orderId,
        userId,
      });

      res.json({ success: true, data: cancelledOrder });
    } catch (error: any) {
      log.error('Failed to cancel order', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @openapi
 * /public/v1/account/trades:
 *   get:
 *     summary: List account trades
 *     description: Retrieve trade history for the authenticated user's account
 *     operationId: publicListTrades
 *     tags:
 *       - Account
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: symbol
 *         in: query
 *         schema:
 *           type: string
 *       - name: side
 *         in: query
 *         schema:
 *           type: string
 *           enum: [buy, sell]
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of trades
 */
router.get('/account/trades', requireApiPermission('read'), async (req: Request, res: Response) => {
  try {
    const userId = req.apiKeyUser?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const symbol = req.query.symbol as string | undefined;
    const side = req.query.side as 'buy' | 'sell' | undefined;
    const limit = parseInt((req.query.limit as string) || '50', 10);

    const trades = await tradesDAO.getMany({
      symbol,
      side,
      limit,
    });

    res.json({ success: true, data: trades });
  } catch (error: any) {
    log.error('Failed to list trades', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Leaderboard Endpoints
// ============================================

/**
 * @openapi
 * /public/v1/leaderboard:
 *   get:
 *     summary: Get leaderboard
 *     description: Retrieve the strategy performance leaderboard
 *     operationId: publicGetLeaderboard
 *     tags:
 *       - Leaderboard
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: sortBy
 *         in: query
 *         schema:
 *           type: string
 *           enum: [roi, winRate, profitFactor, sharpeRatio]
 *           default: roi
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Leaderboard data
 */
router.get('/leaderboard', requireApiPermission('read'), async (req: Request, res: Response) => {
  try {
    const sortBy = (req.query.sortBy as SortCriterion) || 'roi';
    const limit = parseInt((req.query.limit as string) || '100', 10);

    const entries = await leaderboardService.calculateLeaderboard(sortBy);
    const limitedEntries = entries.slice(0, limit);

    res.json({
      success: true,
      data: limitedEntries,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    log.error('Failed to get leaderboard', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export function createPublicApiRouter(): Router {
  return router;
}

export default createPublicApiRouter;