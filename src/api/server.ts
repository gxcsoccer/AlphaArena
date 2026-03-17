/**
 * AlphaArena API Server
 *
 * Express.js + Supabase Realtime backend server providing:
 * - REST API endpoints for data access
 * - Supabase Realtime for real-time event broadcasting
 * - CORS support for frontend integration
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import cors from 'cors';
import { EventEmitter } from 'events';
import { StrategiesDAO } from '../database/strategies.dao';
import { TradesDAO } from '../database/trades.dao';
import { PortfoliosDAO } from '../database/portfolios.dao';
import { ConditionalOrdersDAO } from '../database/conditional-orders.dao';
import { Strategy } from '../database/strategies.dao';
import { Trade } from '../database/trades.dao';
import { Portfolio } from '../database/portfolios.dao';
import { LeaderboardService, LeaderboardEntry, SortCriterion } from '../strategy/LeaderboardService';
import { OrderBookService } from '../orderbook/OrderBookService';
import { OrderBookSnapshot, OrderBookDelta } from '../orderbook/types';
import { SupabaseRealtimeService } from './SupabaseRealtimeService';
import { getMonitoringService, getFeishuAlertService, getPriceMonitoringService } from '../monitoring';
import { WebhookManager } from '../webhook';
import { createWebhookRouter } from './webhookRoutes';
import { createCopyTradingRouter } from './copyTradingRoutes';
import { createLeaderboardRouter } from './leaderboardRoutes';
import backtestRoutes from './backtestRoutes';
import { BotManager } from '../bot';
import { createBotRouter } from './botRoutes';
import { createApiKeyRouter } from './apiKeyRoutes';
import { createAttributionRouter } from './attributionRoutes';
import notificationRoutes from './notificationRoutes.js';
import strategyComparisonRoutes from './strategyComparisonRoutes';
import exportRoutes from './exportRoutes';
import { createLogger } from '../utils/logger';

// Create logger for this module
const log = createLogger('APIServer');

export interface APIServerConfig {
  port: number;
  corsOrigin?: string | string[];
  enableAuth?: boolean;
  authToken?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://alphaarena-production.up.railway.app', // Backend itself
  'https://alphaarena.vercel.app', // Vercel production
  'https://alphaarena-eight.vercel.app', // Vercel production deployment
  'https://alphaarena-hymr9xflt-gxcsoccer-s-team.vercel.app', // Vercel preview deployments
  'http://localhost:3000', // Local development
  'http://localhost:5173', // Vite dev server
  'https://*.vercel.app', // Wildcard for all Vercel deployments
  'https://alpha-arena-*.vercel.app', // Wildcard for alpha-arena-* Vercel deployments
];

/**
 * CORS origin validator function
 * Supports wildcard matching for *.vercel.app domains
 */
function corsOriginValidator(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  
  // Check exact matches
  if (allowedOrigins.includes(origin)) return true;
  
  // Support wildcard matching for *.vercel.app (any subdomain)
  if (allowedOrigins.includes('https://*.vercel.app')) {
    if (origin.match(/^https:\/\/[a-zA-Z0-9][a-zA-Z0-9-]*\.vercel\.app$/)) {
      return true;
    }
  }
  
  // Support wildcard matching for alpha-arena-*.vercel.app
  if (allowedOrigins.includes('https://alpha-arena-*.vercel.app')) {
    if (origin.match(/^https:\/\/alpha-arena-[a-zA-Z0-9-]+\.vercel\.app$/)) {
      return true;
    }
  }
  
  // Support wildcard matching for alphaarena-*.vercel.app (without hyphen)
  if (allowedOrigins.includes('https://*.vercel.app')) {
    if (origin.match(/^https:\/\/alphaarena-[a-zA-Z0-9-]+\.vercel\.app$/)) {
      return true;
    }
  }
  
  return false;
}

/**
 * API Server Class
 * Combines Express REST API with Supabase Realtime broadcasting
 */
export class APIServer extends EventEmitter {
  private config: APIServerConfig;
  private app: Express;
  private httpServer: HTTPServer;
  private realtime: SupabaseRealtimeService;
  private monitoring = getMonitoringService();
  private feishuAlert = getFeishuAlertService();
  private strategiesDAO: StrategiesDAO;
  private tradesDAO: TradesDAO;
  private portfoliosDAO: PortfoliosDAO;
  private conditionalOrdersDAO: ConditionalOrdersDAO;
  private leaderboardService: LeaderboardService;
  private orderBookServices: Map<string, OrderBookService> = new Map();
  private priceMonitoring = getPriceMonitoringService();
  private isRunning: boolean = false;
  private clientErrors: any[] = [];
  private webhookManager: WebhookManager;
  private botManager: BotManager;

  constructor(config: APIServerConfig) {
    super();
    this.config = {
      port: config.port || 3001,
      corsOrigin: config.corsOrigin || ALLOWED_ORIGINS,
      enableAuth: config.enableAuth || false,
      authToken: config.authToken,
      supabaseUrl: config.supabaseUrl || process.env.SUPABASE_URL || '',
      supabaseAnonKey: config.supabaseAnonKey || process.env.SUPABASE_ANON_KEY || '',
    };

    this.app = express();
    this.httpServer = createServer(this.app);
    
    // Initialize Supabase Realtime service
    if (this.config.supabaseUrl && this.config.supabaseAnonKey) {
      this.realtime = new SupabaseRealtimeService(
        this.config.supabaseUrl,
        this.config.supabaseAnonKey
      );
      log.info('Initialized Supabase Realtime service');
    } else {
      log.warn('Supabase credentials not provided, realtime features disabled');
      // Create a dummy service for testing
      this.realtime = null as any;
    }

    this.strategiesDAO = new StrategiesDAO();
    this.tradesDAO = new TradesDAO();
    this.portfoliosDAO = new PortfoliosDAO();
    this.conditionalOrdersDAO = new ConditionalOrdersDAO();
    this.leaderboardService = new LeaderboardService();
    this.webhookManager = new WebhookManager();
    this.botManager = new BotManager();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupOrderBookServices();
    this.setupMonitoring();
    this.setupPriceMonitoring();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // CORS with origin validation function
    const corsOrigin = this.config.corsOrigin || ALLOWED_ORIGINS;
    this.app.use(cors({
      origin: (origin, callback) => {
        if (corsOriginValidator(origin, Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin])) {
          callback(null, true);
        } else {
          log.info(`Blocked origin: ${origin}`);
          callback(null, false);
        }
      },
      credentials: true,
    }));

    // JSON parsing
    this.app.use(express.json());

    // Monitoring middleware - track request timing and errors
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Track response finish
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.monitoring.recordResponse(duration);
        
        // Track errors (5xx responses)
        if (res.statusCode >= 500) {
          this.monitoring.trackError(
            `HTTP ${res.statusCode} on ${req.method} ${req.path}`,
            {
              operation: `${req.method} ${req.path}`,
              statusCode: res.statusCode,
              duration,
            },
            'high'
          );
        }
      });
      
      next();
    });

    // Optional authentication middleware
    if (this.config.enableAuth) {
      this.app.use((req: Request, res: Response, next) => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token || token !== this.config.authToken) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
      });
    }

    // Request logging
    this.app.use((req: Request, res: Response, next) => {
      log.info(`${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup REST API routes
   */
  private setupRoutes(): void {
    // Basic health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Error logging endpoint - receives client-side errors
    this.app.post('/api/log-error', (req: Request, res: Response) => {
      try {
        const { error } = req.body;
        
        if (!error) {
          return res.status(400).json({ 
            success: false, 
            error: 'Missing error data' 
          });
        }

        // Log the error to console with timestamp
        const timestamp = new Date().toISOString();
        const errorType = error.type === 'unhandledrejection' ? 'UNHANDLED_REJECTION' : 'CLIENT_ERROR';
        
        log.info(`[${errorType}] ${error.message}`);
        log.debug(`  URL: ${error.url}`);
        log.debug(`  Source: ${error.source || 'unknown'}`);
        log.debug(`  Location: ${error.lineno}:${error.colno || 'unknown'}`);
        
        if (error.stack) {
          log.debug(`  Stack: ${error.stack}`);
        }

        // In production, you could:
        // 1. Store in database for later analysis
        // 2. Send to external error tracking service (Sentry, etc.)
        // 3. Send Feishu alert for critical errors
        
        // For now, store in memory (would be lost on restart)
        // In production, replace with database storage
        if (!this.clientErrors) {
          this.clientErrors = [];
        }
        this.clientErrors.push({
          ...error,
          receivedAt: timestamp,
        });

        // Keep only last 1000 errors in memory
        if (this.clientErrors.length > 1000) {
          this.clientErrors = this.clientErrors.slice(-1000);
        }

        res.json({ 
          success: true, 
          message: 'Error logged successfully',
          errorId: error.id,
        });
      } catch (logError: any) {
        log.error('Failed to log client error:', logError);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to log error' 
        });
      }
    });

    // Get logged client errors (for debugging)
    this.app.get('/api/log-error', (req: Request, res: Response) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const errors = this.clientErrors ? this.clientErrors.slice(-limit) : [];
        
        res.json({ 
          success: true, 
          data: errors,
          total: this.clientErrors?.length || 0,
        });
      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // Detailed health status with metrics
    this.app.get('/health/status', (req: Request, res: Response) => {
      const healthStatus = this.monitoring.getHealthStatus(
        true, // database connected (assumed)
        this.realtime !== null,
        this.orderBookServices.size
      );
      res.json(healthStatus);
    });

    // Performance metrics dashboard
    this.app.get('/metrics', (req: Request, res: Response) => {
      const metrics = this.monitoring.getMetrics(
        0, // activeStrategies - would need to be passed from StrategyManager
        0, // totalTrades - would need to be passed from TradesDAO
        this.orderBookServices.size
      );
      res.json(metrics);
    });

    // Recent errors
    this.app.get('/metrics/errors', (req: Request, res: Response) => {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const errors = this.monitoring.getRecentErrors(limit);
      const bySeverity = this.monitoring.getErrorsBySeverity();
      res.json({
        errors,
        bySeverity,
        total: this.monitoring.getRecentErrors(1000).length,
      });
    });

    // API version
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        name: 'AlphaArena API',
        version: '1.0.0',
        endpoints: {
          strategies: '/api/strategies',
          trades: '/api/trades',
          portfolios: '/api/portfolios',
          stats: '/api/stats',
          leaderboard: '/api/leaderboard',
        },
        realtime: 'Supabase Realtime',
      });
    });

    // Strategies endpoints
    this.app.get('/api/strategies', async (req: Request, res: Response) => {
      try {
        const strategies = await this.strategiesDAO.getAll();
        res.json({ success: true, data: strategies });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/strategies/:id', async (req: Request, res: Response) => {
      try {
        const strategy = await this.strategiesDAO.getById(req.params.id as string);
        if (!strategy) {
          return res.status(404).json({ success: false, error: 'Strategy not found' });
        }
        res.json({ success: true, data: strategy });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Trades endpoints
    this.app.get('/api/trades', async (req: Request, res: Response) => {
      try {
        const filters = {
          strategyId: req.query.strategyId as string | undefined,
          symbol: req.query.symbol as string | undefined,
          side: req.query.side as 'buy' | 'sell' | undefined,
          limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
          offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        };
        const trades = await this.tradesDAO.getMany(filters);
        res.json({ success: true, data: trades });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Export trades endpoint (CSV)
    this.app.get('/api/trades/export', async (req: Request, res: Response) => {
      try {
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        
        const filters = {
          strategyId: req.query.strategyId as string | undefined,
          symbol: req.query.symbol as string | undefined,
          side: req.query.side as 'buy' | 'sell' | undefined,
          startDate,
          endDate,
        };

        const csv = await this.tradesDAO.exportToCSV(filters);

        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=trades-export.csv');
        
        res.send(csv);
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Portfolios endpoints
    this.app.get('/api/portfolios', async (req: Request, res: Response) => {
      try {
        const strategyId = req.query.strategyId as string | undefined;
        const symbol = req.query.symbol as string | undefined;
        const portfolio = await this.portfoliosDAO.getLatest(strategyId, symbol);
        res.json({ success: true, data: portfolio });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Portfolio PnL history endpoint
    this.app.get('/api/portfolios/history', async (req: Request, res: Response) => {
      try {
        const strategyId = req.query.strategyId as string;
        const timeRange = (req.query.timeRange as '1d' | '1w' | '1m' | 'all') || '1w';

        if (!strategyId) {
          return res.status(400).json({ success: false, error: 'strategyId is required' });
        }

        const history = await this.portfoliosDAO.getPnLHistory(strategyId, timeRange);
        res.json({ success: true, data: history });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Stats endpoint
    this.app.get('/api/stats', async (req: Request, res: Response) => {
      try {
        const [strategies, trades] = await Promise.all([
          this.strategiesDAO.getAll(),
          this.tradesDAO.getMany({ limit: 1000 }),
        ]);

        const stats = {
          totalStrategies: strategies.length,
          activeStrategies: strategies.filter((s: Strategy) => s.status === 'active').length,
          totalTrades: trades.length,
          totalVolume: trades.reduce((sum: number, t: Trade) => sum + t.total, 0),
          buyTrades: trades.filter((t: Trade) => t.side === 'buy').length,
          sellTrades: trades.filter((t: Trade) => t.side === 'sell').length,
        };

        res.json({ success: true, data: stats });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Leaderboard endpoints
    this.app.get('/api/leaderboard', async (req: Request, res: Response) => {
      try {
        const sortBy = (req.query.sortBy as SortCriterion) || 'roi';
        const entries = await this.leaderboardService.calculateLeaderboard(sortBy);
        res.json({ success: true, data: entries, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/leaderboard/:strategyId', async (req: Request, res: Response) => {
      try {
        const entry = this.leaderboardService.getStrategyRank(req.params.strategyId as string);
        if (!entry) {
          return res.status(404).json({ success: false, error: 'Strategy not found in leaderboard' });
        }
        res.json({ success: true, data: entry });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/leaderboard/refresh', async (req: Request, res: Response) => {
      try {
        const sortBy = (req.query.sortBy as SortCriterion) || 'roi';
        const entries = await this.leaderboardService.calculateLeaderboard(sortBy);
        res.json({ success: true, data: entries, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/leaderboard/snapshot', async (req: Request, res: Response) => {
      try {
        const snapshot = await this.leaderboardService.createSnapshot();
        res.json({ success: true, data: snapshot });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/orderbook/:symbol', async (req: Request, res: Response) => {
      try {
        const symbol = req.params.symbol as string;
        const levelsQuery = req.query.levels;
        const levels = levelsQuery && typeof levelsQuery === 'string' ? parseInt(levelsQuery) : undefined;
        
        const snapshot = this.getOrderBookSnapshot(symbol, levels);
        if (!snapshot) {
          return res.status(404).json({ success: false, error: 'Order book not found for symbol' });
        }
        
        res.json({ success: true, data: snapshot, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/orderbook/:symbol/best', async (req: Request, res: Response) => {
      try {
        const symbol = req.params.symbol as string;
        const service = this.getOrderBookService(symbol);
        
        if (!service) {
          return res.status(404).json({ success: false, error: 'Order book not found for symbol' });
        }
        
        const bestPrices = service.getBestPrices();
        res.json({ success: true, data: bestPrices, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Market Data endpoints
    this.app.get('/api/market/tickers', async (req: Request, res: Response) => {
      try {
        const tickers = this.getMarketTickers();
        res.json({ success: true, data: tickers, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/market/tickers/:symbol', async (req: Request, res: Response) => {
      try {
        const symbol = req.params.symbol as string;
        const ticker = this.getMarketTicker(symbol);
        if (!ticker) {
          return res.status(404).json({ success: false, error: 'Ticker not found for symbol' });
        }
        res.json({ success: true, data: ticker, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/market/kline/:symbol', async (req: Request, res: Response) => {
      try {
        const symbol = req.params.symbol as string;
        const timeframe = req.query.timeframe as string || '1h';
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 1000;
        
        const klineData = this.getKLineData(symbol, timeframe, limit);
        res.json({ success: true, data: klineData, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Store for simulated orders (in production, this would be a database)
    const orders: Map<string, any> = new Map();

    // Orders endpoints
    this.app.post('/api/orders', async (req: Request, res: Response) => {
      try {
        const { symbol, side, type, price, quantity } = req.body;
        
        // Validate input
        if (!symbol || !side || !type || !quantity) {
          return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: symbol, side, type, quantity' 
          });
        }

        if (type === 'limit' && !price) {
          return res.status(400).json({ 
            success: false, 
            error: 'Price is required for limit orders' 
          });
        }

        // Create simulated order (in production, this would go through the matching engine)
        const order = {
          id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          symbol,
          side,
          type,
          price: price || 0,
          quantity,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };

        // Store order
        orders.set(order.id, order);

        log.info(`New ${side} ${type} order: ${quantity} ${symbol} @ ${price || 'market'}`);

        // Simulate order processing delay
        setTimeout(() => {
          if (orders.has(order.id)) {
            const storedOrder = orders.get(order.id);
            storedOrder.status = 'filled';
            log.info(`Order ${order.id} filled`);
          }
        }, 1000);

        res.json({ success: true, data: order, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get orders endpoint
    this.app.get('/api/orders', async (req: Request, res: Response) => {
      try {
        const { symbol, status, limit = '50' } = req.query;
        
        let orderList = Array.from(orders.values());

        // Filter by symbol
        if (symbol && typeof symbol === 'string') {
          orderList = orderList.filter(o => o.symbol === symbol);
        }

        // Filter by status
        if (status && typeof status === 'string') {
          orderList = orderList.filter(o => o.status === status);
        }

        // Apply limit
        const limitNum = parseInt(typeof limit === 'string' ? limit : '50', 10);
        orderList = orderList.slice(0, limitNum);

        // Sort by creation time (newest first)
        orderList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        res.json({ success: true, data: orderList, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Cancel order endpoint
    this.app.post('/api/orders/:orderId/cancel', async (req: Request, res: Response) => {
      try {
        const { orderId } = req.params;
        
        // orderId from params is always a string in Express, but TypeScript doesn't know that
        const orderIdStr = Array.isArray(orderId) ? orderId[0] : orderId;
        const order = orders.get(orderIdStr);
        if (!order) {
          return res.status(404).json({ 
            success: false, 
            error: 'Order not found' 
          });
        }

        if (order.status !== 'pending') {
          return res.status(400).json({ 
            success: false, 
            error: 'Only pending orders can be cancelled' 
          });
        }

        // Cancel the order
        order.status = 'cancelled';
        order.cancelledAt = new Date().toISOString();
        
        log.info(`Order ${orderIdStr} cancelled`);

        res.json({ success: true, data: order, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Conditional Orders endpoints (Stop-loss / Take-profit)
    this.app.post('/api/conditional-orders', async (req: Request, res: Response) => {
      try {
        const { symbol, side, orderType, triggerPrice, quantity, expiresAt } = req.body;
        
        // Validate input
        if (!symbol || !side || !orderType || !triggerPrice || !quantity) {
          return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: symbol, side, orderType, triggerPrice, quantity' 
          });
        }

        if (!['stop_loss', 'take_profit'].includes(orderType)) {
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid orderType. Must be stop_loss or take_profit' 
          });
        }

        // Validate trigger price logic
        if (orderType === 'stop_loss' && side === 'buy') {
          return res.status(400).json({ 
            success: false, 
            error: 'Stop-loss orders can only be placed for sell side' 
          });
        }

        if (orderType === 'take_profit' && side === 'buy') {
          return res.status(400).json({ 
            success: false, 
            error: 'Take-profit orders can only be placed for sell side' 
          });
        }

        // Create conditional order
        const order = {
          id: `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          symbol,
          side,
          orderType,
          triggerPrice,
          quantity,
          status: 'active',
          expiresAt: expiresAt || null,
          createdAt: new Date().toISOString(),
        };

        // Store in database
        const savedOrder = await this.conditionalOrdersDAO.create({
          symbol,
          side,
          orderType: orderType as 'stop_loss' | 'take_profit',
          triggerPrice,
          quantity,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        });

        // Add to price monitoring
        this.priceMonitoring.watchSymbol(symbol);

        log.info(`New ${orderType} order: ${quantity} ${symbol} @ trigger ${triggerPrice}`);

        res.json({ success: true, data: savedOrder, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get conditional orders
    this.app.get('/api/conditional-orders', async (req: Request, res: Response) => {
      try {
        const { symbol, status, orderType, limit = '50' } = req.query;
        
        const filters: any = {
          limit: parseInt(typeof limit === 'string' ? limit : '50', 10),
        };

        if (symbol && typeof symbol === 'string') {
          filters.symbol = symbol;
        }
        if (status && typeof status === 'string') {
          filters.status = status as any;
        }
        if (orderType && typeof orderType === 'string') {
          filters.orderType = orderType as 'stop_loss' | 'take_profit';
        }

        const orders = await this.conditionalOrdersDAO.getMany(filters);

        res.json({ success: true, data: orders, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Cancel conditional order
    this.app.post('/api/conditional-orders/:orderId/cancel', async (req: Request, res: Response) => {
      try {
        const { orderId } = req.params;
        const orderIdStr = Array.isArray(orderId) ? orderId[0] : orderId;
        
        const order = await this.conditionalOrdersDAO.getById(orderIdStr);
        if (!order) {
          return res.status(404).json({ 
            success: false, 
            error: 'Conditional order not found' 
          });
        }

        if (order.status !== 'active') {
          return res.status(400).json({ 
            success: false, 
            error: 'Only active conditional orders can be cancelled' 
          });
        }

        const cancelledOrder = await this.conditionalOrdersDAO.cancel(orderIdStr);
        
        log.info(`Order ${orderIdStr} cancelled`);

        res.json({ success: true, data: cancelledOrder, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get conditional order stats
    this.app.get('/api/conditional-orders/stats', async (req: Request, res: Response) => {
      try {
        const { strategyId } = req.query;
        const stats = await this.conditionalOrdersDAO.getStats(strategyId as string | undefined);
        res.json({ success: true, data: stats, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Webhook routes
    this.app.use('/api/webhooks', createWebhookRouter(this.webhookManager));

    // Copy Trading routes
    this.app.use('/api/copy-trading', createCopyTradingRouter());
    this.app.use('/api/leaderboard', createLeaderboardRouter());
    this.app.use('/api/backtest', backtestRoutes);

    // Bot API routes
    this.app.use('/api/bot', createBotRouter(this.botManager));

    // API Key management routes
    this.app.use('/api/keys', createApiKeyRouter());
    this.app.use('/api/attribution', createAttributionRouter());

    // Notification routes
    this.app.use('/api/notifications', notificationRoutes);
    this.app.use('/api/strategies/compare', strategyComparisonRoutes);
    this.app.use('/api/export', exportRoutes);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * Broadcast trade event via Supabase Realtime
   * 
   * Channel Subscription Strategy:
   * - Global trade channel ('trade:global'): All clients interested in any trade can subscribe
   * - Symbol-specific ticker channel ('ticker:{symbol}'): Clients interested in specific symbols subscribe here
   * 
   * This dual-broadcast approach allows clients to choose their subscription strategy:
   * - Subscribe to 'trade:global' to receive all trades (high volume)
   * - Subscribe to 'ticker:{symbol}' to receive trades and market ticks for specific symbols (targeted)
   * 
   * Note: The same trade data is broadcast to both channels, but with different event types:
   * - 'trade:global' receives event 'new' with full trade data
   * - 'ticker:{symbol}' receives event 'tick' with trade wrapped as market tick
   * 
   * This is intentional and not a duplicate - it supports different client subscription patterns.
   */
  public async broadcastTrade(trade: Trade): Promise<void> {
    if (!this.realtime) {
      log.warn('Service not initialized, skipping trade broadcast');
      return;
    }
    
    // Broadcast to global trade channel (for clients subscribed to all trades)
    await this.realtime.broadcastTrade('global', trade);
    
    // Broadcast to symbol-specific channel (for clients interested in this symbol only)
    if (trade.symbol) {
      await this.realtime.broadcastMarketTick(trade.symbol, {
        type: 'trade',
        data: trade,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Broadcast portfolio update via Supabase Realtime
   */
  public async broadcastPortfolioUpdate(portfolio: Portfolio): Promise<void> {
    if (!this.realtime) {
      log.warn('Service not initialized, skipping portfolio broadcast');
      return;
    }
    await this.realtime.broadcastPortfolioUpdate('global', portfolio);
  }

  /**
   * Broadcast strategy tick via Supabase Realtime
   */
  public async broadcastStrategyTick(strategyId: string, data: any): Promise<void> {
    if (!this.realtime) {
      log.warn('Service not initialized, skipping strategy tick broadcast');
      return;
    }
    await this.realtime.broadcastStrategyTick(strategyId, data);
  }

  /**
   * Broadcast leaderboard update via Supabase Realtime
   */
  public async broadcastLeaderboardUpdate(entries: LeaderboardEntry[]): Promise<void> {
    if (!this.realtime) {
      log.warn('Service not initialized, skipping leaderboard broadcast');
      return;
    }
    await this.realtime.broadcastLeaderboardUpdate(entries);
  }

  /**
   * Broadcast market ticker update via Supabase Realtime
   */
  public async broadcastMarketTick(ticker: any): Promise<void> {
    if (!this.realtime) {
      log.warn('Service not initialized, skipping market tick broadcast');
      return;
    }
    await this.realtime.broadcastMarketTick(ticker.symbol, ticker);
  }

  /**
   * Broadcast order book snapshot via Supabase Realtime
   */
  public async broadcastOrderBookSnapshot(symbol: string, snapshot: OrderBookSnapshot): Promise<void> {
    if (!this.realtime) {
      log.warn('Service not initialized, skipping orderbook snapshot broadcast');
      return;
    }
    await this.realtime.broadcastOrderBookSnapshot(symbol, snapshot);
  }

  /**
   * Broadcast order book delta via Supabase Realtime
   */
  public async broadcastOrderBookDelta(symbol: string, delta: OrderBookDelta): Promise<void> {
    if (!this.realtime) {
      log.warn('Service not initialized, skipping orderbook delta broadcast');
      return;
    }
    await this.realtime.broadcastOrderBookDelta(symbol, delta);
  }

  private setupOrderBookServices(): void {
    const symbols = ['BTC/USD', 'ETH/USD', 'BTC/USDT'];
    
    symbols.forEach(symbol => {
      const service = new OrderBookService(symbol);
      this.orderBookServices.set(symbol, service);
      
      service.connect().catch(err => {
        log.error(`Failed to connect for ${symbol}:`, err);
      });
      
      service.on('snapshot', (event) => {
        this.broadcastOrderBookSnapshot(symbol, event.data);
      });
      
      service.on('delta', (event) => {
        this.broadcastOrderBookDelta(symbol, event.data);
      });
      
      log.info(`Initialized service for ${symbol}`);
    });
  }

  /**
   * Setup monitoring and alerting
   */
  private setupMonitoring(): void {
    // Set up error alerting
    this.monitoring.on('error:tracked', async (error) => {
      if (error.severity === 'critical' || error.severity === 'high') {
        log.info(`Sending alert for ${error.severity} error: ${error.message}`);
        await this.feishuAlert.sendCriticalError(
          new Error(error.message),
          { context: error.context, stack: error.stack }
        );
      }
    });

    // Set up threshold alerting
    this.monitoring.on('alert', async (alertData) => {
      log.info(`Threshold alert: ${alertData.alerts.join(', ')}`);
      await this.feishuAlert.sendAlert({
        type: 'warning',
        title: '系统阈值警告',
        content: alertData.alerts.join('\n'),
        severity: 'medium',
        metadata: {
          memoryUsagePercent: alertData.metrics.memoryUsagePercent,
          cpuUsage: alertData.metrics.cpuUsage,
          errorRate: alertData.metrics.errorRate,
        },
      });
    });

    log.info('Monitoring and alerting initialized');
  }

  /**
   * Setup price monitoring for conditional orders
   */
  private setupPriceMonitoring(): void {
    // Start the price monitoring service
    this.priceMonitoring.start();

    // Watch all symbols that have order book services
    this.orderBookServices.forEach((_, symbol) => {
      this.priceMonitoring.watchSymbol(symbol);
    });

    // Listen for triggered orders and broadcast notifications
    this.priceMonitoring.on('order-triggered', async (data: any) => {
      log.info(`Order triggered: ${data.orderType} ${data.symbol} @ ${data.executedPrice}`);
      
      // Send Feishu notification for triggered orders
      const orderTypeText = data.orderType === 'stop_loss' ? '止损单' : '止盈单';
      const sideText = data.side === 'buy' ? '买入' : '卖出';
      
      if (data.orderType === 'stop_loss') {
        log.warn(`⚠️ Stop-loss triggered for ${data.symbol}: ${sideText} ${data.quantity} @ ${data.executedPrice}`);
      } else {
        log.info(`✅ Take-profit triggered for ${data.symbol}: ${sideText} ${data.quantity} @ ${data.executedPrice}`);
      }

      // Send Feishu notification
      try {
        await this.feishuAlert.sendAlert({
          type: data.orderType === 'stop_loss' ? 'warning' : 'info',
          title: `条件单已触发 - ${orderTypeText}`,
          content: `交易对：${data.symbol}\n` +
                   `类型：${orderTypeText} (${sideText})\n` +
                   `触发价格：$${data.triggerPrice}\n` +
                   `执行价格：$${data.executedPrice}\n` +
                   `数量：${data.quantity}\n` +
                   `交易 ID: ${data.tradeId}`,
        });
      } catch (error: any) {
        log.error('Failed to send Feishu notification:', error);
      }

      // Broadcast to frontend via realtime
      if (this.realtime) {
        await this.realtime.broadcastMarketTick(data.symbol, {
          type: 'conditional_order_triggered',
          data: {
            orderId: data.orderId,
            orderType: data.orderType,
            side: data.side,
            triggerPrice: data.triggerPrice,
            executedPrice: data.executedPrice,
            quantity: data.quantity,
            tradeId: data.tradeId,
          },
          timestamp: Date.now(),
        });
      }
    });

    log.info('Price monitoring service initialized');
  }

  public getOrderBookService(symbol: string): OrderBookService | undefined {
    return this.orderBookServices.get(symbol);
  }

  public getOrderBookSnapshot(symbol: string, levels?: number): OrderBookSnapshot | null {
    const service = this.orderBookServices.get(symbol);
    if (!service) {
      return null;
    }
    return service.getSnapshot(levels);
  }

  /**
   * Get market tickers for all symbols
   */
  private getMarketTickers(): any[] {
    const tickers: any[] = [];
    
    this.orderBookServices.forEach((service, symbol) => {
      const bestPrices = service.getBestPrices();
      const snapshot = service.getSnapshot(20);
      
      // Simulate 24h stats (in real implementation, this would come from historical data)
      const basePrice = bestPrices.bestBid || bestPrices.bestAsk || 0;
      const priceChange24h = (Math.random() - 0.5) * basePrice * 0.05; // ±2.5%
      const priceChangePercent24h = basePrice > 0 ? (priceChange24h / basePrice) * 100 : 0;
      
      tickers.push({
        symbol,
        price: basePrice,
        priceChange24h,
        priceChangePercent24h,
        high24h: basePrice * (1 + Math.random() * 0.03), // Up to 3% high
        low24h: basePrice * (1 - Math.random() * 0.03),  // Up to 3% low
        volume24h: Math.random() * 10000 + 1000, // Random volume
        quoteVolume24h: basePrice * (Math.random() * 10000 + 1000),
        bid: bestPrices.bestBid || 0,
        ask: bestPrices.bestAsk || 0,
        timestamp: Date.now(),
      });
    });
    
    return tickers;
  }

  /**
   * Get market ticker for a specific symbol
   */
  private getMarketTicker(symbol: string): any | null {
    const tickers = this.getMarketTickers();
    return tickers.find(t => t.symbol === symbol) || null;
  }

  /**
   * Get K-line (candlestick) data for a symbol
   * @param symbol - Trading pair symbol
   * @param timeframe - Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
   * @param limit - Number of candles to return
   */
  private getKLineData(symbol: string, timeframe: string, limit: number): any[] {
    // Parse timeframe to milliseconds
    const timeframeMap: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };

    const interval = timeframeMap[timeframe] || timeframeMap['1h'];
    const now = Date.now();
    const startTime = now - (interval * limit);

    // Generate simulated K-line data
    // In production, this would come from a database or external API
    const klines: any[] = [];
    let currentPrice = 50000; // Starting price for BTC
    
    for (let time = startTime; time < now; time += interval) {
      // Simulate price movement (random walk)
      const change = (Math.random() - 0.5) * currentPrice * 0.02; // ±1% change
      const open = currentPrice;
      const close = currentPrice + change;
      const high = Math.max(open, close) + Math.random() * currentPrice * 0.005;
      const low = Math.min(open, close) - Math.random() * currentPrice * 0.005;
      const volume = Math.random() * 100 + 10;

      klines.push({
        time: Math.floor(time / 1000), // Convert to seconds for lightweight-charts
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: parseFloat(volume.toFixed(4)),
      });

      currentPrice = close;
    }

    return klines;
  }

  /**
   * Start the API server
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        return reject(new Error('Server is already running'));
      }

      this.httpServer.listen(this.config.port, async () => {
        this.isRunning = true;
        log.info(`Listening on port ${this.config.port}`);
        log.info(`REST API: http://localhost:${this.config.port}/api`);
        log.info(`Realtime: Supabase Realtime enabled`);

        // Start WebhookManager for retry and cleanup loops
        try {
          await this.webhookManager.start();
          log.info('WebhookManager started');
        } catch (error: any) {
          log.error('Failed to start WebhookManager:', error.message);
        }
        
        // Initialize Realtime presence tracking
        if (this.realtime) {
          try {
            await this.realtime.trackPresence('api-server', {
              type: 'server',
              startedAt: new Date().toISOString(),
            });
            log.info('Server presence tracked');
          } catch (error: any) {
            log.error('Failed to track server presence:', error.message);
          }
        }
        
        this.emit('start');
        resolve();
      });

      this.httpServer.on('error', (error: any) => {
        log.error('Error:', error);
        this.emit('error', error);
        reject(error);
      });
    });
  }

  /**
   * Stop the API server
   */
  public async stop(): Promise<void> {
    // Stop webhook manager
    await this.webhookManager.stop();

    // Cleanup Realtime connections
    if (this.realtime) {
      try {
        await this.realtime.unsubscribeAll();
        log.info('All channels unsubscribed');
      } catch (error: any) {
        log.error('Error during cleanup:', error.message);
      }
    }

    return new Promise((resolve, reject) => {
      if (!this.isRunning) {
        return resolve();
      }

      this.httpServer.close((error?: Error) => {
        this.isRunning = false;
        log.info('Stopped');
        this.emit('stop');
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Check if server is running
   */
  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get the Express app instance
   */
  public getApp(): Express {
    return this.app;
  }

  /**
   * Get the Supabase Realtime service instance
   */
  public getRealtime(): SupabaseRealtimeService | null {
    return this.realtime;
  }
}

export default APIServer;
