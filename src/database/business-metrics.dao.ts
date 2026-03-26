/**
 * Business Metrics Data Access Object
 * Handles database operations for business metrics (MRR, ARPU, LTV, etc.)
 */

import { getSupabaseClient, getSupabaseAdminClient } from './client';
import { createLogger } from '../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';

const log = createLogger('BusinessMetricsDAO');

// ============================================
// Types
// ============================================

export interface ConversionFunnelStep {
  step: string;
  order: number;
  count: number;
  cumulativeCount: number;
  conversionRate: number;
  dropOffRate: number;
  avgTimeToNext?: number; // in hours
}

export interface ConversionFunnel {
  name: string;
  period: { start: Date; end: Date };
  steps: ConversionFunnelStep[];
  totalUsers: number;
  completedUsers: number;
  overallConversionRate: number;
}

export interface DAUMAUMetric {
  date: string;
  dau: number;
  mau: number;
  stickiness: number; // DAU/MAU ratio
}

export interface RetentionCohort {
  cohortDate: string;
  cohortSize: number;
  retentionRates: {
    day1?: number;
    day3?: number;
    day7?: number;
    day14?: number;
    day30?: number;
    day60?: number;
    day90?: number;
  };
}

export interface RetentionData {
  cohorts: RetentionCohort[];
  avgDay1Retention: number;
  avgDay7Retention: number;
  avgDay30Retention: number;
}

export interface MRRData {
  date: string;
  mrr: number;
  newMrr: number;
  expansionMrr: number;
  contractionMrr: number;
  churnedMrr: number;
  netNewMrr: number;
}

export interface ARPUData {
  date: string;
  arpu: number;
  arpuFree: number;
  arpuPaid: number;
}

export interface LTVData {
  cohortMonth: string;
  ltv30d: number;
  ltv90d: number;
  ltvLifetime: number;
  userCount: number;
}

export interface RevenueMetrics {
  mrr: number;
  mrrGrowth: number;
  arr: number;
  arpu: number;
  ltv: number;
  customerCount: number;
  payingCustomerCount: number;
}

export interface BusinessMetricsFilter {
  startDate?: Date;
  endDate?: Date;
  granularity?: 'day' | 'week' | 'month';
}

// ============================================
// DAO Class
// ============================================

export class BusinessMetricsDAO {
  private anonClient: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor(anonClient: SupabaseClient, adminClient: SupabaseClient) {
    this.anonClient = anonClient;
    this.adminClient = adminClient;
  }

  // ==================== Conversion Funnel ====================

  /**
   * Get subscription conversion funnel
   * 访问 → 注册 → 试用 → 付费
   */
  async getConversionFunnel(
    startDate: Date,
    endDate: Date
  ): Promise<ConversionFunnel> {
    const supabase = this.adminClient;

    // Define funnel steps with their event types
    const steps = [
      { name: '访问', eventType: 'page_view', category: 'engagement' },
      { name: '注册', eventType: 'user_signup', category: 'auth' },
      { name: '试用', eventType: 'trial_started', category: 'subscription' },
      { name: '付费', eventType: 'subscription_started', category: 'subscription' },
    ];

    // Get visitor count (unique sessions)
    const { data: visitors } = await supabase
      .from('user_tracking_events')
      .select('session_id')
      .eq('event_type', 'page_view')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString())
      .not('session_id', 'is', null);

    const visitorCount = visitors ? new Set(visitors.map(v => v.session_id)).size : 0;

    // Get signups
    const { data: signups } = await supabase
      .from('user_tracking_events')
      .select('user_id')
      .eq('event_type', 'user_signup')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString())
      .not('user_id', 'is', null);

    const signupUserIds = signups ? [...new Set(signups.map(s => s.user_id))] : [];

    // Get trials (users who started trial)
    const { data: trials } = await supabase
      .from('user_tracking_events')
      .select('user_id')
      .eq('event_type', 'trial_started')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString())
      .not('user_id', 'is', null);

    const trialUserIds = trials ? [...new Set(trials.map(t => t.user_id))] : [];

    // Get subscriptions (users who converted to paid)
    const { data: subscriptions } = await supabase
      .from('user_tracking_events')
      .select('user_id')
      .eq('event_type', 'subscription_started')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString())
      .not('user_id', 'is', null);

    const subscriptionUserIds = subscriptions ? [...new Set(subscriptions.map(s => s.user_id))] : [];

    // Build funnel steps
    const funnelSteps: ConversionFunnelStep[] = [
      {
        step: '访问',
        order: 0,
        count: visitorCount,
        cumulativeCount: visitorCount,
        conversionRate: 100,
        dropOffRate: 0,
      },
      {
        step: '注册',
        order: 1,
        count: signupUserIds.length,
        cumulativeCount: signupUserIds.length,
        conversionRate: visitorCount > 0 ? (signupUserIds.length / visitorCount) * 100 : 0,
        dropOffRate: visitorCount > 0 ? ((visitorCount - signupUserIds.length) / visitorCount) * 100 : 0,
      },
      {
        step: '试用',
        order: 2,
        count: trialUserIds.length,
        cumulativeCount: trialUserIds.length,
        conversionRate: signupUserIds.length > 0 ? (trialUserIds.length / signupUserIds.length) * 100 : 0,
        dropOffRate: signupUserIds.length > 0 ? ((signupUserIds.length - trialUserIds.length) / signupUserIds.length) * 100 : 0,
      },
      {
        step: '付费',
        order: 3,
        count: subscriptionUserIds.length,
        cumulativeCount: subscriptionUserIds.length,
        conversionRate: trialUserIds.length > 0 ? (subscriptionUserIds.length / trialUserIds.length) * 100 : 0,
        dropOffRate: trialUserIds.length > 0 ? ((trialUserIds.length - subscriptionUserIds.length) / trialUserIds.length) * 100 : 0,
      },
    ];

    return {
      name: 'subscription_conversion',
      period: { start: startDate, end: endDate },
      steps: funnelSteps,
      totalUsers: visitorCount,
      completedUsers: subscriptionUserIds.length,
      overallConversionRate: visitorCount > 0 ? (subscriptionUserIds.length / visitorCount) * 100 : 0,
    };
  }

  // ==================== DAU/MAU ====================

  /**
   * Get DAU/MAU metrics for a date range
   */
  async getDAUMAUData(
    startDate: Date,
    endDate: Date
  ): Promise<DAUMAUMetric[]> {
    const supabase = this.adminClient;
    const results: DAUMAUMetric[] = [];

    // Get daily active users
    const { data: dailyData, error } = await supabase
      .from('daily_analytics_summary')
      .select('date, unique_visitors')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      log.warn('Could not fetch daily analytics, calculating from events:', error.message);
      return this.calculateDAUMAUFromEvents(startDate, endDate);
    }

    for (const row of dailyData || []) {
      const dau = row.unique_visitors || 0;
      
      // Calculate MAU (rolling 30-day window)
      const date = new Date(row.date);
      const mauStartDate = new Date(date);
      mauStartDate.setDate(mauStartDate.getDate() - 30);

      const { data: mauData } = await supabase
        .from('user_tracking_events')
        .select('user_id')
        .gte('occurred_at', mauStartDate.toISOString())
        .lte('occurred_at', date.toISOString())
        .not('user_id', 'is', null);

      const mau = mauData ? new Set(mauData.map(d => d.user_id)).size : 0;
      const stickiness = mau > 0 ? (dau / mau) * 100 : 0;

      results.push({
        date: row.date,
        dau,
        mau,
        stickiness,
      });
    }

    return results;
  }

  /**
   * Calculate DAU/MAU from raw events (fallback)
   */
  private async calculateDAUMAUFromEvents(
    startDate: Date,
    endDate: Date
  ): Promise<DAUMAUMetric[]> {
    const supabase = this.adminClient;
    const results: DAUMAUMetric[] = [];

    // Get all events in the period
    const { data: events } = await supabase
      .from('user_tracking_events')
      .select('user_id, occurred_at')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString())
      .not('user_id', 'is', null);

    // Group by date
    const byDate = new Map<string, Set<string>>();
    for (const event of events || []) {
      const date = new Date(event.occurred_at).toISOString().split('T')[0];
      if (!byDate.has(date)) {
        byDate.set(date, new Set());
      }
      byDate.get(date)!.add(event.user_id);
    }

    // Calculate DAU/MAU for each date
    for (const [date, users] of byDate) {
      const dau = users.size;
      
      // Get MAU (users active in last 30 days)
      const dateObj = new Date(date);
      const mauStart = new Date(dateObj);
      mauStart.setDate(mauStart.getDate() - 30);

      const { data: mauEvents } = await supabase
        .from('user_tracking_events')
        .select('user_id')
        .gte('occurred_at', mauStart.toISOString())
        .lte('occurred_at', dateObj.toISOString())
        .not('user_id', 'is', null);

      const mau = mauEvents ? new Set(mauEvents.map(e => e.user_id)).size : 0;
      const stickiness = mau > 0 ? (dau / mau) * 100 : 0;

      results.push({ date, dau, mau, stickiness });
    }

    return results.sort((a, b) => a.date.localeCompare(b.date));
  }

  // ==================== Retention ====================

  /**
   * Get retention cohorts
   */
  async getRetentionData(
    startDate: Date,
    endDate: Date
  ): Promise<RetentionData> {
    const supabase = this.adminClient;

    // Get all users who signed up in the period
    const { data: signups } = await supabase
      .from('user_tracking_events')
      .select('user_id, occurred_at')
      .eq('event_type', 'user_signup')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString())
      .not('user_id', 'is', null);

    const cohorts: RetentionCohort[] = [];

    // Group users by signup date (cohort)
    const cohortMap = new Map<string, string[]>();
    for (const signup of signups || []) {
      const date = new Date(signup.occurred_at).toISOString().split('T')[0];
      if (!cohortMap.has(date)) {
        cohortMap.set(date, []);
      }
      cohortMap.get(date)!.push(signup.user_id);
    }

    // Calculate retention for each cohort
    for (const [cohortDate, userIds] of cohortMap) {
      if (userIds.length === 0) continue;

      const cohortSize = userIds.length;
      const retentionRates: RetentionCohort['retentionRates'] = {};

      // Check retention at different intervals
      const checkRetention = async (days: number): Promise<number> => {
        const cohortDateObj = new Date(cohortDate);
        const checkDate = new Date(cohortDateObj);
        checkDate.setDate(checkDate.getDate() + days);

        const { data: returnedUsers } = await supabase
          .from('user_tracking_events')
          .select('user_id')
          .in('user_id', userIds)
          .gte('occurred_at', checkDate.toISOString())
          .lte('occurred_at', new Date(checkDate.getTime() + 24 * 60 * 60 * 1000).toISOString());

        const returned = returnedUsers ? new Set(returnedUsers.map(u => u.user_id)).size : 0;
        return (returned / cohortSize) * 100;
      };

      // Calculate retention for each interval
      const now = new Date();
      const cohortAge = Math.floor((now.getTime() - new Date(cohortDate).getTime()) / (24 * 60 * 60 * 1000));

      if (cohortAge >= 1) retentionRates.day1 = await checkRetention(1);
      if (cohortAge >= 3) retentionRates.day3 = await checkRetention(3);
      if (cohortAge >= 7) retentionRates.day7 = await checkRetention(7);
      if (cohortAge >= 14) retentionRates.day14 = await checkRetention(14);
      if (cohortAge >= 30) retentionRates.day30 = await checkRetention(30);
      if (cohortAge >= 60) retentionRates.day60 = await checkRetention(60);
      if (cohortAge >= 90) retentionRates.day90 = await checkRetention(90);

      cohorts.push({
        cohortDate,
        cohortSize,
        retentionRates,
      });
    }

    // Calculate averages
    const avgDay1 = this.calculateAvgRetention(cohorts, 'day1');
    const avgDay7 = this.calculateAvgRetention(cohorts, 'day7');
    const avgDay30 = this.calculateAvgRetention(cohorts, 'day30');

    return {
      cohorts: cohorts.sort((a, b) => a.cohortDate.localeCompare(b.cohortDate)),
      avgDay1Retention: avgDay1,
      avgDay7Retention: avgDay7,
      avgDay30Retention: avgDay30,
    };
  }

  private calculateAvgRetention(cohorts: RetentionCohort[], key: keyof RetentionCohort['retentionRates']): number {
    const values = cohorts
      .map(c => c.retentionRates[key])
      .filter((v): v is number => v !== undefined);

    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  // ==================== Revenue Metrics ====================

  /**
   * Get MRR (Monthly Recurring Revenue) data
   */
  async getMRRData(startDate: Date, endDate: Date): Promise<MRRData[]> {
    const supabase = this.adminClient;
    const results: MRRData[] = [];

    // Get subscription plans with prices
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('id, name, price, billing_interval')
      .eq('is_active', true);

    const planPrices = new Map<string, number>();
    for (const plan of plans || []) {
      const price = typeof plan.price === 'string' ? parseFloat(plan.price) : plan.price;
      // Normalize to monthly
      if (plan.billing_interval === 'year') {
        planPrices.set(plan.id, price / 12);
      } else {
        planPrices.set(plan.id, price);
      }
    }

    // Get daily subscription snapshots
    const { data: subscriptions } = await supabase
      .from('user_subscriptions')
      .select('user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Calculate MRR by date
    const dateSet = new Set<string>();
    const now = new Date();

    for (let d = new Date(startDate); d <= endDate && d <= now; d.setDate(d.getDate() + 1)) {
      dateSet.add(d.toISOString().split('T')[0]);
    }

    for (const date of Array.from(dateSet).sort()) {
      const dateObj = new Date(date);

      // Get active subscriptions on this date
      const { data: activeSubs } = await supabase
        .from('user_subscriptions')
        .select('plan_id')
        .eq('status', 'active')
        .lte('current_period_start', dateObj.toISOString())
        .gte('current_period_end', dateObj.toISOString());

      let mrr = 0;
      for (const sub of activeSubs || []) {
        mrr += planPrices.get(sub.plan_id) || 0;
      }

      results.push({
        date,
        mrr,
        newMrr: 0, // Would need historical tracking
        expansionMrr: 0,
        contractionMrr: 0,
        churnedMrr: 0,
        netNewMrr: 0,
      });
    }

    return results;
  }

  /**
   * Get ARPU (Average Revenue Per User)
   */
  async getARPUData(startDate: Date, endDate: Date): Promise<ARPUData[]> {
    const supabase = this.adminClient;
    const results: ARPUData[] = [];

    // Get MRR data
    const mrrData = await this.getMRRData(startDate, endDate);

    for (const mrr of mrrData) {
      // Get total users
      const { count: totalUsers } = await supabase
        .from('user_tracking_events')
        .select('user_id', { count: 'exact', head: true })
        .lte('occurred_at', new Date(mrr.date).toISOString());

      // Get paying users
      const { count: payingUsers } = await supabase
        .from('user_subscriptions')
        .select('user_id', { count: 'exact', head: true })
        .eq('status', 'active')
        .lte('current_period_start', new Date(mrr.date).toISOString());

      const freeUsers = (totalUsers ?? 0) - (payingUsers ?? 0);

      results.push({
        date: mrr.date,
        arpu: (totalUsers ?? 0) > 0 ? mrr.mrr / (totalUsers ?? 1) : 0,
        arpuFree: 0,
        arpuPaid: (payingUsers ?? 0) > 0 ? mrr.mrr / (payingUsers ?? 1) : 0,
      });
    }

    return results;
  }

  /**
   * Get LTV (Lifetime Value) by cohort
   */
  async getLTVData(startDate: Date, endDate: Date): Promise<LTVData[]> {
    const supabase = this.adminClient;
    const results: LTVData[] = [];

    // Get users grouped by signup month
    const { data: signups } = await supabase
      .from('user_tracking_events')
      .select('user_id, occurred_at')
      .eq('event_type', 'user_signup')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString());

    // Group by month
    const cohortMap = new Map<string, string[]>();
    for (const signup of signups || []) {
      const month = new Date(signup.occurred_at).toISOString().slice(0, 7); // YYYY-MM
      if (!cohortMap.has(month)) {
        cohortMap.set(month, []);
      }
      cohortMap.get(month)!.push(signup.user_id);
    }

    // Calculate LTV for each cohort
    for (const [cohortMonth, userIds] of cohortMap) {
      // Get total revenue from this cohort
      const { data: subscriptions } = await supabase
        .from('user_subscriptions')
        .select('plan_id, current_period_start, current_period_end')
        .in('user_id', userIds)
        .eq('status', 'active');

      // Calculate LTV (simplified: average monthly revenue * expected lifetime)
      const now = new Date();
      const cohortStart = new Date(cohortMonth + '-01');
      const cohortAge = Math.floor((now.getTime() - cohortStart.getTime()) / (30 * 24 * 60 * 60 * 1000));

      // Get plan prices
      const { data: plans } = await supabase
        .from('subscription_plans')
        .select('id, price, billing_interval');

      const planPrices = new Map<string, number>();
      for (const plan of plans || []) {
        const price = typeof plan.price === 'string' ? parseFloat(plan.price) : plan.price;
        planPrices.set(plan.id, plan.billing_interval === 'year' ? price / 12 : price);
      }

      let totalRevenue = 0;
      for (const sub of subscriptions || []) {
        totalRevenue += planPrices.get(sub.plan_id) || 0;
      }

      const avgRevenuePerUser = userIds.length > 0 ? totalRevenue / userIds.length : 0;

      // Estimate LTV (simplified)
      const ltv30d = avgRevenuePerUser * 1;
      const ltv90d = avgRevenuePerUser * 3;
      const ltvLifetime = avgRevenuePerUser * 24; // Assume 24-month lifetime

      results.push({
        cohortMonth,
        ltv30d,
        ltv90d,
        ltvLifetime,
        userCount: userIds.length,
      });
    }

    return results.sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));
  }

  /**
   * Get overall revenue metrics
   */
  async getRevenueMetrics(): Promise<RevenueMetrics> {
    const supabase = this.adminClient;

    // Get active subscriptions
    const { data: subscriptions } = await supabase
      .from('user_subscriptions')
      .select('user_id, plan_id')
      .eq('status', 'active');

    // Get plan prices
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('id, price, billing_interval');

    const planPrices = new Map<string, number>();
    for (const plan of plans || []) {
      const price = typeof plan.price === 'string' ? parseFloat(plan.price) : plan.price;
      planPrices.set(plan.id, plan.billing_interval === 'year' ? price / 12 : price);
    }

    let mrr = 0;
    const payingCustomerIds = new Set<string>();

    for (const sub of subscriptions || []) {
      mrr += planPrices.get(sub.plan_id) || 0;
      payingCustomerIds.add(sub.user_id);
    }

    // Get total customer count
    const { count: totalCustomers } = await supabase
      .from('user_tracking_events')
      .select('user_id', { count: 'exact', head: true })
      .eq('event_type', 'user_signup');

    const payingCustomerCount = payingCustomerIds.size;
    const arpu = (totalCustomers ?? 0) > 0 ? mrr / (totalCustomers ?? 1) : 0;

    // Calculate MRR growth (compare with last month)
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Simplified: assume 10% growth for demo
    const mrrGrowth = 10;

    return {
      mrr,
      mrrGrowth,
      arr: mrr * 12,
      arpu,
      ltv: arpu * 24, // Simplified LTV calculation
      customerCount: totalCustomers ?? 0,
      payingCustomerCount,
    };
  }

  /**
   * Get hourly activity distribution
   */
  async getHourlyActivity(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ hour: number; count: number; uniqueUsers: number }>> {
    const supabase = this.adminClient;

    const { data: events } = await supabase
      .from('user_tracking_events')
      .select('user_id, occurred_at')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString());

    const hourlyData = new Map<number, { count: number; users: Set<string> }>();

    for (let i = 0; i < 24; i++) {
      hourlyData.set(i, { count: 0, users: new Set() });
    }

    for (const event of events || []) {
      const hour = new Date(event.occurred_at).getHours();
      const data = hourlyData.get(hour)!;
      data.count++;
      if (event.user_id) data.users.add(event.user_id);
    }

    return Array.from(hourlyData.entries())
      .map(([hour, data]) => ({
        hour,
        count: data.count,
        uniqueUsers: data.users.size,
      }))
      .sort((a, b) => a.hour - b.hour);
  }
}

// Singleton instance
let businessMetricsDAO: BusinessMetricsDAO | null = null;

export function getBusinessMetricsDAO(): BusinessMetricsDAO {
  if (!businessMetricsDAO) {
    businessMetricsDAO = new BusinessMetricsDAO(getSupabaseClient(), getSupabaseAdminClient());
  }
  return businessMetricsDAO;
}

export default BusinessMetricsDAO;