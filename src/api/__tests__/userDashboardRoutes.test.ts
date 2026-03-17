/**
 * Tests for User Dashboard API Routes
 */

import request from 'supertest';
import express from 'express';
import userDashboardRoutes from '../userDashboardRoutes';

// Mock authMiddleware
jest.mock('../authMiddleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-123', email: 'test@example.com', role: 'user' };
    next();
  },
}));

// Mock UserDashboardDAO
jest.mock('../../database/user-dashboard.dao', () => ({
  UserDashboardDAO: {
    getUserOverview: jest.fn().mockResolvedValue({
      userId: 'test-user-123',
      totalAssets: 100000,
      monthlyPnL: 5000,
      monthlyPnLPercent: 5,
      activeStrategies: 3,
      totalTrades: 100,
      winRate: 0.65,
      equityCurve: [],
    }),
    getUserStrategies: jest.fn().mockResolvedValue([
      {
        id: 'strat-1',
        userId: 'test-user-123',
        name: 'Test Strategy',
        type: 'momentum',
        status: 'active',
        returnRate: 15.5,
        tradeCount: 50,
        createdAt: '2025-01-01T00:00:00Z',
        lastActiveAt: '2025-03-18T00:00:00Z',
      },
    ]),
    getUserTrades: jest.fn().mockResolvedValue({
      trades: [
        {
          id: 'trade-1',
          userId: 'test-user-123',
          symbol: 'BTC/USDT',
          side: 'buy',
          price: 42000,
          quantity: 1,
          total: 42000,
          pnl: 100,
          fee: 10,
          executedAt: '2025-03-18T00:00:00Z',
        },
      ],
      total: 1,
    }),
    getUserPerformance: jest.fn().mockResolvedValue({
      userId: 'test-user-123',
      totalReturn: 12500,
      totalReturnPercent: 12.5,
      annualizedReturn: 45.2,
      maxDrawdown: -8.5,
      sharpeRatio: 1.85,
      winRate: 0.65,
      profitLossRatio: 2.3,
      monthlyReturns: [],
      assetDistribution: [],
    }),
  },
}));

const app = express();
app.use(express.json());
app.use('/api/user/dashboard', userDashboardRoutes);

describe('User Dashboard API Routes', () => {
  describe('GET /api/user/dashboard/overview', () => {
    it('should return user overview', async () => {
      const response = await request(app).get('/api/user/dashboard/overview');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.userId).toBe('test-user-123');
    });
  });

  describe('GET /api/user/dashboard/strategies', () => {
    it('should return user strategies', async () => {
      const response = await request(app).get('/api/user/dashboard/strategies');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/user/dashboard/trades', () => {
    it('should return user trades with pagination', async () => {
      const response = await request(app).get('/api/user/dashboard/trades');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('GET /api/user/dashboard/performance', () => {
    it('should return user performance metrics', async () => {
      const response = await request(app).get('/api/user/dashboard/performance');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.userId).toBe('test-user-123');
    });
  });
});
