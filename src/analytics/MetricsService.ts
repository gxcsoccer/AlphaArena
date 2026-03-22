/**
 * Metrics Service
 *
 * Core metrics collection and calculation service
 * Implements North Star metric and secondary metrics
 *
 * @module analytics/MetricsService
 */

import { userTrackingDAO } from '../database/user-tracking.dao';
import { getSupabaseAdminClient } from '../database/client';
import { createLogger } from '../utils/logger';
import {
  TrackingEventType,
  EventCategory,
} from './userTracking.types';

const log = createLogger('MetricsService');

/**
 * North Star Metric - Weekly Active Trading Users
 * 用户在 7 天内至少完成一笔交易
 */
export interface NorthStarMetric {
  /** Metric name */
  name: 'weekly_active_trading_users';
  /** Current value */
  value: number;
  /** Previous period value */
  previousValue: number;
  /** Change percentage */
  changePercent: number;
  /** Period */
  period: {
    start: Date;
    end: Date;
  };
  /** Trend direction */
  trend: 'up' | 'down' | 'flat';
}

/**
 * Secondary Metrics - 二级指标
 */
export interface SecondaryMetrics {
  /** Registration rate (注册率) */
  registrationRate: {
    value: number;
    previousValue: number;
    changePercent: number;
  };
  /** Retention rate (留存率) */
  retentionRate: {
    day1: number;
    day7: number;
    day30: number;
  };
  /** Trading frequency (交易频次) */
  tradingFrequency: {
    avgTradesPerUser: number;
    avgTradesPerActiveUser: number;
    totalTrades: number;
  };
  /** Conversion rate (转化率) */
  conversionRate: {
    signupToFirstTrade: number;
    visitorToSignup: number;
    trialToSubscription: number;
  };
  /** User engagement (用户参与度) */
  engagement: {
    dau: number;
    wau: number;
    mau: number;
    stickiness: number; // DAU/MAU
    avgSessionDuration: number;
  };
}

/**
 * Metric calculation options
 */
export interface MetricCalculationOptions {
  /** Start date */
  startDate?: Date;
  /** End date */
  endDate?: Date;
  /** Compare with previous period */
  comparePrevious?: boolean;
}

/**
 * Metric snapshot for storage
 */
export interface MetricSnapshot {
  id?: string;
  metricType: 'north_star' | 'secondary';
  metricName: string;
  value: number;
  previousValue?: number;
  changePercent?: number;
  metadata?: Record<string, any>;
  calculatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Metrics Service
 */
class MetricsService {
  /**
   * Calculate North Star Metric - Weekly Active Trading Users
   */
  async calculateNorthStarMetric(options?: MetricCalculationOptions): Promise<NorthStarMetric> {
    const endDate = options?.endDate || new Date();
    const startDate = options?.startDate || new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousEnd = startDate;

    const supabase = getSupabaseAdminClient();

    // Current period: unique users who placed orders
    const { data: currentTraders } = await supabase
      .from('user_tracking_events')
      .select('user_id')
      .eq('event_type', 'order_placed')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString())
      .not('user_id', 'is', null);

    // Previous period
    const { data: previousTraders } = await supabase
      .from('user_tracking_events')
      .select('user_id')
      .eq('event_type', 'order_placed')
      .gte('occurred_at', previousStart.toISOString())
      .lte('occurred_at', previousEnd.toISOString())
      .not('user_id', 'is', null);

    const currentValue = currentTraders ? new Set(currentTraders.map(t => t.user_id)).size : 0;
    const previousValue = previousTraders ? new Set(previousTraders.map(t => t.user_id)).size : 0;
    const changePercent = previousValue > 0 
      ? ((currentValue - previousValue) / previousValue) * 100 
      : 0;

    return {
      name: 'weekly_active_trading_users',
      value: currentValue,
      previousValue,
      changePercent,
      period: { start: startDate, end: endDate },
      trend: changePercent > 2 ? 'up' : changePercent < -2 ? 'down' : 'flat',
    };
  }

  /**
   * Calculate all secondary metrics
   */
  async calculateSecondaryMetrics(options?: MetricCalculationOptions): Promise<SecondaryMetrics> {
    const endDate = options?.endDate || new Date();
    const startDate = options?.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      registrationRate,
      retentionRate,
      tradingFrequency,
      conversionRate,
      engagement,
    ] = await Promise.all([
      this.calculateRegistrationRate(startDate, endDate),
      this.calculateRetentionRate(),
      this.calculateTradingFrequency(startDate, endDate),
      this.calculateConversionRate(startDate, endDate),
      this.calculateEngagementMetrics(),
    ]);

    return {
      registrationRate,
      retentionRate,
      tradingFrequency,
      conversionRate,
      engagement,
    };
  }

  /**
   * Calculate registration rate
   */
  private async calculateRegistrationRate(startDate: Date, endDate: Date): Promise<{
    value: number;
    previousValue: number;
    changePercent: number;
  }> {
    const supabase = getSupabaseAdminClient();
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const previousStart = new Date(startDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const previousEnd = startDate;

    // Current period signups
    const { count: currentSignups } = await supabase
      .from('user_tracking_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'user_signup')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString());

    // Current period visitors
    const { data: currentVisitors } = await supabase
      .from('user_tracking_events')
      .select('session_id')
      .eq('event_type', 'page_view')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString());

    const uniqueCurrentVisitors = currentVisitors 
      ? new Set(currentVisitors.map(v => v.session_id)).size 
      : 0;

    // Previous period signups
    const { count: previousSignups } = await supabase
      .from('user_tracking_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'user_signup')
      .gte('occurred_at', previousStart.toISOString())
      .lte('occurred_at', previousEnd.toISOString());

    const currentValue = uniqueCurrentVisitors > 0 
      ? (currentSignups || 0) / uniqueCurrentVisitors * 100 
      : 0;
    const previousValue = uniqueCurrentVisitors > 0 
      ? (previousSignups || 0) / uniqueCurrentVisitors * 100 
      : 0;
    const changePercent = previousValue > 0 
      ? ((currentValue - previousValue) / previousValue) * 100 
      : 0;

    return {
      value: currentValue,
      previousValue,
      changePercent,
    };
  }

  /**
   * Calculate retention rate
   */
  private async calculateRetentionRate(): Promise<{
    day1: number;
    day7: number;
    day30: number;
  }> {
    const engagement = await userTrackingDAO.getUserEngagementMetrics(30);
    return engagement.retention;
  }

  /**
   * Calculate trading frequency
   */
  private async calculateTradingFrequency(startDate: Date, endDate: Date): Promise<{
    avgTradesPerUser: number;
    avgTradesPerActiveUser: number;
    totalTrades: number;
  }> {
    const supabase = getSupabaseAdminClient();

    // Get all trades in period
    const { data: trades } = await supabase
      .from('user_tracking_events')
      .select('user_id')
      .in('event_type', ['order_placed', 'order_filled'])
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString())
      .not('user_id', 'is', null);

    if (!trades || trades.length === 0) {
      return {
        avgTradesPerUser: 0,
        avgTradesPerActiveUser: 0,
        totalTrades: 0,
      };
    }

    const totalTrades = trades.length;
    const uniqueTraders = new Set(trades.map(t => t.user_id)).size;
    const avgTradesPerActiveUser = totalTrades / uniqueTraders;

    // Get total users
    const { count: totalUsers } = await supabase
      .from('user_tracking_events')
      .select('*', { count: 'exact', head: true })
      .not('user_id', 'is', null);

    const avgTradesPerUser = (totalUsers || 0) > 0 
      ? totalTrades / (totalUsers || 1) 
      : 0;

    return {
      avgTradesPerUser,
      avgTradesPerActiveUser,
      totalTrades,
    };
  }

  /**
   * Calculate conversion rates
   */
  private async calculateConversionRate(startDate: Date, endDate: Date): Promise<{
    signupToFirstTrade: number;
    visitorToSignup: number;
    trialToSubscription: number;
  }> {
    // Use funnel analysis for signup to first trade
    const signupFunnel = await userTrackingDAO.analyzeFunnel(
      'signup_to_trade',
      [
        { name: 'Sign Up', eventType: 'user_signup' },
        { name: 'First Trade', eventType: 'order_placed' },
      ],
      startDate,
      endDate
    );

    const signupToFirstTrade = signupFunnel.overallConversionRate;

    // Visitor to signup
    const supabase = getSupabaseAdminClient();
    const { count: signups } = await supabase
      .from('user_tracking_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'user_signup')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString());

    const { data: visitors } = await supabase
      .from('user_tracking_events')
      .select('session_id')
      .eq('event_type', 'page_view')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString());

    const uniqueVisitors = visitors ? new Set(visitors.map(v => v.session_id)).size : 0;
    const visitorToSignup = uniqueVisitors > 0 ? ((signups || 0) / uniqueVisitors) * 100 : 0;

    // Trial to subscription
    const { count: trials } = await supabase
      .from('user_tracking_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'subscription_started')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString());

    const trialToSubscription = trials ? 100 : 0; // Simplified

    return {
      signupToFirstTrade,
      visitorToSignup,
      trialToSubscription,
    };
  }

  /**
   * Calculate engagement metrics
   */
  private async calculateEngagementMetrics(): Promise<{
    dau: number;
    wau: number;
    mau: number;
    stickiness: number;
    avgSessionDuration: number;
  }> {
    const engagement = await userTrackingDAO.getUserEngagementMetrics(30);
    return {
      dau: engagement.dau,
      wau: engagement.wau,
      mau: engagement.mau,
      stickiness: engagement.stickiness,
      avgSessionDuration: engagement.avgSessionDuration,
    };
  }

  /**
   * Get all key metrics for dashboard
   */
  async getKeyMetrics(options?: MetricCalculationOptions): Promise<{
    northStar: NorthStarMetric;
    secondary: SecondaryMetrics;
    calculatedAt: Date;
  }> {
    const [northStar, secondary] = await Promise.all([
      this.calculateNorthStarMetric(options),
      this.calculateSecondaryMetrics(options),
    ]);

    return {
      northStar,
      secondary,
      calculatedAt: new Date(),
    };
  }

  /**
   * Store metric snapshot
   */
  async storeMetricSnapshot(snapshot: MetricSnapshot): Promise<MetricSnapshot> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('metric_snapshots')
      .insert({
        metric_type: snapshot.metricType,
        metric_name: snapshot.metricName,
        value: snapshot.value,
        previous_value: snapshot.previousValue,
        change_percent: snapshot.changePercent,
        metadata: snapshot.metadata || {},
        calculated_at: snapshot.calculatedAt,
        period_start: snapshot.periodStart,
        period_end: snapshot.periodEnd,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to store metric snapshot:', error);
      throw new Error(`Failed to store metric snapshot: ${error.message}`);
    }

    return {
      ...snapshot,
      id: data.id,
    };
  }

  /**
   * Get metric history
   */
  async getMetricHistory(
    metricName: string,
    limit: number = 30
  ): Promise<MetricSnapshot[]> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('metric_snapshots')
      .select('*')
      .eq('metric_name', metricName)
      .order('calculated_at', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to get metric history:', error);
      throw new Error(`Failed to get metric history: ${error.message}`);
    }

    return (data || []).map(this.mapSnapshotFromDb);
  }

  /**
   * Aggregate daily metrics
   */
  async runDailyMetricsAggregation(): Promise<void> {
    log.info('Starting daily metrics aggregation');

    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    try {
      // Calculate and store North Star metric
      const northStar = await this.calculateNorthStarMetric({
        startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: today,
      });

      await this.storeMetricSnapshot({
        metricType: 'north_star',
        metricName: 'weekly_active_trading_users',
        value: northStar.value,
        previousValue: northStar.previousValue,
        changePercent: northStar.changePercent,
        calculatedAt: today,
        periodStart: northStar.period.start,
        periodEnd: northStar.period.end,
      });

      log.info('North Star metric stored', { value: northStar.value });

      // Calculate and store secondary metrics
      const secondary = await this.calculateSecondaryMetrics({
        startDate: yesterday,
        endDate: today,
      });

      // Store key secondary metrics
      await Promise.all([
        this.storeMetricSnapshot({
          metricType: 'secondary',
          metricName: 'registration_rate',
          value: secondary.registrationRate.value,
          previousValue: secondary.registrationRate.previousValue,
          changePercent: secondary.registrationRate.changePercent,
          calculatedAt: today,
          periodStart: yesterday,
          periodEnd: today,
        }),
        this.storeMetricSnapshot({
          metricType: 'secondary',
          metricName: 'dau',
          value: secondary.engagement.dau,
          calculatedAt: today,
          periodStart: yesterday,
          periodEnd: today,
        }),
        this.storeMetricSnapshot({
          metricType: 'secondary',
          metricName: 'trading_frequency',
          value: secondary.tradingFrequency.avgTradesPerActiveUser,
          metadata: {
            totalTrades: secondary.tradingFrequency.totalTrades,
            avgTradesPerUser: secondary.tradingFrequency.avgTradesPerUser,
          },
          calculatedAt: today,
          periodStart: yesterday,
          periodEnd: today,
        }),
      ]);

      log.info('Daily metrics aggregation completed');
    } catch (error) {
      log.error('Daily metrics aggregation failed:', error);
      throw error;
    }
  }

  /**
   * Map database record to snapshot
   */
  private mapSnapshotFromDb(data: any): MetricSnapshot {
    return {
      id: data.id,
      metricType: data.metric_type,
      metricName: data.metric_name,
      value: data.value,
      previousValue: data.previous_value,
      changePercent: data.change_percent,
      metadata: data.metadata,
      calculatedAt: new Date(data.calculated_at),
      periodStart: new Date(data.period_start),
      periodEnd: new Date(data.period_end),
    };
  }
}

// Singleton instance
export { MetricsService };
export const metricsService = new MetricsService();
export default metricsService;