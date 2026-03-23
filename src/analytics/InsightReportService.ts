/**
 * User Behavior Insight Report Service
 *
 * Generates comprehensive user behavior insight reports:
 * - User activity pattern recognition
 * - Key metrics trend analysis
 * - Optimization recommendations
 * - Scheduled report generation
 *
 * @module analytics/InsightReportService
 */

import { userTrackingDAO } from '../database/user-tracking.dao';
import { dashboardService, DashboardFunnel, FeatureUsagePoint } from './DashboardService';
import { reportGenerator, DailyReport, WeeklyReport, ReportAlert } from './ReportGenerator';
import { metricsService } from './MetricsService';
import { getSupabaseAdminClient } from '../database/client';
import { createLogger } from '../utils/logger';
import {
  DailyAnalyticsSummary,
  UserEngagementMetrics,
  TrackingEventType,
} from './userTracking.types';

const log = createLogger('InsightReportService');

// ============================================================
// Types
// ============================================================

/**
 * User activity segment
 */
export interface UserSegment {
  name: string;
  description: string;
  userCount: number;
  percentage: number;
  characteristics: string[];
  avgSessionDuration: number;
  avgSessionsPerWeek: number;
  topFeatures: string[];
  churnRisk: 'low' | 'medium' | 'high';
}

/**
 * User behavior pattern
 */
export interface BehaviorPattern {
  patternId: string;
  name: string;
  description: string;
  frequency: number;
  affectedUsers: number;
  impact: 'positive' | 'negative' | 'neutral';
  category: 'engagement' | 'conversion' | 'retention' | 'feature_usage';
  recommendation: string;
  relatedEvents: TrackingEventType[];
}

/**
 * Key metrics trend
 */
export interface MetricsTrend {
  metricName: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  trendStrength: 'strong' | 'moderate' | 'weak';
  historicalData: Array<{ date: string; value: number }>;
  significance: 'significant' | 'normal' | 'insignificant';
  context: string;
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'acquisition' | 'activation' | 'retention' | 'revenue' | 'referral';
  title: string;
  description: string;
  rationale: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  relatedMetrics: string[];
  actionItems: string[];
  abTestSuggestion?: {
    hypothesis: string;
    variantA: string;
    variantB: string;
    successMetric: string;
  };
}

/**
 * Anomaly insight
 */
export interface AnomalyInsight {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  metricName: string;
  detectedAt: Date;
  description: string;
  currentValue: number;
  expectedValue: number;
  deviationPercent: number;
  possibleCauses: string[];
  recommendedActions: string[];
}

/**
 * User journey insight
 */
export interface JourneyInsight {
  journeyType: 'onboarding' | 'trading' | 'strategy' | 'subscription';
  stages: Array<{
    name: string;
    userCount: number;
    dropOffRate: number;
    avgTimeToNextStage: number;
    bottlenecks: string[];
  }>;
  overallCompletionRate: number;
  avgTimeToComplete: number;
  keyDropOffPoints: string[];
  optimizationOpportunities: string[];
}

/**
 * Feature insight
 */
export interface FeatureInsight {
  featureName: string;
  category: string;
  usageRate: number;
  userSatisfaction: 'high' | 'medium' | 'low';
  adoptionTrend: 'growing' | 'stable' | 'declining';
  powerUsers: number;
  casualUsers: number;
  nonUsers: number;
  correlationWithRetention: number;
  recommendation: string;
}

/**
 * Comprehensive insight report
 */
export interface InsightReport {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  
  // Executive summary
  summary: {
    overview: string;
    keyFindings: string[];
    criticalAlerts: string[];
    topRecommendations: string[];
  };
  
  // User segments
  userSegments: UserSegment[];
  
  // Behavior patterns
  behaviorPatterns: BehaviorPattern[];
  
  // Metrics trends
  metricsTrends: MetricsTrend[];
  
  // Optimization suggestions
  optimizationSuggestions: OptimizationSuggestion[];
  
  // Anomalies detected
  anomalies: AnomalyInsight[];
  
  // User journey insights
  journeyInsights: JourneyInsight[];
  
  // Feature insights
  featureInsights: FeatureInsight[];
  
  // Comparison with previous period
  comparison: {
    periodLabel: string;
    improvements: string[];
    regressions: string[];
  };
  
  // Next actions
  nextActions: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    assignee: string;
    dueDate?: Date;
  }>;
}

/**
 * Report schedule configuration
 */
export interface ReportSchedule {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  enabled: boolean;
  cronExpression: string;
  recipients: string[];
  channels: ('email' | 'feishu' | 'slack')[];
  includeSections: string[];
  lastRunAt?: Date;
  nextRunAt?: Date;
}

/**
 * Insight report query options
 */
export interface InsightReportOptions {
  reportType: 'daily' | 'weekly' | 'monthly';
  includeSegments?: boolean;
  includePatterns?: boolean;
  includeTrends?: boolean;
  includeSuggestions?: boolean;
  includeAnomalies?: boolean;
  includeJourneys?: boolean;
  includeFeatures?: boolean;
}

// ============================================================
// Service Implementation
// ============================================================

/**
 * Insight Report Service
 */
class InsightReportService {
  /** Threshold for anomaly detection */
  private readonly ANOMALY_THRESHOLD_PERCENT = 20;
  
  /** Minimum sample size for pattern detection */
  private readonly MIN_SAMPLE_SIZE = 10;

  /**
   * Generate comprehensive insight report
   */
  async generateInsightReport(
    options: InsightReportOptions
  ): Promise<InsightReport> {
    const { reportType } = options;
    const period = this.getReportPeriod(reportType);
    
    log.info(`Generating ${reportType} insight report`, { period });

    const [
      userSegments,
      behaviorPatterns,
      metricsTrends,
      optimizationSuggestions,
      anomalies,
      journeyInsights,
      featureInsights,
      engagement,
    ] = await Promise.all([
      options.includeSegments !== false 
        ? this.analyzeUserSegments(period.start, period.end)
        : Promise.resolve([]),
      options.includePatterns !== false
        ? this.detectBehaviorPatterns(period.start, period.end)
        : Promise.resolve([]),
      options.includeTrends !== false
        ? this.analyzeMetricsTrends(reportType)
        : Promise.resolve([]),
      options.includeSuggestions !== false
        ? this.generateOptimizationSuggestions(period.start, period.end)
        : Promise.resolve([]),
      options.includeAnomalies !== false
        ? this.detectAnomalies(period.start, period.end)
        : Promise.resolve([]),
      options.includeJourneys !== false
        ? this.analyzeUserJourneys(period.start, period.end)
        : Promise.resolve([]),
      options.includeFeatures !== false
        ? this.analyzeFeatureInsights(period.start, period.end)
        : Promise.resolve([]),
      userTrackingDAO.getUserEngagementMetrics(
        reportType === 'daily' ? 1 : reportType === 'weekly' ? 7 : 30
      ),
    ]);

    // Generate summary
    const summary = this.generateSummary({
      reportType,
      userSegments,
      behaviorPatterns,
      metricsTrends,
      anomalies,
      engagement,
    });

    // Generate comparison
    const comparison = await this.generateComparison(reportType, metricsTrends);

    // Generate next actions
    const nextActions = this.generateNextActions(
      anomalies,
      optimizationSuggestions,
      behaviorPatterns
    );

    const report: InsightReport = {
      id: `insight-${reportType}-${period.start.toISOString().split('T')[0]}`,
      reportType,
      generatedAt: new Date(),
      period,
      summary,
      userSegments,
      behaviorPatterns,
      metricsTrends,
      optimizationSuggestions,
      anomalies,
      journeyInsights,
      featureInsights,
      comparison,
      nextActions,
    };

    // Store report
    await this.storeInsightReport(report);

    return report;
  }

  /**
   * Analyze user segments
   */
  private async analyzeUserSegments(
    startDate: Date,
    endDate: Date
  ): Promise<UserSegment[]> {
    const supabase = getSupabaseAdminClient();
    
    // Get user activity data
    const { data: userActivity } = await supabase
      .from('user_tracking_events')
      .select('user_id, event_type, occurred_at, session_id')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString())
      .not('user_id', 'is', null);

    if (!userActivity || userActivity.length === 0) {
      return [];
    }

    // Aggregate by user
    const userStats = new Map<string, {
      sessionCount: number;
      eventCount: number;
      sessions: Set<string>;
      eventTypes: Map<string, number>;
      firstSeen: Date;
      lastSeen: Date;
    }>();

    for (const event of userActivity) {
      if (!event.user_id) continue;
      
      const stats = userStats.get(event.user_id) || {
        sessionCount: 0,
        eventCount: 0,
        sessions: new Set<string>(),
        eventTypes: new Map<string, number>(),
        firstSeen: new Date(event.occurred_at),
        lastSeen: new Date(event.occurred_at),
      };
      
      stats.eventCount++;
      stats.sessions.add(event.session_id);
      stats.sessionCount = stats.sessions.size;
      stats.eventTypes.set(
        event.event_type,
        (stats.eventTypes.get(event.event_type) || 0) + 1
      );
      
      const eventDate = new Date(event.occurred_at);
      if (eventDate < stats.firstSeen) stats.firstSeen = eventDate;
      if (eventDate > stats.lastSeen) stats.lastSeen = eventDate;
      
      userStats.set(event.user_id, stats);
    }

    // Classify users into segments
    const segments: UserSegment[] = [];
    const totalUsers = userStats.size;
    
    // High active users (top 20% by session count)
    const sortedBySessions = Array.from(userStats.entries())
      .sort((a, b) => b[1].sessionCount - a[1].sessionCount);
    
    const highActiveThreshold = Math.ceil(totalUsers * 0.2);
    const highActiveUsers = sortedBySessions.slice(0, highActiveThreshold);
    
    if (highActiveUsers.length >= this.MIN_SAMPLE_SIZE) {
      const avgSessions = this.average(
        highActiveUsers.map(([_, s]) => s.sessionCount)
      );
      const avgEvents = this.average(
        highActiveUsers.map(([_, s]) => s.eventCount)
      );
      const topFeatures = this.getTopFeatures(
        highActiveUsers.flatMap(([_, s]) => Array.from(s.eventTypes.keys()))
      );
      
      segments.push({
        name: '高活跃用户',
        description: '最活跃的 20% 用户，使用频率高，深度参与产品',
        userCount: highActiveUsers.length,
        percentage: (highActiveUsers.length / totalUsers) * 100,
        characteristics: [
          `平均每周 ${avgSessions.toFixed(1)} 次会话`,
          `平均每次会话 ${avgEvents.toFixed(1)} 个事件`,
          '高度依赖核心功能',
        ],
        avgSessionDuration: avgEvents * 30, // Estimate
        avgSessionsPerWeek: avgSessions,
        topFeatures,
        churnRisk: 'low',
      });
    }

    // Medium active users (middle 50%)
    const mediumActiveUsers = sortedBySessions.slice(
      highActiveThreshold,
      Math.floor(totalUsers * 0.7)
    );
    
    if (mediumActiveUsers.length >= this.MIN_SAMPLE_SIZE) {
      const avgSessions = this.average(
        mediumActiveUsers.map(([_, s]) => s.sessionCount)
      );
      const avgEvents = this.average(
        mediumActiveUsers.map(([_, s]) => s.eventCount)
      );
      const topFeatures = this.getTopFeatures(
        mediumActiveUsers.flatMap(([_, s]) => Array.from(s.eventTypes.keys()))
      );
      
      segments.push({
        name: '中活跃用户',
        description: '定期使用产品，有明确的使用场景',
        userCount: mediumActiveUsers.length,
        percentage: (mediumActiveUsers.length / totalUsers) * 100,
        characteristics: [
          `平均每周 ${avgSessions.toFixed(1)} 次会话`,
          '有固定的使用习惯',
          '对部分功能有依赖',
        ],
        avgSessionDuration: avgEvents * 25,
        avgSessionsPerWeek: avgSessions,
        topFeatures,
        churnRisk: 'medium',
      });
    }

    // Low active users (bottom 30%)
    const lowActiveUsers = sortedBySessions.slice(Math.floor(totalUsers * 0.7));
    
    if (lowActiveUsers.length >= this.MIN_SAMPLE_SIZE) {
      const avgSessions = this.average(
        lowActiveUsers.map(([_, s]) => s.sessionCount)
      );
      const daysSinceLastActive = this.average(
        lowActiveUsers.map(([_, s]) => 
          (endDate.getTime() - s.lastSeen.getTime()) / (1000 * 60 * 60 * 24)
        )
      );
      
      segments.push({
        name: '低活跃用户',
        description: '使用频率低，流失风险高',
        userCount: lowActiveUsers.length,
        percentage: (lowActiveUsers.length / totalUsers) * 100,
        characteristics: [
          `平均每周 ${avgSessions.toFixed(1)} 次会话`,
          `${daysSinceLastActive.toFixed(0)} 天未活跃`,
          '功能使用有限',
        ],
        avgSessionDuration: 60,
        avgSessionsPerWeek: avgSessions,
        topFeatures: ['浏览页面'],
        churnRisk: 'high',
      });
    }

    // New users (joined in period)
    const { data: newUserData } = await supabase
      .from('user_tracking_events')
      .select('user_id')
      .eq('event_type', 'user_signup')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString());

    const newUserCount = newUserData ? new Set(newUserData.map(u => u.user_id)).size : 0;
    
    if (newUserCount >= this.MIN_SAMPLE_SIZE) {
      segments.push({
        name: '新用户',
        description: '本周期内新注册的用户',
        userCount: newUserCount,
        percentage: (newUserCount / totalUsers) * 100,
        characteristics: [
          '正在探索产品功能',
          '需要引导和支持',
          '激活是关键',
        ],
        avgSessionDuration: 120,
        avgSessionsPerWeek: 2,
        topFeatures: ['页面浏览', '账户设置'],
        churnRisk: 'medium',
      });
    }

    return segments;
  }

  /**
   * Detect behavior patterns
   */
  private async detectBehaviorPatterns(
    startDate: Date,
    endDate: Date
  ): Promise<BehaviorPattern[]> {
    const patterns: BehaviorPattern[] = [];
    const supabase = getSupabaseAdminClient();

    // Get event sequences
    const { data: events } = await supabase
      .from('user_tracking_events')
      .select('user_id, event_type, occurred_at, session_id, properties')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString())
      .order('occurred_at', { ascending: true });

    if (!events || events.length === 0) {
      return patterns;
    }

    // Pattern 1: Quick bounce (visit one page and leave)
    const bouncePattern = this.detectBouncePattern(events);
    if (bouncePattern) patterns.push(bouncePattern);

    // Pattern 2: Feature discovery flow
    const discoveryPattern = await this.detectFeatureDiscoveryPattern(events, startDate, endDate);
    if (discoveryPattern) patterns.push(discoveryPattern);

    // Pattern 3: Trading activation pattern
    const tradingPattern = await this.detectTradingActivationPattern(events, startDate, endDate);
    if (tradingPattern) patterns.push(tradingPattern);

    // Pattern 4: Churn risk pattern
    const churnPattern = await this.detectChurnRiskPattern(events, startDate, endDate);
    if (churnPattern) patterns.push(churnPattern);

    // Pattern 5: Power user pattern
    const powerUserPattern = await this.detectPowerUserPattern(events, startDate, endDate);
    if (powerUserPattern) patterns.push(powerUserPattern);

    return patterns;
  }

  /**
   * Detect bounce pattern
   */
  private detectBouncePattern(events: any[]): BehaviorPattern | null {
    const sessionEvents = new Map<string, any[]>();
    
    for (const event of events) {
      const session = sessionEvents.get(event.session_id) || [];
      session.push(event);
      sessionEvents.set(event.session_id, session);
    }

    let bounceCount = 0;
    for (const [, session] of sessionEvents) {
      if (session.length === 1 && session[0].event_type === 'page_view') {
        bounceCount++;
      }
    }

    const totalSessions = sessionEvents.size;
    const bounceRate = totalSessions > 0 ? (bounceCount / totalSessions) * 100 : 0;

    if (bounceRate > 30) {
      return {
        patternId: 'bounce-rate-high',
        name: '高跳出率模式',
        description: `${bounceRate.toFixed(1)}% 的会话只访问了一个页面就离开`,
        frequency: bounceCount,
        affectedUsers: bounceCount,
        impact: 'negative',
        category: 'engagement',
        recommendation: '优化落地页内容，增加吸引力和导航引导',
        relatedEvents: ['page_view'],
      };
    }

    return null;
  }

  /**
   * Detect feature discovery pattern
   */
  private async detectFeatureDiscoveryPattern(
    events: any[],
    startDate: Date,
    endDate: Date
  ): Promise<BehaviorPattern | null> {
    const supabase = getSupabaseAdminClient();
    
    // Check how many users discover features after signup
    const { data: signups } = await supabase
      .from('user_tracking_events')
      .select('user_id, occurred_at')
      .eq('event_type', 'user_signup')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString());

    if (!signups || signups.length === 0) return null;

    let discoveredFeatures = 0;
    for (const signup of signups) {
      const signupTime = new Date(signup.occurred_at);
      const threeDaysLater = new Date(signupTime.getTime() + 3 * 24 * 60 * 60 * 1000);
      
      const { data: featureUsage } = await supabase
        .from('user_tracking_events')
        .select('id')
        .eq('user_id', signup.user_id)
        .eq('event_category', 'feature')
        .gte('occurred_at', signupTime.toISOString())
        .lte('occurred_at', threeDaysLater.toISOString())
        .limit(1);

      if (featureUsage && featureUsage.length > 0) {
        discoveredFeatures++;
      }
    }

    const discoveryRate = (discoveredFeatures / signups.length) * 100;

    return {
      patternId: 'feature-discovery',
      name: '功能发现模式',
      description: `${discoveryRate.toFixed(1)}% 的新用户在注册后 3 天内发现了核心功能`,
      frequency: discoveredFeatures,
      affectedUsers: signups.length,
      impact: discoveryRate > 50 ? 'positive' : discoveryRate > 30 ? 'neutral' : 'negative',
      category: 'feature_usage',
      recommendation: discoveryRate < 50 
        ? '增加功能引导和提示，帮助新用户发现核心功能'
        : '继续优化功能发现流程',
      relatedEvents: ['user_signup', 'feature_used'],
    };
  }

  /**
   * Detect trading activation pattern
   */
  private async detectTradingActivationPattern(
    events: any[],
    startDate: Date,
    endDate: Date
  ): Promise<BehaviorPattern | null> {
    const supabase = getSupabaseAdminClient();

    // Find users who connected exchange
    const { data: exchangeConnections } = await supabase
      .from('user_tracking_events')
      .select('user_id, occurred_at')
      .eq('event_name', 'exchange_connected')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString());

    if (!exchangeConnections || exchangeConnections.length === 0) return null;

    let activatedTraders = 0;
    for (const conn of exchangeConnections) {
      const connTime = new Date(conn.occurred_at);
      const sevenDaysLater = new Date(connTime.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const { data: trades } = await supabase
        .from('user_tracking_events')
        .select('id')
        .eq('user_id', conn.user_id)
        .eq('event_type', 'order_placed')
        .gte('occurred_at', connTime.toISOString())
        .lte('occurred_at', sevenDaysLater.toISOString())
        .limit(1);

      if (trades && trades.length > 0) {
        activatedTraders++;
      }
    }

    const activationRate = (activatedTraders / exchangeConnections.length) * 100;

    return {
      patternId: 'trading-activation',
      name: '交易激活模式',
      description: `连接交易所后，${activationRate.toFixed(1)}% 的用户在 7 天内完成了首次交易`,
      frequency: activatedTraders,
      affectedUsers: exchangeConnections.length,
      impact: activationRate > 60 ? 'positive' : activationRate > 40 ? 'neutral' : 'negative',
      category: 'conversion',
      recommendation: activationRate < 60 
        ? '优化交易所连接后的引导流程，帮助用户完成首次交易'
        : '继续优化交易体验',
      relatedEvents: ['feature_used', 'order_placed'],
    };
  }

  /**
   * Detect churn risk pattern
   */
  private async detectChurnRiskPattern(
    events: any[],
    startDate: Date,
    endDate: Date
  ): Promise<BehaviorPattern | null> {
    const supabase = getSupabaseAdminClient();

    // Find users who were active 2 weeks ago but not this week
    const twoWeeksAgo = new Date(startDate.getTime() - 14 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: prevActiveUsers } = await supabase
      .from('user_tracking_events')
      .select('user_id')
      .gte('occurred_at', twoWeeksAgo.toISOString())
      .lte('occurred_at', oneWeekAgo.toISOString())
      .not('user_id', 'is', null);

    if (!prevActiveUsers || prevActiveUsers.length === 0) return null;

    const prevUserIds = new Set(prevActiveUsers.map(u => u.user_id));

    const { data: currentActiveUsers } = await supabase
      .from('user_tracking_events')
      .select('user_id')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString())
      .not('user_id', 'is', null);

    const currentUserIds = new Set(
      currentActiveUsers?.filter(u => u.user_id).map(u => u.user_id) || []
    );

    let churnedCount = 0;
    for (const userId of prevUserIds) {
      if (!currentUserIds.has(userId)) {
        churnedCount++;
      }
    }

    const churnRate = prevUserIds.size > 0 ? (churnedCount / prevUserIds.size) * 100 : 0;

    if (churnRate > 10) {
      return {
        patternId: 'churn-risk',
        name: '用户流失模式',
        description: `${churnRate.toFixed(1)}% 的上周活跃用户本周未活跃`,
        frequency: churnedCount,
        affectedUsers: churnedCount,
        impact: 'negative',
        category: 'retention',
        recommendation: '实施用户召回策略，分析流失原因',
        relatedEvents: ['user_logout', 'subscription_cancelled'],
      };
    }

    return null;
  }

  /**
   * Detect power user pattern
   */
  private async detectPowerUserPattern(
    events: any[],
    startDate: Date,
    endDate: Date
  ): Promise<BehaviorPattern | null> {
    const userEventCounts = new Map<string, number>();

    for (const event of events) {
      if (event.user_id) {
        userEventCounts.set(
          event.user_id,
          (userEventCounts.get(event.user_id) || 0) + 1
        );
      }
    }

    const avgEvents = this.average(Array.from(userEventCounts.values()));
    const powerUserThreshold = avgEvents * 3;
    
    let powerUserCount = 0;
    for (const [, count] of userEventCounts) {
      if (count >= powerUserThreshold) {
        powerUserCount++;
      }
    }

    const powerUserRate = (powerUserCount / userEventCounts.size) * 100;

    if (powerUserRate >= 5) {
      return {
        patternId: 'power-users',
        name: '重度用户模式',
        description: `${powerUserRate.toFixed(1)}% 的用户是重度使用者（活跃度是平均的 3 倍以上）`,
        frequency: powerUserCount,
        affectedUsers: powerUserCount,
        impact: 'positive',
        category: 'engagement',
        recommendation: '关注重度用户需求，他们可能是产品的核心用户群体',
        relatedEvents: ['order_placed', 'strategy_created', 'backtest_completed'],
      };
    }

    return null;
  }

  /**
   * Analyze metrics trends
   */
  private async analyzeMetricsTrends(
    reportType: 'daily' | 'weekly' | 'monthly'
  ): Promise<MetricsTrend[]> {
    const trends: MetricsTrend[] = [];
    const days = reportType === 'daily' ? 7 : reportType === 'weekly' ? 30 : 90;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // DAU trend
    const dauTrend = await this.calculateMetricTrend('dau', days);
    if (dauTrend) trends.push(dauTrend);

    // WAU trend
    if (reportType !== 'daily') {
      const wauTrend = await this.calculateMetricTrend('wau', days);
      if (wauTrend) trends.push(wauTrend);
    }

    // Signups trend
    const signupTrend = await this.calculateMetricTrend('signups', days);
    if (signupTrend) trends.push(signupTrend);

    // Trades trend
    const tradesTrend = await this.calculateMetricTrend('trades', days);
    if (tradesTrend) trends.push(tradesTrend);

    // Retention trend
    const retentionTrend = await this.calculateMetricTrend('retention_day7', days);
    if (retentionTrend) trends.push(retentionTrend);

    // Conversion rate trend
    const conversionTrend = await this.calculateMetricTrend('conversion_rate', days);
    if (conversionTrend) trends.push(conversionTrend);

    return trends;
  }

  /**
   * Calculate trend for a specific metric
   */
  private async calculateMetricTrend(
    metricName: string,
    days: number
  ): Promise<MetricsTrend | null> {
    const supabase = getSupabaseAdminClient();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let currentValue = 0;
    let previousValue = 0;
    const historicalData: Array<{ date: string; value: number }> = [];

    switch (metricName) {
      case 'dau': {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const yesterdayStr = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const [todayData, yesterdayData] = await Promise.all([
          supabase.from('user_tracking_events')
            .select('user_id')
            .eq('event_date', todayStr)
            .not('user_id', 'is', null),
          supabase.from('user_tracking_events')
            .select('user_id')
            .eq('event_date', yesterdayStr)
            .not('user_id', 'is', null),
        ]);

        currentValue = todayData.data ? new Set(todayData.data.map(u => u.user_id)).size : 0;
        previousValue = yesterdayData.data ? new Set(yesterdayData.data.map(u => u.user_id)).size : 0;

        // Get historical data
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split('T')[0];
          const { data } = await supabase.from('user_tracking_events')
            .select('user_id')
            .eq('event_date', dateStr)
            .not('user_id', 'is', null);
          
          historicalData.push({
            date: dateStr,
            value: data ? new Set(data.map(u => u.user_id)).size : 0,
          });
        }
        break;
      }

      case 'signups': {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const yesterdayStr = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const [todayData, yesterdayData] = await Promise.all([
          supabase.from('user_tracking_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_type', 'user_signup')
            .eq('event_date', todayStr),
          supabase.from('user_tracking_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_type', 'user_signup')
            .eq('event_date', yesterdayStr),
        ]);

        currentValue = todayData.count || 0;
        previousValue = yesterdayData.count || 0;

        for (let i = 6; i >= 0; i--) {
          const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split('T')[0];
          const { count } = await supabase.from('user_tracking_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_type', 'user_signup')
            .eq('event_date', dateStr);
          
          historicalData.push({
            date: dateStr,
            value: count || 0,
          });
        }
        break;
      }

      case 'trades': {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const yesterdayStr = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const [todayData, yesterdayData] = await Promise.all([
          supabase.from('user_tracking_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_type', 'order_placed')
            .eq('event_date', todayStr),
          supabase.from('user_tracking_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_type', 'order_placed')
            .eq('event_date', yesterdayStr),
        ]);

        currentValue = todayData.count || 0;
        previousValue = yesterdayData.count || 0;

        for (let i = 6; i >= 0; i--) {
          const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split('T')[0];
          const { count } = await supabase.from('user_tracking_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_type', 'order_placed')
            .eq('event_date', dateStr);
          
          historicalData.push({
            date: dateStr,
            value: count || 0,
          });
        }
        break;
      }

      default:
        return null;
    }

    const changePercent = previousValue > 0 
      ? ((currentValue - previousValue) / previousValue) * 100 
      : 0;
    
    const trend = changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable';
    const trendStrength = Math.abs(changePercent) > 20 ? 'strong' 
      : Math.abs(changePercent) > 10 ? 'moderate' 
      : 'weak';
    const significance = Math.abs(changePercent) > 10 ? 'significant' 
      : Math.abs(changePercent) > 5 ? 'normal' 
      : 'insignificant';

    return {
      metricName,
      currentValue,
      previousValue,
      changePercent,
      trend,
      trendStrength,
      historicalData,
      significance,
      context: this.getMetricContext(metricName, currentValue, trend),
    };
  }

  /**
   * Get context for a metric
   */
  private getMetricContext(
    metricName: string,
    value: number,
    trend: string
  ): string {
    const contexts: Record<string, Record<string, string>> = {
      dau: {
        up: `日活跃用户增至 ${value}，用户活跃度提升`,
        down: `日活跃用户降至 ${value}，需关注用户粘性`,
        stable: `日活跃用户稳定在 ${value}`,
      },
      signups: {
        up: `新注册用户增长，获客效果良好`,
        down: `新注册用户减少，需检查获客渠道`,
        stable: `注册量稳定`,
      },
      trades: {
        up: `交易量上升，用户交易意愿增强`,
        down: `交易量下降，需关注交易体验`,
        stable: `交易量稳定`,
      },
    };

    return contexts[metricName]?.[trend] || `${metricName} ${trend === 'up' ? '上升' : trend === 'down' ? '下降' : '稳定'}`;
  }

  /**
   * Generate optimization suggestions
   */
  private async generateOptimizationSuggestions(
    startDate: Date,
    endDate: Date
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Get funnel data
    const funnels = await dashboardService.getFunnels(30);
    
    // Analyze signup to trade funnel
    if (funnels.signupToTrade.overallConversionRate < 20) {
      suggestions.push({
        id: 'opt-signup-conversion',
        priority: 'high',
        category: 'activation',
        title: '提高注册到交易转化率',
        description: '当前注册到交易转化率较低，优化用户激活流程',
        rationale: `当前转化率 ${funnels.signupToTrade.overallConversionRate.toFixed(1)}%，行业基准为 30-40%`,
        expectedImpact: '预计可提升 50% 的用户激活率',
        effort: 'medium',
        relatedMetrics: ['activation_rate', 'd7_retention'],
        actionItems: [
          '优化注册后的引导流程',
          '简化交易所连接步骤',
          '提供首次交易激励',
        ],
        abTestSuggestion: {
          hypothesis: '简化的引导流程可以提高用户激活率',
          variantA: '当前多步骤引导流程',
          variantB: '简化的一页式引导 + 首次交易奖励',
          successMetric: 'activation_rate',
        },
      });
    }

    // Analyze strategy execution funnel
    if (funnels.strategyExecution.overallConversionRate < 30) {
      suggestions.push({
        id: 'opt-strategy-execution',
        priority: 'medium',
        category: 'activation',
        title: '优化策略执行流程',
        description: '策略创建到执行的转化率偏低',
        rationale: `只有 ${funnels.strategyExecution.overallConversionRate.toFixed(1)}% 的策略被实际执行`,
        expectedImpact: '提高策略使用率和用户粘性',
        effort: 'medium',
        relatedMetrics: ['strategy_usage', 'retention'],
        actionItems: [
          '提供预设策略模板',
          '简化策略配置界面',
          '添加策略验证提示',
        ],
      });
    }

    // Get engagement metrics
    const engagement = await userTrackingDAO.getUserEngagementMetrics(30);
    
    // Retention suggestion
    if (engagement.retention.day7 < 30) {
      suggestions.push({
        id: 'opt-retention',
        priority: 'high',
        category: 'retention',
        title: '提升用户留存率',
        description: '7日留存率偏低，需要加强用户粘性建设',
        rationale: `当前 7 日留存率 ${engagement.retention.day7.toFixed(1)}%，目标应达到 40% 以上`,
        expectedImpact: '提升 30% 的留存率',
        effort: 'high',
        relatedMetrics: ['d7_retention', 'd30_retention', 'ltv'],
        actionItems: [
          '分析流失用户特征',
          '实施推送召回策略',
          '优化核心功能体验',
          '增加社区互动元素',
        ],
      });
    }

    // Stickiness suggestion
    if (engagement.stickiness < 25) {
      suggestions.push({
        id: 'opt-stickiness',
        priority: 'medium',
        category: 'retention',
        title: '提高产品粘性',
        description: 'DAU/MAU 比率偏低，用户使用频率不足',
        rationale: `当前粘性指数 ${engagement.stickiness.toFixed(1)}%，健康水平应在 30% 以上`,
        expectedImpact: '提高用户活跃度和留存',
        effort: 'medium',
        relatedMetrics: ['dau_mau_ratio', 'session_frequency'],
        actionItems: [
          '增加每日签到奖励',
          '推送个性化内容提醒',
          '添加社交功能',
        ],
      });
    }

    // Session duration suggestion
    if (engagement.avgSessionDuration < 180) {
      suggestions.push({
        id: 'opt-session-duration',
        priority: 'low',
        category: 'retention',
        title: '延长用户会话时长',
        description: '用户平均会话时长较短',
        rationale: `当前平均会话时长 ${Math.floor(engagement.avgSessionDuration / 60)} 分钟，有提升空间`,
        expectedImpact: '提高用户参与度和功能使用深度',
        effort: 'medium',
        relatedMetrics: ['session_duration', 'pages_per_session'],
        actionItems: [
          '优化内容推荐算法',
          '增加互动式功能',
          '改善页面导航体验',
        ],
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Detect anomalies
   */
  private async detectAnomalies(
    startDate: Date,
    endDate: Date
  ): Promise<AnomalyInsight[]> {
    const anomalies: AnomalyInsight[] = [];
    const supabase = getSupabaseAdminClient();

    // Get daily summaries for the period
    const { data: dailySummaries } = await supabase
      .from('daily_analytics_summary')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (!dailySummaries || dailySummaries.length < 3) {
      return anomalies;
    }

    // Check for anomalies in page views
    const pageViews = dailySummaries.map(d => d.page_views || 0);
    const avgPageViews = this.average(pageViews);
    const lastPageViews = pageViews[pageViews.length - 1];
    const pvDeviation = avgPageViews > 0 
      ? ((lastPageViews - avgPageViews) / avgPageViews) * 100 
      : 0;

    if (Math.abs(pvDeviation) > this.ANOMALY_THRESHOLD_PERCENT) {
      anomalies.push({
        id: `anomaly-page-views-${endDate.toISOString().split('T')[0]}`,
        severity: pvDeviation < -30 ? 'critical' : pvDeviation < -20 ? 'warning' : 'info',
        metricName: 'page_views',
        detectedAt: new Date(),
        description: `页面浏览量 ${pvDeviation > 0 ? '异常上升' : '异常下降'} ${Math.abs(pvDeviation).toFixed(1)}%`,
        currentValue: lastPageViews,
        expectedValue: avgPageViews,
        deviationPercent: pvDeviation,
        possibleCauses: pvDeviation < 0 
          ? ['技术问题', '营销活动结束', '季节性因素']
          : ['营销活动效果', '病毒式传播', '媒体曝光'],
        recommendedActions: pvDeviation < 0
          ? ['检查系统稳定性', '回顾近期变更', '评估营销渠道']
          : ['分析流量来源', '评估转化效果'],
      });
    }

    // Check for anomalies in unique visitors
    const visitors = dailySummaries.map(d => d.unique_visitors || 0);
    const avgVisitors = this.average(visitors);
    const lastVisitors = visitors[visitors.length - 1];
    const visitorDeviation = avgVisitors > 0 
      ? ((lastVisitors - avgVisitors) / avgVisitors) * 100 
      : 0;

    if (Math.abs(visitorDeviation) > this.ANOMALY_THRESHOLD_PERCENT) {
      anomalies.push({
        id: `anomaly-visitors-${endDate.toISOString().split('T')[0]}`,
        severity: visitorDeviation < -30 ? 'critical' : visitorDeviation < -20 ? 'warning' : 'info',
        metricName: 'unique_visitors',
        detectedAt: new Date(),
        description: `访客数 ${visitorDeviation > 0 ? '异常上升' : '异常下降'} ${Math.abs(visitorDeviation).toFixed(1)}%`,
        currentValue: lastVisitors,
        expectedValue: avgVisitors,
        deviationPercent: visitorDeviation,
        possibleCauses: visitorDeviation < 0
          ? ['SEO 排名下降', '竞品活动', '市场环境变化']
          : ['内容营销效果', '搜索引擎优化', '口碑传播'],
        recommendedActions: visitorDeviation < 0
          ? ['检查 SEO 排名', '分析竞品动态', '评估市场趋势']
          : ['巩固流量来源', '优化转化路径'],
      });
    }

    return anomalies;
  }

  /**
   * Analyze user journeys
   */
  private async analyzeUserJourneys(
    startDate: Date,
    endDate: Date
  ): Promise<JourneyInsight[]> {
    const journeys: JourneyInsight[] = [];
    const supabase = getSupabaseAdminClient();

    // Onboarding journey
    const onboardingJourney = await this.analyzeOnboardingJourney(startDate, endDate, supabase);
    if (onboardingJourney) journeys.push(onboardingJourney);

    // Trading journey
    const tradingJourney = await this.analyzeTradingJourney(startDate, endDate, supabase);
    if (tradingJourney) journeys.push(tradingJourney);

    // Strategy journey
    const strategyJourney = await this.analyzeStrategyJourney(startDate, endDate, supabase);
    if (strategyJourney) journeys.push(strategyJourney);

    // Subscription journey
    const subscriptionJourney = await this.analyzeSubscriptionJourney(startDate, endDate, supabase);
    if (subscriptionJourney) journeys.push(subscriptionJourney);

    return journeys;
  }

  /**
   * Analyze onboarding journey
   */
  private async analyzeOnboardingJourney(
    startDate: Date,
    endDate: Date,
    supabase: any
  ): Promise<JourneyInsight | null> {
    const stages = [
      { name: '注册', eventType: 'user_signup' },
      { name: '邮箱验证', eventType: 'email_verified' },
      { name: '完善资料', eventType: 'profile_completed' },
      { name: '首次登录', eventType: 'user_login' },
    ];

    const stageCounts: Array<{
      name: string;
      userCount: number;
      dropOffRate: number;
      avgTimeToNextStage: number;
      bottlenecks: string[];
    }> = [];

    let prevCount = 0;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      
      const { count } = await supabase
        .from('user_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', stage.eventType)
        .gte('occurred_at', startDate.toISOString())
        .lte('occurred_at', endDate.toISOString());

      const userCount = count || 0;
      const dropOffRate = i === 0 ? 0 
        : prevCount > 0 ? ((prevCount - userCount) / prevCount) * 100 
        : 0;

      stageCounts.push({
        name: stage.name,
        userCount,
        dropOffRate,
        avgTimeToNextStage: 0, // Would need more analysis
        bottlenecks: dropOffRate > 30 ? [`${stage.name} 流失率高`] : [],
      });

      prevCount = userCount;
    }

    const overallCompletionRate = stageCounts.length > 0 && stageCounts[0].userCount > 0
      ? (stageCounts[stageCounts.length - 1].userCount / stageCounts[0].userCount) * 100
      : 0;

    return {
      journeyType: 'onboarding',
      stages: stageCounts,
      overallCompletionRate,
      avgTimeToComplete: 0,
      keyDropOffPoints: stageCounts
        .filter(s => s.dropOffRate > 20)
        .map(s => s.name),
      optimizationOpportunities: stageCounts
        .filter(s => s.dropOffRate > 30)
        .map(s => `优化 ${s.name} 流程`),
    };
  }

  /**
   * Analyze trading journey
   */
  private async analyzeTradingJourney(
    startDate: Date,
    endDate: Date,
    supabase: any
  ): Promise<JourneyInsight | null> {
    const stages = [
      { name: '浏览市场', eventType: 'page_view' },
      { name: '连接交易所', eventType: 'feature_used' },
      { name: '创建订单', eventType: 'order_placed' },
      { name: '订单成交', eventType: 'order_filled' },
    ];

    const stageCounts: Array<{
      name: string;
      userCount: number;
      dropOffRate: number;
      avgTimeToNextStage: number;
      bottlenecks: string[];
    }> = [];

    let prevCount = 0;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      
      const { count } = await supabase
        .from('user_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', stage.eventType)
        .gte('occurred_at', startDate.toISOString())
        .lte('occurred_at', endDate.toISOString());

      const userCount = count || 0;
      const dropOffRate = i === 0 ? 0 
        : prevCount > 0 ? ((prevCount - userCount) / prevCount) * 100 
        : 0;

      stageCounts.push({
        name: stage.name,
        userCount,
        dropOffRate,
        avgTimeToNextStage: 0,
        bottlenecks: dropOffRate > 30 ? [`${stage.name} 流失率高`] : [],
      });

      prevCount = userCount;
    }

    const overallCompletionRate = stageCounts.length > 0 && stageCounts[0].userCount > 0
      ? (stageCounts[stageCounts.length - 1].userCount / stageCounts[0].userCount) * 100
      : 0;

    return {
      journeyType: 'trading',
      stages: stageCounts,
      overallCompletionRate,
      avgTimeToComplete: 0,
      keyDropOffPoints: stageCounts
        .filter(s => s.dropOffRate > 20)
        .map(s => s.name),
      optimizationOpportunities: stageCounts
        .filter(s => s.dropOffRate > 30)
        .map(s => `简化 ${s.name} 流程`),
    };
  }

  /**
   * Analyze strategy journey
   */
  private async analyzeStrategyJourney(
    startDate: Date,
    endDate: Date,
    supabase: any
  ): Promise<JourneyInsight | null> {
    const stages = [
      { name: '浏览策略', eventType: 'page_view' },
      { name: '创建策略', eventType: 'strategy_created' },
      { name: '配置参数', eventType: 'form_submit' },
      { name: '启动策略', eventType: 'strategy_started' },
    ];

    const stageCounts: Array<{
      name: string;
      userCount: number;
      dropOffRate: number;
      avgTimeToNextStage: number;
      bottlenecks: string[];
    }> = [];

    let prevCount = 0;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      
      const { count } = await supabase
        .from('user_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', stage.eventType)
        .gte('occurred_at', startDate.toISOString())
        .lte('occurred_at', endDate.toISOString());

      const userCount = count || 0;
      const dropOffRate = i === 0 ? 0 
        : prevCount > 0 ? ((prevCount - userCount) / prevCount) * 100 
        : 0;

      stageCounts.push({
        name: stage.name,
        userCount,
        dropOffRate,
        avgTimeToNextStage: 0,
        bottlenecks: dropOffRate > 30 ? [`${stage.name} 流失率高`] : [],
      });

      prevCount = userCount;
    }

    const overallCompletionRate = stageCounts.length > 0 && stageCounts[0].userCount > 0
      ? (stageCounts[stageCounts.length - 1].userCount / stageCounts[0].userCount) * 100
      : 0;

    return {
      journeyType: 'strategy',
      stages: stageCounts,
      overallCompletionRate,
      avgTimeToComplete: 0,
      keyDropOffPoints: stageCounts
        .filter(s => s.dropOffRate > 20)
        .map(s => s.name),
      optimizationOpportunities: stageCounts
        .filter(s => s.dropOffRate > 30)
        .map(s => `优化 ${s.name} 体验`),
    };
  }

  /**
   * Analyze subscription journey
   */
  private async analyzeSubscriptionJourney(
    startDate: Date,
    endDate: Date,
    supabase: any
  ): Promise<JourneyInsight | null> {
    const stages = [
      { name: '查看定价页', eventType: 'page_view' },
      { name: '点击订阅', eventType: 'button_click' },
      { name: '填写支付信息', eventType: 'form_submit' },
      { name: '完成支付', eventType: 'subscription_started' },
    ];

    const stageCounts: Array<{
      name: string;
      userCount: number;
      dropOffRate: number;
      avgTimeToNextStage: number;
      bottlenecks: string[];
    }> = [];

    let prevCount = 0;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      
      const { count } = await supabase
        .from('user_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', stage.eventType)
        .gte('occurred_at', startDate.toISOString())
        .lte('occurred_at', endDate.toISOString());

      const userCount = count || 0;
      const dropOffRate = i === 0 ? 0 
        : prevCount > 0 ? ((prevCount - userCount) / prevCount) * 100 
        : 0;

      stageCounts.push({
        name: stage.name,
        userCount,
        dropOffRate,
        avgTimeToNextStage: 0,
        bottlenecks: dropOffRate > 30 ? [`${stage.name} 流失率高`] : [],
      });

      prevCount = userCount;
    }

    const overallCompletionRate = stageCounts.length > 0 && stageCounts[0].userCount > 0
      ? (stageCounts[stageCounts.length - 1].userCount / stageCounts[0].userCount) * 100
      : 0;

    return {
      journeyType: 'subscription',
      stages: stageCounts,
      overallCompletionRate,
      avgTimeToComplete: 0,
      keyDropOffPoints: stageCounts
        .filter(s => s.dropOffRate > 20)
        .map(s => s.name),
      optimizationOpportunities: stageCounts
        .filter(s => s.dropOffRate > 30)
        .map(s => `优化 ${s.name} 流程`),
    };
  }

  /**
   * Analyze feature insights
   */
  private async analyzeFeatureInsights(
    startDate: Date,
    endDate: Date
  ): Promise<FeatureInsight[]> {
    const insights: FeatureInsight[] = [];
    const featureUsage = await dashboardService.getFeatureUsage(startDate, endDate);

    for (const feature of featureUsage.slice(0, 10)) {
      const usageRate = feature.uniqueUsers > 0 
        ? (feature.usageCount / feature.uniqueUsers) 
        : 0;

      insights.push({
        featureName: feature.feature,
        category: feature.category,
        usageRate,
        userSatisfaction: usageRate > 3 ? 'high' : usageRate > 1.5 ? 'medium' : 'low',
        adoptionTrend: 'stable', // Would need historical comparison
        powerUsers: Math.floor(feature.uniqueUsers * 0.2),
        casualUsers: Math.floor(feature.uniqueUsers * 0.5),
        nonUsers: 0, // Would need total user count
        correlationWithRetention: 0, // Would need correlation analysis
        recommendation: usageRate < 2 
          ? '考虑优化功能易用性或增加推广'
          : '功能使用情况良好，继续优化',
      });
    }

    return insights;
  }

  /**
   * Generate summary
   */
  private generateSummary(params: {
    reportType: string;
    userSegments: UserSegment[];
    behaviorPatterns: BehaviorPattern[];
    metricsTrends: MetricsTrend[];
    anomalies: AnomalyInsight[];
    engagement: UserEngagementMetrics;
  }): InsightReport['summary'] {
    const { userSegments, behaviorPatterns, metricsTrends, anomalies, engagement } = params;

    // Generate overview
    const overview = this.generateOverviewText(params);

    // Key findings
    const keyFindings: string[] = [];
    
    const positivePatterns = behaviorPatterns.filter(p => p.impact === 'positive');
    const negativePatterns = behaviorPatterns.filter(p => p.impact === 'negative');
    
    if (positivePatterns.length > 0) {
      keyFindings.push(`发现 ${positivePatterns.length} 个积极行为模式`);
    }
    if (negativePatterns.length > 0) {
      keyFindings.push(`发现 ${negativePatterns.length} 个需要关注的行为模式`);
    }
    
    const upTrends = metricsTrends.filter(t => t.trend === 'up');
    const downTrends = metricsTrends.filter(t => t.trend === 'down');
    
    if (upTrends.length > 0) {
      keyFindings.push(`${upTrends.length} 个核心指标呈上升趋势`);
    }
    if (downTrends.length > 0) {
      keyFindings.push(`${downTrends.length} 个核心指标呈下降趋势`);
    }

    keyFindings.push(`DAU/MAU 粘性指数: ${engagement.stickiness.toFixed(1)}%`);
    keyFindings.push(`7 日留存率: ${engagement.retention.day7.toFixed(1)}%`);

    // Critical alerts
    const criticalAlerts: string[] = anomalies
      .filter(a => a.severity === 'critical')
      .map(a => a.description);

    // Top recommendations
    const topRecommendations = behaviorPatterns
      .filter(p => p.impact === 'negative')
      .slice(0, 3)
      .map(p => p.recommendation);

    return {
      overview,
      keyFindings,
      criticalAlerts,
      topRecommendations,
    };
  }

  /**
   * Generate overview text
   */
  private generateOverviewText(params: {
    userSegments: UserSegment[];
    behaviorPatterns: BehaviorPattern[];
    metricsTrends: MetricsTrend[];
    engagement: UserEngagementMetrics;
  }): string {
    const { userSegments, behaviorPatterns, metricsTrends, engagement } = params;

    const totalUsers = userSegments.reduce((sum, s) => sum + s.userCount, 0);
    const highActiveUsers = userSegments.find(s => s.name === '高活跃用户');
    const churnRiskUsers = userSegments.find(s => s.churnRisk === 'high');

    let overview = `本期分析覆盖 ${totalUsers} 名活跃用户。`;
    
    if (highActiveUsers) {
      overview += `其中 ${highActiveUsers.percentage.toFixed(1)}% 为高活跃用户。`;
    }
    
    if (churnRiskUsers) {
      overview += `${churnRiskUsers.percentage.toFixed(1)}% 的用户存在流失风险。`;
    }

    const improvingTrends = metricsTrends.filter(t => t.trend === 'up').length;
    const decliningTrends = metricsTrends.filter(t => t.trend === 'down').length;
    
    overview += `${improvingTrends} 个指标改善，${decliningTrends} 个指标下降。`;

    return overview;
  }

  /**
   * Generate comparison with previous period
   */
  private async generateComparison(
    reportType: string,
    metricsTrends: MetricsTrend[]
  ): Promise<InsightReport['comparison']> {
    const improvements: string[] = [];
    const regressions: string[] = [];

    for (const trend of metricsTrends) {
      if (trend.trend === 'up' && trend.significance !== 'insignificant') {
        improvements.push(
          `${trend.metricName} 提升 ${Math.abs(trend.changePercent).toFixed(1)}%`
        );
      } else if (trend.trend === 'down' && trend.significance !== 'insignificant') {
        regressions.push(
          `${trend.metricName} 下降 ${Math.abs(trend.changePercent).toFixed(1)}%`
        );
      }
    }

    const periodLabel = reportType === 'daily' 
      ? '与昨日相比' 
      : reportType === 'weekly' 
        ? '与上周相比' 
        : '与上月相比';

    return {
      periodLabel,
      improvements,
      regressions,
    };
  }

  /**
   * Generate next actions
   */
  private generateNextActions(
    anomalies: AnomalyInsight[],
    suggestions: OptimizationSuggestion[],
    patterns: BehaviorPattern[]
  ): InsightReport['nextActions'] {
    const actions: InsightReport['nextActions'] = [];

    // Add actions from critical anomalies
    for (const anomaly of anomalies.filter(a => a.severity === 'critical')) {
      if (anomaly.recommendedActions.length > 0) {
        actions.push({
          action: anomaly.recommendedActions[0],
          priority: 'high',
          assignee: '产品团队',
        });
      }
    }

    // Add actions from high priority suggestions
    for (const suggestion of suggestions.filter(s => s.priority === 'high')) {
      if (suggestion.actionItems.length > 0) {
        actions.push({
          action: suggestion.actionItems[0],
          priority: 'high',
          assignee: '产品团队',
        });
      }
    }

    // Add actions from negative patterns
    for (const pattern of patterns.filter(p => p.impact === 'negative')) {
      actions.push({
        action: pattern.recommendation,
        priority: 'medium',
        assignee: '产品团队',
      });
    }

    return actions.slice(0, 5);
  }

  /**
   * Store insight report
   */
  private async storeInsightReport(report: InsightReport): Promise<void> {
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('insight_reports')
      .insert({
        id: report.id,
        report_type: report.reportType,
        period_start: report.period.start,
        period_end: report.period.end,
        content: report,
        generated_at: report.generatedAt,
      });

    if (error) {
      log.error('Failed to store insight report:', error);
      // Don't throw, just log
    }
  }

  /**
   * Get historical insight reports
   */
  async getInsightReports(
    reportType?: 'daily' | 'weekly' | 'monthly',
    limit: number = 30
  ): Promise<InsightReport[]> {
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('insight_reports')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(limit);

    if (reportType) {
      query = query.eq('report_type', reportType);
    }

    const { data, error } = await query;

    if (error) {
      log.error('Failed to get insight reports:', error);
      throw new Error(`Failed to get insight reports: ${error.message}`);
    }

    return (data || []).map(d => d.content as InsightReport);
  }

  /**
   * Get report period based on type
   */
  private getReportPeriod(reportType: 'daily' | 'weekly' | 'monthly'): {
    start: Date;
    end: Date;
  } {
    const now = new Date();
    const end = new Date(now);
    
    let start: Date;
    
    switch (reportType) {
      case 'daily':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    return { start, end };
  }

  /**
   * Schedule insight report generation
   */
  async scheduleReportGeneration(
    reportType: 'daily' | 'weekly' | 'monthly'
  ): Promise<void> {
    log.info(`Scheduled ${reportType} insight report generation triggered`);
    
    try {
      const report = await this.generateInsightReport({ reportType });
      log.info(`${reportType} insight report generated`, {
        id: report.id,
        patterns: report.behaviorPatterns.length,
        suggestions: report.optimizationSuggestions.length,
        anomalies: report.anomalies.length,
      });

      // Check for critical anomalies
      const criticalAnomalies = report.anomalies.filter(a => a.severity === 'critical');
      if (criticalAnomalies.length > 0) {
        log.warn('Critical anomalies detected', { anomalies: criticalAnomalies });
        // In production, this would send notifications
      }
    } catch (error) {
      log.error(`Failed to generate ${reportType} insight report:`, error);
      throw error;
    }
  }

  // ============== Utility Methods ==============

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Get top features from event types
   */
  private getTopFeatures(eventTypes: string[]): string[] {
    const counts = new Map<string, number>();
    
    for (const type of eventTypes) {
      counts.set(type, (counts.get(type) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);
  }
}

// Singleton instance
export { InsightReportService };
export const insightReportService = new InsightReportService();
export default insightReportService;