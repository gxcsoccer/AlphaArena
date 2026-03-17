/**
 * Risk Monitor Routes Tests
 */

import request from 'supertest';
import express, { Express } from 'express';
import { createRiskMonitorRouter } from '../riskMonitorRoutes';
import { riskMonitorDAO } from '../../database/risk-monitor.dao';

// Mock the auth middleware
jest.mock('../authMiddleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
  optionalAuthMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
}));

// Mock the DAO
jest.mock('../../database/risk-monitor.dao', () => ({
  riskMonitorDAO: {
    createAlert: jest.fn(),
    getAlertById: jest.fn(),
    listAlerts: jest.fn(),
    updateAlert: jest.fn(),
    deleteAlert: jest.fn(),
    recordAlertTrigger: jest.fn(),
    createRiskHistory: jest.fn(),
    getRiskHistory: jest.fn(),
    getLatestRiskSnapshot: jest.fn(),
    createPositionRisk: jest.fn(),
    batchCreatePositionRisks: jest.fn(),
    getPositionRisksByHistoryId: jest.fn(),
    getLatestPositionRisks: jest.fn(),
    upsertCorrelation: jest.fn(),
    batchUpsertCorrelations: jest.fn(),
    getCorrelationMatrix: jest.fn(),
    getAlertHistory: jest.fn(),
  },
}));

const mockDAO = riskMonitorDAO as jest.Mocked<typeof riskMonitorDAO>;

describe('Risk Monitor Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/risk', createRiskMonitorRouter());
    jest.clearAllMocks();
  });

  describe('GET /api/risk/summary', () => {
    it('should return risk summary with metrics', async () => {
      mockDAO.getLatestRiskSnapshot.mockResolvedValue({
        id: 'snapshot-id',
        userId: 'test-user-id',
        recordedAt: new Date(),
        periodType: 'snapshot',
        var95: 1000,
        var99: 1500,
        maxDrawdown: 10,
        sharpeRatio: 1.5,
        volatility: 15,
        beta: 1.0,
        concentrationRisk: 0.3,
        liquidityRisk: 0.2,
      });

      mockDAO.getLatestPositionRisks.mockResolvedValue([]);
      mockDAO.listAlerts.mockResolvedValue([]);

      const response = await request(app).get('/api/risk/summary');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.riskScore).toBeDefined();
    });

    it('should handle no snapshot data', async () => {
      mockDAO.getLatestRiskSnapshot.mockResolvedValue(null);
      mockDAO.getLatestPositionRisks.mockResolvedValue([]);
      mockDAO.listAlerts.mockResolvedValue([]);

      const response = await request(app).get('/api/risk/summary');

      expect(response.status).toBe(200);
      expect(response.body.data.metrics).toBeNull();
      expect(response.body.data.riskScore).toBe(0);
    });
  });

  describe('GET /api/risk/positions', () => {
    it('should return position risks', async () => {
      mockDAO.getLatestPositionRisks.mockResolvedValue([
        {
          id: 'pos-1',
          userId: 'test-user-id',
          symbol: 'BTC',
          weight: 0.5,
          contributionToRisk: 0.6,
          varContribution: 500,
          recordedAt: new Date(),
        },
        {
          id: 'pos-2',
          userId: 'test-user-id',
          symbol: 'ETH',
          weight: 0.3,
          contributionToRisk: 0.3,
          varContribution: 300,
          recordedAt: new Date(),
        },
      ]);

      const response = await request(app).get('/api/risk/positions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.positions).toHaveLength(2);
      expect(response.body.data.positions[0].symbol).toBe('BTC');
    });
  });

  describe('GET /api/risk/history', () => {
    it('should return risk history', async () => {
      mockDAO.getRiskHistory.mockResolvedValue([
        {
          id: 'hist-1',
          userId: 'test-user-id',
          recordedAt: new Date('2024-01-01'),
          periodType: 'daily',
          var95: 1000,
          var99: 1500,
          volatility: 15,
        },
      ]);

      const response = await request(app).get('/api/risk/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toHaveLength(1);
    });
  });

  describe('POST /api/risk/snapshot', () => {
    it('should create a risk snapshot', async () => {
      mockDAO.createRiskHistory.mockResolvedValue({
        id: 'new-snapshot',
        userId: 'test-user-id',
        recordedAt: new Date(),
        periodType: 'snapshot',
        var95: 1200,
      });

      mockDAO.listAlerts.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/risk/snapshot')
        .send({
          var95: 1200,
          var99: 1800,
          maxDrawdown: 5,
          sharpeRatio: 2.0,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockDAO.createRiskHistory).toHaveBeenCalled();
    });

    it('should create position risks when provided', async () => {
      mockDAO.createRiskHistory.mockResolvedValue({
        id: 'new-snapshot',
        userId: 'test-user-id',
        recordedAt: new Date(),
        periodType: 'snapshot',
      });

      mockDAO.batchCreatePositionRisks.mockResolvedValue([]);
      mockDAO.listAlerts.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/risk/snapshot')
        .send({
          positions: [
            {
              symbol: 'BTC',
              weight: 0.5,
              contributionToRisk: 0.6,
              varContribution: 500,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(mockDAO.batchCreatePositionRisks).toHaveBeenCalled();
    });
  });

  describe('GET /api/risk/correlations', () => {
    it('should return correlation matrix', async () => {
      mockDAO.getCorrelationMatrix.mockResolvedValue([
        {
          id: 'corr-1',
          userId: 'test-user-id',
          symbol1: 'BTC',
          symbol2: 'ETH',
          correlation: 0.8,
          periodDays: 30,
          calculatedAt: new Date(),
        },
      ]);

      const response = await request(app).get('/api/risk/correlations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.correlations).toHaveLength(1);
    });
  });

  describe('GET /api/risk/alerts', () => {
    it('should list alerts', async () => {
      mockDAO.listAlerts.mockResolvedValue([
        {
          id: 'alert-1',
          userId: 'test-user-id',
          metric: 'var95',
          threshold: 5000,
          operator: 'gt',
          channels: ['ui'],
          enabled: true,
          triggerCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const response = await request(app).get('/api/risk/alerts');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/risk/alerts', () => {
    it('should create an alert', async () => {
      mockDAO.createAlert.mockResolvedValue({
        id: 'new-alert',
        userId: 'test-user-id',
        metric: 'var95',
        threshold: 5000,
        operator: 'gt',
        channels: ['ui'],
        enabled: true,
        triggerCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/risk/alerts')
        .send({
          metric: 'var95',
          threshold: 5000,
          operator: 'gt',
          channels: ['ui'],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(mockDAO.createAlert).toHaveBeenCalled();
    });

    it('should reject invalid metric', async () => {
      const response = await request(app)
        .post('/api/risk/alerts')
        .send({
          metric: 'invalid',
          threshold: 5000,
          operator: 'gt',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/risk/alerts/:id', () => {
    it('should update an alert', async () => {
      mockDAO.updateAlert.mockResolvedValue({
        id: 'alert-id',
        userId: 'test-user-id',
        metric: 'var95',
        threshold: 6000,
        operator: 'gt',
        channels: ['ui'],
        enabled: true,
        triggerCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .put('/api/risk/alerts/alert-id')
        .send({
          threshold: 6000,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/risk/alerts/:id', () => {
    it('should delete an alert', async () => {
      mockDAO.deleteAlert.mockResolvedValue();

      const response = await request(app).delete('/api/risk/alerts/alert-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockDAO.deleteAlert).toHaveBeenCalledWith('alert-id', 'test-user-id');
    });
  });

  describe('GET /api/risk/alerts/history', () => {
    it('should return alert history', async () => {
      mockDAO.getAlertHistory.mockResolvedValue([
        {
          id: 'hist-1',
          alertId: 'alert-1',
          userId: 'test-user-id',
          metric: 'var95',
          threshold: 5000,
          actualValue: 5500,
          operator: 'gt',
          channels: ['ui'],
          notificationSent: true,
          triggeredAt: new Date(),
        },
      ]);

      const response = await request(app).get('/api/risk/alerts/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });
});
