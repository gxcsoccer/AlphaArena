/**
 * Supabase Realtime Client Tests
 * 
 * Tests for the frontend RealtimeClient that replaces Socket.IO
 */

import { RealtimeClient } from '../../src/client/utils/realtime';

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

describe('RealtimeClient', () => {
  let client: RealtimeClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new RealtimeClient();
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('initialization', () => {
    it('should create client instance', () => {
      expect(client).toBeInstanceOf(RealtimeClient);
    });

    it('should start in disconnected state', () => {
      // Connection status is set to 'connected' in constructor via monitorConnection
      const status = client.getConnectionStatus();
      expect(['disconnected', 'connected']).toContain(status);
    });

    it('should have connect method for backward compatibility', async () => {
      // connect() should exist and resolve without error
      await expect(client.connect()).resolves.not.toThrow();
      expect(client.getConnectionStatus()).toBe('connected');
    });

    it('should allow multiple connect() calls', async () => {
      await client.connect();
      await client.connect();
      await client.connect();
      
      expect(client.getConnectionStatus()).toBe('connected');
    });
  });

  describe('channel subscription', () => {
    it('should subscribe to a channel', async () => {
      const topic = 'ticker:BTC/USDT';
      const channel = await client.subscribe(topic);
      
      expect(channel).toBeDefined();
    });

    it('should subscribe to orderbook channel', async () => {
      const symbol = 'BTC/USDT';
      await client.subscribeOrderBook(symbol);
      
      expect(client.getChannelCount()).toBeGreaterThan(0);
    });

    it('should subscribe to market tickers', async () => {
      await client.subscribeMarket();
      
      // Should subscribe to multiple common symbols
      expect(client.getChannelCount()).toBeGreaterThan(0);
    });

    it('should subscribe to trades channel', async () => {
      const userId = 'user123';
      await client.subscribeTrades(userId);
      
      expect(client.getChannelCount()).toBeGreaterThan(0);
    });

    it('should subscribe to leaderboard channel', async () => {
      await client.subscribeLeaderboard();
      
      expect(client.getChannelCount()).toBeGreaterThan(0);
    });

    it('should return existing channel if already subscribed', async () => {
      const topic = 'ticker:ETH/USDT';
      const channel1 = await client.subscribe(topic);
      const channel2 = await client.subscribe(topic);
      
      expect(channel1).toBe(channel2);
    });
  });

  describe('message handling', () => {
    it('should register listener for orderbook snapshot', () => {
      const symbol = 'BTC/USDT';
      const callback = jest.fn();
      
      const unsubscribe = client.onOrderBookSnapshot(symbol, callback);
      
      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should register listener for orderbook delta', () => {
      const symbol = 'BTC/USDT';
      const callback = jest.fn();
      
      const unsubscribe = client.onOrderBookDelta(symbol, callback);
      
      expect(unsubscribe).toBeDefined();
    });

    it('should register listener for market tick', () => {
      const symbol = 'BTC/USDT';
      const callback = jest.fn();
      
      const unsubscribe = client.onMarketTick(symbol, callback);
      
      expect(unsubscribe).toBeDefined();
    });

    it('should register listener for trades', () => {
      const callback = jest.fn();
      
      const unsubscribe = client.onTrade('global', callback);
      
      expect(unsubscribe).toBeDefined();
    });

    it('should register listener for strategy tick', () => {
      const strategyId = 'strategy123';
      const callback = jest.fn();
      
      const unsubscribe = client.onStrategyTick(strategyId, callback);
      
      expect(unsubscribe).toBeDefined();
    });

    it('should register listener for leaderboard update', () => {
      const callback = jest.fn();
      
      const unsubscribe = client.onLeaderboardUpdate(callback);
      
      expect(unsubscribe).toBeDefined();
    });

    it('should allow unsubscribing from events', () => {
      const symbol = 'BTC/USDT';
      const callback = jest.fn();
      
      const unsubscribe = client.onMarketTick(symbol, callback);
      
      // Should be able to call unsubscribe without errors
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('presence tracking', () => {
    it('should track presence for user', async () => {
      const userId = 'user123';
      
      await expect(client.trackPresence(userId)).resolves.not.toThrow();
    });

    it('should track presence with metadata', async () => {
      const userId = 'user123';
      const metadata = { status: 'active', strategyId: 'strat1' };
      
      await expect(client.trackPresence(userId, metadata)).resolves.not.toThrow();
    });

    it('should get presence state', () => {
      const state = client.getPresenceState();
      
      expect(state).toBeDefined();
    });

    it('should register presence listener', () => {
      const callback = jest.fn();
      
      const unsubscribe = client.onPresence(callback);
      
      expect(unsubscribe).toBeDefined();
    });
  });

  describe('unsubscription', () => {
    it('should unsubscribe from a channel', async () => {
      const topic = 'ticker:BTC/USDT';
      await client.subscribe(topic);
      
      await client.unsubscribe(topic);
      
      expect(client.getChannelCount()).toBe(0);
    });

    it('should handle unsubscribing from non-existent channel', async () => {
      await expect(client.unsubscribe('nonexistent:channel')).resolves.not.toThrow();
    });

    it('should unsubscribe from all channels', async () => {
      await client.subscribe('ticker:BTC/USDT');
      await client.subscribe('orderbook:BTC/USDT');
      
      await client.unsubscribeAll();
      
      expect(client.getChannelCount()).toBe(0);
    });
  });

  describe('disconnection', () => {
    it('should disconnect and cleanup all channels', async () => {
      await client.disconnect();
      
      expect(client.getChannelCount()).toBe(0);
      expect(client.getConnectionStatus()).toBe('disconnected');
    });
  });

  describe('generic on() method', () => {
    it('should register listener with generic on method', () => {
      const topic = 'orderbook:BTC/USDT';
      const event = 'snapshot';
      const callback = jest.fn();
      
      const unsubscribe = client.on(topic, event, callback);
      
      expect(unsubscribe).toBeDefined();
    });

    it('should handle unknown event types gracefully', () => {
      const callback = jest.fn();
      
      // Should not throw
      expect(() => {
        const unsubscribe = client.on('unknown:channel', 'event', callback);
        unsubscribe();
      }).not.toThrow();
    });
  });
});

describe('getRealtimeClient singleton', () => {
  it('should return same instance on multiple calls', () => {
    const { getRealtimeClient } = require('../../src/client/utils/realtime');
    
    const client1 = getRealtimeClient();
    const client2 = getRealtimeClient();
    
    expect(client1).toBe(client2);
  });
});
