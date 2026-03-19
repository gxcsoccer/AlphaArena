/**
 * Scheduler API Routes Tests
 */

import request from 'supertest';
import express from 'express';
import { createSchedulerRouter } from '../schedulerRoutes';

// Mock dependencies
jest.mock('../../database/client', () => {
  const mockAuth = {
    getUser: jest.fn(),
  };
  const mockFrom = jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  }));
  const mockChannel = jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn(),
  }));
  const mockClient = {
    auth: mockAuth,
    from: mockFrom,
    channel: mockChannel,
    realtime: {
      channels: new Map(),
    },
  };
  return {
    __esModule: true,
    default: jest.fn(() => mockClient),
    getSupabaseClient: jest.fn(() => mockClient),
  };
});

jest.mock('../../scheduler/SchedulerService', () => {
  const mockSchedulerService = {
    registerSchedule: jest.fn(),
    unregisterSchedule: jest.fn(),
    executeSchedule: jest.fn(),
    getStatus: jest.fn(() => ({ isRunning: true, activeJobs: 0 })),
  };
  return {
    getSchedulerService: jest.fn(() => mockSchedulerService),
  };
});

jest.mock('../../database/trading-schedules.dao', () => ({
  tradingSchedulesDAO: {
    create: jest.fn(),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findSafetyConfigByScheduleId: jest.fn(),
    createSafetyConfig: jest.fn(),
    updateSafetyConfig: jest.fn(),
    findExecutionsByScheduleId: jest.fn(),
    countExecutionsByScheduleId: jest.fn(),
    createExecution: jest.fn(),
    updateExecution: jest.fn(),
    findExecutionById: jest.fn(),
    updateExecutionStats: jest.fn(),
  },
}));

const mockUser = { id: 'test-user-id', email: 'test@example.com' };

const mockSchedule = {
  id: 'schedule-1',
  userId: 'test-user-id',
  name: 'Test Schedule',
  cronExpression: '0 * * * *',
  timezone: 'UTC',
  scheduleType: 'cron',
  enabled: true,
  params: {},
  totalExecutions: 0,
  successfulExecutions: 0,
  failedExecutions: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const app = express();
app.use(express.json());
app.use('/api/schedules', createSchedulerRouter());

describe('Scheduler Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup auth mock - getSupabaseClient() returns the client object
    const getSupabaseClient = require('../../database/client').default;
    const mockClient = getSupabaseClient();
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  describe('POST /api/schedules', () => {
    it('should create a new schedule', async () => {
      const { tradingSchedulesDAO } = require('../../database/trading-schedules.dao');
      tradingSchedulesDAO.create.mockResolvedValue(mockSchedule);

      const response = await request(app)
        .post('/api/schedules')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Test Schedule',
          cronExpression: '0 * * * *',
          scheduleType: 'cron',
          params: {},
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Test Schedule');
    });

    it('should reject invalid cron expression', async () => {
      const response = await request(app)
        .post('/api/schedules')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Test Schedule',
          cronExpression: 'invalid',
          scheduleType: 'cron',
          params: {},
        });

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/schedules')
        .send({
          name: 'Test Schedule',
          cronExpression: '0 * * * *',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/schedules', () => {
    it('should return user schedules', async () => {
      const { tradingSchedulesDAO } = require('../../database/trading-schedules.dao');
      tradingSchedulesDAO.findByUserId.mockResolvedValue([mockSchedule]);
      tradingSchedulesDAO.findSafetyConfigByScheduleId.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/schedules')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
    });
  });

  describe('GET /api/schedules/:id', () => {
    it('should return a specific schedule', async () => {
      const { tradingSchedulesDAO } = require('../../database/trading-schedules.dao');
      tradingSchedulesDAO.findById.mockResolvedValue(mockSchedule);
      tradingSchedulesDAO.findSafetyConfigByScheduleId.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/schedules/schedule-1')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('schedule-1');
    });

    it('should return 404 for non-existent schedule', async () => {
      const { tradingSchedulesDAO } = require('../../database/trading-schedules.dao');
      tradingSchedulesDAO.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/schedules/non-existent')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/schedules/:id', () => {
    it('should update a schedule', async () => {
      const { tradingSchedulesDAO } = require('../../database/trading-schedules.dao');
      tradingSchedulesDAO.findById.mockResolvedValue(mockSchedule);
      tradingSchedulesDAO.update.mockResolvedValue({
        ...mockSchedule,
        name: 'Updated Name',
      });

      const response = await request(app)
        .put('/api/schedules/schedule-1')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
    });
  });

  describe('DELETE /api/schedules/:id', () => {
    it('should delete a schedule', async () => {
      const { tradingSchedulesDAO } = require('../../database/trading-schedules.dao');
      tradingSchedulesDAO.findById.mockResolvedValue(mockSchedule);
      tradingSchedulesDAO.delete.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/schedules/schedule-1')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/schedules/:id/enable', () => {
    it('should enable a schedule', async () => {
      const { tradingSchedulesDAO } = require('../../database/trading-schedules.dao');
      tradingSchedulesDAO.findById.mockResolvedValue({ ...mockSchedule, enabled: false });
      tradingSchedulesDAO.update.mockResolvedValue({ ...mockSchedule, enabled: true });

      const response = await request(app)
        .post('/api/schedules/schedule-1/enable')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(true);
    });
  });

  describe('POST /api/schedules/:id/disable', () => {
    it('should disable a schedule', async () => {
      const { tradingSchedulesDAO } = require('../../database/trading-schedules.dao');
      tradingSchedulesDAO.findById.mockResolvedValue(mockSchedule);
      tradingSchedulesDAO.update.mockResolvedValue({ ...mockSchedule, enabled: false });

      const response = await request(app)
        .post('/api/schedules/schedule-1/disable')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(false);
    });
  });

  describe('POST /api/schedules/:id/execute', () => {
    it('should manually execute a schedule', async () => {
      const { tradingSchedulesDAO } = require('../../database/trading-schedules.dao');
      tradingSchedulesDAO.findById.mockResolvedValue(mockSchedule);
      
      const mockExecution = {
        id: 'execution-1',
        scheduleId: 'schedule-1',
        status: 'success',
        startedAt: new Date(),
        completedAt: new Date(),
      };
      
      const { getSchedulerService } = require('../../scheduler/SchedulerService');
      getSchedulerService().executeSchedule.mockResolvedValue(mockExecution);

      const response = await request(app)
        .post('/api/schedules/schedule-1/execute')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/schedules/:id/executions', () => {
    it('should return execution history', async () => {
      const { tradingSchedulesDAO } = require('../../database/trading-schedules.dao');
      tradingSchedulesDAO.findById.mockResolvedValue(mockSchedule);
      tradingSchedulesDAO.findExecutionsByScheduleId.mockResolvedValue([]);
      tradingSchedulesDAO.countExecutionsByScheduleId.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/schedules/schedule-1/executions')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.executions).toEqual([]);
    });
  });

  describe('PUT /api/schedules/:id/safety', () => {
    it('should update safety config', async () => {
      const { tradingSchedulesDAO } = require('../../database/trading-schedules.dao');
      tradingSchedulesDAO.findById.mockResolvedValue(mockSchedule);
      tradingSchedulesDAO.findSafetyConfigByScheduleId.mockResolvedValue(null);
      tradingSchedulesDAO.createSafetyConfig.mockResolvedValue({
        scheduleId: 'schedule-1',
        maxDailyTrades: 5,
        maxConsecutiveFailures: 3,
        consecutiveFailures: 0,
        isPaused: false,
        notifyOnFailure: true,
      });

      const response = await request(app)
        .put('/api/schedules/schedule-1/safety')
        .set('Authorization', 'Bearer test-token')
        .send({ maxDailyTrades: 5 });

      expect(response.status).toBe(200);
    });
  });
});
