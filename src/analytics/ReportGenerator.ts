/**
 * Report Generator Service
 *
 * Generates analytics reports:
 * - Daily data summary
 * - Weekly data report
 * - Anomaly detection and alerts
 *
 * @module analytics/ReportGenerator
 */

import { metricsService } from './MetricsService';
import { dashboardService, DashboardOverview, DashboardFunnel } from './DashboardService';
import { userTrackingDAO } from '../database/user-tracking.dao';
import { getSupabaseAdminClient } from '../database/client';
import { createLogger } from '../utils/logger';
import {
  DailyAnalyticsSummary,
  UserEngagementMetrics,
} from './userTracking.types';

const log = createLogger('ReportGenerator');

/**
 * Daily report
 */
export interface DailyReport {
  /** Report date */
  date: string;
  /** Report type */
  type: 'daily';
  /** Key metrics */
  metrics: {
    dau: number;
    newSignups: number;
    trades: number;
    avgSessionDuration: number;
  };
  /** Comparison with previous day */
  comparison: {
    dauChange: number;
    signupsChange: number;
    tradesChange: number;
  };
  /** Top pages */
  topPages: Array<{ url: string; views: number }>;
  /** Top events */
  topEvents: Array<{ type: string; count: number }>;
  /** Alerts */
  alerts: ReportAlert[];
  /** Generated at */
  generatedAt: Date;
}

/**
 * Weekly report
 */
export interface WeeklyReport {
  /** Report period */
  period: {
    start: string;
    end: string;
  };
  /** Report type */
  type: 'weekly';
  /** Executive summary */
  summary: {
    northStar: {
      name: string;
      value: number;
      changePercent: number;
      trend: string;
    };
    highlights: string[];
    concerns: string[];
  };
  /** Key metrics */
  metrics: {
    wau: number;
    newSignups: number;
    trades: number;
    retention: {
      day1: number;
      day7: number;
      day30: number;
    };
    conversionRate: number;
  };
  /** Week over week comparison */
  comparison: {
    wauChange: number;
    signupsChange: number;
    tradesChange: number;
    retentionChange: number;
  };
  /** Funnel performance */
  funnels: {
    signupToTrade: DashboardFunnel;
    strategyExecution: DashboardFunnel;
  };
  /** Daily breakdown */
  dailyBreakdown: DailyAnalyticsSummary[];
  /** Alerts */
  alerts: ReportAlert[];
  /** Generated at */
  generatedAt: Date;
}

/**
 * Report alert
 */
export interface ReportAlert {
  type: 'warning' | 'critical' | 'info';
  category: 'metric_drop' | 'anomaly' | 'threshold' | 'trend';
  title: string;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
  recommendation?: string;
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetection {
  metricName: string;
  currentValue: number;
  expectedValue: number;
  deviationPercent: number;
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Report Generator Service
 */
class ReportGenerator {
  /** Thresholds for anomaly detection */
  private readonly ANOMALY_THRESHOLDS = {
    dau_drop_percent: 20, // Alert if DAU drops > 20%
    signup_drop_percent: 30, // Alert if signups drop > 30%
    trade_drop_percent: 25, // Alert if trades drop > 25%
    retention_drop_percent: 15, // Alert if retention drops > 15%
    session_duration_drop_percent: 30, // Alert if session duration drops > 30%
  };

  /**
   * Generate daily report
   */
  async generateDailyReport(date?: Date): Promise<DailyReport> {
    const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateStr = targetDate.toISOString().split('T')[0];
    const previousDate = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);
    const previousDateStr = previousDate.toISOString().split('T')[0];

    const supabase = getSupabaseAdminClient();

    // Get metrics for the day
    const [
      dauData,
      signupData,
      tradeData,
      sessionData,
      previousDauData,
      previousSignupData,
      previousTradeData,
      topPages,
      topEvents,
    ] = await Promise.all([
      // Today's DAU
      supabase
        .from('user_tracking_events')
        .select('user_id')
        .gte('occurred_at', `${dateStr}T00:00:00Z`)
        .lte('occurred_at', `${dateStr}T23:59:59Z`)
        .not('user_id', 'is', null),
      // Today's signups
      supabase
        .from('user_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'user_signup')
        .gte('occurred_at', `${dateStr}T00:00:00Z`)
        .lte('occurred_at', `${dateStr}T23:59:59Z`),
      // Today's trades
      supabase
        .from('user_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'order_placed')
        .gte('occurred_at', `${dateStr}T00:00:00Z`)
        .lte('occurred_at', `${dateStr}T23:59:59Z`),
      // Session durations
      supabase
        .from('user_sessions')
        .select('duration_seconds')
        .gte('first_event_at', `${dateStr}T00:00:00Z`)
        .lte('first_event_at', `${dateStr}T23:59:59Z`)
        .not('duration_seconds', 'is', null),
      // Previous day's DAU
      supabase
        .from('user_tracking_events')
        .select('user_id')
        .gte('occurred_at', `${previousDateStr}T00:00:00Z`)
        .lte('occurred_at', `${previousDateStr}T23:59:59Z`)
        .not('user_id', 'is', null),
      // Previous day's signups
      supabase
        .from('user_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'user_signup')
        .gte('occurred_at', `${previousDateStr}T00:00:00Z`)
        .lte('occurred_at', `${previousDateStr}T23:59:59Z`),
      // Previous day's trades
      supabase
        .from('user_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'order_placed')
        .gte('occurred_at', `${previousDateStr}T00:00:00Z`)
        .lte('occurred_at', `${previousDateStr}T23:59:59Z`),
      // Top pages
      this.getTopPages(dateStr),
      // Top events
      this.getTopEvents(dateStr),
    ]);

    // Calculate metrics
    const dau = dauData.data ? new Set(dauData.data.map(u => u.user_id)).size : 0;
    const previousDau = previousDauData.data ? new Set(previousDauData.data.map(u => u.user_id)).size : 0;
    const newSignups = signupData.count || 0;
    const previousSignups = previousSignupData.count || 0;
    const trades = tradeData.count || 0;
    const previousTrades = previousTradeData.count || 0;

    const validDurations = sessionData.data?.filter(s => s.duration_seconds).map(s => s.duration_seconds) || [];
    const avgSessionDuration = validDurations.length > 0
      ? validDurations.reduce((a, b) => a + b, 0) / validDurations.length
      : 0;

    // Calculate changes
    const dauChange = previousDau > 0 ? ((dau - previousDau) / previousDau) * 100 : 0;
    const signupsChange = previousSignups > 0 ? ((newSignups - previousSignups) / previousSignups) * 100 : 0;
    const tradesChange = previousTrades > 0 ? ((trades - previousTrades) / previousTrades) * 100 : 0;

    // Detect anomalies
    const alerts = this.detectDailyAnomalies({
      dau,
      previousDau,
      newSignups,
      previousSignups,
      trades,
      previousTrades,
      dauChange,
      signupsChange,
      tradesChange,
    });

    const report: DailyReport = {
      date: dateStr,
      type: 'daily',
      metrics: {
        dau,
        newSignups,
        trades,
        avgSessionDuration,
      },
      comparison: {
        dauChange,
        signupsChange,
        tradesChange,
      },
      topPages,
      topEvents,
      alerts,
      generatedAt: new Date(),
    };

    // Store report
    await this.storeReport(report);

    return report;
  }

  /**
   * Generate weekly report
   */
  async generateWeeklyReport(endDate?: Date): Promise<WeeklyReport> {
    const end = endDate || new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousEnd = start;
    const previousStart = new Date(previousEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      overview,
      funnels,
      engagement,
      dailyBreakdown,
      previousEngagement,
    ] = await Promise.all([
      dashboardService.getOverview(7),
      dashboardService.getFunnels(7),
      userTrackingDAO.getUserEngagementMetrics(7),
      userTrackingDAO.getDailySummary(start, end),
      userTrackingDAO.getUserEngagementMetrics(7),
    ]);

    // Get signups and trades for the week
    const supabase = getSupabaseAdminClient();

    const [signupsResult, tradesResult, previousSignupsResult, previousTradesResult] = await Promise.all([
      supabase
        .from('user_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'user_signup')
        .gte('occurred_at', start.toISOString())
        .lte('occurred_at', end.toISOString()),
      supabase
        .from('user_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'order_placed')
        .gte('occurred_at', start.toISOString())
        .lte('occurred_at', end.toISOString()),
      supabase
        .from('user_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'user_signup')
        .gte('occurred_at', previousStart.toISOString())
        .lte('occurred_at', previousEnd.toISOString()),
      supabase
        .from('user_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'order_placed')
        .gte('occurred_at', previousStart.toISOString())
        .lte('occurred_at', previousEnd.toISOString()),
    ]);

    const newSignups = signupsResult.count || 0;
    const trades = tradesResult.count || 0;
    const previousSignups = previousSignupsResult.count || 0;
    const previousTrades = previousTradesResult.count || 0;

    // Calculate week-over-week changes
    const wauChange = previousEngagement.wau > 0
      ? ((engagement.wau - previousEngagement.wau) / previousEngagement.wau) * 100
      : 0;
    const signupsChange = previousSignups > 0
      ? ((newSignups - previousSignups) / previousSignups) * 100
      : 0;
    const tradesChange = previousTrades > 0
      ? ((trades - previousTrades) / previousTrades) * 100
      : 0;
    const retentionChange = previousEngagement.retention.day7 > 0
      ? ((engagement.retention.day7 - previousEngagement.retention.day7) / previousEngagement.retention.day7) * 100
      : 0;

    // Generate highlights and concerns
    const highlights: string[] = [];
    const concerns: string[] = [];

    if (overview.northStar.changePercent > 10) {
      highlights.push(`周活跃交易用户增长 ${overview.northStar.changePercent.toFixed(1)}%`);
    }
    if (signupsChange > 20) {
      highlights.push(`新注册用户增长 ${signupsChange.toFixed(1)}%`);
    }
    if (engagement.stickiness > 30) {
      highlights.push(`用户粘性达到 ${engagement.stickiness.toFixed(1)}%`);
    }

    if (wauChange < -10) {
      concerns.push(`周活跃用户下降 ${Math.abs(wauChange).toFixed(1)}%`);
    }
    if (engagement.retention.day7 < 20) {
      concerns.push(`7日留存率仅 ${engagement.retention.day7.toFixed(1)}%`);
    }
    if (funnels.signupToTrade.overallConversionRate < 5) {
      concerns.push(`注册到交易转化率仅 ${funnels.signupToTrade.overallConversionRate.toFixed(1)}%`);
    }

    // Detect anomalies
    const alerts = this.detectWeeklyAnomalies({
      wau: engagement.wau,
      previousWau: previousEngagement.wau,
      wauChange,
      signupsChange,
      tradesChange,
      retention: engagement.retention,
      conversionRate: funnels.signupToTrade.overallConversionRate,
    });

    const report: WeeklyReport = {
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      },
      type: 'weekly',
      summary: {
        northStar: {
          name: '周活跃交易用户',
          value: overview.northStar.value,
          changePercent: overview.northStar.changePercent,
          trend: overview.northStar.trend === 'up' ? '上升' : overview.northStar.trend === 'down' ? '下降' : '持平',
        },
        highlights,
        concerns,
      },
      metrics: {
        wau: engagement.wau,
        newSignups,
        trades,
        retention: engagement.retention,
        conversionRate: funnels.signupToTrade.overallConversionRate,
      },
      comparison: {
        wauChange,
        signupsChange,
        tradesChange,
        retentionChange,
      },
      funnels: {
        signupToTrade: funnels.signupToTrade,
        strategyExecution: funnels.strategyExecution,
      },
      dailyBreakdown,
      alerts,
      generatedAt: new Date(),
    };

    // Store report
    await this.storeReport(report);

    return report;
  }

  /**
   * Detect anomalies in daily metrics
   */
  private detectDailyAnomalies(data: {
    dau: number;
    previousDau: number;
    newSignups: number;
    previousSignups: number;
    trades: number;
    previousTrades: number;
    dauChange: number;
    signupsChange: number;
    tradesChange: number;
  }): ReportAlert[] {
    const alerts: ReportAlert[] = [];

    // DAU drop
    if (data.dauChange < -this.ANOMALY_THRESHOLDS.dau_drop_percent) {
      alerts.push({
        type: 'warning',
        category: 'metric_drop',
        title: '日活用户下降',
        message: `DAU 下降 ${Math.abs(data.dauChange).toFixed(1)}%，从 ${data.previousDau} 降至 ${data.dau}`,
        metric: 'dau',
        value: data.dau,
        recommendation: '检查是否有技术问题或市场变化',
      });
    }

    // Signup drop
    if (data.signupsChange < -this.ANOMALY_THRESHOLDS.signup_drop_percent) {
      alerts.push({
        type: 'warning',
        category: 'metric_drop',
        title: '新注册用户下降',
        message: `注册量下降 ${Math.abs(data.signupsChange).toFixed(1)}%，从 ${data.previousSignups} 降至 ${data.newSignups}`,
        metric: 'signups',
        value: data.newSignups,
        recommendation: '检查营销渠道和注册流程',
      });
    }

    // Trade drop
    if (data.tradesChange < -this.ANOMALY_THRESHOLDS.trade_drop_percent) {
      alerts.push({
        type: 'critical',
        category: 'metric_drop',
        title: '交易量下降',
        message: `交易量下降 ${Math.abs(data.tradesChange).toFixed(1)}%，从 ${data.previousTrades} 降至 ${data.trades}`,
        metric: 'trades',
        value: data.trades,
        recommendation: '检查交易系统和市场状况',
      });
    }

    // Zero activity
    if (data.dau === 0) {
      alerts.push({
        type: 'critical',
        category: 'anomaly',
        title: '无活跃用户',
        message: '今日无活跃用户，可能存在系统问题',
        metric: 'dau',
        value: 0,
        recommendation: '立即检查系统状态',
      });
    }

    return alerts;
  }

  /**
   * Detect anomalies in weekly metrics
   */
  private detectWeeklyAnomalies(data: {
    wau: number;
    previousWau: number;
    wauChange: number;
    signupsChange: number;
    tradesChange: number;
    retention: { day1: number; day7: number; day30: number };
    conversionRate: number;
  }): ReportAlert[] {
    const alerts: ReportAlert[] = [];

    // WAU drop
    if (data.wauChange < -this.ANOMALY_THRESHOLDS.dau_drop_percent) {
      alerts.push({
        type: 'warning',
        category: 'trend',
        title: '周活用户持续下降',
        message: `WAU 下降 ${Math.abs(data.wauChange).toFixed(1)}%`,
        metric: 'wau',
        value: data.wau,
        recommendation: '需要深入分析流失原因',
      });
    }

    // Low retention
    if (data.retention.day7 < 20) {
      alerts.push({
        type: 'warning',
        category: 'threshold',
        title: '留存率偏低',
        message: `7日留存率仅 ${data.retention.day7.toFixed(1)}%，低于健康水平`,
        metric: 'retention_day7',
        value: data.retention.day7,
        threshold: 20,
        recommendation: '优化新用户体验',
      });
    }

    // Low conversion
    if (data.conversionRate < 5) {
      alerts.push({
        type: 'info',
        category: 'threshold',
        title: '转化率偏低',
        message: `注册到交易转化率仅 ${data.conversionRate.toFixed(1)}%`,
        metric: 'conversion_rate',
        value: data.conversionRate,
        threshold: 5,
        recommendation: '优化用户引导流程',
      });
    }

    return alerts;
  }

  /**
   * Detect anomaly for a specific metric
   */
  async detectAnomaly(
    metricName: string,
    currentValue: number,
    historicalValues: number[]
  ): Promise<AnomalyDetection> {
    if (historicalValues.length < 7) {
      return {
        metricName,
        currentValue,
        expectedValue: currentValue,
        deviationPercent: 0,
        isAnomaly: false,
        severity: 'low',
      };
    }

    // Calculate expected value (simple moving average)
    const expectedValue = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    const deviationPercent = expectedValue > 0
      ? ((currentValue - expectedValue) / expectedValue) * 100
      : 0;

    // Calculate standard deviation
    const variance = historicalValues.reduce((sum, v) => sum + Math.pow(v - expectedValue, 2), 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);

    // Determine if anomaly (more than 2 standard deviations)
    const isAnomaly = Math.abs(currentValue - expectedValue) > 2 * stdDev;

    // Determine severity
    let severity: 'low' | 'medium' | 'high' = 'low';
    if (isAnomaly) {
      const deviationRatio = Math.abs(currentValue - expectedValue) / stdDev;
      if (deviationRatio > 3) {
        severity = 'high';
      } else if (deviationRatio > 2.5) {
        severity = 'medium';
      }
    }

    return {
      metricName,
      currentValue,
      expectedValue,
      deviationPercent,
      isAnomaly,
      severity,
    };
  }

  /**
   * Get top pages for a date
   */
  private async getTopPages(dateStr: string): Promise<Array<{ url: string; views: number }>> {
    const supabase = getSupabaseAdminClient();

    const { data } = await supabase
      .from('user_tracking_events')
      .select('page_url')
      .eq('event_type', 'page_view')
      .gte('occurred_at', `${dateStr}T00:00:00Z`)
      .lte('occurred_at', `${dateStr}T23:59:59Z`)
      .not('page_url', 'is', null);

    const pageCount = new Map<string, number>();
    for (const p of data || []) {
      if (p.page_url) {
        pageCount.set(p.page_url, (pageCount.get(p.page_url) || 0) + 1);
      }
    }

    return Array.from(pageCount.entries())
      .map(([url, views]) => ({ url, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
  }

  /**
   * Get top events for a date
   */
  private async getTopEvents(dateStr: string): Promise<Array<{ type: string; count: number }>> {
    const supabase = getSupabaseAdminClient();

    const { data } = await supabase
      .from('user_tracking_events')
      .select('event_type')
      .gte('occurred_at', `${dateStr}T00:00:00Z`)
      .lte('occurred_at', `${dateStr}T23:59:59Z`);

    const eventCount = new Map<string, number>();
    for (const e of data || []) {
      eventCount.set(e.event_type, (eventCount.get(e.event_type) || 0) + 1);
    }

    return Array.from(eventCount.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Store report in database
   */
  private async storeReport(report: DailyReport | WeeklyReport): Promise<void> {
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('analytics_reports')
      .insert({
        report_type: report.type,
        report_date: report.type === 'daily' ? report.date : report.period.end,
        content: report,
        generated_at: report.generatedAt,
      });

    if (error) {
      log.error('Failed to store report:', error);
      // Don't throw, just log
    }
  }

  /**
   * Get historical reports
   */
  async getReports(
    type: 'daily' | 'weekly',
    limit: number = 30
  ): Promise<Array<DailyReport | WeeklyReport>> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('analytics_reports')
      .select('*')
      .eq('report_type', type)
      .order('report_date', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to get reports:', error);
      throw new Error(`Failed to get reports: ${error.message}`);
    }

    return (data || []).map(d => d.content as DailyReport | WeeklyReport);
  }

  /**
   * Schedule daily report generation
   */
  async scheduleDailyReport(): Promise<void> {
    log.info('Scheduled daily report generation triggered');
    try {
      const report = await this.generateDailyReport();
      log.info('Daily report generated', { date: report.date, alerts: report.alerts.length });

      // Check for critical alerts and send notifications
      const criticalAlerts = report.alerts.filter(a => a.type === 'critical');
      if (criticalAlerts.length > 0) {
        log.warn('Critical alerts detected in daily report', { alerts: criticalAlerts });
        // In production, this would send notifications (email, Slack, etc.)
      }
    } catch (error) {
      log.error('Failed to generate daily report:', error);
      throw error;
    }
  }

  /**
   * Schedule weekly report generation
   */
  async scheduleWeeklyReport(): Promise<void> {
    log.info('Scheduled weekly report generation triggered');
    try {
      const report = await this.generateWeeklyReport();
      log.info('Weekly report generated', {
        period: report.period,
        alerts: report.alerts.length,
      });

      // Check for critical alerts
      const criticalAlerts = report.alerts.filter(a => a.type === 'critical');
      if (criticalAlerts.length > 0) {
        log.warn('Critical alerts detected in weekly report', { alerts: criticalAlerts });
      }
    } catch (error) {
      log.error('Failed to generate weekly report:', error);
      throw error;
    }
  }
}

// Singleton instance
export { ReportGenerator };
export const reportGenerator = new ReportGenerator();
export default reportGenerator;