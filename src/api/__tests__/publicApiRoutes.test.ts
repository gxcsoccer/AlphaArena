/**
 * Public API Routes Tests
 *
 * Tests for the Public API endpoints that provide third-party access
 * to the AlphaArena trading platform.
 */

import { Request } from 'express';

// Mock dependencies BEFORE importing the module
jest.mock('../apiKeyMiddleware', () => ({
  apiKeyAuthMiddleware: (req: any, res: any, next: any) => {
    // Simulate authenticated user
    req.apiKeyUser = {
      id: 'test-user-001',
      keyId: 'test-key-001',
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

jest.mock('../../database/strategies.dao', () => {
  const mockStrategies = [
    {
      id: 'strategy-001',
      name: 'Test Strategy',
      symbol: 'BTC/USDT',
      status: 'active',
      config: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'strategy-002',
      name: 'Paused Strategy',
      symbol: 'ETH/USDT',
      status: 'paused',
      config: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  return {
    StrategiesDAO: jest.fn().mockImplementation(() => ({
      getAll: jest.fn().mockResolvedValue(mockStrategies),
      getById: jest.fn().mockImplementation((id: string) => 
        Promise.resolve(mockStrategies.find(s => s.id === id) || null)
      ),
      create: jest.fn().mockImplementation((name: string, symbol: string, description: string, config: any) =>
        Promise.resolve({
          id: 'strategy-new',
          name,
          symbol,
          status: 'active',
          config: config || {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ),
      updateStatus: jest.fn().mockImplementation((id: string, status: string) =>
        Promise.resolve({
          id,
          status,
          updatedAt: new Date(),
        })
      ),
    })),
  };
});

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
        timestamp: new Date(),
      },
    ]),
  })),
}));

jest.mock('../../database/portfolios.dao', () => ({
  PortfoliosDAO: jest.fn().mockImplementation(() => ({
    getLatest: jest.fn().mockResolvedValue({
      id: 'portfolio-001',
      totalValue: 100000,
      cashBalance: 50000,
      positions: [],
    }),
  })),
}));

jest.mock('../../database/virtual-account.dao', () => ({
  VirtualAccountDAO: {
    getAccountByUserId: jest.fn().mockResolvedValue({
      id: 'account-001',
      user_id: 'test-user-001',
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
    getPositions: jest.fn().mockResolvedValue([
      {
        id: 'pos-001',
        account_id: 'account-001',
        symbol: 'BTC',
        quantity: 1.5,
        available_quantity: 1.5,
        frozen_quantity: 0,
        average_cost: 42000,
        total_cost: 63000,
        current_price: 43500,
        market_value: 65250,
        unrealized_pnl: 2250,
        unrealized_pnl_pct: 3.57,
      },
    ]),
    getOrders: jest.fn().mockResolvedValue([
      {
        id: 'order-001',
        account_id: 'account-001',
        symbol: 'BTC/USDT',
        side: 'buy',
        order_type: 'limit',
        quantity: 0.5,
        filled_quantity: 0,
        remaining_quantity: 0.5,
        price: 42000,
        status: 'open',
        created_at: new Date().toISOString(),
      },
    ]),
    createOrder: jest.fn().mockResolvedValue({
      id: 'order-new',
      account_id: 'account-001',
      symbol: 'BTC/USDT',
      side: 'buy',
      order_type: 'limit',
      quantity: 0.5,
      price: 42000,
      status: 'pending',
      created_at: new Date().toISOString(),
    }),
    getOrder: jest.fn().mockResolvedValue({
      id: 'order-001',
      account_id: 'account-001',
      symbol: 'BTC/USDT',
      side: 'buy',
      order_type: 'limit',
      quantity: 0.5,
      status: 'open',
    }),
    cancelOrder: jest.fn().mockResolvedValue({
      id: 'order-001',
      status: 'cancelled',
    }),
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
    getStrategyRank: jest.fn().mockReturnValue({
      rank: 1,
      strategyId: 'strategy-001',
      strategyName: 'Top Strategy',
    }),
  })),
  SortCriterion: {
    ROI: 'roi',
    WIN_RATE: 'winRate',
    PROFIT_FACTOR: 'profitFactor',
    SHARPE_RATIO: 'sharpeRatio',
  },
}));

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

// Import after mocks are set up
import { createPublicApiRouter } from '../publicApiRoutes';

describe('Public API Routes', () => {
  let router: any;

  beforeEach(() => {
    jest.clearAllMocks();
    router = createPublicApiRouter();
  });

  describe('Router Setup', () => {
    it('should create a router with routes', () => {
      expect(router).toBeDefined();
      expect(router.stack).toBeDefined();
      expect(router.stack.length).toBeGreaterThan(0);
    });

    it('should have API key authentication middleware', () => {
      // First layer should be the auth middleware
      const hasAuthMiddleware = router.stack.some((layer: any) => 
        layer.handle && layer.handle.name === 'apiKeyAuthMiddleware'
      );
      expect(hasAuthMiddleware).toBe(true);
    });
  });

  describe('Route Registration', () => {
    it('should register GET / route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/' && layer.route.methods.get
      );
      expect(route).toBeDefined();
    });

    it('should register GET /strategies route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/strategies' && layer.route.methods.get
      );
      expect(route).toBeDefined();
    });

    it('should register POST /strategies route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/strategies' && layer.route.methods.post
      );
      expect(route).toBeDefined();
    });

    it('should register GET /strategies/:id route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/strategies/:id' && layer.route.methods.get
      );
      expect(route).toBeDefined();
    });

    it('should register PUT /strategies/:id/status route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/strategies/:id/status' && layer.route.methods.put
      );
      expect(route).toBeDefined();
    });

    it('should register POST /backtest/run route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/backtest/run' && layer.route.methods.post
      );
      expect(route).toBeDefined();
    });

    it('should register GET /backtest/strategies route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/backtest/strategies' && layer.route.methods.get
      );
      expect(route).toBeDefined();
    });

    it('should register GET /backtest/symbols route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/backtest/symbols' && layer.route.methods.get
      );
      expect(route).toBeDefined();
    });

    it('should register GET /account route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/account' && layer.route.methods.get
      );
      expect(route).toBeDefined();
    });

    it('should register GET /account/positions route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/account/positions' && layer.route.methods.get
      );
      expect(route).toBeDefined();
    });

    it('should register GET /account/orders route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/account/orders' && layer.route.methods.get
      );
      expect(route).toBeDefined();
    });

    it('should register POST /account/orders route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/account/orders' && layer.route.methods.post
      );
      expect(route).toBeDefined();
    });

    it('should register POST /account/orders/:orderId/cancel route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/account/orders/:orderId/cancel' && layer.route.methods.post
      );
      expect(route).toBeDefined();
    });

    it('should register GET /account/trades route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/account/trades' && layer.route.methods.get
      );
      expect(route).toBeDefined();
    });

    it('should register GET /leaderboard route', () => {
      const route = router.stack.find((layer: any) => 
        layer.route?.path === '/leaderboard' && layer.route.methods.get
      );
      expect(route).toBeDefined();
    });
  });

  describe('API Info Endpoint', () => {
    it('should return API information', async () => {
      const mockJson = jest.fn();
      const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
      
      const mockRequest = {
        apiKeyUser: {
          id: 'test-user-001',
          keyId: 'test-key-001',
          permission: 'trade',
          rateLimit: {
            remainingMinute: 58,
            resetAtMinute: new Date(),
          },
        },
      };
      
      const mockResponse = {
        json: mockJson,
        status: mockStatus,
      };

      // Find the GET / route handler
      const routeHandler = router.stack.find(
        (layer: any) => layer.route?.path === '/' && layer.route.methods.get
      )?.route?.stack[0]?.handle;

      if (routeHandler) {
        await routeHandler(mockRequest, mockResponse);
        
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              version: '1.0.0',
              endpoints: expect.objectContaining({
                strategies: '/public/v1/strategies',
                backtest: '/public/v1/backtest',
                account: '/public/v1/account',
              }),
            }),
          })
        );
      }
    });
  });

  describe('Backtest Endpoints', () => {
    it('should list available strategies', async () => {
      const mockJson = jest.fn();
      const mockRequest = { apiKeyUser: { id: 'test-user-001' } };
      const mockResponse = { json: mockJson };

      const routeHandler = router.stack.find(
        (layer: any) => layer.route?.path === '/backtest/strategies' && layer.route.methods.get
      )?.route?.stack[1]?.handle;

      if (routeHandler) {
        await routeHandler(mockRequest, mockResponse);
        
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.arrayContaining([
              expect.objectContaining({
                id: expect.any(String),
                name: expect.any(String),
              }),
            ]),
          })
        );
      }
    });

    it('should list available symbols', async () => {
      const mockJson = jest.fn();
      const mockRequest = { apiKeyUser: { id: 'test-user-001' } };
      const mockResponse = { json: mockJson };

      const routeHandler = router.stack.find(
        (layer: any) => layer.route?.path === '/backtest/symbols' && layer.route.methods.get
      )?.route?.stack[1]?.handle;

      if (routeHandler) {
        await routeHandler(mockRequest, mockResponse);
        
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.arrayContaining([
              expect.objectContaining({
                id: expect.any(String),
                category: expect.any(String),
              }),
            ]),
          })
        );
      }
    });
  });
});