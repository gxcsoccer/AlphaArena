/**
 * Analytics Dashboard Service
 *
 * Provides data for analytics dashboard including:
 * - Key metrics visualization
 * - User behavior funnel analysis
 * - Feature usage heatmaps
 * - Real-time analytics
 *
 * @module analytics/DashboardService
 */

import { userTrackingDAO } from '../database/user-tracking.dao';
import { metricsService, NorthStarMetric, SecondaryMetrics } from './MetricsService';
import { getSupabaseAdminClient } from '../database/client';
import { createLogger } from '../utils/logger';
import {
  TrackingEvent,
  UserAnalyticsQueryOptions,
  FunnelAnalysis,
  DailyAnalyticsSummary,
} from './userTracking.types';

const log = createLogger('DashboardService');

/**
 * Dashboard overview data
 */
export interface DashboardOverview {
  /** North Star metric */
  northStar: NorthStarMetric;
  /** Secondary metrics */
  metrics: SecondaryMetrics;
  /** Period */
  period: {
    start: Date;
    end: Date;
  };
  /** Last updated */
  updatedAt: Date;
}

/**
 * Funnel step for dashboard
 */
export interface DashboardFunnelStep {
  name: string;
  order: number;
  count: number;
  conversionRate: number;
  dropOffRate: number;
}

/**
 * Funnel visualization data
 */
export interface DashboardFunnel {
  name: string;
  steps: DashboardFunnelStep[];
  totalUsers: number;
  completedUsers: number;
  overallConversionRate: number;
}

/**
 * Feature usage data point
 */
export interface FeatureUsagePoint {
  feature: string;
  category: string;
  usageCount: number;
  uniqueUsers: number;
  avgSessionDuration?: number;
}

/**
 * Heatmap cell
 */
export interface HeatmapCell {
  hour: number; // 0-23
  day: number; // 0-6 (Sunday = 0)
  value: number;
  normalizedValue: number; // 0-100
}

/**
 * Activity heatmap
 */
export interface ActivityHeatmap {
  type: 'hourly' | 'daily';
  data: HeatmapCell[];
  maxValue: number;
  minValue: number;
}

/**
 * Trend data point
 */
export interface TrendPoint {
  date: string; // YYYY-MM-DD
  value: number;
  label?: string;
}

/**
 * Metric trend
 */
export interface MetricTrend {
  metricName: string;
  data: TrendPoint[];
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

/**
 * Real-time stats
 */
export interface RealTimeStats {
  activeUsers: number;
  pageViewsLastHour: number;
  eventsLastHour: number;
  topPages: Array<{ url: string; views: number }>;
  topEvents: Array<{ type: string; count: number }>;
  timestamp: Date;
}

/**
 * Dashboard Service
 */
class DashboardService {
  /**
   * Get dashboard overview
   */
  async getOverview(days: number = 7): Promise<DashboardOverview> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const keyMetrics = await metricsService.getKeyMetrics({
      startDate,
      endDate,
    });

    return {
      northStar: keyMetrics.northStar,
      metrics: keyMetrics.secondary,
      period: { start: startDate, end: endDate },
      updatedAt: keyMetrics.calculatedAt,
    };
  }

  /**
   * Get user behavior funnels
   */
  async getFunnels(days: number = 30): Promise<{
    signupToTrade: DashboardFunnel;
    strategyExecution: DashboardFunnel;
    subscriptionConversion: DashboardFunnel;
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      signupToTradeRaw,
      strategyExecutionRaw,
      subscriptionConversionRaw,
    ] = await Promise.all([
      userTrackingDAO.analyzeFunnel(
        'signup_to_trade',
        [
          { name: '注册', eventType: 'user_signup' },
          { name: '首次登录', eventType: 'user_login' },
          { name: '连接交易所', eventType: 'feature_used' },
          { name: '首次交易', eventType: 'order_placed' },
        ],
        startDate,
        endDate
      ),
      userTrackingDAO.analyzeFunnel(
        'strategy_execution',
        [
          { name: '创建策略', eventType: 'strategy_created' },
          { name: '配置参数', eventType: 'form_submit' },
          { name: '启动策略', eventType: 'strategy_started' },
          { name: '执行交易', eventType: 'order_placed' },
        ],
        startDate,
        endDate
      ),
      userTrackingDAO.analyzeFunnel(
        'subscription_conversion',
        [
          { name: '查看定价', eventType: 'page_view' },
          { name: '点击订阅', eventType: 'button_click' },
          { name: '完成支付', eventType: 'subscription_started' },
        ],
        startDate,
        endDate
      ),
    ]);

    const mapFunnel = (raw: FunnelAnalysis): DashboardFunnel => ({
      name: raw.name,
      steps: raw.steps.map(s => ({
        name: s.name,
        order: s.order,
        count: s.completedCount,
        conversionRate: s.conversionRate,
        dropOffRate: s.dropOffRate,
      })),
      totalUsers: raw.totalUsers,
      completedUsers: raw.completedUsers,
      overallConversionRate: raw.overallConversionRate,
    });

    return {
      signupToTrade: mapFunnel(signupToTradeRaw),
      strategyExecution: mapFunnel(strategyExecutionRaw),
      subscriptionConversion: mapFunnel(subscriptionConversionRaw),
    };
  }

  /**
   * Get feature usage data
   */
  async getFeatureUsage(
    startDate: Date,
    endDate: Date,
    limit: number = 20
  ): Promise<FeatureUsagePoint[]> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('user_tracking_events')
      .select('event_name, event_category, user_id')
      .in('event_category', ['feature', 'trading', 'strategy', 'backtest'])
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString());

    if (error) {
      log.error('Failed to get feature usage:', error);
      throw new Error(`Failed to get feature usage: ${error.message}`);
    }

    // Aggregate by feature
    const featureMap = new Map<string, {
      feature: string;
      category: string;
      usageCount: number;
      users: Set<string>;
    }>();

    for (const event of data || []) {
      const key = `${event.event_category}:${event.event_name}`;
      const existing = featureMap.get(key) || {
        feature: event.event_name,
        category: event.event_category,
        usageCount: 0,
        users: new Set<string>(),
      };
      existing.usageCount++;
      if (event.user_id) existing.users.add(event.user_id);
      featureMap.set(key, existing);
    }

    return Array.from(featureMap.values())
      .map(f => ({
        feature: f.feature,
        category: f.category,
        usageCount: f.usageCount,
        uniqueUsers: f.users.size,
      }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Get activity heatmap (hourly distribution by day of week)
   */
  async getActivityHeatmap(
    startDate: Date,
    endDate: Date
  ): Promise<ActivityHeatmap> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('user_tracking_events')
      .select('occurred_at')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString());

    if (error) {
      log.error('Failed to get activity data:', error);
      throw new Error(`Failed to get activity data: ${error.message}`);
    }

    // Initialize heatmap grid (24 hours x 7 days)
    const grid: Map<string, number> = new Map();
    for (let hour = 0; hour < 24; hour++) {
      for (let day = 0; day < 7; day++) {
        grid.set(`${hour}-${day}`, 0);
      }
    }

    // Count events by hour and day
    for (const event of data || []) {
      const date = new Date(event.occurred_at);
      const hour = date.getHours();
      const day = date.getDay();
      const key = `${hour}-${day}`;
      grid.set(key, (grid.get(key) || 0) + 1);
    }

    const values = Array.from(grid.values());
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);

    const data_points: HeatmapCell[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let day = 0; day < 7; day++) {
        const value = grid.get(`${hour}-${day}`) || 0;
        data_points.push({
          hour,
          day,
          value,
          normalizedValue: maxValue > 0 ? (value / maxValue) * 100 : 0,
        });
      }
    }

    return {
      type: 'hourly',
      data: data_points,
      maxValue,
      minValue,
    };
  }

  /**
   * Get metric trends
   */
  async getMetricTrends(
    metricName: string,
    days: number = 30
  ): Promise<MetricTrend> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('metric_snapshots')
      .select('*')
      .eq('metric_name', metricName)
      .order('calculated_at', { ascending: false })
      .limit(days);

    if (error) {
      log.error('Failed to get metric trends:', error);
      throw new Error(`Failed to get metric trends: ${error.message}`);
    }

    const points: TrendPoint[] = (data || [])
      .reverse()
      .map(d => ({
        date: new Date(d.calculated_at).toISOString().split('T')[0],
        value: d.value,
      }));

    // Calculate trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    let changePercent = 0;

    if (points.length >= 2) {
      const last = points[points.length - 1].value;
      const prev = points[points.length - 2].value;
      changePercent = prev > 0 ? ((last - prev) / prev) * 100 : 0;
      trend = changePercent > 2 ? 'up' : changePercent < -2 ? 'down' : 'stable';
    }

    return {
      metricName,
      data: points,
      trend,
      changePercent,
    };
  }

  /**
   * Get daily analytics summary
   */
  async getDailySummary(
    startDate: Date,
    endDate: Date
  ): Promise<DailyAnalyticsSummary[]> {
    return userTrackingDAO.getDailySummary(startDate, endDate);
  }

  /**
   * Get real-time stats
   */
  async getRealTimeStats(): Promise<RealTimeStats> {
    const supabase = getSupabaseAdminClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Active users in last hour
    const { data: activeUsersData } = await supabase
      .from('user_tracking_events')
      .select('user_id')
      .gte('occurred_at', oneHourAgo.toISOString())
      .not('user_id', 'is', null);

    const activeUsers = activeUsersData 
      ? new Set(activeUsersData.map(u => u.user_id)).size 
      : 0;

    // Page views in last hour
    const { count: pageViewsLastHour } = await supabase
      .from('user_tracking_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'page_view')
      .gte('occurred_at', oneHourAgo.toISOString());

    // Total events in last hour
    const { count: eventsLastHour } = await supabase
      .from('user_tracking_events')
      .select('*', { count: 'exact', head: true })
      .gte('occurred_at', oneHourAgo.toISOString());

    // Top pages in last hour
    const { data: pageData } = await supabase
      .from('user_tracking_events')
      .select('page_url')
      .eq('event_type', 'page_view')
      .gte('occurred_at', oneHourAgo.toISOString())
      .not('page_url', 'is', null);

    const pageCount = new Map<string, number>();
    for (const p of pageData || []) {
      if (p.page_url) {
        pageCount.set(p.page_url, (pageCount.get(p.page_url) || 0) + 1);
      }
    }

    const topPages = Array.from(pageCount.entries())
      .map(([url, views]) => ({ url, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    // Top events in last hour
    const { data: eventData } = await supabase
      .from('user_tracking_events')
      .select('event_type')
      .gte('occurred_at', oneHourAgo.toISOString());

    const eventTypeCount = new Map<string, number>();
    for (const e of eventData || []) {
      eventTypeCount.set(e.event_type, (eventTypeCount.get(e.event_type) || 0) + 1);
    }

    const topEvents = Array.from(eventTypeCount.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      activeUsers,
      pageViewsLastHour: pageViewsLastHour || 0,
      eventsLastHour: eventsLastHour || 0,
      topPages,
      topEvents,
      timestamp: new Date(),
    };
  }

  /**
   * Get complete dashboard data
   */
  async getFullDashboard(days: number = 7): Promise<{
    overview: DashboardOverview;
    funnels: {
      signupToTrade: DashboardFunnel;
      strategyExecution: DashboardFunnel;
      subscriptionConversion: DashboardFunnel;
    };
    featureUsage: FeatureUsagePoint[];
    heatmap: ActivityHeatmap;
    realTime: RealTimeStats;
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      overview,
      funnels,
      featureUsage,
      heatmap,
      realTime,
    ] = await Promise.all([
      this.getOverview(days),
      this.getFunnels(days),
      this.getFeatureUsage(startDate, endDate),
      this.getActivityHeatmap(startDate, endDate),
      this.getRealTimeStats(),
    ]);

    return {
      overview,
      funnels,
      featureUsage,
      heatmap,
      realTime,
    };
  }
}

// Singleton instance
export { DashboardService };
export const dashboardService = new DashboardService();
export default dashboardService;