/**
 * Payment Funnel Routes Tests
 * Issue #662: 支付转化漏斗优化
 */

import request from 'supertest';
import express from 'express';
import paymentFunnelRoutes from '../paymentFunnelRoutes';
import { getPaymentFunnelService } from '../../services/paymentFunnelService';

// Mock the service
jest.mock('../../services/paymentFunnelService', () => ({
  getPaymentFunnelService: jest.fn(),
}));

// Mock auth middleware
jest.mock('../authMiddleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', role: 'admin' };
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    // Already set user as admin in authMiddleware mock
    next();
  },
}));

describe('Payment Funnel Routes', () => {
  let app: express.Application;
  let mockService: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/payment-funnel', paymentFunnelRoutes);

    mockService = {
      trackEvent: jest.fn(),
      trackEvents: jest.fn(),
      getFunnelAnalysis: jest.fn(),
      getDropOffAnalysis: jest.fn(),
      getConversionByPlan: jest.fn(),
      getConversionByDevice: jest.fn(),
      generateOptimizationSuggestions: jest.fn(),
      getABTestResults: jest.fn(),
      getSession: jest.fn(),
      calculateDailyStats: jest.fn(),
    };

    (getPaymentFunnelService as jest.Mock).mockReturnValue(mockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/payment-funnel/track', () => {
    it('should track a funnel event', async () => {
      mockService.trackEvent.mockResolvedValueOnce({ eventId: 'event-123' });

      const response = await request(app)
        .post('/api/payment-funnel/track')
        .send({
          sessionId: 'session-123',
          stage: 'subscription_page_view',
          userId: 'user-123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.eventId).toBe('event-123');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/payment-funnel/track')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should validate stage value', async () => {
      const response = await request(app)
        .post('/api/payment-funnel/track')
        .send({
          sessionId: 'session-123',
          stage: 'invalid_stage',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid stage');
    });

    it('should track all event types', async () => {
      const stages = [
        'subscription_page_view',
        'plan_selected',
        'checkout_initiated',
        'checkout_loaded',
        'payment_method_entered',
        'payment_submitted',
        'payment_succeeded',
        'payment_failed',
        'checkout_canceled',
      ];

      for (const stage of stages) {
        mockService.trackEvent.mockResolvedValueOnce({ eventId: `${stage}-event` });

        const response = await request(app)
          .post('/api/payment-funnel/track')
          .send({
            sessionId: 'session-123',
            stage,
          });

        expect(response.status).toBe(200);
        expect(response.body.eventId).toBe(`${stage}-event`);
      }
    });
  });

  describe('POST /api/payment-funnel/track-batch', () => {
    it('should track multiple events', async () => {
      mockService.trackEvents.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/payment-funnel/track-batch')
        .send({
          events: [
            { sessionId: 's1', stage: 'subscription_page_view' },
            { sessionId: 's1', stage: 'plan_selected' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
    });

    it('should validate events array', async () => {
      const response = await request(app)
        .post('/api/payment-funnel/track-batch')
        .send({ events: [] });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/payment-funnel/analysis', () => {
    it('should return funnel analysis', async () => {
      const mockAnalysis = {
        period: { start: new Date(), end: new Date() },
        steps: [
          { stage: 'subscription_page_view', stageName: '访问订阅页', count: 100, uniqueUsers: 100, conversionRate: 100, dropOffRate: 0 },
          { stage: 'plan_selected', stageName: '选择计划', count: 50, uniqueUsers: 50, conversionRate: 50, dropOffRate: 50 },
        ],
        totalVisitors: 100,
        totalConversions: 10,
        overallConversionRate: 10,
        dropOffDistribution: [],
      };

      mockService.getFunnelAnalysis.mockResolvedValueOnce(mockAnalysis);

      const response = await request(app)
        .get('/api/payment-funnel/analysis')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalVisitors).toBe(100);
    });
  });

  describe('GET /api/payment-funnel/dropoff-analysis', () => {
    it('should return drop-off analysis', async () => {
      const mockDropOff = [
        {
          stage: 'checkout_initiated',
          reason: 'price_concern',
          count: 10,
          percentage: 40,
          suggestions: ['提供优惠券'],
        },
      ];

      mockService.getDropOffAnalysis.mockResolvedValueOnce(mockDropOff);

      const response = await request(app)
        .get('/api/payment-funnel/dropoff-analysis')
        .query({ limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/payment-funnel/conversion-by-plan', () => {
    it('should return conversion by plan', async () => {
      const mockData = [
        { planId: 'pro', planName: '专业版', visitors: 50, conversions: 10, conversionRate: 20, revenue: 990 },
      ];

      mockService.getConversionByPlan.mockResolvedValueOnce(mockData);

      const response = await request(app)
        .get('/api/payment-funnel/conversion-by-plan');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/payment-funnel/conversion-by-device', () => {
    it('should return conversion by device', async () => {
      const mockData = [
        { deviceType: 'mobile', visitors: 100, conversions: 5, conversionRate: 5 },
        { deviceType: 'desktop', visitors: 50, conversions: 10, conversionRate: 20 },
      ];

      mockService.getConversionByDevice.mockResolvedValueOnce(mockData);

      const response = await request(app)
        .get('/api/payment-funnel/conversion-by-device');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/payment-funnel/optimization-suggestions', () => {
    it('should return optimization suggestions', async () => {
      const mockSuggestions = [
        {
          category: 'pricing',
          priority: 'high',
          description: '价格过高导致流失',
          impact: '提升 5-10%',
          effort: '中等',
          actionable: true,
        },
      ];

      mockService.generateOptimizationSuggestions.mockResolvedValueOnce(mockSuggestions);

      const response = await request(app)
        .get('/api/payment-funnel/optimization-suggestions');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/payment-funnel/ab-test/:experimentId', () => {
    it('should return A/B test results', async () => {
      const mockResults = {
        experimentId: 'exp-123',
        status: 'running',
        variants: [
          { variantId: 'control', variantName: 'Control', visitors: 100, conversions: 10, conversionRate: 10, improvement: 0, isSignificant: false },
          { variantId: 'variant-a', variantName: 'Variant A', visitors: 100, conversions: 15, conversionRate: 15, improvement: 50, isSignificant: true },
        ],
        winner: 'Variant A',
        recommendation: '建议采用 Variant A',
      };

      mockService.getABTestResults.mockResolvedValueOnce(mockResults);

      const response = await request(app)
        .get('/api/payment-funnel/ab-test/exp-123');

      expect(response.status).toBe(200);
      expect(response.body.data.winner).toBe('Variant A');
    });
  });

  describe('GET /api/payment-funnel/session/:sessionId', () => {
    it('should return session details', async () => {
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        completedStage: 'payment_succeeded',
        isConverted: true,
        isDropped: false,
        firstEventAt: new Date(),
        lastEventAt: new Date(),
      };

      mockService.getSession.mockResolvedValueOnce(mockSession);

      const response = await request(app)
        .get('/api/payment-funnel/session/session-123');

      expect(response.status).toBe(200);
      expect(response.body.data.sessionId).toBe('session-123');
    });

    it('should return 404 for non-existent session', async () => {
      mockService.getSession.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/payment-funnel/session/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/payment-funnel/calculate-stats', () => {
    it('should calculate daily stats', async () => {
      mockService.calculateDailyStats.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/payment-funnel/calculate-stats')
        .send({ date: '2024-01-15' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/payment-funnel/dashboard', () => {
    it('should return all dashboard data', async () => {
      mockService.getFunnelAnalysis.mockResolvedValueOnce({
        totalVisitors: 100,
        totalConversions: 10,
        steps: [],
        overallConversionRate: 10,
        dropOffDistribution: [],
      });

      mockService.getDropOffAnalysis.mockResolvedValueOnce([]);
      mockService.getConversionByPlan.mockResolvedValueOnce([]);
      mockService.getConversionByDevice.mockResolvedValueOnce([]);
      mockService.generateOptimizationSuggestions.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/payment-funnel/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.analysis).toBeDefined();
    });
  });
});