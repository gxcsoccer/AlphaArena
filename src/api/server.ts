/**
 * AlphaArena API Server
 *
 * Express.js + Socket.IO backend server providing:
 * - REST API endpoints for data access
 * - WebSocket real-time event streaming
 * - CORS support for frontend integration
 */

import express, { Express, Request, Response } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { EventEmitter } from 'events';
import { StrategiesDAO } from '../database/strategies.dao';
import { TradesDAO } from '../database/trades.dao';
import { PortfoliosDAO } from '../database/portfolios.dao';
import { Strategy } from '../database/strategies.dao';
import { Trade } from '../database/trades.dao';
import { Portfolio } from '../database/portfolios.dao';
import { LeaderboardService, LeaderboardEntry, SortCriterion } from '../strategy/LeaderboardService';
import { OrderBookService } from '../orderbook/OrderBookService';
import { OrderBookSnapshot, OrderBookDelta } from '../orderbook/types';

export interface APIServerConfig {
  port: number;
  corsOrigin?: string | string[];
  enableAuth?: boolean;
  authToken?: string;
}

/**
 * API Server Class
 * Combines Express REST API with Socket.IO WebSocket
 */
export class APIServer extends EventEmitter {
  private config: APIServerConfig;
  private app: Express;
  private httpServer: HTTPServer;
  private io: SocketIOServer;
  private strategiesDAO: StrategiesDAO;
  private tradesDAO: TradesDAO;
  private portfoliosDAO: PortfoliosDAO;
  private leaderboardService: LeaderboardService;
  private orderBookServices: Map<string, OrderBookService> = new Map();
  private isRunning: boolean = false;

  constructor(config: APIServerConfig) {
    super();
    this.config = {
      port: config.port || 3001,
      corsOrigin: config.corsOrigin || '*',
      enableAuth: config.enableAuth || false,
      authToken: config.authToken,
    };

    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: this.config.corsOrigin,
        methods: ['GET', 'POST'],
      },
    });

    this.strategiesDAO = new StrategiesDAO();
    this.tradesDAO = new TradesDAO();
    this.portfoliosDAO = new PortfoliosDAO();
    this.leaderboardService = new LeaderboardService();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupOrderBookServices();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // CORS
    this.app.use(cors({
      origin: this.config.corsOrigin,
      credentials: true,
    }));

    // JSON parsing
    this.app.use(express.json());

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
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup REST API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
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
        websocket: '/socket.io/',
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

        console.log(`[Order] New ${side} ${type} order: ${quantity} ${symbol} @ ${price || 'market'}`);

        // Simulate order processing delay
        setTimeout(() => {
          order.status = 'filled';
          console.log(`[Order] Order ${order.id} filled`);
        }, 1000);

        res.json({ success: true, data: order, timestamp: Date.now() });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      console.log(`[WebSocket] Client connected: ${socket.id}`);

      // Subscribe to strategy ticks
      socket.on('subscribe:strategy', (strategyId: string) => {
        socket.join(`strategy:${strategyId}`);
        console.log(`[WebSocket] Client ${socket.id} subscribed to strategy:${strategyId}`);
      });

      // Subscribe to symbol updates
      socket.on('subscribe:symbol', (symbol: string) => {
        socket.join(`symbol:${symbol}`);
        console.log(`[WebSocket] Client ${socket.id} subscribed to symbol:${symbol}`);
      });

      // Unsubscribe
      socket.on('unsubscribe', (room: string) => {
        socket.leave(room);
        console.log(`[WebSocket] Client ${socket.id} unsubscribed from ${room}`);
      });

      // Disconnect
      socket.on('disconnect', () => {
        console.log(`[WebSocket] Client disconnected: ${socket.id}`);
      });

      socket.on('subscribe:orderbook', (symbol: string) => {
        socket.join(`orderbook:${symbol}`);
        console.log(`[WebSocket] Client ${socket.id} subscribed to orderbook:${symbol}`);
        
        const service = this.orderBookServices.get(symbol);
        if (service) {
          const snapshot = service.getSnapshot(20);
          socket.emit('orderbook:snapshot', snapshot);
        }
      });

      socket.on('unsubscribe:orderbook', (symbol: string) => {
        socket.leave(`orderbook:${symbol}`);
        console.log(`[WebSocket] Client ${socket.id} unsubscribed from orderbook:${symbol}`);
      });

      // Subscribe to market data (all tickers)
      socket.on('subscribe:market', () => {
        socket.join('market:tickers');
        console.log(`[WebSocket] Client ${socket.id} subscribed to market:tickers`);
        
        // Send initial snapshot
        const tickers = this.getMarketTickers();
        tickers.forEach(ticker => {
          socket.emit('market:tick', ticker);
        });
      });

      socket.on('unsubscribe:market', () => {
        socket.leave('market:tickers');
        console.log(`[WebSocket] Client ${socket.id} unsubscribed from market:tickers`);
      });
    });
  }

  /**
   * Emit event to WebSocket clients
   */
  public emitEvent(event: string, data: any, room?: string): void {
    if (room) {
      this.io.to(room).emit(event, data);
    } else {
      this.io.emit(event, data);
    }
  }

  /**
   * Broadcast trade event
   */
  public broadcastTrade(trade: Trade): void {
    this.emitEvent('trade:new', trade);
    if (trade.symbol) {
      this.emitEvent('trade:new', trade, `symbol:${trade.symbol}`);
    }
  }

  /**
   * Broadcast portfolio update
   */
  public broadcastPortfolioUpdate(portfolio: Portfolio): void {
    this.emitEvent('portfolio:update', portfolio);
  }

  /**
   * Broadcast strategy tick
   */
  public broadcastStrategyTick(strategyId: string, data: any): void {
    this.emitEvent('strategy:tick', { strategyId, ...data }, `strategy:${strategyId}`);
  }

  /**
   * Broadcast leaderboard update
   */
  public broadcastLeaderboardUpdate(entries: LeaderboardEntry[]): void {
    this.emitEvent('leaderboard:update', entries);
  }

  /**
   * Broadcast market ticker update
   */
  public broadcastMarketTick(ticker: any): void {
    this.emitEvent('market:tick', ticker, 'market:tickers');
  }

  public broadcastOrderBookSnapshot(symbol: string, snapshot: OrderBookSnapshot): void {
    this.emitEvent('orderbook:snapshot', snapshot, `orderbook:${symbol}`);
  }

  public broadcastOrderBookDelta(symbol: string, delta: OrderBookDelta): void {
    this.emitEvent('orderbook:delta', delta, `orderbook:${symbol}`);
  }

  private setupOrderBookServices(): void {
    const symbols = ['BTC/USD', 'ETH/USD', 'BTC/USDT'];
    
    symbols.forEach(symbol => {
      const service = new OrderBookService(symbol);
      this.orderBookServices.set(symbol, service);
      
      service.connect().catch(err => {
        console.error(`[OrderBook] Failed to connect for ${symbol}:`, err);
      });
      
      service.on('snapshot', (event) => {
        this.broadcastOrderBookSnapshot(symbol, event.data);
      });
      
      service.on('delta', (event) => {
        this.broadcastOrderBookDelta(symbol, event.data);
      });
      
      console.log(`[OrderBook] Initialized service for ${symbol}`);
    });
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

      this.httpServer.listen(this.config.port, () => {
        this.isRunning = true;
        console.log(`[API Server] Listening on port ${this.config.port}`);
        console.log(`[API Server] REST API: http://localhost:${this.config.port}/api`);
        console.log(`[API Server] WebSocket: ws://localhost:${this.config.port}`);
        this.emit('start');
        resolve();
      });

      this.httpServer.on('error', (error: any) => {
        console.error('[API Server] Error:', error);
        this.emit('error', error);
        reject(error);
      });
    });
  }

  /**
   * Stop the API server
   */
  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isRunning) {
        return resolve();
      }

      this.httpServer.close((error?: Error) => {
        this.isRunning = false;
        console.log('[API Server] Stopped');
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
   * Get the Socket.IO server instance
   */
  public getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * Get the Express app instance
   */
  public getApp(): Express {
    return this.app;
  }
}

export default APIServer;
