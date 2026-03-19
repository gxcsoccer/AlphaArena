/**
 * Tests for Rebalance API Routes
 */

import request from 'supertest';
import express from 'express';
import { createRebalanceRouter } from '../rebalanceRoutes';
import { rebalanceDAO } from '../../database/rebalance.dao';

// Mock rebalanceDAO
jest.mock('../../database/rebalance.dao', () => ({
  rebalanceDAO: {
    createTargetAllocation: jest.fn(),
    getTargetAllocations: jest.fn(),
    getTargetAllocation: jest.fn(),
    updateTargetAllocation: jest.fn(),
    deleteTargetAllocation: jest.fn(),
    createPlan: jest.fn(),
    getPlans: jest.fn(),
    getPlan: jest.fn(),
    updatePlan: jest.fn(),
    deletePlan: jest.fn(),
    createExecution: jest.fn(),
    getExecutions: jest.fn(),
    getExecution: jest.fn(),
  },
}));

// Mock Supabase client
jest.mock('../../database/client', () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
  };
  return {
    __esModule: true,
    default: jest.fn(() => mockSupabase),
    getSupabaseClient: jest.fn(() => mockSupabase),
  };
});

const app = express();
app.use(express.json());

// Bypass auth middleware by adding auth header to all requests
app.use((req: any, res, next) => {
  req.headers.authorization = 'Bearer test-token';
  next();
});

app.use('/api/rebalance', createRebalanceRouter());

describe('Rebalance Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Target Allocation Routes', () => {
    describe('POST /api/rebalance/allocations', () => {
      it('should create a new target allocation', async () => {
        const mockAllocation = {
          id: 'test-id',
          name: 'Test Allocation',
          allocations: [
            { symbol: 'BTC', targetWeight: 50 },
            { symbol: 'ETH', targetWeight: 50 },
          ],
          totalWeight: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        (rebalanceDAO.createTargetAllocation as jest.Mock).mockResolvedValue(mockAllocation);

        const response = await request(app)
          .post('/api/rebalance/allocations')
          .set('Authorization', 'Bearer test-token')
          .send({
            name: 'Test Allocation',
            allocations: [
              { symbol: 'BTC', targetWeight: 50 },
              { symbol: 'ETH', targetWeight: 50 },
            ],
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Test Allocation');
      });

      it('should reject allocation with invalid total weight', async () => {
        const response = await request(app)
          .post('/api/rebalance/allocations')
          .set('Authorization', 'Bearer test-token')
          .send({
            name: 'Invalid Allocation',
            allocations: [
              { symbol: 'BTC', targetWeight: 60 },
              { symbol: 'ETH', targetWeight: 60 },
            ],
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('100%');
      });

      it('should reject allocation without name', async () => {
        const response = await request(app)
          .post('/api/rebalance/allocations')
          .set('Authorization', 'Bearer test-token')
          .send({
            allocations: [
              { symbol: 'BTC', targetWeight: 100 },
            ],
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Name is required');
      });
    });

    describe('GET /api/rebalance/allocations', () => {
      it('should return all allocations', async () => {
        const mockAllocations = [
          {
            id: 'id-1',
            name: 'Allocation 1',
            allocations: [{ symbol: 'BTC', targetWeight: 100 }],
            totalWeight: 100,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        (rebalanceDAO.getTargetAllocations as jest.Mock).mockResolvedValue(mockAllocations);

        const response = await request(app)
          .get('/api/rebalance/allocations')
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
      });
    });

    describe('PUT /api/rebalance/allocations/:id', () => {
      it('should update an allocation', async () => {
        const mockUpdated = {
          id: 'test-id',
          name: 'Updated Name',
          allocations: [
            { symbol: 'BTC', targetWeight: 60 },
            { symbol: 'ETH', targetWeight: 40 },
          ],
          totalWeight: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        (rebalanceDAO.updateTargetAllocation as jest.Mock).mockResolvedValue(mockUpdated);

        const response = await request(app)
          .put('/api/rebalance/allocations/test-id')
          .set('Authorization', 'Bearer test-token')
          .send({
            name: 'Updated Name',
            allocations: [
              { symbol: 'BTC', targetWeight: 60 },
              { symbol: 'ETH', targetWeight: 40 },
            ],
          });

        expect(response.status).toBe(200);
        expect(response.body.data.name).toBe('Updated Name');
      });
    });

    describe('DELETE /api/rebalance/allocations/:id', () => {
      it('should delete an allocation', async () => {
        (rebalanceDAO.deleteTargetAllocation as jest.Mock).mockResolvedValue(undefined);

        const response = await request(app)
          .delete('/api/rebalance/allocations/test-id')
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Rebalance Plan Routes', () => {
    describe('POST /api/rebalance/plans', () => {
      it('should create a new plan', async () => {
        const mockPlan = {
          id: 'plan-id',
          name: 'Test Plan',
          targetAllocationId: 'alloc-id',
          targetAllocation: {
            id: 'alloc-id',
            name: 'Test Allocation',
            allocations: [{ symbol: 'BTC', targetWeight: 100 }],
            totalWeight: 100,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          trigger: 'manual',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        (rebalanceDAO.createPlan as jest.Mock).mockResolvedValue(mockPlan);

        const response = await request(app)
          .post('/api/rebalance/plans')
          .set('Authorization', 'Bearer test-token')
          .send({
            name: 'Test Plan',
            targetAllocationId: 'alloc-id',
            trigger: 'manual',
            isActive: true,
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Test Plan');
      });

      it('should reject plan without target allocation', async () => {
        const response = await request(app)
          .post('/api/rebalance/plans')
          .set('Authorization', 'Bearer test-token')
          .send({
            name: 'Invalid Plan',
            trigger: 'manual',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('allocation');
      });

      it('should reject threshold trigger without threshold value', async () => {
        const response = await request(app)
          .post('/api/rebalance/plans')
          .set('Authorization', 'Bearer test-token')
          .send({
            name: 'Threshold Plan',
            targetAllocationId: 'alloc-id',
            trigger: 'threshold',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('threshold');
      });
    });

    describe('GET /api/rebalance/plans', () => {
      it('should return all plans', async () => {
        const mockPlans = [
          {
            id: 'plan-1',
            name: 'Plan 1',
            targetAllocationId: 'alloc-1',
            targetAllocation: {
              id: 'alloc-1',
              name: 'Alloc 1',
              allocations: [],
              totalWeight: 100,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            trigger: 'manual',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        (rebalanceDAO.getPlans as jest.Mock).mockResolvedValue(mockPlans);

        const response = await request(app)
          .get('/api/rebalance/plans')
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });

      it('should filter by active only', async () => {
        (rebalanceDAO.getPlans as jest.Mock).mockResolvedValue([]);

        const response = await request(app)
          .get('/api/rebalance/plans?activeOnly=true')
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(200);
        expect(rebalanceDAO.getPlans).toHaveBeenCalledWith(true);
      });
    });

    describe('DELETE /api/rebalance/plans/:id', () => {
      it('should delete a plan', async () => {
        (rebalanceDAO.deletePlan as jest.Mock).mockResolvedValue(undefined);

        const response = await request(app)
          .delete('/api/rebalance/plans/plan-id')
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Execution Routes', () => {
    describe('POST /api/rebalance/preview', () => {
      it('should return preview for a plan', async () => {
        const mockPlan = {
          id: 'plan-id',
          name: 'Test Plan',
          targetAllocationId: 'alloc-id',
          targetAllocation: {
            id: 'alloc-id',
            name: 'Test',
            allocations: [
              { symbol: 'BTC', targetWeight: 50 },
              { symbol: 'ETH', targetWeight: 50 },
            ],
            totalWeight: 100,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          trigger: 'manual',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        (rebalanceDAO.getPlan as jest.Mock).mockResolvedValue(mockPlan);

        const response = await request(app)
          .post('/api/rebalance/preview')
          .set('Authorization', 'Bearer test-token')
          .send({
            planId: 'plan-id',
            portfolioValue: 100000,
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.planId).toBe('plan-id');
      });

      it('should return 404 for non-existent plan', async () => {
        (rebalanceDAO.getPlan as jest.Mock).mockResolvedValue(null);

        const response = await request(app)
          .post('/api/rebalance/preview')
          .set('Authorization', 'Bearer test-token')
          .send({
            planId: 'non-existent',
          });

        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/rebalance/execute', () => {
      it('should create execution record', async () => {
        const mockPlan = {
          id: 'plan-id',
          name: 'Test Plan',
          targetAllocationId: 'alloc-id',
          targetAllocation: {
            id: 'alloc-id',
            name: 'Test',
            allocations: [],
            totalWeight: 100,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          trigger: 'manual',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const mockExecution = {
          id: 'exec-id',
          planId: 'plan-id',
          status: 'pending',
          trigger: 'manual',
          preview: null,
          orders: [],
          totalEstimatedCost: 0,
          totalActualCost: 0,
          totalFees: 0,
          startedAt: new Date(),
          metrics: {
            totalOrders: 0,
            successfulOrders: 0,
            failedOrders: 0,
            totalVolume: 0,
            averageExecutionPrice: 0,
            executionTimeMs: 0,
            slippageBps: 0,
          },
        };

        (rebalanceDAO.getPlan as jest.Mock).mockResolvedValue(mockPlan);
        (rebalanceDAO.createExecution as jest.Mock).mockResolvedValue(mockExecution);

        const response = await request(app)
          .post('/api/rebalance/execute')
          .set('Authorization', 'Bearer test-token')
          .send({
            planId: 'plan-id',
          });

        expect(response.status).toBe(202);
        expect(response.body.success).toBe(true);
        expect(response.body.data.executionId).toBe('exec-id');
      });
    });

    describe('GET /api/rebalance/history', () => {
      it('should return execution history', async () => {
        const mockExecutions = [
          {
            id: 'exec-1',
            planId: 'plan-id',
            status: 'completed',
            trigger: 'manual',
            startedAt: new Date(),
            totalActualCost: 1000,
            totalFees: 5,
            metrics: {
              totalOrders: 2,
              successfulOrders: 2,
              failedOrders: 0,
            },
          },
        ];

        (rebalanceDAO.getExecutions as jest.Mock).mockResolvedValue(mockExecutions);

        const response = await request(app)
          .get('/api/rebalance/history?planId=plan-id')
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });

      it('should require planId', async () => {
        const response = await request(app)
          .get('/api/rebalance/history')
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Plan ID');
      });
    });
  });
});
