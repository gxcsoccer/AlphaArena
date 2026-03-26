/**
 * Business Metrics Routes Tests
 * Issue #652: 业务指标仪表盘 - 订阅转化率、DAU/MAU、留存率
 */

import request from 'supertest';
import express from 'express';
import businessMetricsRoutes from '../businessMetricsRoutes';
import { businessMetricsService } from '../../analytics/BusinessMetricsService';

// Mock the service
jest.mock('../../analytics/BusinessMetricsService', () => ({
  businessMetricsService: {
    getDashboard: jest.fn(),
    getConversionFunnel: jest.fn(),
    getDAUMAU: jest.fn(),
    getRetention: jest.fn(),
    getRevenue: jest.fn(),
    exportMetrics: jest.fn(),
  },
}));

// Mock auth middleware
jest.mock('../authMiddleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user', role: 'admin' };
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.user?.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Admin access required' });
    }
  },
}));

describe('Business Metrics Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/business-metrics', businessMetricsRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/business-metrics/dashboard', () => {
    it('should return complete dashboard data', async () => {
      const mockDashboard = {
        conversionFunnel: {
          name: 'subscription_conversion',
          steps: [],
          totalUsers: 0,
          completedUsers: 0,
          overallConversionRate: 0,
        },
        dauMau: {
          current: { dau: 100, mau: 500, stickiness: 20 },
          trend: [],
          hourlyDistribution: [],
        },
        retention: {
          avgDay1: 40,
          avgDay7: 20,
          avgDay30: 10,
          cohorts: [],
        },
        revenue: {
          mrr: 5000,
          mrrGrowth: 10,
          arr: 60000,
          arpu: 50,
          ltv: 1200,
          customerCount: 100,
          payingCustomerCount: 20,
          mrrTrend: [],
        },
        period: { start: new Date(), end: new Date() },
        updatedAt: new Date(),
      };

      (businessMetricsService.getDashboard as jest.Mock).mockResolvedValue(mockDashboard);

      const response = await request(app)
        .get('/api/business-metrics/dashboard')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.dashboard).toBeDefined();
      expect(businessMetricsService.getDashboard).toHaveBeenCalledWith(30);
    });

    it('should use default days parameter', async () => {
      (businessMetricsService.getDashboard as jest.Mock).mockResolvedValue({});

      await request(app)
        .get('/api/business-metrics/dashboard');

      expect(businessMetricsService.getDashboard).toHaveBeenCalledWith(30);
    });

    it('should handle errors', async () => {
      (businessMetricsService.getDashboard as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/business-metrics/dashboard');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('GET /api/business-metrics/funnel', () => {
    it('should return conversion funnel data', async () => {
      const mockFunnel = {
        name: 'subscription_conversion',
        steps: [
          { step: '访问', order: 0, count: 1000, conversionRate: 100, dropOffRate: 0 },
          { step: '注册', order: 1, count: 100, conversionRate: 10, dropOffRate: 90 },
        ],
        totalUsers: 1000,
        completedUsers: 100,
        overallConversionRate: 10,
      };

      (businessMetricsService.getConversionFunnel as jest.Mock).mockResolvedValue(mockFunnel);

      const response = await request(app)
        .get('/api/business-metrics/funnel')
        .query({ days: 7 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.funnel).toBeDefined();
      expect(businessMetricsService.getConversionFunnel).toHaveBeenCalledWith(7);
    });
  });

  describe('GET /api/business-metrics/dau-mau', () => {
    it('should return DAU/MAU metrics', async () => {
      const mockDAUMAU = {
        current: { dau: 100, mau: 500, stickiness: 20 },
        trend: [{ date: '2026-03-01', dau: 100, mau: 500, stickiness: 20 }],
        hourlyDistribution: [{ hour: 0, count: 10, uniqueUsers: 8 }],
      };

      (businessMetricsService.getDAUMAU as jest.Mock).mockResolvedValue(mockDAUMAU);

      const response = await request(app)
        .get('/api/business-metrics/dau-mau')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.dauMau).toBeDefined();
    });
  });

  describe('GET /api/business-metrics/retention', () => {
    it('should return retention data', async () => {
      const mockRetention = {
        cohorts: [
          { cohortDate: '2026-03-01', cohortSize: 100, retentionRates: { day1: 40 } },
        ],
        avgDay1Retention: 40,
        avgDay7Retention: 20,
        avgDay30Retention: 10,
      };

      (businessMetricsService.getRetention as jest.Mock).mockResolvedValue(mockRetention);

      const response = await request(app)
        .get('/api/business-metrics/retention')
        .query({ days: 90 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.retention).toBeDefined();
    });
  });

  describe('GET /api/business-metrics/revenue', () => {
    it('should return revenue metrics', async () => {
      const mockRevenue = {
        mrr: 5000,
        mrrGrowth: 10,
        arr: 60000,
        arpu: 50,
        ltv: 1200,
        customerCount: 100,
        payingCustomerCount: 20,
        mrrTrend: [],
        arpuTrend: [],
        ltvByCohort: [],
      };

      (businessMetricsService.getRevenue as jest.Mock).mockResolvedValue(mockRevenue);

      const response = await request(app)
        .get('/api/business-metrics/revenue')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.revenue).toBeDefined();
      expect(response.body.revenue.mrr).toBe(5000);
    });
  });

  describe('GET /api/business-metrics/export', () => {
    it('should export metrics as JSON', async () => {
      (businessMetricsService.exportMetrics as jest.Mock).mockResolvedValue(
        JSON.stringify({ mrr: 5000 })
      );

      const response = await request(app)
        .get('/api/business-metrics/export')
        .query({ format: 'json' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ mrr: 5000 });
    });

    it('should export metrics as CSV', async () => {
      (businessMetricsService.exportMetrics as jest.Mock).mockResolvedValue(
        'Conversion Funnel\nStep,Count'
      );

      const response = await request(app)
        .get('/api/business-metrics/export')
        .query({ format: 'csv' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
    });
  });
});