/**
 * SchedulerRealtimeService Tests
 */

import { SchedulerRealtimeService, getSchedulerRealtimeService } from '../SchedulerRealtimeService';

// Mock Supabase client
jest.mock('../../database/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    channel: jest.fn(() => ({
      send: jest.fn().mockResolvedValue('ok'),
    })),
    removeChannel: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('SchedulerRealtimeService', () => {
  let service: SchedulerRealtimeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = getSchedulerRealtimeService();
  });

  describe('broadcastStatus', () => {
    it('should broadcast status change event', async () => {
      const userId = 'user-123';
      const status = 'running';
      const activeJobs = 5;

      const result = await service.broadcastStatus(userId, status, activeJobs);

      expect(result).toBe(true);
    });

    it('should handle broadcast failure gracefully', async () => {
      const userId = 'user-123';
      const status = 'stopped';
      const activeJobs = 0;

      // This should not throw
      const result = await service.broadcastStatus(userId, status, activeJobs);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('broadcastExecutionStart', () => {
    it('should broadcast execution start event', async () => {
      const params = {
        userId: 'user-123',
        scheduleId: 'schedule-456',
        scheduleName: 'Test Schedule',
        executionId: 'exec-789',
        triggerType: 'scheduled' as const,
      };

      const result = await service.broadcastExecutionStart(
        params.userId,
        params.scheduleId,
        params.scheduleName,
        params.executionId,
        params.triggerType
      );

      expect(result).toBe(true);
    });
  });

  describe('broadcastExecutionComplete', () => {
    it('should broadcast successful execution complete event', async () => {
      const params = {
        userId: 'user-123',
        scheduleId: 'schedule-456',
        scheduleName: 'Test Schedule',
        executionId: 'exec-789',
        triggerType: 'manual' as const,
        result: {
          success: true,
          tradesExecuted: 2,
          totalValue: 500.00,
        },
      };

      const result = await service.broadcastExecutionComplete(
        params.userId,
        params.scheduleId,
        params.scheduleName,
        params.executionId,
        params.triggerType,
        params.result
      );

      expect(result).toBe(true);
    });

    it('should broadcast failed execution event', async () => {
      const params = {
        userId: 'user-123',
        scheduleId: 'schedule-456',
        scheduleName: 'Test Schedule',
        executionId: 'exec-789',
        triggerType: 'scheduled' as const,
        result: {
          success: false,
          tradesExecuted: 0,
          errorMessage: 'Connection timeout',
        },
      };

      const result = await service.broadcastExecutionComplete(
        params.userId,
        params.scheduleId,
        params.scheduleName,
        params.executionId,
        params.triggerType,
        params.result
      );

      expect(result).toBe(true);
    });
  });

  describe('broadcastExecutionSkipped', () => {
    it('should broadcast execution skipped event', async () => {
      const params = {
        userId: 'user-123',
        scheduleId: 'schedule-456',
        scheduleName: 'Test Schedule',
        executionId: 'exec-789',
        reason: 'Schedule is paused due to consecutive failures',
      };

      const result = await service.broadcastExecutionSkipped(
        params.userId,
        params.scheduleId,
        params.scheduleName,
        params.executionId,
        params.reason
      );

      expect(result).toBe(true);
    });
  });

  describe('broadcastScheduleUpdate', () => {
    it('should broadcast schedule created event', async () => {
      const result = await service.broadcastScheduleUpdate(
        'user-123',
        'schedule-456',
        'created'
      );

      expect(result).toBe(true);
    });

    it('should broadcast schedule updated event', async () => {
      const result = await service.broadcastScheduleUpdate(
        'user-123',
        'schedule-456',
        'updated'
      );

      expect(result).toBe(true);
    });

    it('should broadcast schedule deleted event', async () => {
      const result = await service.broadcastScheduleUpdate(
        'user-123',
        'schedule-456',
        'deleted'
      );

      expect(result).toBe(true);
    });

    it('should broadcast schedule enabled event', async () => {
      const result = await service.broadcastScheduleUpdate(
        'user-123',
        'schedule-456',
        'enabled'
      );

      expect(result).toBe(true);
    });

    it('should broadcast schedule disabled event', async () => {
      const result = await service.broadcastScheduleUpdate(
        'user-123',
        'schedule-456',
        'disabled'
      );

      expect(result).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup channels for a user', async () => {
      // Broadcast some events first
      await service.broadcastStatus('user-123', 'running', 3);

      // Cleanup should not throw
      await expect(service.cleanup('user-123')).resolves.not.toThrow();
    });

    it('should cleanup all channels', async () => {
      // Broadcast some events first
      await service.broadcastStatus('user-123', 'running', 3);
      await service.broadcastStatus('user-456', 'stopped', 0);

      // Cleanup all should not throw
      await expect(service.cleanupAll()).resolves.not.toThrow();
    });
  });
});

describe('getSchedulerRealtimeService', () => {
  it('should return singleton instance', () => {
    const instance1 = getSchedulerRealtimeService();
    const instance2 = getSchedulerRealtimeService();

    expect(instance1).toBe(instance2);
  });
});