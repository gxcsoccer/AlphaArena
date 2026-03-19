/**
 * Tests for Rebalance Scheduler
 */

import { RebalanceScheduler } from '../RebalanceScheduler';
import { RebalanceEngine } from '../RebalanceEngine';
import {
  RebalanceTrigger,
  ScheduleFrequency,
  RebalancePlan,
  TargetAllocation,
} from '../types';

// Mock RebalanceEngine
const mockPriceProvider = {
  getPrice: jest.fn().mockResolvedValue(50000),
  getPrices: jest.fn().mockResolvedValue(new Map([['BTC', 50000]])),
};

const mockEngine = new RebalanceEngine(mockPriceProvider);

// Mock rebalanceDAO
jest.mock('../../../database/rebalance.dao', () => ({
  rebalanceDAO: {
    getPlans: jest.fn(),
    getPlan: jest.fn(),
    createExecution: jest.fn(),
  },
}));

import { rebalanceDAO } from '../../../database/rebalance.dao';

describe('RebalanceScheduler', () => {
  let scheduler: RebalanceScheduler;

  const mockTargetAllocation: TargetAllocation = {
    id: 'alloc-1',
    name: 'Test Allocation',
    allocations: [
      { symbol: 'BTC', targetWeight: 50 },
      { symbol: 'ETH', targetWeight: 50 },
    ],
    totalWeight: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createMockPlan = (overrides?: Partial<RebalancePlan>): RebalancePlan => ({
    id: 'plan-1',
    name: 'Test Plan',
    targetAllocationId: 'alloc-1',
    targetAllocation: mockTargetAllocation,
    trigger: RebalanceTrigger.SCHEDULED,
    schedule: {
      frequency: ScheduleFrequency.DAILY,
      time: '09:00',
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new RebalanceScheduler(mockEngine, {
      checkIntervalMs: 60000,
      maxConcurrentJobs: 3,
      enableRetry: true,
      notifyOnExecution: true,
    });
  });

  afterEach(async () => {
    await scheduler.stop();
  });

  describe('schedulePlan', () => {
    it('should schedule a plan with daily frequency', async () => {
      const plan = createMockPlan();
      
      const job = await scheduler.schedulePlan(plan);

      expect(job.planId).toBe(plan.id);
      expect(job.status).toBe('scheduled');
      expect(job.nextRunTime).toBeInstanceOf(Date);
    });

    it('should throw error for non-scheduled trigger', async () => {
      const plan = createMockPlan({ trigger: RebalanceTrigger.MANUAL });

      await expect(scheduler.schedulePlan(plan)).rejects.toThrow(
        'Plan is not configured for scheduled rebalancing'
      );
    });

    it('should calculate correct next run time for weekly schedule', async () => {
      const plan = createMockPlan({
        schedule: {
          frequency: ScheduleFrequency.WEEKLY,
          time: '10:00',
          dayOfWeek: 1, // Monday
        },
      });

      const job = await scheduler.schedulePlan(plan);

      expect(job.nextRunTime.getDay()).toBe(1); // Monday
    });

    it('should calculate correct next run time for monthly schedule', async () => {
      const plan = createMockPlan({
        schedule: {
          frequency: ScheduleFrequency.MONTHLY,
          time: '09:00',
          dayOfMonth: 15,
        },
      });

      const job = await scheduler.schedulePlan(plan);

      expect(job.nextRunTime.getDate()).toBe(15);
    });
  });

  describe('unschedulePlan', () => {
    it('should unschedule a plan', async () => {
      const plan = createMockPlan();
      await scheduler.schedulePlan(plan);

      const result = await scheduler.unschedulePlan(plan.id);

      expect(result).toBe(true);
      expect(scheduler.getScheduledJobs()).toHaveLength(0);
    });

    it('should return false for non-existent plan', async () => {
      const result = await scheduler.unschedulePlan('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('pauseJob and resumeJob', () => {
    it('should pause a scheduled job', async () => {
      const plan = createMockPlan();
      await scheduler.schedulePlan(plan);

      const result = scheduler.pauseJob(plan.id);

      expect(result).toBe(true);
      const jobs = scheduler.getScheduledJobs();
      expect(jobs[0].status).toBe('paused');
    });

    it('should resume a paused job', async () => {
      const plan = createMockPlan();
      await scheduler.schedulePlan(plan);
      scheduler.pauseJob(plan.id);

      const result = scheduler.resumeJob(plan.id);

      expect(result).toBe(true);
      const jobs = scheduler.getScheduledJobs();
      expect(jobs[0].status).toBe('scheduled');
    });
  });

  describe('getStatus', () => {
    it('should return correct scheduler status', async () => {
      const plan = createMockPlan();
      await scheduler.schedulePlan(plan);

      const status = scheduler.getStatus();

      expect(status.totalJobs).toBe(1);
      expect(status.scheduledJobs).toBe(1);
      expect(status.runningJobs).toBe(0);
    });
  });

  describe('start and stop', () => {
    it('should start and stop scheduler', async () => {
      (rebalanceDAO.getPlans as jest.Mock).mockResolvedValue([]);

      await scheduler.start();
      const status = scheduler.getStatus();
      expect(status.isRunning).toBe(true);

      await scheduler.stop();
      const statusAfterStop = scheduler.getStatus();
      expect(statusAfterStop.isRunning).toBe(false);
    });

    it('should load scheduled plans on start', async () => {
      const plan = createMockPlan();
      (rebalanceDAO.getPlans as jest.Mock).mockResolvedValue([plan]);

      await scheduler.start();

      expect(rebalanceDAO.getPlans).toHaveBeenCalledWith(true);
    });
  });

  describe('getNextRunTime', () => {
    it('should return next run time for a plan', async () => {
      const plan = createMockPlan();
      await scheduler.schedulePlan(plan);

      const nextRun = scheduler.getNextRunTime(plan.id);

      expect(nextRun).toBeInstanceOf(Date);
    });

    it('should return undefined for non-existent plan', () => {
      const nextRun = scheduler.getNextRunTime('non-existent');
      expect(nextRun).toBeUndefined();
    });
  });
});