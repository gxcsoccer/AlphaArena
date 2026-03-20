/**
 * Enhanced RealtimeClient Tests
 * 
 * Tests for advanced reconnection logic, connection quality monitoring,
 * and message queueing
 */

import { RealtimeClient, getRealtimeClient } from '../../src/client/utils/realtime';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => {
  const mockChannel: any = {
    subscribe: jest.fn((callback: any) => {
      callback('SUBSCRIBED');
      return mockChannel;
    }),
    on: jest.fn(() => mockChannel),
    off: jest.fn(() => mockChannel),
    track: jest.fn(async () => 'ok'),
    presenceState: jest.fn(() => ({})),
    send: jest.fn(async () => 'ok'),
  };

  const mockSupabase: any = {
    channel: jest.fn(() => mockChannel),
    removeChannel: jest.fn(async () => 'ok'),
  };

  return {
    createClient: jest.fn(() => mockSupabase),
  };
});

describe('RealtimeClient - Enhanced Reconnection', () => {
  let client: RealtimeClient;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    client = new RealtimeClient();
  });

  afterEach(() => {
    jest.useRealTimers();
    client.disconnect();
  });

  describe('exponential backoff', () => {
    it('should calculate reconnect delay with exponential backoff', () => {
      // Initial delay should be 1 second
      const delay1 = (client as any).calculateReconnectDelay(1);
      expect(delay1).toBeGreaterThanOrEqual(800); // 1000ms - 20% jitter
      expect(delay1).toBeLessThanOrEqual(1200); // 1000ms + 20% jitter

      // Second attempt should be ~2 seconds
      const delay2 = (client as any).calculateReconnectDelay(2);
      expect(delay2).toBeGreaterThanOrEqual(1600);
      expect(delay2).toBeLessThanOrEqual(2400);

      // Third attempt should be ~4 seconds
      const delay3 = (client as any).calculateReconnectDelay(3);
      expect(delay3).toBeGreaterThanOrEqual(3200);
      expect(delay3).toBeLessThanOrEqual(4800);
    });

    it('should cap reconnect delay at maximum (30 seconds)', () => {
      const delay = (client as any).calculateReconnectDelay(10);
      expect(delay).toBeLessThanOrEqual(30000 * 1.2); // Max + jitter
    });

    it('should include jitter to prevent thundering herd', () => {
      const delays = Array.from({ length: 10 }, () => 
        (client as any).calculateReconnectDelay(2)
      );
      
      // Delays should vary due to jitter
      const uniqueDelays = new Set(delays.map(d => Math.round(d / 100)));
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('connection state management', () => {
    it('should track connection status transitions', async () => {
      expect(client.getConnectionStatus()).toBe('disconnected');

      // Subscribe and wait for it to complete
      await client.subscribe('test:channel');
      
      // After successful subscription, should be connected
      expect(client.getConnectionStatus()).toBe('connected');
    });

    it('should transition to reconnecting on failure', async () => {
      const mockSubscribe = jest.fn((callback: any) => {
        callback('CHANNEL_ERROR');
      });
      (client as any).getChannel = jest.fn().mockReturnValue({
        subscribe: mockSubscribe,
      });

      client.subscribe('test:channel').catch(() => {});
      
      jest.advanceTimersByTime(100);
      expect(client.getConnectionStatus()).toBe('reconnecting');
    });

    it('should reset reconnect attempts on successful connection', async () => {
      // Simulate multiple reconnection attempts
      (client as any).connectionQuality.reconnectAttempts = 3;
      
      // Successful subscription
      await client.subscribe('test:channel');
      
      expect((client as any).connectionQuality.reconnectAttempts).toBe(0);
    });
  });

  describe('connection quality monitoring', () => {
    it('should track connection quality metrics', () => {
      const quality = client.getConnectionQuality();
      
      expect(quality).toHaveProperty('latency');
      expect(quality).toHaveProperty('lastPingAt');
      expect(quality).toHaveProperty('isStale');
      expect(quality).toHaveProperty('reconnectAttempts');
      expect(quality).toHaveProperty('lastReconnectAt');
    });

    it('should update latency on ping', () => {
      (client as any).recordPing(50);
      
      const quality = client.getConnectionQuality();
      expect(quality.latency).toBe(50);
      expect(quality.isStale).toBe(false);
    });

    it('should detect stale connections', () => {
      // Set last ping to 61 seconds ago
      (client as any).connectionQuality.lastPingAt = Date.now() - 61000;
      
      (client as any).checkConnectionHealth();
      
      const quality = client.getConnectionQuality();
      expect(quality.isStale).toBe(true);
    });

    it('should notify quality listeners on change', () => {
      const listener = jest.fn();
      client.onQualityChange(listener);
      
      (client as any).recordPing(100);
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        latency: 100,
      }));
    });
  });

  describe('message queueing', () => {
    it('should queue messages when offline', () => {
      (client as any).connectionStatus = 'disconnected';
      
      client.queueMessage('test:channel', 'event', { data: 'test' }, 5);
      
      expect(client.getQueuedMessageCount()).toBe(1);
    });

    it('should prioritize messages by priority', () => {
      client.queueMessage('test:1', 'event', {}, 1);
      client.queueMessage('test:2', 'event', {}, 10);
      client.queueMessage('test:3', 'event', {}, 5);
      
      // Queue should be sorted by priority (highest first)
      const queue = (client as any).messageQueue;
      expect(queue[0].priority).toBe(10);
      expect(queue[1].priority).toBe(5);
      expect(queue[2].priority).toBe(1);
    });

    it('should process queue when reconnected', async () => {
      client.queueMessage('test:channel', 'event', { data: 'test' }, 5);
      
      // Subscribe to trigger queue processing
      await client.subscribe('test:channel');
      
      // Give time for queue processing
      jest.advanceTimersByTime(100);
      
      expect(client.getQueuedMessageCount()).toBe(0);
    });

    it('should re-queue failed messages with lower priority', async () => {
      // Mock send to fail once, then succeed
      const mockSend = jest.fn()
        .mockRejectedValueOnce(new Error('Send failed'))
        .mockResolvedValue('ok');
      const mockChannel = {
        send: mockSend,
        subscribe: jest.fn((cb) => { cb('SUBSCRIBED'); return mockChannel; }),
      };
      (client as any).getChannel = jest.fn().mockReturnValue(mockChannel);
      
      // First subscribe to establish a connection
      await client.subscribe('test:channel');
      
      // Now queue a message
      client.queueMessage('test:channel', 'event', { data: 'test' }, 5);
      expect(client.getQueuedMessageCount()).toBe(1);
      
      // Process the queue - should fail first time, re-queue, then succeed on retry
      await (client as any).processMessageQueue();
      
      // After first failure, message was re-queued with lower priority
      // and then processed again (succeeding this time)
      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(client.getQueuedMessageCount()).toBe(0);
    });

    it('should drop messages after max retries', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('Send failed'));
      (client as any).getChannel = jest.fn().mockReturnValue({
        send: mockSend,
      });
      
      // Queue a message that has already been retried 3 times
      (client as any).messageQueue.push({
        topic: 'test:channel',
        event: 'event',
        payload: { data: 'test' },
        timestamp: Date.now(),
        priority: 5,
        retryCount: 3, // Already at max retries
      });
      (client as any).connectionStatus = 'connected';
      
      await (client as any).processMessageQueue();
      
      const queue = (client as any).messageQueue;
      expect(queue.length).toBe(0); // Message dropped
    });
  });

  describe('network recovery', () => {
    it('should handle network recovery event', async () => {
      await client.subscribe('test:channel');
      expect(client.getConnectionStatus()).toBe('connected');
      
      // Simulate network recovery - should reset reconnect attempts
      (client as any).connectionQuality.reconnectAttempts = 5;
      (client as any).handleNetworkRecovery();
      
      // Reconnect attempts should be reset
      expect((client as any).connectionQuality.reconnectAttempts).toBe(0);
    });

    it('should handle network loss event', async () => {
      await client.subscribe('test:channel');
      
      // Simulate network loss
      (client as any).handleNetworkLoss();
      
      expect(client.getConnectionStatus()).toBe('disconnected');
    });
  });

  describe('connection listeners', () => {
    it('should notify connection status listeners', () => {
      const listener = jest.fn();
      client.onConnectionChange(listener);
      
      client.subscribe('test:channel').catch(() => {});
      jest.advanceTimersByTime(100);
      
      expect(listener).toHaveBeenCalledWith('connecting');
      expect(listener).toHaveBeenCalledWith('connected');
    });

    it('should allow unsubscribing from connection listeners', () => {
      const listener = jest.fn();
      const unsubscribe = client.onConnectionChange(listener);
      
      unsubscribe();
      
      client.subscribe('test:channel').catch(() => {});
      jest.advanceTimersByTime(100);
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('reconnection timers', () => {
    it('should clear reconnect timers on successful subscription', async () => {
      const topic = 'test:channel';
      
      // First subscription
      client.subscribe(topic).catch(() => {});
      jest.advanceTimersByTime(100);
      
      // Should have no pending reconnect timers after success
      expect((client as any).reconnectTimers.size).toBe(0);
    });

    it('should schedule reconnect timer on failure', () => {
      const mockSubscribe = jest.fn((callback: any) => {
        callback('CHANNEL_ERROR');
      });
      (client as any).getChannel = jest.fn().mockReturnValue({
        subscribe: mockSubscribe,
      });

      client.subscribe('test:channel').catch(() => {});
      jest.advanceTimersByTime(100);
      
      // Should have a reconnect timer scheduled
      expect((client as any).reconnectTimers.size).toBeGreaterThan(0);
    });

    it('should clear all timers on disconnect', async () => {
      client.subscribe('test:channel').catch(() => {});
      jest.advanceTimersByTime(100);
      
      await client.disconnect();
      
      expect((client as any).reconnectTimers.size).toBe(0);
      expect((client as any).pingTimer).toBeNull();
    });
  });

  describe('stale connection handling', () => {
    it('should trigger reconnection for stale connections', () => {
      client.subscribe('test:channel').catch(() => {});
      jest.advanceTimersByTime(100);
      
      // Simulate stale connection
      (client as any).connectionQuality.lastPingAt = Date.now() - 61000;
      (client as any).checkConnectionHealth();
      
      // Should have triggered reconnection
      expect(client.getConnectionStatus()).toBe('reconnecting');
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance on multiple calls', () => {
      const client1 = getRealtimeClient();
      const client2 = getRealtimeClient();
      
      expect(client1).toBe(client2);
    });

    it('should create new instance after disconnect', () => {
      const client1 = getRealtimeClient();
      client1.disconnect();
      
      // Reset singleton (normally done on app restart)
      jest.resetModules();
      
      const { getRealtimeClient: getRealtimeClient2 } = require('../../src/client/utils/realtime');
      const client2 = getRealtimeClient2();
      
      expect(client1).not.toBe(client2);
    });
  });
});

describe('RealtimeClient - Edge Cases', () => {
  let client: RealtimeClient;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    client = new RealtimeClient();
  });

  afterEach(() => {
    jest.useRealTimers();
    client.disconnect();
  });

  it('should handle multiple subscribe calls to same topic', async () => {
    const topic = 'test:channel';
    
    const [channel1, channel2] = await Promise.all([
      client.subscribe(topic),
      client.subscribe(topic),
    ]);
    
    expect(channel1).toBe(channel2);
  });

  it('should handle unsubscribe from non-existent channel', async () => {
    await expect(client.unsubscribe('nonexistent:channel')).resolves.not.toThrow();
  });

  it('should handle rapid connect/disconnect cycles', async () => {
    for (let i = 0; i < 5; i++) {
      await client.subscribe(`test:${i}`);
      await client.unsubscribe(`test:${i}`);
    }
    
    expect(client.getChannelCount()).toBe(0);
  });

  it('should prevent infinite reconnection loops', () => {
    const mockSubscribe = jest.fn((callback: any) => {
      callback('CHANNEL_ERROR');
    });
    (client as any).getChannel = jest.fn().mockReturnValue({
      subscribe: mockSubscribe,
    });

    client.subscribe('test:channel').catch(() => {});
    
    // Advance time through multiple reconnection attempts
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(35000); // Max delay + buffer
    }
    
    // Should still be in reconnecting state, not crashed
    expect(client.getConnectionStatus()).toBe('reconnecting');
  });

  it('should handle subscription timeout', async () => {
    const mockSubscribe = jest.fn(); // Never calls callback
    (client as any).getChannel = jest.fn().mockReturnValue({
      subscribe: mockSubscribe,
    });

    const subscribePromise = client.subscribe('test:channel');
    
    // Advance time past the CONNECTION_TIMEOUT (10000ms)
    jest.advanceTimersByTime(11000);
    
    await expect(subscribePromise)
      .rejects
      .toThrow('订阅超时');
  });
});
