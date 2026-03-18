/**
 * Alert Routes Tests
 */

import request from 'supertest';
import express from 'express';
import alertRoutes from '../alertRoutes';

// Mock dependencies
jest.mock('../../alerting', () => ({
  getAlertService: () => ({
    createRule: jest.fn().mockResolvedValue({ id: 'rule-1', name: 'Test Rule' }),
    getRule: jest.fn().mockResolvedValue({ id: 'rule-1', name: 'Test Rule', user_id: 'user-1' }),
    listRules: jest.fn().mockResolvedValue({ rules: [], total: 0 }),
    updateRule: jest.fn().mockResolvedValue({ id: 'rule-1', name: 'Updated Rule' }),
    deleteRule: jest.fn().mockResolvedValue(true),
    acknowledgeAlert: jest.fn().mockResolvedValue({ id: 'alert-1', is_acknowledged: true }),
    resolveAlert: jest.fn().mockResolvedValue({ id: 'alert-1', is_resolved: true }),
    getUnacknowledgedAlerts: jest.fn().mockResolvedValue([]),
    getAlertStats: jest.fn().mockResolvedValue({ total: 0 }),
    updateConfiguration: jest.fn().mockResolvedValue({ id: 'config-1' }),
  }),
}));

jest.mock('../../database/alert-rules.dao', () => ({
  alertRulesDao: {
    listAlertRules: jest.fn().mockResolvedValue({ rules: [], total: 0 }),
    getAlertRuleById: jest.fn().mockResolvedValue(null),
    deleteAlertRule: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../../database/alert-history.dao', () => ({
  alertHistoryDao: {
    listAlertHistory: jest.fn().mockResolvedValue({ alerts: [], total: 0 }),
    getAlertHistoryById: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../../database/alert-configurations.dao', () => ({
  alertConfigurationsDao: {
    getAlertConfiguration: jest.fn().mockResolvedValue({ id: 'config-1' }),
  },
}));

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/alerts', alertRoutes);
  return app;
};

describe('Alert Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  describe('GET /api/alerts/rules', () => {
    it('should list alert rules for authenticated user', async () => {
      const response = await request(app)
        .get('/api/alerts/rules')
        .set('x-user-id', 'user-1')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rules');
      expect(response.body).toHaveProperty('total');
    });
  });

  describe('POST /api/alerts/rules', () => {
    it('should create a new alert rule', async () => {
      const response = await request(app)
        .post('/api/alerts/rules')
        .set('x-user-id', 'user-1')
        .send({
          name: 'Test Rule',
          rule_type: 'consecutive_failures',
          conditions: { threshold: 3 },
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/alerts/rules')
        .set('x-user-id', 'user-1')
        .send({
          name: 'Test Rule',
          // missing rule_type and conditions
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/alerts/history', () => {
    it('should list alert history for authenticated user', async () => {
      const response = await request(app)
        .get('/api/alerts/history')
        .set('x-user-id', 'user-1')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('alerts');
      expect(response.body).toHaveProperty('total');
    });
  });

  describe('POST /api/alerts/history/:id/acknowledge', () => {
    it('should acknowledge an alert', async () => {
      const response = await request(app)
        .post('/api/alerts/history/alert-1/acknowledge')
        .set('x-user-id', 'user-1')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('is_acknowledged', true);
    });
  });

  describe('POST /api/alerts/history/:id/resolve', () => {
    it('should resolve an alert', async () => {
      const response = await request(app)
        .post('/api/alerts/history/alert-1/resolve')
        .set('x-user-id', 'user-1')
        .send({ resolution_note: 'Fixed the issue' })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('is_resolved', true);
    });
  });

  describe('GET /api/alerts/stats', () => {
    it('should return alert statistics', async () => {
      const response = await request(app)
        .get('/api/alerts/stats')
        .set('x-user-id', 'user-1')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total');
    });
  });

  describe('GET /api/alerts/unacknowledged', () => {
    it('should return unacknowledged alerts', async () => {
      const response = await request(app)
        .get('/api/alerts/unacknowledged')
        .set('x-user-id', 'user-1')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/alerts/configuration', () => {
    it('should return user alert configuration', async () => {
      const response = await request(app)
        .get('/api/alerts/configuration')
        .set('x-user-id', 'user-1')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
    });
  });

  describe('PUT /api/alerts/configuration', () => {
    it('should update user alert configuration', async () => {
      const response = await request(app)
        .put('/api/alerts/configuration')
        .set('x-user-id', 'user-1')
        .send({ alerts_enabled: true })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
    });
  });
});
