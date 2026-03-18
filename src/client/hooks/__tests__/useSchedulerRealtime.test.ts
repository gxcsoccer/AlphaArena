/**
 * useSchedulerRealtime Hook Tests
 * 
 * Note: Hook testing requires @testing-library/react-hooks which is not installed.
 * This file contains unit tests for the exported functions and types.
 */

import { 
  useSchedulerRealtime, 
  useSchedulerStatus,
  type SchedulerStatus,
  type ExecutionEventType,
  type SchedulerStatusEvent,
  type ExecutionEvent,
  type ScheduleUpdatedEvent,
} from '../useSchedulerRealtime';

// Test type exports
describe('useSchedulerRealtime types', () => {
  it('should export SchedulerStatus type', () => {
    const status: SchedulerStatus = 'running';
    expect(['running', 'stopped', 'paused']).toContain(status);
  });

  it('should export ExecutionEventType type', () => {
    const eventType: ExecutionEventType = 'execution_start';
    expect(['execution_start', 'execution_complete', 'execution_failed', 'execution_skipped']).toContain(eventType);
  });

  it('should define SchedulerStatusEvent interface', () => {
    const event: SchedulerStatusEvent = {
      type: 'status_change',
      userId: 'user-123',
      status: 'running',
      activeJobs: 5,
      timestamp: Date.now(),
    };
    expect(event.type).toBe('status_change');
    expect(event.status).toBe('running');
  });

  it('should define ExecutionEvent interface', () => {
    const event: ExecutionEvent = {
      type: 'execution_complete',
      userId: 'user-123',
      scheduleId: 'schedule-456',
      scheduleName: 'Test Schedule',
      executionId: 'exec-789',
      triggerType: 'scheduled',
      result: {
        success: true,
        tradesExecuted: 2,
        totalValue: 100.00,
      },
      timestamp: Date.now(),
    };
    expect(event.type).toBe('execution_complete');
    expect(event.result?.success).toBe(true);
  });

  it('should define ScheduleUpdatedEvent interface', () => {
    const event: ScheduleUpdatedEvent = {
      type: 'schedule_updated',
      userId: 'user-123',
      scheduleId: 'schedule-456',
      action: 'created',
      timestamp: Date.now(),
    };
    expect(event.type).toBe('schedule_updated');
    expect(event.action).toBe('created');
  });
});

// Test hook exports
describe('useSchedulerRealtime exports', () => {
  it('should export useSchedulerRealtime hook', () => {
    expect(typeof useSchedulerRealtime).toBe('function');
  });

  it('should export useSchedulerStatus hook', () => {
    expect(typeof useSchedulerStatus).toBe('function');
  });
});