/**
 * Payment Funnel Service Tests
 * Issue #662: 支付转化漏斗优化
 */

import { PaymentFunnelService } from '../paymentFunnelService';
import { getSupabaseAdminClient } from '../../database/client';

// Mock Supabase client
jest.mock('../../database/client', () => ({
  getSupabaseAdminClient: jest.fn(),
}));

describe('PaymentFunnelService', () => {
  let service: PaymentFunnelService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      rpc: jest.fn(),
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      filter: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    };
    
    (getSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);
    service = new PaymentFunnelService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('trackEvent', () => {
    it('should track a funnel event successfully', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: 'event-123', error: null });

      const result = await service.trackEvent({
        sessionId: 'session-123',
        stage: 'subscription_page_view',
        userId: 'user-123',
      });

      expect(result.eventId).toBe('event-123');
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'track_payment_funnel_event',
        expect.objectContaining({
          p_session_id: 'session-123',
          p_stage: 'subscription_page_view',
          p_user_id: 'user-123',
        })
      );
    });

    it('should track checkout initiated with all details', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: 'event-456', error: null });

      const result = await service.trackEvent({
        sessionId: 'session-456',
        stage: 'checkout_initiated',
        userId: 'user-456',
        planId: 'pro',
        billingPeriod: 'monthly',
        priceAmount: 99,
        experimentId: 'exp-123',
        variantId: 'variant-a',
      });

      expect(result.eventId).toBe('event-456');
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'track_payment_funnel_event',
        expect.objectContaining({
          p_session_id: 'session-456',
          p_stage: 'checkout_initiated',
          p_plan_id: 'pro',
          p_billing_period: 'monthly',
          p_price_amount: 99,
          p_experiment_id: 'exp-123',
          p_variant_id: 'variant-a',
        })
      );
    });

    it('should track payment failure with drop-off reason', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: 'event-789', error: null });

      const result = await service.trackEvent({
        sessionId: 'session-789',
        stage: 'payment_failed',
        dropOffReason: 'payment_declined',
        dropOffDetails: { cardType: 'visa', errorCode: 'insufficient_funds' },
      });

      expect(result.eventId).toBe('event-789');
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'track_payment_funnel_event',
        expect.objectContaining({
          p_stage: 'payment_failed',
          p_drop_off_reason: 'payment_declined',
          p_drop_off_details: { cardType: 'visa', errorCode: 'insufficient_funds' },
        })
      );
    });

    it('should throw error when tracking fails', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      });

      await expect(service.trackEvent({
        sessionId: 'session-error',
        stage: 'subscription_page_view',
      })).rejects.toThrow();
    });
  });

  describe('getFunnelAnalysis', () => {
    it('should return funnel analysis structure', async () => {
      // Simplified test - just verify the method runs and returns expected structure
      mockSupabase.select.mockReturnThis();
      mockSupabase.gte.mockReturnThis();
      mockSupabase.lte.mockReturnThis();
      mockSupabase.order.mockReturnThis();
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await service.getFunnelAnalysis(startDate, endDate);

      expect(result.period.start.toISOString()).toBe(startDate.toISOString());
      expect(result.period.end.toISOString()).toBe(endDate.toISOString());
      expect(result.steps).toHaveLength(6);
      expect(result.totalVisitors).toBe(0);
      expect(result.totalConversions).toBe(0);
    });

    it('should return empty analysis when no events', async () => {
      mockSupabase.select.mockReturnThis();
      mockSupabase.gte.mockReturnThis();
      mockSupabase.lte.mockReturnThis();
      mockSupabase.order.mockReturnThis();
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const result = await service.getFunnelAnalysis(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.totalVisitors).toBe(0);
      expect(result.totalConversions).toBe(0);
      expect(result.overallConversionRate).toBe(0);
    });
  });

  describe('getDropOffAnalysis', () => {
    it('should return drop-off analysis', async () => {
      const mockDropOffData = [
        {
          drop_off_stage: 'checkout_initiated',
          drop_off_reason: 'price_concern',
          count: 10,
          percentage: 40,
          avg_time_before_dropoff: 120,
          avg_selected_price: 99,
        },
        {
          drop_off_stage: 'plan_selected',
          drop_off_reason: 'comparison',
          count: 5,
          percentage: 20,
          avg_time_before_dropoff: 60,
          avg_selected_price: 199,
        },
      ];

      mockSupabase.rpc.mockResolvedValueOnce({ data: mockDropOffData, error: null });
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockResolvedValueOnce({ data: [], error: null });

      const result = await service.getDropOffAnalysis(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toHaveLength(2);
      expect(result[0].stage).toBe('checkout_initiated');
      expect(result[0].reason).toBe('price_concern');
      expect(result[0].count).toBe(10);
      expect(result[0].percentage).toBe(40);
    });
  });

  describe('getConversionByPlan', () => {
    it('should handle empty results gracefully', async () => {
      // Create a chainable mock that returns empty data
      const chainableMock: any = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
      };
      
      chainableMock.not.mockReturnValue({
        select: jest.fn().mockResolvedValueOnce({ data: [], error: null }),
      });
      
      mockSupabase.from.mockReturnValueOnce(chainableMock);

      const result = await service.getConversionByPlan(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
      });

      await expect(service.getConversionByPlan(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      )).resolves.toBeDefined();
    });
  });

  describe('getConversionByDevice', () => {
    it('should handle empty results gracefully', async () => {
      // Create a chainable mock that returns empty data
      const chainableMock: any = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
      };
      
      chainableMock.not.mockReturnValue({
        select: jest.fn().mockResolvedValueOnce({ data: [], error: null }),
      });
      
      mockSupabase.from.mockReturnValueOnce(chainableMock);

      const result = await service.getConversionByDevice(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('calculateDailyStats', () => {
    it('should calculate daily statistics', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ error: null });

      await service.calculateDailyStats(new Date('2024-01-15'));

      expect(mockSupabase.rpc).toHaveBeenCalledWith('calculate_payment_funnel_stats', {
        p_date: '2024-01-15',
      });
    });
  });

  describe('getSession', () => {
    it('should return session details', async () => {
      const mockSession = {
        session_id: 'session-123',
        user_id: 'user-123',
        completed_stage: 'payment_succeeded',
        is_converted: true,
        is_dropped: false,
        first_event_at: '2024-01-15T10:00:00Z',
        last_event_at: '2024-01-15T10:05:00Z',
        total_time_seconds: 300,
      };

      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValueOnce({ data: mockSession, error: null });

      const result = await service.getSession('session-123');

      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe('session-123');
      expect(result?.isConverted).toBe(true);
      expect(result?.totalTimeSeconds).toBe(300);
    });

    it('should return null for non-existent session', async () => {
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await service.getSession('non-existent');

      expect(result).toBeNull();
    });
  });
});