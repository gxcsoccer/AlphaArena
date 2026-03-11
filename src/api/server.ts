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

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
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
