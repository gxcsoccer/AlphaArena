/**
 * SupabaseRealtimeService Unit Tests
 * 
 * Tests for the Supabase Realtime Broadcast Service covering:
 * - Broadcast success/failure scenarios
 * - Channel subscription/unsubscription
 * - Presence tracking
 * - Error handling
 */

import { SupabaseRealtimeService } from '../../src/api/SupabaseRealtimeService';

// Mock Supabase client
const mockSubscribe = jest.fn();
const mockSend = jest.fn();
const mockTrack = jest.fn();
const mockPresenceState = jest.fn();
const mockOn = jest.fn();
const mockOff = jest.fn();

const mockChannel = {
  subscribe: mockSubscribe,
  send: mockSend,
  track: mockTrack,
  presenceState: mockPresenceState,
  on: mockOn,
  off: mockOff,
};

const mockRemoveChannel = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    channel: jest.fn(() => mockChannel),
    removeChannel: mockRemoveChannel,
  })),
}));

describe('SupabaseRealtimeService', () => {
  let service: SupabaseRealtimeService;
  const testUrl = 'https://test.supabase.co';
  const testKey = 'test-anon-key';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SupabaseRealtimeService(testUrl, testKey);
  });

  describe('Constructor', () => {
    it('should initialize with Supabase client', () => {
      expect(service).toBeDefined();
      expect(service.getIsConnected()).toBe(false);
      expect(service.getChannelCount()).toBe(0);
    });
  });

  describe('Channel Subscription', () => {
    it('should successfully subscribe to a channel', async () => {
      mockSubscribe.mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      });

      const channel = await service.subscribe('test:channel');

      expect(channel).toBeDefined();
      expect(service.getIsConnected()).toBe(true);
      expect(service.getChannelCount()).toBe(1);
    });

    it('should handle subscription error', async () => {
      mockSubscribe.mockImplementation((callback) => {
        callback('CHANNEL_ERROR');
        return mockChannel;
      });

      await expect(service.subscribe('test:channel')).rejects.toThrow('Subscription failed: CHANNEL_ERROR');
    });

    it('should handle subscription timeout', async () => {
      mockSubscribe.mockImplementation((callback) => {
        callback('TIMED_OUT');
        return mockChannel;
      });

      await expect(service.subscribe('test:channel')).rejects.toThrow('Subscription failed: TIMED_OUT');
    });

    it('should reuse existing channel for same topic', async () => {
      mockSubscribe.mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      });

      await service.subscribe('test:channel');
      await service.subscribe('test:channel');

      expect(service.getChannelCount()).toBe(1);
    });
  });

  describe('Channel Unsubscription', () => {
    beforeEach(() => {
      mockSubscribe.mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      });
    });

    it('should successfully unsubscribe from a channel', async () => {
      await service.subscribe('test:channel');
      const result = await service.unsubscribe('test:channel');

      expect(result).toBe(true);
      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
      expect(service.getChannelCount()).toBe(0);
    });

    it('should return false when unsubscribing from non-existent channel', async () => {
      const result = await service.unsubscribe('non-existent:channel');
      expect(result).toBe(false);
    });

    it('should unsubscribe from all channels', async () => {
      await service.subscribe('channel:1');
      await service.subscribe('channel:2');
      await service.subscribe('channel:3');

      await service.unsubscribeAll();

      expect(service.getChannelCount()).toBe(0);
      expect(service.getIsConnected()).toBe(false);
    });
  });

  describe('Broadcast Success Scenarios', () => {
    beforeEach(() => {
      mockSubscribe.mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      });
    });

    it('should successfully broadcast a message', async () => {
      mockSend.mockResolvedValue('ok');

      const result = await service.broadcast('test:channel', 'test:event', { data: 'test' });

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'test:event',
        payload: { data: 'test' },
      });
    });

    it('should handle broadcast result with status property', async () => {
      mockSend.mockResolvedValue({ status: 'ok' });

      const result = await service.broadcast('test:channel', 'test:event', { data: 'test' });

      expect(result).toBe(true);
    });

    it('should successfully broadcast order book snapshot', async () => {
      mockSend.mockResolvedValue('ok');
      const snapshot = { bids: [[1, 10]], asks: [[2, 10]] };

      const result = await service.broadcastOrderBookSnapshot('BTC/USDT', snapshot);

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'snapshot',
        payload: {
          data: snapshot,
          timestamp: expect.any(Number),
        },
      });
    });

    it('should successfully broadcast order book delta', async () => {
      mockSend.mockResolvedValue('ok');
      const delta = { side: 'bid', price: 1, size: 5 };

      const result = await service.broadcastOrderBookDelta('BTC/USDT', delta);

      expect(result).toBe(true);
    });

    it('should successfully broadcast market tick', async () => {
      mockSend.mockResolvedValue('ok');
      const ticker = { price: 50000, volume: 1000 };

      const result = await service.broadcastMarketTick('BTC/USDT', ticker);

      expect(result).toBe(true);
    });

    it('should successfully broadcast trade to global channel', async () => {
      mockSend.mockResolvedValue('ok');
      const trade = { id: 'trade-1', symbol: 'BTC/USDT', price: 50000 };

      const result = await service.broadcastTrade('global', trade);

      expect(result).toBe(true);
    });

    it('should successfully broadcast trade to user-specific channel', async () => {
      mockSend.mockResolvedValue('ok');
      const trade = { id: 'trade-1', symbol: 'BTC/USDT', price: 50000 };

      const result = await service.broadcastTrade('user-123', trade);

      expect(result).toBe(true);
    });

    it('should successfully broadcast portfolio update', async () => {
      mockSend.mockResolvedValue('ok');
      const portfolio = { userId: 'user-1', balance: 10000 };

      const result = await service.broadcastPortfolioUpdate('user-1', portfolio);

      expect(result).toBe(true);
    });

    it('should successfully broadcast strategy tick', async () => {
      mockSend.mockResolvedValue('ok');
      const data = { signal: 'buy', strength: 0.8 };

      const result = await service.broadcastStrategyTick('strategy-1', data);

      expect(result).toBe(true);
    });

    it('should successfully broadcast leaderboard update', async () => {
      mockSend.mockResolvedValue('ok');
      const entries = [{ rank: 1, userId: 'user-1', score: 100 }];

      const result = await service.broadcastLeaderboardUpdate(entries);

      expect(result).toBe(true);
    });
  });

  describe('Broadcast Failure Scenarios', () => {
    beforeEach(() => {
      mockSubscribe.mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      });
    });

    it('should return false when broadcast fails', async () => {
      mockSend.mockResolvedValue('error');

      const result = await service.broadcast('test:channel', 'test:event', { data: 'test' });

      expect(result).toBe(false);
    });

    it('should return false when broadcast throws error', async () => {
      mockSend.mockRejectedValue(new Error('Network error'));

      const result = await service.broadcast('test:channel', 'test:event', { data: 'test' });

      expect(result).toBe(false);
    });

    it('should return false when broadcast result has error status', async () => {
      mockSend.mockResolvedValue({ status: 'error', reason: 'timeout' });

      const result = await service.broadcast('test:channel', 'test:event', { data: 'test' });

      expect(result).toBe(false);
    });
  });

  describe('Presence Tracking', () => {
    beforeEach(() => {
      mockSubscribe.mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      });
    });

    it('should successfully track presence', async () => {
      mockTrack.mockResolvedValue(undefined);

      const result = await service.trackPresence('user-123', { status: 'trading' });

      expect(result).toBe(true);
      expect(mockTrack).toHaveBeenCalledWith({
        id: 'user-123',
        userId: 'user-123',
        online_at: expect.any(String),
        status: 'trading',
      });
    });

    it('should track presence without metadata', async () => {
      mockTrack.mockResolvedValue(undefined);

      const result = await service.trackPresence('user-456');

      expect(result).toBe(true);
      expect(mockTrack).toHaveBeenCalledWith({
        id: 'user-456',
        userId: 'user-456',
        online_at: expect.any(String),
      });
    });

    it('should return false when presence tracking fails', async () => {
      mockTrack.mockRejectedValue(new Error('Presence error'));

      const result = await service.trackPresence('user-123');

      expect(result).toBe(false);
    });

    it('should get presence state', () => {
      const mockPresence = {
        'user-1': [{ id: 'user-1', userId: 'user-1', online_at: '2024-01-01T00:00:00Z' }],
      };
      mockPresenceState.mockReturnValue(mockPresence);

      // First subscribe to create the channel
      service.subscribe('presence:traders');

      const state = service.getPresenceState();

      expect(state).toBeDefined();
      expect(mockPresenceState).toHaveBeenCalled();
    });

    it('should return empty object when presence channel does not exist', () => {
      const state = service.getPresenceState();
      expect(state).toEqual({});
    });
  });

  describe('Broadcast Listeners', () => {
    it('should register broadcast listener', () => {
      const callback = jest.fn();
      const unsubscribe = service.onBroadcast('test:channel', 'test:event', callback);

      expect(mockOn).toHaveBeenCalledWith('broadcast', expect.any(Function));
      expect(typeof unsubscribe).toBe('function');
    });

    it('should filter events by event name', () => {
      const callback = jest.fn();
      service.onBroadcast('test:channel', 'specific:event', callback);

      // Simulate broadcast handler being called
      const handler = mockOn.mock.calls.find((call) => call[0] === 'broadcast')?.[1];
      if (handler) {
        handler({ event: 'other:event', payload: {} });
        handler({ event: 'specific:event', payload: { data: 'test' } });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith({ event: 'specific:event', payload: { data: 'test' } });
      }
    });

    it('should accept all events with wildcard', () => {
      const callback = jest.fn();
      service.onBroadcast('test:channel', '*', callback);

      const handler = mockOn.mock.calls.find((call) => call[0] === 'broadcast')?.[1];
      if (handler) {
        handler({ event: 'event1', payload: {} });
        handler({ event: 'event2', payload: {} });

        expect(callback).toHaveBeenCalledTimes(2);
      }
    });

    it('should unregister broadcast listener', () => {
      const callback = jest.fn();
      const unsubscribe = service.onBroadcast('test:channel', 'test:event', callback);

      unsubscribe();

      expect(mockOff).toHaveBeenCalledWith('broadcast', expect.any(Function));
    });
  });

  describe('Presence Listeners', () => {
    beforeEach(() => {
      mockSubscribe.mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      });
    });

    it('should register presence listener', () => {
      const callback = jest.fn();
      const _unsubscribe = service.onPresence(callback);

      expect(mockOn).toHaveBeenCalledWith('presence', { event: 'sync' }, expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('presence', { event: 'join' }, expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('presence', { event: 'leave' }, expect.any(Function));
    });

    it('should call callback with presence state on presence events', () => {
      const callback = jest.fn();
      mockPresenceState.mockReturnValue({
        'user-1': { presence: [{ id: 'user-1', online_at: '2024-01-01T00:00:00Z' }] },
      });

      service.subscribe('presence:traders');
      service.onPresence(callback);

      // Simulate presence event
      const presenceHandler = mockOn.mock.calls.find(
        (call) => call[1]?.event === 'sync'
      )?.[2];
      if (presenceHandler) {
        presenceHandler();
        expect(callback).toHaveBeenCalled();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase client initialization errors', () => {
      // Service should still be constructable even with invalid credentials
      // Errors will surface during operations
      expect(() => new SupabaseRealtimeService('', '')).not.toThrow();
    });

    it('should handle concurrent broadcast operations', async () => {
      mockSubscribe.mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      });
      mockSend.mockResolvedValue('ok');

      const promises = Array.from({ length: 5 }, (_, i) =>
        service.broadcast(`channel:${i}`, 'event', { i })
      );

      const results = await Promise.all(promises);

      expect(results.every((r) => r === true)).toBe(true);
    });

    it('should handle rapid subscribe/unsubscribe cycles', async () => {
      mockSubscribe.mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      });
      mockRemoveChannel.mockResolvedValue(undefined);

      for (let i = 0; i < 5; i++) {
        await service.subscribe(`channel:${i}`);
        await service.unsubscribe(`channel:${i}`);
      }

      expect(service.getChannelCount()).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty payload broadcasts', async () => {
      mockSubscribe.mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      });
      mockSend.mockResolvedValue('ok');

      const result = await service.broadcast('test:channel', 'test:event', {});

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'test:event',
        payload: {},
      });
    });

    it('should handle special characters in topic names', async () => {
      mockSubscribe.mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      });
      mockSend.mockResolvedValue('ok');

      const result = await service.broadcast('test:channel-with-special-chars_123', 'event', {});

      expect(result).toBe(true);
    });

    it('should handle large payloads', async () => {
      mockSubscribe.mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      });
      mockSend.mockResolvedValue('ok');

      const largePayload = { data: 'x'.repeat(10000) };
      const result = await service.broadcast('test:channel', 'event', largePayload);

      expect(result).toBe(true);
    });
  });
});
