/**
 * Tests for SignalRealtimeService
 */

import { SignalRealtimeService, getSignalRealtimeService } from '../SignalRealtimeService';
import { TradingSignal } from '../../database/trading-signals.dao';

// Mock Supabase client
jest.mock('../../database/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    channel: jest.fn(() => ({
      send: jest.fn().mockResolvedValue('ok'),
      subscribe: jest.fn(),
      on: jest.fn(),
      unsubscribe: jest.fn(),
    })),
    removeChannel: jest.fn(),
  })),
}));

// Mock push config DAO
jest.mock('../../database/signal-push-config.dao', () => ({
  SignalPushConfigDAO: jest.fn().mockImplementation(() => ({
    getOrCreate: jest.fn().mockResolvedValue({
      id: 'config-1',
      userId: 'user-1',
      pushEnabled: true,
      signalTypes: ['all'],
      frequency: 'realtime',
      browserNotify: true,
      inAppNotify: true,
      soundEnabled: true,
      minConfidenceScore: 0,
      riskLevels: ['low', 'medium', 'high', 'very_high'],
      symbols: [],
      quietHoursEnabled: false,
    }),
  })),
}));

// Mock signal subscriptions DAO
jest.mock('../../database/signal-subscriptions.dao', () => ({
  SignalSubscriptionsDAO: jest.fn().mockImplementation(() => ({
    getActiveSubscriptionsForSource: jest.fn().mockResolvedValue([
      { subscriberId: 'user-1' },
      { subscriberId: 'user-2' },
    ]),
  })),
}));

describe('SignalRealtimeService', () => {
  let service: SignalRealtimeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SignalRealtimeService();
  });

  afterEach(async () => {
    await service.cleanupAll();
  });

  describe('broadcastNewSignal', () => {
    it('should broadcast signal to all subscribers', async () => {
      const signal: TradingSignal = {
        id: 'signal-1',
        publisherId: 'publisher-1',
        symbol: 'BTC/USDT',
        side: 'buy',
        signalType: 'entry',
        entryPrice: 50000,
        targetPrice: 55000,
        stopLossPrice: 48000,
        riskLevel: 'medium',
        status: 'active',
        viewsCount: 0,
        subscribersNotified: 0,
        executionsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const subscriberIds = ['user-1', 'user-2'];
      const result = await service.broadcastNewSignal(signal, subscriberIds);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should skip broadcast if push is disabled', async () => {
      // Override mock for this test
      const { SignalPushConfigDAO } = require('../../database/signal-push-config.dao');
      SignalPushConfigDAO.mockImplementationOnce(() => ({
        getOrCreate: jest.fn().mockResolvedValue({
          pushEnabled: false,
          signalTypes: ['all'],
          riskLevels: ['low', 'medium', 'high', 'very_high'],
          symbols: [],
        }),
      }));

      const serviceWithDisabledPush = new SignalRealtimeService();
      
      const signal: TradingSignal = {
        id: 'signal-2',
        publisherId: 'publisher-1',
        symbol: 'BTC/USDT',
        side: 'buy',
        signalType: 'entry',
        riskLevel: 'medium',
        status: 'active',
        viewsCount: 0,
        subscribersNotified: 0,
        executionsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await serviceWithDisabledPush.broadcastNewSignal(signal, ['user-1']);

      // Should skip since push is disabled
      expect(result.success).toBe(0);
    });
  });

  describe('broadcastSignalClose', () => {
    it('should broadcast signal close event', async () => {
      const signal: TradingSignal = {
        id: 'signal-3',
        publisherId: 'publisher-1',
        symbol: 'ETH/USDT',
        side: 'sell',
        signalType: 'exit',
        status: 'executed',
        executionPrice: 3000,
        pnl: 100,
        pnlPercent: 5,
        riskLevel: 'low',
        viewsCount: 10,
        subscribersNotified: 5,
        executionsCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Should not throw
      await expect(
        service.broadcastSignalClose(signal, 'executed', 100, 5)
      ).resolves.not.toThrow();
    });
  });

  describe('broadcastSignalAlert', () => {
    it('should broadcast price alert', async () => {
      const signal: TradingSignal = {
        id: 'signal-4',
        publisherId: 'publisher-1',
        symbol: 'BTC/USDT',
        side: 'buy',
        signalType: 'entry',
        targetPrice: 55000,
        riskLevel: 'medium',
        status: 'active',
        viewsCount: 0,
        subscribersNotified: 0,
        executionsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(
        service.broadcastSignalAlert(
          signal,
          'target_hit',
          '目标价格已达成',
          55100
        )
      ).resolves.not.toThrow();
    });
  });

  describe('broadcastToGlobal', () => {
    it('should broadcast to global channel', async () => {
      const signal: TradingSignal = {
        id: 'signal-5',
        publisherId: 'publisher-1',
        symbol: 'SOL/USDT',
        side: 'buy',
        signalType: 'entry',
        riskLevel: 'high',
        status: 'active',
        viewsCount: 0,
        subscribersNotified: 0,
        executionsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.broadcastToGlobal(signal);
      expect(result).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup channels for a user', async () => {
      await expect(service.cleanup('user-1')).resolves.not.toThrow();
    });

    it('should cleanup all channels', async () => {
      await expect(service.cleanupAll()).resolves.not.toThrow();
    });
  });
});

describe('getSignalRealtimeService', () => {
  it('should return singleton instance', () => {
    const instance1 = getSignalRealtimeService();
    const instance2 = getSignalRealtimeService();
    expect(instance1).toBe(instance2);
  });
});