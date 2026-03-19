/**
 * Public API Routes Tests
 */

import { Request, Response } from 'express';
import express from 'express';
import request from 'supertest';

// Mock dependencies before importing
jest.mock('../apiKeyMiddleware', () => ({
  apiKeyAuthMiddleware: (req: any, res: any, next: any) => {
    req.apiKeyUser = {
      id: 'user-001',
      keyId: 'key-001',
      permission: 'trade',
      rateLimit: {
        remainingMinute: 58,
        remainingDay: 9942,
        resetAtMinute: new Date(),
        resetAtDay: new Date(),
      },
    };
    next();
  },
  requireApiPermission: (permission: string) => (req: any, res: any, next: any) => next(),
}));

jest.mock('../../database/strategies.dao', () => ({
  StrategiesDAO: jest.fn().mockImplementation(() => ({
    getAll: jest.fn().mockResolvedValue([
      {
        id: 'strategy-001',
        name: 'Test Strategy',
        symbol: 'BTC/USDT',
        status: 'active',
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    getById: jest.fn().mockResolvedValue({
      id: 'strategy-001',
      name: 'Test Strategy',
      symbol: 'BTC/USDT',
      status: 'active',
      config: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    create: jest.fn().mockResolvedValue({
      id: 'strategy-new',
      name: 'New Strategy',
      symbol: 'BTC/USDT',
      status: 'active',
      config: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    updateStatus: jest.fn().mockResolvedValue({
      id: 'strategy-001',
      status: 'paused',
    }),
  })),
}));

jest.mock('../../database/trades.dao', () => ({
  TradesDAO: jest.fn().mockImplementation(() => ({
    getMany: jest.fn().mockResolvedValue([
      {
        id: 'trade-001',
        symbol: 'BTC/USDT',
        side: 'buy',
        quantity: 0.5,
        price: 42000,
        total: 21000,
        fee: 21,
        timestamp: new Date(),
      },
    ]),
  })),
}));

jest.mock('../../database/portfolios.dao', () => ({
  PortfoliosDAO: jest.fn().mockImplementation(() => ({
    getLatest: jest.fn().mockResolvedValue(null),
  })),
}));

jest.mock('../../database/virtual-account.dao', () => ({
  VirtualAccountDAO: {
    getAccountByUserId: jest.fn().mockResolvedValue({
      id: 'account-001',
      user_id: 'user-001',
      balance: 100000,
      initial_capital: 100000,
      frozen_balance: 0,
      total_realized_pnl: 0,
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      account_currency: 'USDT',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    createAccount: jest.fn().mockResolvedValue({
      id: 'account-new',
      user_id: 'user-001',
      balance: 100000,
      initial_capital: 100000,
    }),
    getPositions: jest.fn().mockResolvedValue([]),
    getOrders: jest.fn().mockResolvedValue({ orders: [], total: 0 }),
    createOrder: jest.fn().mockResolvedValue({
      id: 'order-001',
      account_id: 'account-001',
      symbol: 'BTC/USDT',
      side: 'buy',
      order_type: 'limit',
      quantity: 0.5,
      price: 42000,
      status: 'pending',
      created_at: new Date().toISOString(),
    }),
    getOrder: jest.fn().mockResolvedValue(null),
    cancelOrder: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../../backtest/BacktestEngine', () => ({
  BacktestEngine: jest.fn().mockImplementation(() => ({
    run: jest.fn().mockResolvedValue({
      stats: {
        totalReturn: 45.67,
        winRate: 62.5,
        profitFactor: 1.85,
        maxDrawdown: -12.34,
        sharpeRatio: 1.45,
        totalTrades: 48,
        winningTrades: 30,
        losingTrades: 18,
      },
      trades: [],
      equity: [],
    }),
  })),
}));

jest.mock('../../strategy/LeaderboardService', () => ({
  LeaderboardService: jest.fn().mockImplementation(() => ({
    calculateLeaderboard: jest.fn().mockResolvedValue([
      {
        rank: 1,
        strategyId: 'strategy-001',
        strategyName: 'Top Strategy',
        totalReturn: 125.67,
        winRate: 68.5,
        profitFactor: 2.15,
        sharpeRatio: 1.85,
        maxDrawdown: -8.45,
        tradeCount: 156,
      },
    ]),
  })),
}));

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

// Import after mocking
import { createPublicApiRouter } from '../publicApiRoutes';

describe('Public API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/public/v1', createPublicApiRouter());
  });

  describe('GET /public/v1', () => {
    it('should return API information', async () => {
      const response = await request(app).get('/public/v1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          version: '1.0.0',
          endpoints: expect.objectContaining({
            strategies: '/public/v1/strategies',
            backtest: '/public/v1/backtest',
            account: '/public/v1/account',
          }),
        }),
      });
    });
  });

  describe('GET /public/v1/strategies', () => {
    it('should list strategies', async () => {
      const response = await request(app).get('/public/v1/strategies');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        pagination: expect.objectContaining({
          total: expect.any(Number),
        }),
      });
    });
  });

  describe('GET /public/v1/strategies/:id', () => {
    it('should return a specific strategy', async () => {
      const response = await request(app).get('/public/v1/strategies/strategy-001');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: 'strategy-001',
        }),
      });
    });
  });

  describe('POST /public/v1/strategies', () => {
    it('should create a new strategy', async () => {
      const response = await request(app)
        .post('/public/v1/strategies')
        .send({
          name: 'New Strategy',
          symbol: 'BTC/USDT',
          description: 'Test strategy',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          name: 'New Strategy',
        }),
      });
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/public/v1/strategies')
        .send({
          name: 'New Strategy',
          // missing symbol
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('required'),
      });
    });
  });

  describe('GET /public/v1/backtest/strategies', () => {
    it('should list available strategies', async () => {
      const response = await request(app).get('/public/v1/backtest/strategies');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
          }),
        ]),
      });
    });
  });

  describe('GET /public/v1/backtest/symbols', () => {
    it('should list available symbols', async () => {
      const response = await request(app).get('/public/v1/backtest/symbols');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            category: expect.any(String),
          }),
        ]),
      });
    });
  });

  describe('POST /public/v1/backtest/run', () => {
    it('should run a backtest', async () => {
      const response = await request(app)
        .post('/public/v1/backtest/run')
        .send({
          symbol: 'BTC/USDT',
          strategy: 'sma',
          capital: 10000,
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-12-31T23:59:59Z',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        result: expect.objectContaining({
          stats: expect.any(Object),
        }),
      });
    });

    it('should return 400 for invalid backtest config', async () => {
      const response = await request(app)
        .post('/public/v1/backtest/run')
        .send({
          symbol: 'BTC/USDT',
          // missing strategy
          capital: 10000,
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });

  describe('GET /public/v1/account', () => {
    it('should return account information', async () => {
      const response = await request(app).get('/public/v1/account');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: 'account-001',
        }),
      });
    });
  });

  describe('GET /public/v1/account/positions', () => {
    it('should list positions', async () => {
      const response = await request(app).get('/public/v1/account/positions');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
      });
    });
  });

  describe('GET /public/v1/account/orders', () => {
    it('should list orders', async () => {
      const response = await request(app).get('/public/v1/account/orders');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
      });
    });
  });

  describe('POST /public/v1/account/orders', () => {
    it('should create an order', async () => {
      const response = await request(app)
        .post('/public/v1/account/orders')
        .send({
          symbol: 'BTC/USDT',
          side: 'buy',
          order_type: 'limit',
          quantity: 0.5,
          price: 42000,
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          symbol: 'BTC/USDT',
          side: 'buy',
        }),
      });
    });

    it('should return 400 for invalid order', async () => {
      const response = await request(app)
        .post('/public/v1/account/orders')
        .send({
          symbol: 'BTC/USDT',
          // missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('required'),
      });
    });
  });

  describe('GET /public/v1/leaderboard', () => {
    it('should return leaderboard', async () => {
      const response = await request(app).get('/public/v1/leaderboard');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        timestamp: expect.any(Number),
      });
    });
  });
});