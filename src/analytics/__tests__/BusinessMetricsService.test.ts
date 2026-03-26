/**
 * Business Metrics Service Tests
 * Issue #652: 业务指标仪表盘 - 订阅转化率、DAU/MAU、留存率
 */

import { businessMetricsService } from '../BusinessMetricsService';
import { getBusinessMetricsDAO } from '../../database/business-metrics.dao';

// Mock the DAO
jest.mock('../../database/business-metrics.dao', () => ({
  getBusinessMetricsDAO: jest.fn(),
}));

describe('BusinessMetricsService', () => {
  let mockDAO: any;

  beforeEach(() => {
    mockDAO = {
      getConversionFunnel: jest.fn(),
      getDAUMAUData: jest.fn(),
      getRetentionData: jest.fn(),
      getRevenueMetrics: jest.fn(),
      getMRRData: jest.fn(),
      getARPUData: jest.fn(),
      getLTVData: jest.fn(),
      getHourlyActivity: jest.fn(),
    };
    (getBusinessMetricsDAO as jest.Mock).mockReturnValue(mockDAO);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('should return complete dashboard data', async () => {
      // Setup mocks
      mockDAO.getConversionFunnel.mockResolvedValue({
        name: 'subscription_conversion',
        steps: [
          { step: '访问', order: 0, count: 1000, conversionRate: 100, dropOffRate: 0 },
          { step: '注册', order: 1, count: 100, conversionRate: 10, dropOffRate: 90 },
          { step: '试用', order: 2, count: 50, conversionRate: 50, dropOffRate: 50 },
          { step: '付费', order: 3, count: 20, conversionRate: 40, dropOffRate: 60 },
        ],
        totalUsers: 1000,
        completedUsers: 20,
        overallConversionRate: 2,
      });

      mockDAO.getDAUMAUData.mockResolvedValue([
        { date: '2026-03-01', dau: 100, mau: 500, stickiness: 20 },
        { date: '2026-03-02', dau: 120, mau: 520, stickiness: 23.1 },
      ]);

      mockDAO.getRetentionData.mockResolvedValue({
        cohorts: [
          { cohortDate: '2026-03-01', cohortSize: 100, retentionRates: { day1: 40, day7: 20, day30: 10 } },
        ],
        avgDay1Retention: 40,
        avgDay7Retention: 20,
        avgDay30Retention: 10,
      });

      mockDAO.getRevenueMetrics.mockResolvedValue({
        mrr: 5000,
        mrrGrowth: 10,
        arr: 60000,
        arpu: 50,
        ltv: 1200,
        customerCount: 100,
        payingCustomerCount: 20,
      });

      mockDAO.getMRRData.mockResolvedValue([
        { date: '2026-03-01', mrr: 4800 },
        { date: '2026-03-02', mrr: 5000 },
      ]);

      mockDAO.getHourlyActivity.mockResolvedValue([
        { hour: 0, count: 10, uniqueUsers: 8 },
        { hour: 1, count: 5, uniqueUsers: 4 },
      ]);

      const dashboard = await businessMetricsService.getDashboard(30);

      expect(dashboard).toBeDefined();
      expect(dashboard.conversionFunnel).toBeDefined();
      expect(dashboard.conversionFunnel.steps).toHaveLength(4);
      expect(dashboard.conversionFunnel.overallConversionRate).toBe(2);

      expect(dashboard.dauMau).toBeDefined();
      expect(dashboard.dauMau.trend).toHaveLength(2);

      expect(dashboard.retention).toBeDefined();
      expect(dashboard.retention.avgDay1).toBe(40);

      expect(dashboard.revenue).toBeDefined();
      expect(dashboard.revenue.mrr).toBe(5000);
    });

    it('should handle empty data gracefully', async () => {
      mockDAO.getConversionFunnel.mockResolvedValue({
        name: 'subscription_conversion',
        steps: [],
        totalUsers: 0,
        completedUsers: 0,
        overallConversionRate: 0,
      });

      mockDAO.getDAUMAUData.mockResolvedValue([]);
      mockDAO.getRetentionData.mockResolvedValue({
        cohorts: [],
        avgDay1Retention: 0,
        avgDay7Retention: 0,
        avgDay30Retention: 0,
      });
      mockDAO.getRevenueMetrics.mockResolvedValue({
        mrr: 0,
        mrrGrowth: 0,
        arr: 0,
        arpu: 0,
        ltv: 0,
        customerCount: 0,
        payingCustomerCount: 0,
      });
      mockDAO.getMRRData.mockResolvedValue([]);
      mockDAO.getHourlyActivity.mockResolvedValue([]);

      const dashboard = await businessMetricsService.getDashboard(30);

      expect(dashboard.conversionFunnel.steps).toHaveLength(0);
      expect(dashboard.dauMau.trend).toHaveLength(0);
      expect(dashboard.revenue.mrr).toBe(0);
    });
  });

  describe('getConversionFunnel', () => {
    it('should return funnel data for specified days', async () => {
      mockDAO.getConversionFunnel.mockResolvedValue({
        name: 'subscription_conversion',
        steps: [
          { step: '访问', order: 0, count: 1000, conversionRate: 100, dropOffRate: 0 },
          { step: '注册', order: 1, count: 100, conversionRate: 10, dropOffRate: 90 },
        ],
        totalUsers: 1000,
        completedUsers: 100,
        overallConversionRate: 10,
      });

      const funnel = await businessMetricsService.getConversionFunnel(7);

      expect(funnel).toBeDefined();
      expect(funnel.steps).toHaveLength(2);
      expect(mockDAO.getConversionFunnel).toHaveBeenCalled();
    });
  });

  describe('getDAUMAU', () => {
    it('should return DAU/MAU data with hourly distribution', async () => {
      mockDAO.getDAUMAUData.mockResolvedValue([
        { date: '2026-03-01', dau: 100, mau: 500, stickiness: 20 },
        { date: '2026-03-02', dau: 120, mau: 520, stickiness: 23.1 },
      ]);
      mockDAO.getHourlyActivity.mockResolvedValue([
        { hour: 0, count: 10, uniqueUsers: 8 },
      ]);

      const dauMau = await businessMetricsService.getDAUMAU(30);

      expect(dauMau).toBeDefined();
      expect(dauMau.trend).toHaveLength(2);
      expect(dauMau.current).toBeDefined();
      expect(dauMau.current.dau).toBe(120);
      expect(dauMau.hourlyDistribution).toBeDefined();
    });
  });

  describe('getRetention', () => {
    it('should return retention data', async () => {
      mockDAO.getRetentionData.mockResolvedValue({
        cohorts: [
          { cohortDate: '2026-03-01', cohortSize: 100, retentionRates: { day1: 40, day7: 20, day30: 10 } },
        ],
        avgDay1Retention: 40,
        avgDay7Retention: 20,
        avgDay30Retention: 10,
      });

      const retention = await businessMetricsService.getRetention(90);

      expect(retention).toBeDefined();
      expect(retention.cohorts).toHaveLength(1);
      expect(retention.avgDay1Retention).toBe(40);
    });
  });

  describe('getRevenue', () => {
    it('should return revenue metrics with trends', async () => {
      mockDAO.getRevenueMetrics.mockResolvedValue({
        mrr: 5000,
        mrrGrowth: 10,
        arr: 60000,
        arpu: 50,
        ltv: 1200,
        customerCount: 100,
        payingCustomerCount: 20,
      });
      mockDAO.getMRRData.mockResolvedValue([{ date: '2026-03-01', mrr: 5000 }]);
      mockDAO.getARPUData.mockResolvedValue([{ date: '2026-03-01', arpu: 50 }]);
      mockDAO.getLTVData.mockResolvedValue([{ cohortMonth: '2026-03', ltvLifetime: 1200 }]);

      const revenue = await businessMetricsService.getRevenue(30);

      expect(revenue).toBeDefined();
      expect(revenue.mrr).toBe(5000);
      expect(revenue.mrrTrend).toBeDefined();
      expect(revenue.arpuTrend).toBeDefined();
      expect(revenue.ltvByCohort).toBeDefined();
    });
  });

  describe('exportMetrics', () => {
    it('should export metrics as JSON', async () => {
      mockDAO.getConversionFunnel.mockResolvedValue({
        name: 'test',
        steps: [],
        totalUsers: 0,
        completedUsers: 0,
        overallConversionRate: 0,
      });
      mockDAO.getDAUMAUData.mockResolvedValue([]);
      mockDAO.getRetentionData.mockResolvedValue({
        cohorts: [],
        avgDay1Retention: 0,
        avgDay7Retention: 0,
        avgDay30Retention: 0,
      });
      mockDAO.getRevenueMetrics.mockResolvedValue({
        mrr: 0,
        mrrGrowth: 0,
        arr: 0,
        arpu: 0,
        ltv: 0,
        customerCount: 0,
        payingCustomerCount: 0,
      });
      mockDAO.getMRRData.mockResolvedValue([]);
      mockDAO.getHourlyActivity.mockResolvedValue([]);

      const exported = await businessMetricsService.exportMetrics('json');

      expect(exported).toBeDefined();
      const parsed = JSON.parse(exported);
      expect(parsed.conversionFunnel).toBeDefined();
    });

    it('should export metrics as CSV', async () => {
      mockDAO.getConversionFunnel.mockResolvedValue({
        name: 'test',
        steps: [
          { step: '访问', order: 0, count: 1000, conversionRate: 100, dropOffRate: 0 },
        ],
        totalUsers: 1000,
        completedUsers: 100,
        overallConversionRate: 10,
      });
      mockDAO.getDAUMAUData.mockResolvedValue([
        { date: '2026-03-01', dau: 100, mau: 500, stickiness: 20 },
      ]);
      mockDAO.getRetentionData.mockResolvedValue({
        cohorts: [],
        avgDay1Retention: 40,
        avgDay7Retention: 20,
        avgDay30Retention: 10,
      });
      mockDAO.getRevenueMetrics.mockResolvedValue({
        mrr: 5000,
        mrrGrowth: 10,
        arr: 60000,
        arpu: 50,
        ltv: 1200,
        customerCount: 100,
        payingCustomerCount: 20,
      });
      mockDAO.getMRRData.mockResolvedValue([]);
      mockDAO.getHourlyActivity.mockResolvedValue([]);

      const exported = await businessMetricsService.exportMetrics('csv');

      expect(exported).toBeDefined();
      expect(exported).toContain('Conversion Funnel');
      expect(exported).toContain('DAU/MAU Trend');
    });
  });
});