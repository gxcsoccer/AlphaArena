/**
 * Payment Funnel Service
 * Issue #662: 支付转化漏斗优化
 * 
 * Tracks and analyzes the payment conversion funnel:
 * - subscription_page_view → plan_selected → checkout_initiated → payment_succeeded
 * 
 * Features:
 * - Real-time funnel tracking
 * - Drop-off analysis
 * - A/B test integration
 * - Conversion optimization suggestions
 */

import { getSupabaseAdminClient } from '../database/client';
import { createLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const log = createLogger('PaymentFunnelService');

// ==================== Types ====================

export type FunnelStage =
  | 'subscription_page_view'
  | 'plan_selected'
  | 'checkout_initiated'
  | 'checkout_loaded'
  | 'payment_method_entered'
  | 'payment_submitted'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'checkout_canceled';

export type DropOffReason =
  | 'price_concern'
  | 'comparison'
  | 'complexity'
  | 'technical_issue'
  | 'payment_declined'
  | 'timeout'
  | 'distracted'
  | 'not_ready'
  | 'trust_issue'
  | 'missing_features'
  | 'unknown';

export interface FunnelEvent {
  sessionId: string;
  stage: FunnelStage;
  userId?: string;
  planId?: string;
  billingPeriod?: 'monthly' | 'yearly';
  priceAmount?: number;
  currency?: string;
  stripeSessionId?: string;
  dropOffReason?: DropOffReason;
  dropOffDetails?: Record<string, any>;
  experimentId?: string;
  variantId?: string;
  timeOnPageSeconds?: number;
  timeToActionSeconds?: number;
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
  deviceType?: string;
  country?: string;
}

export interface FunnelSession {
  sessionId: string;
  userId?: string;
  completedStage: FunnelStage;
  isConverted: boolean;
  isDropped: boolean;
  dropOffStage?: string;
  dropOffReason?: string;
  selectedPlanId?: string;
  selectedBillingPeriod?: string;
  selectedPrice?: number;
  experimentId?: string;
  variantId?: string;
  firstEventAt: Date;
  lastEventAt: Date;
  totalTimeSeconds?: number;
}

export interface FunnelStepStats {
  stage: FunnelStage;
  stageName: string;
  count: number;
  uniqueUsers: number;
  conversionRate: number;
  dropOffRate: number;
  avgTimeToNext?: number;
}

export interface FunnelAnalysis {
  period: { start: Date; end: Date };
  steps: FunnelStepStats[];
  totalVisitors: number;
  totalConversions: number;
  overallConversionRate: number;
  avgTimeToConversion?: number;
  dropOffDistribution: Array<{
    stage: string;
    reason: string;
    count: number;
    percentage: number;
  }>;
}

export interface DropOffAnalysis {
  stage: FunnelStage;
  reason: DropOffReason;
  count: number;
  percentage: number;
  avgTimeBeforeDropOff?: number;
  avgSelectedPrice?: number;
  suggestions: string[];
}

export interface OptimizationSuggestion {
  category: 'ux' | 'pricing' | 'trust' | 'technical' | 'messaging';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  effort: string;
  actionable: boolean;
}

export interface ABTestConfig {
  experimentId: string;
  variantId: string;
  variantName: string;
  changes: Record<string, any>;
}

// ==================== Stage Names (Chinese) ====================

export const STAGE_NAMES: Record<FunnelStage, string> = {
  subscription_page_view: '访问订阅页',
  plan_selected: '选择计划',
  checkout_initiated: '发起支付',
  checkout_loaded: '加载支付页',
  payment_method_entered: '输入支付方式',
  payment_submitted: '提交支付',
  payment_succeeded: '支付成功',
  payment_failed: '支付失败',
  checkout_canceled: '取消支付',
};

export const DROPOFF_REASON_NAMES: Record<DropOffReason, string> = {
  price_concern: '价格顾虑',
  comparison: '比较选择',
  complexity: '流程复杂',
  technical_issue: '技术问题',
  payment_declined: '支付被拒',
  timeout: '会话超时',
  distracted: '用户分心',
  not_ready: '尚未准备',
  trust_issue: '信任问题',
  missing_features: '功能缺失',
  unknown: '未知原因',
};

// ==================== Service Class ====================

export class PaymentFunnelService {
  private adminClient = getSupabaseAdminClient();

  /**
   * Track a funnel event
   */
  async trackEvent(event: FunnelEvent): Promise<{ eventId: string }> {
    try {
      const { data, error } = await this.adminClient.rpc('track_payment_funnel_event', {
        p_session_id: event.sessionId,
        p_stage: event.stage,
        p_user_id: event.userId || null,
        p_plan_id: event.planId || null,
        p_billing_period: event.billingPeriod || null,
        p_price_amount: event.priceAmount || null,
        p_stripe_session_id: event.stripeSessionId || null,
        p_drop_off_reason: event.dropOffReason || null,
        p_drop_off_details: event.dropOffDetails || {},
        p_experiment_id: event.experimentId || null,
        p_variant_id: event.variantId || null,
        p_time_on_page_seconds: event.timeOnPageSeconds || null,
        p_page_url: event.pageUrl || null,
        p_referrer: event.referrer || null,
        p_user_agent: event.userAgent || null,
        p_device_type: event.deviceType || null,
        p_country: event.country || null,
      });

      if (error) throw error;

      log.info('Tracked funnel event', {
        sessionId: event.sessionId,
        stage: event.stage,
        userId: event.userId,
      });

      return { eventId: data };
    } catch (error) {
      log.error('Failed to track funnel event:', error);
      throw error;
    }
  }

  /**
   * Track multiple events in batch
   */
  async trackEvents(events: FunnelEvent[]): Promise<void> {
    for (const event of events) {
      await this.trackEvent(event);
    }
  }

  /**
   * Get funnel analysis for a period
   */
  async getFunnelAnalysis(
    startDate: Date,
    endDate: Date,
    experimentId?: string
  ): Promise<FunnelAnalysis> {
    try {
      // Get events for the period
      let query = this.adminClient
        .from('payment_funnel_events')
        .select('*')
        .gte('occurred_at', startDate.toISOString())
        .lte('occurred_at', endDate.toISOString())
        .order('occurred_at', { ascending: true });

      if (experimentId) {
        query = query.eq('experiment_id', experimentId);
      }

      const { data: events, error } = await query;

      if (error) throw error;

      // Build funnel steps
      const stages: FunnelStage[] = [
        'subscription_page_view',
        'plan_selected',
        'checkout_initiated',
        'checkout_loaded',
        'payment_submitted',
        'payment_succeeded',
      ];

      const steps: FunnelStepStats[] = [];
      let prevCount = 0;

      for (const stage of stages) {
        const stageEvents = events?.filter(e => e.stage === stage) || [];
        const uniqueSessions = new Set(stageEvents.map(e => e.session_id));
        const uniqueUsers = new Set(stageEvents.map(e => e.user_id).filter(Boolean));

        const count = stageEvents.length;
        const conversionRate = prevCount > 0 ? (uniqueSessions.size / prevCount) * 100 : 100;
        const dropOffRate = prevCount > 0 ? ((prevCount - uniqueSessions.size) / prevCount) * 100 : 0;

        steps.push({
          stage,
          stageName: STAGE_NAMES[stage],
          count,
          uniqueUsers: uniqueUsers.size || uniqueSessions.size,
          conversionRate: Math.round(conversionRate * 100) / 100,
          dropOffRate: Math.round(dropOffRate * 100) / 100,
        });

        prevCount = uniqueSessions.size;
      }

      // Calculate overall metrics
      const totalVisitors = steps[0].uniqueUsers;
      const totalConversions = steps[steps.length - 1].uniqueUsers;
      const overallConversionRate = totalVisitors > 0
        ? (totalConversions / totalVisitors) * 100
        : 0;

      // Get drop-off distribution
      const { data: dropOffData } = await this.adminClient
        .rpc('get_payment_dropoff_analysis', {
          p_start_date: startDate.toISOString().split('T')[0],
          p_end_date: endDate.toISOString().split('T')[0],
          p_limit: 10,
        });

      const dropOffDistribution = (dropOffData || []).map((row: any) => ({
        stage: row.drop_off_stage || 'unknown',
        reason: row.drop_off_reason || 'unknown',
        count: row.count || 0,
        percentage: Math.round((row.percentage || 0) * 100) / 100,
      }));

      return {
        period: { start: startDate, end: endDate },
        steps,
        totalVisitors,
        totalConversions,
        overallConversionRate: Math.round(overallConversionRate * 100) / 100,
        dropOffDistribution,
      };
    } catch (error) {
      log.error('Failed to get funnel analysis:', error);
      throw error;
    }
  }

  /**
   * Get drop-off analysis
   */
  async getDropOffAnalysis(
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<DropOffAnalysis[]> {
    try {
      const { data, error } = await this.adminClient.rpc('get_payment_dropoff_analysis', {
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: endDate.toISOString().split('T')[0],
        p_limit: limit,
      });

      if (error) throw error;

      // Get suggestions for each reason
      const { data: reasonData } = await this.adminClient
        .from('payment_dropoff_reasons')
        .select('*');

      const suggestionsMap = new Map(
        (reasonData || []).map(r => [r.code, r.suggestions || []])
      );

      return (data || []).map((row: any) => ({
        stage: row.drop_off_stage as FunnelStage,
        reason: row.drop_off_reason as DropOffReason,
        count: row.count || 0,
        percentage: Math.round((row.percentage || 0) * 100) / 100,
        avgTimeBeforeDropOff: row.avg_time_before_dropoff,
        avgSelectedPrice: row.avg_selected_price,
        suggestions: suggestionsMap.get(row.drop_off_reason) || [],
      }));
    } catch (error) {
      log.error('Failed to get drop-off analysis:', error);
      throw error;
    }
  }

  /**
   * Get conversion rate by plan
   */
  async getConversionByPlan(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    planId: string;
    planName: string;
    visitors: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
  }>> {
    try {
      // Get all sessions with plan selection
      const { data: sessions, error } = await this.adminClient
        .from('payment_funnel_sessions')
        .select('selected_plan_id, is_converted, selected_price')
        .gte('first_event_at', startDate.toISOString())
        .lte('first_event_at', endDate.toISOString())
        .not('selected_plan_id', 'is', null);

      if (error) throw error;

      // Group by plan
      const planStats = new Map<string, {
        visitors: number;
        conversions: number;
        revenue: number;
      }>();

      for (const session of sessions || []) {
        const planId = session.selected_plan_id;
        if (!planId) continue;

        const stats = planStats.get(planId) || {
          visitors: 0,
          conversions: 0,
          revenue: 0,
        };

        stats.visitors++;
        if (session.is_converted) {
          stats.conversions++;
          stats.revenue += session.selected_price || 0;
        }

        planStats.set(planId, stats);
      }

      // Map to result
      const planNames: Record<string, string> = {
        free: '免费版',
        pro: '专业版',
        enterprise: '企业版',
      };

      return Array.from(planStats.entries()).map(([planId, stats]) => ({
        planId,
        planName: planNames[planId] || planId,
        visitors: stats.visitors,
        conversions: stats.conversions,
        conversionRate: stats.visitors > 0
          ? Math.round((stats.conversions / stats.visitors) * 100 * 100) / 100
          : 0,
        revenue: stats.revenue,
      }));
    } catch (error) {
      log.error('Failed to get conversion by plan:', error);
      throw error;
    }
  }

  /**
   * Get conversion rate by device type
   */
  async getConversionByDevice(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    deviceType: string;
    visitors: number;
    conversions: number;
    conversionRate: number;
  }>> {
    try {
      const { data: sessions, error } = await this.adminClient
        .from('payment_funnel_sessions')
        .select('device_type, is_converted')
        .gte('first_event_at', startDate.toISOString())
        .lte('first_event_at', endDate.toISOString())
        .not('device_type', 'is', null);

      if (error) throw error;

      const deviceStats = new Map<string, { visitors: number; conversions: number }>();

      for (const session of sessions || []) {
        const device = session.device_type || 'unknown';
        const stats = deviceStats.get(device) || { visitors: 0, conversions: 0 };
        stats.visitors++;
        if (session.is_converted) stats.conversions++;
        deviceStats.set(device, stats);
      }

      return Array.from(deviceStats.entries()).map(([deviceType, stats]) => ({
        deviceType,
        visitors: stats.visitors,
        conversions: stats.conversions,
        conversionRate: stats.visitors > 0
          ? Math.round((stats.conversions / stats.visitors) * 100 * 100) / 100
          : 0,
      }));
    } catch (error) {
      log.error('Failed to get conversion by device:', error);
      throw error;
    }
  }

  /**
   * Generate optimization suggestions based on funnel data
   */
  async generateOptimizationSuggestions(
    startDate: Date,
    endDate: Date
  ): Promise<OptimizationSuggestion[]> {
    try {
      const analysis = await this.getFunnelAnalysis(startDate, endDate);
      const dropOffAnalysis = await this.getDropOffAnalysis(startDate, endDate);
      const suggestions: OptimizationSuggestion[] = [];

      // Analyze each step for bottlenecks
      for (let i = 1; i < analysis.steps.length; i++) {
        const step = analysis.steps[i];
        const prevStep = analysis.steps[i - 1];

        if (step.dropOffRate > 30) {
          // High drop-off rate
          const reason = dropOffAnalysis.find(d => d.stage === step.stage);

          if (reason?.reason === 'price_concern') {
            suggestions.push({
              category: 'pricing',
              priority: 'high',
              description: `${STAGE_NAMES[step.stage]}阶段流失率高(${step.dropOffRate.toFixed(1)}%)，用户对价格有顾虑`,
              impact: '预计可提升转化率 5-10%',
              effort: '中等',
              actionable: true,
            });
          } else if (reason?.reason === 'complexity') {
            suggestions.push({
              category: 'ux',
              priority: 'high',
              description: `${STAGE_NAMES[step.stage]}阶段流程复杂导致流失`,
              impact: '预计可提升转化率 10-15%',
              effort: '低',
              actionable: true,
            });
          } else if (reason?.reason === 'trust_issue') {
            suggestions.push({
              category: 'trust',
              priority: 'critical',
              description: '用户对平台信任度不足',
              impact: '预计可提升转化率 15-20%',
              effort: '中等',
              actionable: true,
            });
          }
        }
      }

      // Check overall conversion rate
      if (analysis.overallConversionRate < 5) {
        suggestions.push({
          category: 'messaging',
          priority: 'critical',
          description: '整体转化率过低，建议优化价值主张和定价策略',
          impact: '预计可提升转化率 20-30%',
          effort: '高',
          actionable: true,
        });
      }

      // Check for technical issues
      const technicalIssues = dropOffAnalysis.filter(d => d.reason === 'technical_issue');
      if (technicalIssues.length > 0) {
        suggestions.push({
          category: 'technical',
          priority: 'critical',
          description: '发现技术问题导致支付失败，需要立即修复',
          impact: '预计可挽回 5-10% 流失用户',
          effort: '低',
          actionable: true,
        });
      }

      return suggestions;
    } catch (error) {
      log.error('Failed to generate optimization suggestions:', error);
      throw error;
    }
  }

  /**
   * Get A/B test results for payment experiments
   */
  async getABTestResults(
    experimentId: string
  ): Promise<{
    experimentId: string;
    status: string;
    variants: Array<{
      variantId: string;
      variantName: string;
      visitors: number;
      conversions: number;
      conversionRate: number;
      improvement: number;
      isSignificant: boolean;
    }>;
    winner?: string;
    recommendation: string;
  }> {
    try {
      // Get experiment details
      const { data: experiment, error: expError } = await this.adminClient
        .from('experiments')
        .select('*')
        .eq('id', experimentId)
        .single();

      if (expError) throw expError;

      // Get variant stats
      const { data: sessions, error: sessionError } = await this.adminClient
        .from('payment_funnel_sessions')
        .select('variant_id, is_converted')
        .eq('experiment_id', experimentId);

      if (sessionError) throw sessionError;

      // Get variant details
      const { data: variants } = await this.adminClient
        .from('experiment_variants')
        .select('*')
        .eq('experiment_id', experimentId);

      // Calculate stats per variant
      const variantStats = new Map<string, { visitors: number; conversions: number }>();

      for (const session of sessions || []) {
        const variantId = session.variant_id || 'control';
        const stats = variantStats.get(variantId) || { visitors: 0, conversions: 0 };
        stats.visitors++;
        if (session.is_converted) stats.conversions++;
        variantStats.set(variantId, stats);
      }

      // Build result
      const controlStats = variantStats.get('control') || { visitors: 0, conversions: 0 };
      const controlRate = controlStats.visitors > 0
        ? (controlStats.conversions / controlStats.visitors) * 100
        : 0;

      const variantResults = (variants || []).map(v => {
        const stats = variantStats.get(v.id) || { visitors: 0, conversions: 0 };
        const rate = stats.visitors > 0
          ? (stats.conversions / stats.visitors) * 100
          : 0;

        return {
          variantId: v.id,
          variantName: v.name,
          visitors: stats.visitors,
          conversions: stats.conversions,
          conversionRate: Math.round(rate * 100) / 100,
          improvement: controlRate > 0
            ? Math.round(((rate - controlRate) / controlRate) * 100 * 100) / 100
            : 0,
          isSignificant: stats.visitors >= 100, // Simplified significance check
        };
      });

      // Determine winner
      const sortedVariants = [...variantResults].sort((a, b) => b.conversionRate - a.conversionRate);
      const winner = sortedVariants[0]?.conversionRate > controlRate * 1.05
        ? sortedVariants[0]?.variantName
        : undefined;

      return {
        experimentId,
        status: experiment.status,
        variants: variantResults,
        winner,
        recommendation: winner
          ? `建议采用 ${winner} 方案，转化率提升 ${sortedVariants[0]?.improvement}%`
          : '暂无显著胜出方案，建议继续观察',
      };
    } catch (error) {
      log.error('Failed to get A/B test results:', error);
      throw error;
    }
  }

  /**
   * Calculate daily statistics
   */
  async calculateDailyStats(date: Date): Promise<void> {
    try {
      await this.adminClient.rpc('calculate_payment_funnel_stats', {
        p_date: date.toISOString().split('T')[0],
      });
      log.info('Calculated daily funnel stats', { date: date.toISOString().split('T')[0] });
    } catch (error) {
      log.error('Failed to calculate daily stats:', error);
      throw error;
    }
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<FunnelSession | null> {
    try {
      const { data, error } = await this.adminClient
        .from('payment_funnel_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return {
        sessionId: data.session_id,
        userId: data.user_id,
        completedStage: data.completed_stage,
        isConverted: data.is_converted,
        isDropped: data.is_dropped,
        dropOffStage: data.drop_off_stage,
        dropOffReason: data.drop_off_reason,
        selectedPlanId: data.selected_plan_id,
        selectedBillingPeriod: data.selected_billing_period,
        selectedPrice: data.selected_price,
        experimentId: data.experiment_id,
        variantId: data.variant_id,
        firstEventAt: new Date(data.first_event_at),
        lastEventAt: new Date(data.last_event_at),
        totalTimeSeconds: data.total_time_seconds,
      };
    } catch (error) {
      log.error('Failed to get session:', error);
      throw error;
    }
  }
}

// ==================== Singleton ====================

let paymentFunnelService: PaymentFunnelService | null = null;

export function getPaymentFunnelService(): PaymentFunnelService {
  if (!paymentFunnelService) {
    paymentFunnelService = new PaymentFunnelService();
  }
  return paymentFunnelService;
}

export default PaymentFunnelService;