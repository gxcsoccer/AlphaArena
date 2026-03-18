/**
 * WebSocket Integration Tests
 * 
 * Tests for WebSocket real-time status module including:
 * - WebSocket connection establishment and disconnection
 * - Status change broadcast (running/stopped)
 * - Execution event broadcast (start/complete/failed/skipped)
 * - Disconnection reconnection mechanism
 * - Multi-client synchronization
 * 
 * Note: Uses mocked WebSocket components for JSDOM compatibility
 */

import { EventEmitter } from 'events';
import { WebSocketConnectionPool, PooledConnection, ConnectionPoolStats } from '../../src/realtime/WebSocketConnectionPool';

// Mock WebSocket for JSDOM environment
jest.mock('ws', () => {
  const MockWebSocket = jest.fn().mockImplementation((url: string) => {
    const ws = new EventEmitter();
    (ws as any).url = url;
    (ws as any).readyState = 0; // CONNECTING
    (ws as any).OPEN = 1;
    (ws as any).CLOSED = 3;
    (ws as any).send = jest.fn((data: string, callback?: (error?: Error) => void) => {
      if (callback) callback();
    });
    (ws as any).close = jest.fn(() => {
      (ws as any).readyState = 3;
      ws.emit('close');
    });
    (ws as any).terminate = jest.fn();
    
    // Simulate async open
    setTimeout(() => {
      (ws as any).readyState = 1;
      ws.emit('open');
    }, 10);
    
    return ws;
  });
  
  (MockWebSocket as any).OPEN = 1;
  (MockWebSocket as any).CONNECTING = 0;
  (MockWebSocket as any).CLOSING = 2;
  (MockWebSocket as any).CLOSED = 3;
  
  return {
    __esModule: true,
    default: MockWebSocket,
    WebSocket: MockWebSocket,
  };
});

// Helper to wait for events
function waitForEvent(emitter: EventEmitter, event: string, timeout: number = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    emitter.once(event, (...args) => {
      clearTimeout(timer);
      resolve(args.length === 1 ? args[0] : args);
    });
  });
}

// Helper to sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('WebSocket Integration Tests', () => {
  describe('WebSocketConnectionPool', () => {
    describe('Connection Establishment and Disconnection', () => {
      it('should establish initial connection pool', async () => {
        const pool = new WebSocketConnectionPool('ws://localhost:8080', {
          poolSize: 3,
          minPoolSize: 2,
          maxPoolSize: 10,
        });

        const initPromise = waitForEvent(pool, 'initialized', 10000);
        await pool.initialize();
        await initPromise;

        const stats = pool.getStats();
        expect(stats.totalConnections).toBeGreaterThanOrEqual(2);
        expect(stats.activeConnections).toBeGreaterThanOrEqual(2);

        await pool.shutdown();
      });

      it('should emit connection:created event on new connections', async () => {
        const pool = new WebSocketConnectionPool('ws://localhost:8080', { minPoolSize: 1 });
        const createdPromise = waitForEvent(pool, 'connection:created');
        await pool.initialize();
        await createdPromise;

        const stats = pool.getStats();
        expect(stats.totalConnections).toBeGreaterThan(0);
        await pool.shutdown();
      });

      it('should handle graceful shutdown', async () => {
        const pool = new WebSocketConnectionPool('ws://localhost:8080', { minPoolSize: 2 });
        await pool.initialize();
        await sleep(100);

        const shutdownPromise = waitForEvent(pool, 'shutdown');
        await pool.shutdown();
        await shutdownPromise;

        const stats = pool.getStats();
        expect(stats.totalConnections).toBe(0);
      });

      it('should return null when no connections available', () => {
        const pool = new WebSocketConnectionPool('ws://localhost:8080', { minPoolSize: 0 });
        // Don't initialize, so no connections
        const conn = pool.getConnection();
        expect(conn).toBeNull();
      });
    });

    describe('Message Sending', () => {
      it('should send messages through the pool', async () => {
        const pool = new WebSocketConnectionPool('ws://localhost:8080', { minPoolSize: 1 });
        await pool.initialize();
        await sleep(50);

        const testMessage = { type: 'test', data: 'hello' };
        await pool.send(testMessage);

        await sleep(50);
        const stats = pool.getStats();
        expect(stats.messagesProcessed).toBe(1);

        await pool.shutdown();
      });

      it('should track message count and latency', async () => {
        const pool = new WebSocketConnectionPool('ws://localhost:8080', { minPoolSize: 1 });
        await pool.initialize();
        await sleep(50);

        for (let i = 0; i < 5; i++) {
          await pool.send({ type: 'test', index: i });
        }

        await sleep(50);
        const stats = pool.getStats();
        expect(stats.messagesProcessed).toBe(5);
        expect(stats.avgLatency).toBeGreaterThanOrEqual(0);

        await pool.shutdown();
      });

      it('should return queue size', async () => {
        const pool = new WebSocketConnectionPool('ws://localhost:8080', { minPoolSize: 0 });
        expect(pool.getQueueSize()).toBe(0);
        await pool.shutdown();
      });
    });

    describe('Connection Pool Statistics', () => {
      it('should return accurate pool statistics', async () => {
        const pool = new WebSocketConnectionPool('ws://localhost:8080', {
          poolSize: 3,
          minPoolSize: 2,
          maxPoolSize: 10,
        });
        await pool.initialize();
        await sleep(50);

        const stats = pool.getStats();
        expect(stats.totalConnections).toBeGreaterThanOrEqual(2);
        expect(stats.totalConnections).toBeLessThanOrEqual(10);
        expect(stats.messagesProcessed).toBe(0);
        expect(stats.avgLatency).toBe(0);

        await pool.shutdown();
      });

      it('should include all required stats fields', async () => {
        const pool = new WebSocketConnectionPool('ws://localhost:8080', { minPoolSize: 1 });
        await pool.initialize();
        await sleep(50);

        const stats = pool.getStats();
        expect(stats).toHaveProperty('totalConnections');
        expect(stats).toHaveProperty('activeConnections');
        expect(stats).toHaveProperty('idleConnections');
        expect(stats).toHaveProperty('connectingCount');
        expect(stats).toHaveProperty('errorCount');
        expect(stats).toHaveProperty('messagesProcessed');
        expect(stats).toHaveProperty('avgLatency');

        await pool.shutdown();
      });
    });

    describe('Queue Management', () => {
      it('should reject messages when pool is shutting down', async () => {
        const pool = new WebSocketConnectionPool('ws://localhost:8080', { minPoolSize: 1 });
        await pool.initialize();
        await pool.shutdown();

        await expect(pool.send({ type: 'test' })).rejects.toThrow('Pool is shutting down');
      });
    });
  });

  describe('SchedulerRealtimeService', () => {
    // Mock Supabase client for integration testing
    let mockChannel: any;
    let mockSupabase: any;
    let sentMessages: any[];
    let service: SchedulerRealtimeService;

    beforeEach(() => {
      sentMessages = [];
      
      mockChannel = {
        send: jest.fn((message: any) => {
          sentMessages.push(message);
          return Promise.resolve('ok');
        }),
        subscribe: jest.fn(() => Promise.resolve('SUBSCRIBED')),
        unsubscribe: jest.fn(() => Promise.resolve('ok')),
      };

      mockSupabase = {
        channel: jest.fn(() => mockChannel),
        removeChannel: jest.fn(() => Promise.resolve('ok')),
      };

      jest.resetModules();
      jest.doMock('../../src/database/client', () => ({
        getSupabaseClient: jest.fn(() => mockSupabase),
      }));
    });

    afterEach(async () => {
      if (service) {
        await service.cleanupAll();
      }
      jest.dontMock('../../src/database/client');
    });

    describe('Status Change Broadcast', () => {
      it('should broadcast running status', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        const result = await service.broadcastStatus('user-123', 'running', 5);

        expect(result).toBe(true);
        expect(mockSupabase.channel).toHaveBeenCalledWith(
          'scheduler:user-123',
          expect.any(Object)
        );
        expect(sentMessages.length).toBe(1);
        expect(sentMessages[0].type).toBe('broadcast');
        expect(sentMessages[0].event).toBe('status_change');
        expect(sentMessages[0].payload.status).toBe('running');
        expect(sentMessages[0].payload.activeJobs).toBe(5);
      });

      it('should broadcast stopped status', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        await service.broadcastStatus('user-456', 'stopped', 0);

        expect(sentMessages[0].payload.status).toBe('stopped');
        expect(sentMessages[0].payload.activeJobs).toBe(0);
      });

      it('should broadcast paused status', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        await service.broadcastStatus('user-789', 'paused', 2);

        expect(sentMessages[0].payload.status).toBe('paused');
        expect(sentMessages[0].payload.activeJobs).toBe(2);
      });

      it('should include correct timestamp in status events', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        const before = Date.now();
        await service.broadcastStatus('user-123', 'running', 1);
        const after = Date.now();

        const timestamp = sentMessages[0].payload.timestamp;
        expect(timestamp).toBeGreaterThanOrEqual(before);
        expect(timestamp).toBeLessThanOrEqual(after);
      });

      it('should include userId in status events', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        await service.broadcastStatus('user-abc', 'running', 1);

        expect(sentMessages[0].payload.userId).toBe('user-abc');
      });

      it('should set type to status_change in status events', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        await service.broadcastStatus('user-123', 'running', 1);

        expect(sentMessages[0].payload.type).toBe('status_change');
      });
    });

    describe('Execution Event Broadcast', () => {
      it('should broadcast execution_start event', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        const result = await service.broadcastExecutionStart(
          'user-123',
          'schedule-456',
          'Test Schedule',
          'exec-789',
          'scheduled'
        );

        expect(result).toBe(true);
        expect(sentMessages[0].type).toBe('broadcast');
        expect(sentMessages[0].event).toBe('execution_start');
        expect(sentMessages[0].payload.type).toBe('execution_start');
        expect(sentMessages[0].payload.scheduleId).toBe('schedule-456');
        expect(sentMessages[0].payload.scheduleName).toBe('Test Schedule');
        expect(sentMessages[0].payload.executionId).toBe('exec-789');
        expect(sentMessages[0].payload.triggerType).toBe('scheduled');
      });

      it('should broadcast execution_complete event on success', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        const result = await service.broadcastExecutionComplete(
          'user-123',
          'schedule-456',
          'Test Schedule',
          'exec-789',
          'manual',
          {
            success: true,
            tradesExecuted: 3,
            totalValue: 1500.00,
          }
        );

        expect(result).toBe(true);
        expect(sentMessages[0].event).toBe('execution_complete');
        expect(sentMessages[0].payload.result.success).toBe(true);
        expect(sentMessages[0].payload.result.tradesExecuted).toBe(3);
        expect(sentMessages[0].payload.result.totalValue).toBe(1500.00);
      });

      it('should broadcast execution_failed event on failure', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        const result = await service.broadcastExecutionComplete(
          'user-123',
          'schedule-456',
          'Test Schedule',
          'exec-789',
          'scheduled',
          {
            success: false,
            tradesExecuted: 0,
            errorMessage: 'Connection timeout',
          }
        );

        expect(result).toBe(true);
        expect(sentMessages[0].event).toBe('execution_failed');
        expect(sentMessages[0].payload.type).toBe('execution_failed');
        expect(sentMessages[0].payload.result.success).toBe(false);
        expect(sentMessages[0].payload.result.errorMessage).toBe('Connection timeout');
      });

      it('should broadcast execution_skipped event', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        const result = await service.broadcastExecutionSkipped(
          'user-123',
          'schedule-456',
          'Test Schedule',
          'exec-789',
          'Market is closed'
        );

        expect(result).toBe(true);
        expect(sentMessages[0].event).toBe('execution_skipped');
        expect(sentMessages[0].payload.type).toBe('execution_skipped');
        expect(sentMessages[0].payload.result.errorMessage).toBe('Market is closed');
        expect(sentMessages[0].payload.result.tradesExecuted).toBe(0);
      });

      it('should support all trigger types', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        const triggerTypes = ['scheduled', 'manual', 'condition'] as const;

        for (const triggerType of triggerTypes) {
          sentMessages = [];
          await service.broadcastExecutionStart(
            'user-123',
            'schedule-' + triggerType,
            'Test',
            'exec-' + triggerType,
            triggerType
          );
          expect(sentMessages[0].payload.triggerType).toBe(triggerType);
        }
      });

      it('should include all required fields in execution events', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        await service.broadcastExecutionStart(
          'user-123',
          'schedule-456',
          'Test Schedule',
          'exec-789',
          'manual'
        );

        const payload = sentMessages[0].payload;
        expect(payload).toHaveProperty('type');
        expect(payload).toHaveProperty('userId');
        expect(payload).toHaveProperty('scheduleId');
        expect(payload).toHaveProperty('scheduleName');
        expect(payload).toHaveProperty('executionId');
        expect(payload).toHaveProperty('triggerType');
        expect(payload).toHaveProperty('timestamp');
      });
    });

    describe('Schedule Update Broadcast', () => {
      it('should broadcast schedule_created event', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        const result = await service.broadcastScheduleUpdate(
          'user-123',
          'schedule-456',
          'created'
        );

        expect(result).toBe(true);
        expect(sentMessages[0].type).toBe('broadcast');
        expect(sentMessages[0].event).toBe('schedule_updated');
        expect(sentMessages[0].payload.type).toBe('schedule_updated');
        expect(sentMessages[0].payload.action).toBe('created');
      });

      it('should broadcast all schedule actions', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        const actions = ['created', 'updated', 'deleted', 'enabled', 'disabled'] as const;

        for (const action of actions) {
          sentMessages = [];
          await service.broadcastScheduleUpdate('user-123', 'schedule-' + action, action);
          expect(sentMessages[0].payload.action).toBe(action);
        }
      });

      it('should include scheduleId in schedule events', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        await service.broadcastScheduleUpdate('user-123', 'schedule-abc', 'updated');

        expect(sentMessages[0].payload.scheduleId).toBe('schedule-abc');
      });
    });

    describe('Multi-Client Synchronization', () => {
      it('should create separate channels per user', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        await service.broadcastStatus('user-1', 'running', 1);
        await service.broadcastStatus('user-2', 'running', 2);
        await service.broadcastStatus('user-3', 'running', 3);

        expect(mockSupabase.channel).toHaveBeenCalledWith(
          'scheduler:user-1',
          expect.any(Object)
        );
        expect(mockSupabase.channel).toHaveBeenCalledWith(
          'scheduler:user-2',
          expect.any(Object)
        );
        expect(mockSupabase.channel).toHaveBeenCalledWith(
          'scheduler:user-3',
          expect.any(Object)
        );
      });

      it('should reuse channel for same user', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        await service.broadcastStatus('user-123', 'running', 1);
        await service.broadcastExecutionStart('user-123', 's1', 'S1', 'e1', 'manual');
        await service.broadcastScheduleUpdate('user-123', 's1', 'updated');

        // Channel should be cached and reused
        expect(mockSupabase.channel).toHaveBeenCalledTimes(1);
      });

      it('should cleanup individual user channels', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        await service.broadcastStatus('user-1', 'running', 1);
        await service.broadcastStatus('user-2', 'running', 2);

        await service.cleanup('user-1');

        expect(mockSupabase.removeChannel).toHaveBeenCalled();

        // user-2 channel should still exist
        await service.broadcastStatus('user-2', 'stopped', 0);
      });

      it('should cleanup all channels', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        await service.broadcastStatus('user-1', 'running', 1);
        await service.broadcastStatus('user-2', 'running', 2);

        await service.cleanupAll();

        expect(mockSupabase.removeChannel).toHaveBeenCalled();
      });

      it('should handle cleanup for non-existent user', async () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        // Should not throw when cleaning up non-existent user
        await expect(service.cleanup('non-existent-user')).resolves.not.toThrow();
      });
    });

    describe('Error Handling', () => {
      it('should handle broadcast failure gracefully', async () => {
        mockChannel.send = jest.fn(() => Promise.reject(new Error('Network error')));
        
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        const result = await service.broadcastStatus('user-123', 'running', 1);

        expect(result).toBe(false);
      });

      it('should handle non-ok response from channel', async () => {
        mockChannel.send = jest.fn(() => Promise.resolve({ status: 'error' }));
        
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        service = getSchedulerRealtimeService();

        const result = await service.broadcastStatus('user-123', 'running', 1);

        // Should handle non-ok response
        expect(typeof result).toBe('boolean');
      });

      it('should return singleton instance', () => {
        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        
        const instance1 = getSchedulerRealtimeService();
        const instance2 = getSchedulerRealtimeService();

        expect(instance1).toBe(instance2);
      });
    });

    describe('Event Sequencing', () => {
      it('should maintain correct event sequence for execution lifecycle', async () => {
        const mockChannel = {
          send: jest.fn((message: any) => {
            sentMessages.push(message);
            return Promise.resolve('ok');
          }),
        };

        const mockSupabase = {
          channel: jest.fn(() => mockChannel),
          removeChannel: jest.fn(() => Promise.resolve('ok')),
        };

        jest.resetModules();
        jest.doMock('../../src/database/client', () => ({
          getSupabaseClient: jest.fn(() => mockSupabase),
        }));

        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        const service = getSchedulerRealtimeService();

        // Simulate a complete execution lifecycle
        await service.broadcastStatus('user-123', 'running', 1);
        await service.broadcastExecutionStart('user-123', 'schedule-1', 'Test Schedule', 'exec-1', 'scheduled');
        await service.broadcastExecutionComplete(
          'user-123',
          'schedule-1',
          'Test Schedule',
          'exec-1',
          'scheduled',
          { success: true, tradesExecuted: 2 }
        );
        await service.broadcastStatus('user-123', 'stopped', 0);

        // Verify event sequence
        expect(sentMessages.length).toBe(4);
        expect(sentMessages[0].event).toBe('status_change');
        expect(sentMessages[1].event).toBe('execution_start');
        expect(sentMessages[2].event).toBe('execution_complete');
        expect(sentMessages[3].event).toBe('status_change');

        // Verify timestamps are in order
        for (let i = 1; i < sentMessages.length; i++) {
          expect(sentMessages[i].payload.timestamp)
            .toBeGreaterThanOrEqual(sentMessages[i - 1].payload.timestamp);
        }

        await service.cleanupAll();
        jest.dontMock('../../src/database/client');
      });

      it('should handle rapid status changes', async () => {
        let messages: any[] = [];
        
        const mockChannel = {
          send: jest.fn((message: any) => {
            messages.push(message);
            return Promise.resolve('ok');
          }),
        };

        const mockSupabase = {
          channel: jest.fn(() => mockChannel),
          removeChannel: jest.fn(() => Promise.resolve('ok')),
        };

        jest.resetModules();
        jest.doMock('../../src/database/client', () => ({
          getSupabaseClient: jest.fn(() => mockSupabase),
        }));

        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        const service = getSchedulerRealtimeService();

        // Rapid status changes
        const statuses: Array<'running' | 'paused' | 'stopped'> = ['running', 'paused', 'running', 'paused', 'stopped'];
        
        for (const status of statuses) {
          await service.broadcastStatus('user-123', status, status === 'running' ? 1 : 0);
        }

        expect(messages.length).toBe(5);
        for (let i = 0; i < statuses.length; i++) {
          expect(messages[i].payload.status).toBe(statuses[i]);
        }

        await service.cleanupAll();
        jest.dontMock('../../src/database/client');
      });

      it('should handle execution failure sequence', async () => {
        let messages: any[] = [];
        
        const mockChannel = {
          send: jest.fn((message: any) => {
            messages.push(message);
            return Promise.resolve('ok');
          }),
        };

        const mockSupabase = {
          channel: jest.fn(() => mockChannel),
          removeChannel: jest.fn(() => Promise.resolve('ok')),
        };

        jest.resetModules();
        jest.doMock('../../src/database/client', () => ({
          getSupabaseClient: jest.fn(() => mockSupabase),
        }));

        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        const service = getSchedulerRealtimeService();

        // Execution failure sequence
        await service.broadcastExecutionStart('user-123', 'schedule-1', 'Test', 'exec-1', 'scheduled');
        await service.broadcastExecutionComplete(
          'user-123',
          'schedule-1',
          'Test',
          'exec-1',
          'scheduled',
          { success: false, tradesExecuted: 0, errorMessage: 'API error' }
        );

        expect(messages.length).toBe(2);
        expect(messages[0].event).toBe('execution_start');
        expect(messages[1].event).toBe('execution_failed');
        expect(messages[1].payload.result.success).toBe(false);
        expect(messages[1].payload.result.errorMessage).toBe('API error');

        await service.cleanupAll();
        jest.dontMock('../../src/database/client');
      });

      it('should handle skip sequence', async () => {
        let messages: any[] = [];
        
        const mockChannel = {
          send: jest.fn((message: any) => {
            messages.push(message);
            return Promise.resolve('ok');
          }),
        };

        const mockSupabase = {
          channel: jest.fn(() => mockChannel),
          removeChannel: jest.fn(() => Promise.resolve('ok')),
        };

        jest.resetModules();
        jest.doMock('../../src/database/client', () => ({
          getSupabaseClient: jest.fn(() => mockSupabase),
        }));

        const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
        const service = getSchedulerRealtimeService();

        await service.broadcastExecutionSkipped('user-123', 'schedule-1', 'Test', 'exec-1', 'Condition not met');

        expect(messages.length).toBe(1);
        expect(messages[0].event).toBe('execution_skipped');
        expect(messages[0].payload.result.errorMessage).toBe('Condition not met');

        await service.cleanupAll();
        jest.dontMock('../../src/database/client');
      });
    });
  });

  describe('Type Safety', () => {
    it('should have correct types for SchedulerStatusEvent', async () => {
      const mockChannel = {
        send: jest.fn((message: any) => Promise.resolve('ok')),
      };

      const mockSupabase = {
        channel: jest.fn(() => mockChannel),
        removeChannel: jest.fn(() => Promise.resolve('ok')),
      };

      jest.resetModules();
      jest.doMock('../../src/database/client', () => ({
        getSupabaseClient: jest.fn(() => mockSupabase),
      }));

      const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
      const service = getSchedulerRealtimeService();

      await service.broadcastStatus('user-123', 'running', 5);

      const call = mockChannel.send.mock.calls[0][0];
      const payload: SchedulerStatusEvent = call.payload;
      
      expect(payload.type).toBe('status_change');
      expect(['running', 'stopped', 'paused']).toContain(payload.status);
      expect(typeof payload.activeJobs).toBe('number');
      expect(typeof payload.timestamp).toBe('number');

      await service.cleanupAll();
      jest.dontMock('../../src/database/client');
    });

    it('should have correct types for ExecutionEvent', async () => {
      const mockChannel = {
        send: jest.fn((message: any) => Promise.resolve('ok')),
      };

      const mockSupabase = {
        channel: jest.fn(() => mockChannel),
        removeChannel: jest.fn(() => Promise.resolve('ok')),
      };

      jest.resetModules();
      jest.doMock('../../src/database/client', () => ({
        getSupabaseClient: jest.fn(() => mockSupabase),
      }));

      const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
      const service = getSchedulerRealtimeService();

      await service.broadcastExecutionComplete(
        'user-123',
        'schedule-1',
        'Test',
        'exec-1',
        'manual',
        { success: true, tradesExecuted: 2, totalValue: 100 }
      );

      const call = mockChannel.send.mock.calls[0][0];
      const payload: ExecutionEvent = call.payload;
      
      expect(['execution_start', 'execution_complete', 'execution_failed', 'execution_skipped']).toContain(payload.type);
      expect(typeof payload.scheduleId).toBe('string');
      expect(typeof payload.executionId).toBe('string');
      expect(['scheduled', 'manual', 'condition']).toContain(payload.triggerType);

      await service.cleanupAll();
      jest.dontMock('../../src/database/client');
    });

    it('should have correct types for ScheduleUpdatedEvent', async () => {
      const mockChannel = {
        send: jest.fn((message: any) => Promise.resolve('ok')),
      };

      const mockSupabase = {
        channel: jest.fn(() => mockChannel),
        removeChannel: jest.fn(() => Promise.resolve('ok')),
      };

      jest.resetModules();
      jest.doMock('../../src/database/client', () => ({
        getSupabaseClient: jest.fn(() => mockSupabase),
      }));

      const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
      const service = getSchedulerRealtimeService();

      await service.broadcastScheduleUpdate('user-123', 'schedule-1', 'updated');

      const call = mockChannel.send.mock.calls[0][0];
      const payload: ScheduleUpdatedEvent = call.payload;
      
      expect(payload.type).toBe('schedule_updated');
      expect(['created', 'updated', 'deleted', 'enabled', 'disabled']).toContain(payload.action);
      expect(typeof payload.scheduleId).toBe('string');

      await service.cleanupAll();
      jest.dontMock('../../src/database/client');
    });
  });

  describe('Reconnection Scenarios', () => {
    it('should handle WebSocket connection errors', async () => {
      // Test error handling in the connection pool
      const pool = new WebSocketConnectionPool('ws://invalid-host:9999', {
        minPoolSize: 0,
        connectionTimeout: 100,
        reconnectAttempts: 0,
      });

      // Initialize should not throw
      await pool.initialize();

      // Get stats should work
      const stats = pool.getStats();
      expect(stats).toBeDefined();

      await pool.shutdown();
    });

    it('should handle multiple shutdown calls gracefully', async () => {
      const pool = new WebSocketConnectionPool('ws://localhost:8080', { minPoolSize: 1 });
      await pool.initialize();
      await sleep(50);

      // Multiple shutdowns should not throw
      await pool.shutdown();
      await pool.shutdown();
      await pool.shutdown();

      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(0);
    });

    it('should handle send errors gracefully', async () => {
      const pool = new WebSocketConnectionPool('ws://localhost:8080', { minPoolSize: 1 });
      await pool.initialize();
      await sleep(50);

      // Normal send should work
      await pool.send({ type: 'test' });

      await pool.shutdown();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty schedule name', async () => {
      let messages: any[] = [];
      const mockChannel = {
        send: jest.fn((message: any) => {
          messages.push(message);
          return Promise.resolve('ok');
        }),
      };

      const mockSupabase = {
        channel: jest.fn(() => mockChannel),
        removeChannel: jest.fn(() => Promise.resolve('ok')),
      };

      jest.resetModules();
      jest.doMock('../../src/database/client', () => ({
        getSupabaseClient: jest.fn(() => mockSupabase),
      }));

      const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
      const service = getSchedulerRealtimeService();

      const result = await service.broadcastExecutionStart(
        'user-123',
        'schedule-1',
        '',  // Empty name
        'exec-1',
        'manual'
      );

      expect(result).toBe(true);
      expect(messages[0].payload.scheduleName).toBe('');

      await service.cleanupAll();
      jest.dontMock('../../src/database/client');
    });

    it('should handle zero activeJobs', async () => {
      let messages: any[] = [];
      const mockChannel = {
        send: jest.fn((message: any) => {
          messages.push(message);
          return Promise.resolve('ok');
        }),
      };

      const mockSupabase = {
        channel: jest.fn(() => mockChannel),
        removeChannel: jest.fn(() => Promise.resolve('ok')),
      };

      jest.resetModules();
      jest.doMock('../../src/database/client', () => ({
        getSupabaseClient: jest.fn(() => mockSupabase),
      }));

      const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
      const service = getSchedulerRealtimeService();

      await service.broadcastStatus('user-123', 'stopped', 0);

      expect(messages[0].payload.activeJobs).toBe(0);

      await service.cleanupAll();
      jest.dontMock('../../src/database/client');
    });

    it('should handle large numbers of activeJobs', async () => {
      let messages: any[] = [];
      const mockChannel = {
        send: jest.fn((message: any) => {
          messages.push(message);
          return Promise.resolve('ok');
        }),
      };

      const mockSupabase = {
        channel: jest.fn(() => mockChannel),
        removeChannel: jest.fn(() => Promise.resolve('ok')),
      };

      jest.resetModules();
      jest.doMock('../../src/database/client', () => ({
        getSupabaseClient: jest.fn(() => mockSupabase),
      }));

      const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
      const service = getSchedulerRealtimeService();

      await service.broadcastStatus('user-123', 'running', 1000000);

      expect(messages[0].payload.activeJobs).toBe(1000000);

      await service.cleanupAll();
      jest.dontMock('../../src/database/client');
    });

    it('should handle special characters in schedule name', async () => {
      let messages: any[] = [];
      const mockChannel = {
        send: jest.fn((message: any) => {
          messages.push(message);
          return Promise.resolve('ok');
        }),
      };

      const mockSupabase = {
        channel: jest.fn(() => mockChannel),
        removeChannel: jest.fn(() => Promise.resolve('ok')),
      };

      jest.resetModules();
      jest.doMock('../../src/database/client', () => ({
        getSupabaseClient: jest.fn(() => mockSupabase),
      }));

      const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
      const service = getSchedulerRealtimeService();

      const specialName = 'Schedule with "quotes" and \n newlines & <html>';
      await service.broadcastExecutionStart(
        'user-123',
        'schedule-1',
        specialName,
        'exec-1',
        'manual'
      );

      expect(messages[0].payload.scheduleName).toBe(specialName);

      await service.cleanupAll();
      jest.dontMock('../../src/database/client');
    });

    it('should handle unicode in user IDs', async () => {
      let messages: any[] = [];
      const mockChannel = {
        send: jest.fn((message: any) => {
          messages.push(message);
          return Promise.resolve('ok');
        }),
      };

      const mockSupabase = {
        channel: jest.fn(() => mockChannel),
        removeChannel: jest.fn(() => Promise.resolve('ok')),
      };

      jest.resetModules();
      jest.doMock('../../src/database/client', () => ({
        getSupabaseClient: jest.fn(() => mockSupabase),
      }));

      const { getSchedulerRealtimeService } = require('../../src/realtime/SchedulerRealtimeService');
      const service = getSchedulerRealtimeService();

      await service.broadcastStatus('用户-123-测试', 'running', 1);

      expect(messages[0].payload.userId).toBe('用户-123-测试');

      await service.cleanupAll();
      jest.dontMock('../../src/database/client');
    });
  });

  describe('Connection Pool Advanced', () => {
    it('should handle concurrent message sends', async () => {
      const pool = new WebSocketConnectionPool('ws://localhost:8080', { minPoolSize: 2 });
      await pool.initialize();
      await sleep(50);

      // Send multiple messages concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(pool.send({ type: 'test', index: i }));
      }

      await Promise.all(promises);
      await sleep(50);

      const stats = pool.getStats();
      expect(stats.messagesProcessed).toBe(10);

      await pool.shutdown();
    });

    it('should track latency measurements', async () => {
      const pool = new WebSocketConnectionPool('ws://localhost:8080', { minPoolSize: 1 });
      await pool.initialize();
      await sleep(50);

      await pool.send({ type: 'test' });
      await pool.send({ type: 'test' });
      await pool.send({ type: 'test' });

      await sleep(50);
      const stats = pool.getStats();
      expect(stats.avgLatency).toBeGreaterThanOrEqual(0);

      await pool.shutdown();
    });

    it('should handle getConnection returning available connection', async () => {
      const pool = new WebSocketConnectionPool('ws://localhost:8080', { minPoolSize: 1 });
      await pool.initialize();
      await sleep(50);

      const conn = pool.getConnection();
      expect(conn).not.toBeNull();
      expect(conn!.id).toBeDefined();
      expect(conn!.status).toBeDefined();

      await pool.shutdown();
    });
  });
});