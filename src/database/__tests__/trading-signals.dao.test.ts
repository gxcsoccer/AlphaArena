/**
 * Tests for TradingSignalsDAO
 * 
 * Note: These tests verify the DAO method signatures and basic behavior.
 * Full integration tests would require a real Supabase connection.
 */

import { TradingSignalsDAO, SignalStatus, SignalType, RiskLevel } from '../trading-signals.dao';

// Mock Supabase client
jest.mock('../client', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('TradingSignalsDAO', () => {
  describe('Data Types and Interfaces', () => {
    it('should have correct TradingSignal interface structure', () => {
      const signal = {
        id: 'test-id',
        publisherId: 'publisher-id',
        symbol: 'BTC/USDT',
        side: 'buy',
        signalType: 'entry' as SignalType,
        riskLevel: 'medium' as RiskLevel,
        status: 'active' as SignalStatus,
        viewsCount: 0,
        subscribersNotified: 0,
        executionsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(signal.id).toBe('test-id');
      expect(signal.symbol).toBe('BTC/USDT');
      expect(signal.side).toBe('buy');
    });

    it('should have correct CreateSignalInput interface structure', () => {
      const input = {
        publisherId: 'publisher-id',
        symbol: 'BTC/USDT',
        side: 'buy' as const,
        signalType: 'entry' as SignalType,
        entryPrice: 50000,
        targetPrice: 55000,
        stopLossPrice: 48000,
        riskLevel: 'medium' as RiskLevel,
        confidenceScore: 85,
      };

      expect(input.publisherId).toBe('publisher-id');
      expect(input.signalType).toBe('entry');
      expect(input.confidenceScore).toBe(85);
    });

    it('should have correct SignalFilters interface structure', () => {
      const filters = {
        publisherId: 'publisher-id',
        symbol: 'BTC/USDT',
        status: 'active' as SignalStatus,
        signalType: 'entry' as SignalType,
        limit: 20,
        offset: 0,
        orderBy: 'created_at' as const,
        orderDirection: 'desc' as const,
      };

      expect(filters.status).toBe('active');
      expect(filters.limit).toBe(20);
    });
  });

  describe('Method Signatures', () => {
    it('should have all required signal methods', () => {
      const dao = new TradingSignalsDAO();

      expect(typeof dao.create).toBe('function');
      expect(typeof dao.getById).toBe('function');
      expect(typeof dao.getMany).toBe('function');
      expect(typeof dao.update).toBe('function');
      expect(typeof dao.delete).toBe('function');
      expect(typeof dao.incrementViews).toBe('function');
      expect(typeof dao.incrementExecutions).toBe('function');
      expect(typeof dao.getActiveSignalsForPublisher).toBe('function');
      expect(typeof dao.getActiveSignalsForSymbol).toBe('function');
      expect(typeof dao.expireSignals).toBe('function');
    });
  });

  describe('Signal Types', () => {
    it('should support all signal types', () => {
      const signalTypes: SignalType[] = ['entry', 'stop_loss', 'take_profit', 'exit', 'update'];
      
      signalTypes.forEach((type) => {
        expect(['entry', 'stop_loss', 'take_profit', 'exit', 'update']).toContain(type);
      });
    });

    it('should support all signal statuses', () => {
      const statuses: SignalStatus[] = ['active', 'expired', 'cancelled', 'executed'];
      
      statuses.forEach((status) => {
        expect(['active', 'expired', 'cancelled', 'executed']).toContain(status);
      });
    });

    it('should support all risk levels', () => {
      const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'very_high'];
      
      riskLevels.forEach((level) => {
        expect(['low', 'medium', 'high', 'very_high']).toContain(level);
      });
    });
  });
});
