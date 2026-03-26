/**
 * Business Metrics Service
 *
 * Core service for business metrics calculation and aggregation
 * Implements subscription conversion, DAU/MAU, retention, and revenue metrics
 *
 * @module analytics/BusinessMetricsService
 */

import { getBusinessMetricsDAO, BusinessMetricsFilter } from '../database/business-metrics.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('BusinessMetricsService');

/**
 * Business Metrics Dashboard Response
 */
export interface BusinessMetricsDashboard {
  conversionFunnel: {
    name: string;
    steps: Array<{
      step: string;
      order: number;
      count: number;
      conversionRate: number;
      dropOffRate: number;
    }>;
    totalUsers: number;
    completedUsers: number;
    overallConversionRate: number;
  };
  dauMau: {
    current: {
      dau: number;
      mau: number;
      stickiness: number;
    };
    trend: Array<{
      date: string;
      dau: number;
      mau: number;
      stickiness: number;
    }>;
    hourlyDistribution: Array<{
      hour: number;
      count: number;
      uniqueUsers: number;
    }>;
  };
  retention: {
    avgDay1: number;
    avgDay7: number;
    avgDay30: number;
    cohorts: Array<{
      cohortDate: string;
      cohortSize: number;
      retentionRates: Record<string, number>;
    }>;
  };
  revenue: {
    mrr: number;
    mrrGrowth: number;
    arr: number;
    arpu: number;
    ltv: number;
    customerCount: number;
    payingCustomerCount: number;
    mrrTrend: Array<{
      date: string;
      mrr: number;
    }>;
  };
  period: {
    start: Date;
    end: Date;
  };
  updatedAt: Date;
}

/**
 * Business Metrics Service
 */
class BusinessMetricsService {
  /**
   * Get complete business metrics dashboard
   */
  async getDashboard(days: number = 30): Promise<BusinessMetricsDashboard> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dao = getBusinessMetricsDAO();

    log.info('Fetching business metrics dashboard', { days, startDate, endDate });

    const [
      conversionFunnel,
      dauMauData,
      retentionData,
      revenueMetrics,
      mrrData,
      hourlyActivity,
    ] = await Promise.all([
      dao.getConversionFunnel(startDate, endDate),
      dao.getDAUMAUData(startDate, endDate),
      dao.getRetentionData(startDate, endDate),
      dao.getRevenueMetrics(),
      dao.getMRRData(startDate, endDate),
      dao.getHourlyActivity(startDate, endDate),
    ]);

    // Get current DAU/MAU
    const currentDauMau = dauMauData[dauMauData.length - 1] || {
      dau: 0,
      mau: 0,
      stickiness: 0,
    };

    return {
      conversionFunnel: {
        name: conversionFunnel.name,
        steps: conversionFunnel.steps.map(s => ({
          step: s.step,
          order: s.order,
          count: s.count,
          conversionRate: s.conversionRate,
          dropOffRate: s.dropOffRate,
        })),
        totalUsers: conversionFunnel.totalUsers,
        completedUsers: conversionFunnel.completedUsers,
        overallConversionRate: conversionFunnel.overallConversionRate,
      },
      dauMau: {
        current: currentDauMau,
        trend: dauMauData.slice(-30), // Last 30 days
        hourlyDistribution: hourlyActivity,
      },
      retention: {
        avgDay1: retentionData.avgDay1Retention,
        avgDay7: retentionData.avgDay7Retention,
        avgDay30: retentionData.avgDay30Retention,
        cohorts: retentionData.cohorts.map(c => ({
          cohortDate: c.cohortDate,
          cohortSize: c.cohortSize,
          retentionRates: c.retentionRates as Record<string, number>,
        })),
      },
      revenue: {
        ...revenueMetrics,
        mrrTrend: mrrData.slice(-30).map(m => ({
          date: m.date,
          mrr: m.mrr,
        })),
      },
      period: { start: startDate, end: endDate },
      updatedAt: new Date(),
    };
  }

  /**
   * Get conversion funnel only
   */
  async getConversionFunnel(days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dao = getBusinessMetricsDAO();
    return dao.getConversionFunnel(startDate, endDate);
  }

  /**
   * Get DAU/MAU metrics
   */
  async getDAUMAU(days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dao = getBusinessMetricsDAO();
    const [dauMauData, hourlyActivity] = await Promise.all([
      dao.getDAUMAUData(startDate, endDate),
      dao.getHourlyActivity(startDate, endDate),
    ]);

    const current = dauMauData[dauMauData.length - 1] || {
      dau: 0,
      mau: 0,
      stickiness: 0,
    };

    return {
      current,
      trend: dauMauData,
      hourlyDistribution: hourlyActivity,
    };
  }

  /**
   * Get retention data
   */
  async getRetention(days: number = 90) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dao = getBusinessMetricsDAO();
    return dao.getRetentionData(startDate, endDate);
  }

  /**
   * Get revenue metrics
   */
  async getRevenue(days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dao = getBusinessMetricsDAO();
    const [metrics, mrrData, arpuData, ltvData] = await Promise.all([
      dao.getRevenueMetrics(),
      dao.getMRRData(startDate, endDate),
      dao.getARPUData(startDate, endDate),
      dao.getLTVData(startDate, endDate),
    ]);

    return {
      ...metrics,
      mrrTrend: mrrData,
      arpuTrend: arpuData,
      ltvByCohort: ltvData,
    };
  }

  /**
   * Export metrics for reporting
   */
  async exportMetrics(format: 'json' | 'csv' = 'json'): Promise<string> {
    const dashboard = await this.getDashboard(30);

    if (format === 'csv') {
      return this.formatAsCsv(dashboard);
    }

    return JSON.stringify(dashboard, null, 2);
  }

  /**
   * Format dashboard as CSV
   */
  private formatAsCsv(dashboard: BusinessMetricsDashboard): string {
    const lines: string[] = [];

    // Conversion Funnel
    lines.push('Conversion Funnel');
    lines.push('Step,Count,Conversion Rate,Drop-off Rate');
    for (const step of dashboard.conversionFunnel.steps) {
      lines.push(`${step.step},${step.count},${step.conversionRate.toFixed(2)}%,${step.dropOffRate.toFixed(2)}%`);
    }
    lines.push('');

    // DAU/MAU Trend
    lines.push('DAU/MAU Trend');
    lines.push('Date,DAU,MAU,Stickiness');
    for (const row of dashboard.dauMau.trend) {
      lines.push(`${row.date},${row.dau},${row.mau},${row.stickiness.toFixed(2)}%`);
    }
    lines.push('');

    // Retention
    lines.push('Retention Summary');
    lines.push(`Day 1,${dashboard.retention.avgDay1.toFixed(2)}%`);
    lines.push(`Day 7,${dashboard.retention.avgDay7.toFixed(2)}%`);
    lines.push(`Day 30,${dashboard.retention.avgDay30.toFixed(2)}%`);
    lines.push('');

    // Revenue
    lines.push('Revenue Metrics');
    lines.push(`MRR,${dashboard.revenue.mrr}`);
    lines.push(`ARR,${dashboard.revenue.arr}`);
    lines.push(`ARPU,${dashboard.revenue.arpu}`);
    lines.push(`LTV,${dashboard.revenue.ltv}`);
    lines.push(`Paying Customers,${dashboard.revenue.payingCustomerCount}`);

    return lines.join('\n');
  }

  /**
   * Run daily metrics aggregation
   */
  async runDailyAggregation(): Promise<void> {
    log.info('Starting daily business metrics aggregation');

    try {
      const dashboard = await this.getDashboard(30);
      log.info('Daily business metrics aggregated', {
        dau: dashboard.dauMau.current.dau,
        mau: dashboard.dauMau.current.mau,
        mrr: dashboard.revenue.mrr,
        conversionRate: dashboard.conversionFunnel.overallConversionRate,
      });

      // In production, you would store these in a metrics_snapshots table
      // for historical comparison

      log.info('Daily business metrics aggregation completed');
    } catch (error) {
      log.error('Daily business metrics aggregation failed:', error);
      throw error;
    }
  }
}

// Singleton instance
export const businessMetricsService = new BusinessMetricsService();
export default businessMetricsService;