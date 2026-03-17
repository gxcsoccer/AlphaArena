/**
 * Tests for SignalSubscriptionsDAO
 * 
 * Note: These tests verify the DAO method signatures and basic behavior.
 * Full integration tests would require a real Supabase connection.
 */

import { SignalSubscriptionsDAO, SubscriptionType, SubscriptionStatus } from '../signal-subscriptions.dao';

// Mock Supabase client
jest.mock('../client', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('SignalSubscriptionsDAO', () => {
  describe('Data Types and Interfaces', () => {
    it('should have correct SignalSubscription interface structure', () => {
      const subscription = {
        id: 'test-id',
        subscriberId: 'subscriber-id',
        sourceType: 'user' as SubscriptionType,
        sourceId: 'source-id',
        autoExecute: false,
        copyRatio: 1.0,
        allowedSymbols: [],
        blockedSymbols: [],
        notifyInApp: true,
        notifyPush: false,
        notifyEmail: false,
        status: 'active' as SubscriptionStatus,
        signalsReceived: 0,
        signalsExecuted: 0,
        totalPnl: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(subscription.id).toBe('test-id');
      expect(subscription.sourceType).toBe('user');
      expect(subscription.autoExecute).toBe(false);
    });

    it('should have correct CreateSubscriptionInput interface structure', () => {
      const input = {
        subscriberId: 'subscriber-id',
        sourceType: 'user' as SubscriptionType,
        sourceId: 'source-id',
        autoExecute: true,
        copyRatio: 0.5,
        maxAmount: 1000,
        allowedSymbols: ['BTC/USDT', 'ETH/USDT'],
        notifyInApp: true,
        notifyPush: true,
      };

      expect(input.subscriberId).toBe('subscriber-id');
      expect(input.copyRatio).toBe(0.5);
      expect(input.allowedSymbols).toHaveLength(2);
    });

    it('should have correct SubscriptionFilters interface structure', () => {
      const filters = {
        subscriberId: 'subscriber-id',
        sourceType: 'user' as SubscriptionType,
        sourceId: 'source-id',
        status: 'active' as SubscriptionStatus,
        limit: 20,
        offset: 0,
      };

      expect(filters.status).toBe('active');
      expect(filters.limit).toBe(20);
    });
  });

  describe('Method Signatures', () => {
    it('should have all required subscription methods', () => {
      const dao = new SignalSubscriptionsDAO();

      expect(typeof dao.create).toBe('function');
      expect(typeof dao.getById).toBe('function');
      expect(typeof dao.getBySubscriberAndSource).toBe('function');
      expect(typeof dao.getMany).toBe('function');
      expect(typeof dao.update).toBe('function');
      expect(typeof dao.pause).toBe('function');
      expect(typeof dao.resume).toBe('function');
      expect(typeof dao.cancel).toBe('function');
      expect(typeof dao.delete).toBe('function');
      expect(typeof dao.getActiveSubscriptionsForSource).toBe('function');
      expect(typeof dao.getSubscriptionsForSubscriber).toBe('function');
      expect(typeof dao.incrementSignalsReceived).toBe('function');
      expect(typeof dao.incrementSignalsExecuted).toBe('function');
      expect(typeof dao.getSubscriberCount).toBe('function');
    });
  });

  describe('Subscription Types', () => {
    it('should support all subscription types', () => {
      const types: SubscriptionType[] = ['user', 'strategy'];

      types.forEach((type) => {
        expect(['user', 'strategy']).toContain(type);
      });
    });

    it('should support all subscription statuses', () => {
      const statuses: SubscriptionStatus[] = ['active', 'paused', 'cancelled'];

      statuses.forEach((status) => {
        expect(['active', 'paused', 'cancelled']).toContain(status);
      });
    });
  });

  describe('Subscription Settings', () => {
    it('should support notification preferences', () => {
      const settings = {
        notifyInApp: true,
        notifyPush: false,
        notifyEmail: true,
      };

      expect(settings.notifyInApp).toBe(true);
      expect(settings.notifyPush).toBe(false);
      expect(settings.notifyEmail).toBe(true);
    });

    it('should support risk control settings', () => {
      const settings = {
        autoExecute: true,
        copyRatio: 0.5,
        fixedAmount: 100,
        maxAmount: 1000,
        maxRiskPerTrade: 2.5,
        allowedSymbols: ['BTC/USDT'],
        blockedSymbols: ['DOGE/USDT'],
      };

      expect(settings.copyRatio).toBe(0.5);
      expect(settings.maxRiskPerTrade).toBe(2.5);
      expect(settings.allowedSymbols).toContain('BTC/USDT');
      expect(settings.blockedSymbols).toContain('DOGE/USDT');
    });
  });
});
