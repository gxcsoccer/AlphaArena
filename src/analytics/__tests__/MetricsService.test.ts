/**
 * MetricsService Tests
 *
 * @module analytics/__tests__/MetricsService.test
 */

import { metricsService } from '../MetricsService';
import { userTrackingDAO } from '../../database/user-tracking.dao';
import { getSupabaseAdminClient } from '../../database/client';

// Mock dependencies
jest.mock('../../database/client');
jest.mock('../../database/user-tracking.dao');

describe('MetricsService', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
      rpc: jest.fn(),
    };

    (getSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('calculateNorthStarMetric', () => {
    it('should calculate weekly active trading users', async () => {
      // Mock current period traders
      mockSupabase.select
        .mockResolvedValueOnce({
          data: [
            { user_id: 'user1' },
            { user_id: 'user2' },
            { user_id: 'user1' }, // duplicate
            { user_id: 'user3' },
          ],
        })
        // Mock previous period traders
        .mockResolvedValueOnce({
          data: [
            { user_id: 'user1' },
            { user_id: 'user2' },
          ],
        });

      const result = await metricsService.calculateNorthStarMetric();

      expect(result.name).toBe('weekly_active_trading_users');
      expect(result.value).toBe(3); // 3 unique users
      expect(result.previousValue).toBe(2);
      expect(result.changePercent).toBe(50); // 50% increase
      expect(result.trend).toBe('up');
    });

    it('should handle zero previous value', async () => {
      mockSupabase.select
        .mockResolvedValueOnce({
          data: [{ user_id: 'user1' }],
        })
        .mockResolvedValueOnce({
          data: [],
        });

      const result = await metricsService.calculateNorthStarMetric();

      expect(result.value).toBe(1);
      expect(result.previousValue).toBe(0);
      expect(result.changePercent).toBe(0);
    });
  });

  describe('calculateSecondaryMetrics', () => {
    it('should calculate all secondary metrics', async () => {
      // Mock registration rate queries
      mockSupabase.select
        .mockResolvedValueOnce({ count: 10 }) // current signups
        .mockResolvedValueOnce({ data: [{ session_id: 's1' }, { session_id: 's2' }] }) // current visitors
        .mockResolvedValueOnce({ count: 8 }); // previous signups

      // Mock trading frequency queries
      mockSupabase.select
        .mockResolvedValueOnce({
          data: [
            { user_id: 'u1' },
            { user_id: 'u2' },
            { user_id: 'u1' },
          ],
        })
        .mockResolvedValueOnce({ count: 100 }); // total users

      // Mock conversion rate queries
      mockSupabase.select
        .mockResolvedValueOnce({ count: 5 }) // signups
        .mockResolvedValueOnce({ data: [{ session_id: 's1' }] }) // visitors
        .mockResolvedValueOnce({ count: 2 }); // trials

      // Mock engagement metrics
      (userTrackingDAO.getUserEngagementMetrics as jest.Mock).mockResolvedValue({
        dau: 100,
        wau: 300,
        mau: 500,
        stickiness: 20,
        retention: { day1: 40, day7: 25, day30: 10 },
        avgSessionDuration: 300,
        avgSessionsPerUser: 2.5,
      });

      // Mock retention calculation
      (userTrackingDAO as any).calculateRetention = jest.fn().mockResolvedValue({
        day1: 40,
        day7: 25,
        day30: 10,
      });

      const result = await metricsService.calculateSecondaryMetrics();

      expect(result.engagement.dau).toBe(100);
      expect(result.engagement.wau).toBe(300);
      expect(result.engagement.mau).toBe(500);
      expect(result.engagement.stickiness).toBe(20);
      expect(result.retentionRate.day1).toBe(40);
      expect(result.retentionRate.day7).toBe(25);
    });
  });

  describe('storeMetricSnapshot', () => {
    it('should store metric snapshot in database', async () => {
      const mockSnapshot = {
        data: {
          id: 'snapshot-1',
          metric_type: 'north_star',
          metric_name: 'weekly_active_trading_users',
          value: 100,
          previous_value: 90,
          change_percent: 11.11,
          calculated_at: new Date(),
          period_start: new Date(),
          period_end: new Date(),
        },
      };

      mockSupabase.insert.mockResolvedValueOnce(mockSnapshot);
      mockSupabase.single.mockResolvedValueOnce(mockSnapshot);

      const result = await metricsService.storeMetricSnapshot({
        metricType: 'north_star',
        metricName: 'weekly_active_trading_users',
        value: 100,
        previousValue: 90,
        changePercent: 11.11,
        calculatedAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
      });

      expect(result.id).toBe('snapshot-1');
    });
  });

  describe('getMetricHistory', () => {
    it('should retrieve metric history', async () => {
      const mockHistory = [
        {
          id: '1',
          metric_type: 'north_star',
          metric_name: 'weekly_active_trading_users',
          value: 100,
          calculated_at: new Date('2024-01-02'),
          period_start: new Date('2024-01-01'),
          period_end: new Date('2024-01-02'),
        },
        {
          id: '2',
          metric_type: 'north_star',
          metric_name: 'weekly_active_trading_users',
          value: 95,
          calculated_at: new Date('2024-01-01'),
          period_start: new Date('2023-12-25'),
          period_end: new Date('2024-01-01'),
        },
      ];

      mockSupabase.select.mockResolvedValueOnce({ data: mockHistory, error: null });

      const result = await metricsService.getMetricHistory('weekly_active_trading_users', 30);

      expect(result.length).toBe(2);
      expect(result[0].value).toBe(100);
    });
  });

  describe('getKeyMetrics', () => {
    it('should return all key metrics', async () => {
      // Mock North Star calculation
      mockSupabase.select
        .mockResolvedValueOnce({ data: [{ user_id: 'u1' }] })
        .mockResolvedValueOnce({ data: [{ user_id: 'u2' }] });

      // Mock secondary metrics
      (userTrackingDAO.getUserEngagementMetrics as jest.Mock).mockResolvedValue({
        dau: 100,
        wau: 300,
        mau: 500,
        stickiness: 20,
        retention: { day1: 40, day7: 25, day30: 10 },
        avgSessionDuration: 300,
        avgSessionsPerUser: 2.5,
      });

      // Mock other queries...
      mockSupabase.select.mockResolvedValue({ data: [], count: 0 });

      const result = await metricsService.getKeyMetrics();

      expect(result.northStar).toBeDefined();
      expect(result.northStar.name).toBe('weekly_active_trading_users');
      expect(result.secondary).toBeDefined();
      expect(result.calculatedAt).toBeInstanceOf(Date);
    });
  });
});