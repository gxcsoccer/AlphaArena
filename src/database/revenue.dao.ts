/**
 * Revenue Analytics Data Access Object
 * Handles database operations for revenue analytics, metrics, and reporting
 */

import { getSupabaseAdminClient } from './client';
import { createLogger } from '../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';

const log = createLogger('RevenueDAO');

// Type definitions
export interface RevenueMetrics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  arpu: number; // Average Revenue Per User
  totalRevenue: number;
  activeSubscribers: number;
  trialUsers: number;
  churnRate: number;
  ltv: number; // Lifetime Value
  conversionRate: number;
}

export interface RevenueTrend {
  date: string;
  revenue: number;
  subscriptions: number;
  churned: number;
  newSubscribers: number;
}

export interface SubscriptionDistribution {
  planId: string;
  planName: string;
  count: number;
  percentage: number;
  revenue: number;
}

export interface ConversionFunnel {
  stage: string;
  count: number;
  percentage: number;
}

export interface ChurnData {
  month: string;
  churnedUsers: number;
  totalUsers: number;
  churnRate: number;
  topReasons: string[];
}

export interface RevenueExport {
  date: string;
  userId: string;
  userName: string;
  userEmail: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
}

export interface SubscriberExport {
  userId: string;
  userName: string;
  userEmail: string;
  planId: string;
  planName: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  stripeCustomerId: string;
  totalPayments: number;
  totalRevenue: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Revenue DAO Class
 * Uses admin client for all operations (admin-only data)
 */
export class RevenueDAO {
  private adminClient: SupabaseClient;

  constructor(adminClient: SupabaseClient) {
    this.adminClient = adminClient;
  }

  /**
   * Get overall revenue metrics
   */
  async getRevenueMetrics(): Promise<RevenueMetrics> {
    try {
      // Get active subscriptions
      const { data: activeSubs, error: subError } = await this.adminClient
        .from('user_subscriptions')
        .select('plan_id, status')
        .in('status', ['active', 'trialing']);

      if (subError) throw subError;

      // Get plan prices
      const { data: plans, error: planError } = await this.adminClient
        .from('subscription_plans')
        .select('id, name, price');

      if (planError) throw planError;

      const planMap = new Map(plans?.map(p => [p.id, { name: p.name, price: parseFloat(p.price) || 0 }]) || []);

      // Calculate MRR
      let mrr = 0;
      let activeCount = 0;
      let trialCount = 0;

      (activeSubs || []).forEach(sub => {
        const plan = planMap.get(sub.plan_id);
        if (plan) {
          if (sub.status === 'active') {
            mrr += plan.price;
            activeCount++;
          } else if (sub.status === 'trialing') {
            trialCount++;
          }
        }
      });

      // Get total revenue from payments
      const { data: payments, error: payError } = await this.adminClient
        .from('payment_history')
        .select('amount')
        .eq('status', 'succeeded');

      if (payError) throw payError;

      const totalRevenue = (payments || []).reduce((sum, p) => sum + (parseFloat(p.amount as any) || 0), 0);

      // Calculate ARPU
      const arpu = activeCount > 0 ? mrr / activeCount : 0;

      // Calculate ARR
      const arr = mrr * 12;

      // Get churn rate (users who canceled in the last 30 days / total active at start)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { data: churned, error: churnError } = await this.adminClient
        .from('subscription_history')
        .select('user_id')
        .eq('action', 'canceled')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (churnError) throw churnError;

      // Get total users at start of period
      const { count: totalUsersAtStart, error: countError } = await this.adminClient
        .from('user_subscriptions')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'expired');

      if (countError) throw countError;

      const churnRate = (totalUsersAtStart || 0) > 0 
        ? ((churned?.length || 0) / totalUsersAtStart!) * 100 
        : 0;

      // Calculate LTV (average customer lifetime in months * ARPU)
      // Average customer lifetime = 1 / churn rate (if churn rate > 0)
      const avgLifetimeMonths = churnRate > 0 ? 100 / churnRate : 12; // Default to 12 months if no churn
      const ltv = arpu * avgLifetimeMonths;

      // Calculate conversion rate (trial to paid)
      const { data: trials, error: trialError } = await this.adminClient
        .from('subscription_history')
        .select('user_id')
        .eq('action', 'trial_started');

      if (trialError) throw trialError;

      const { data: converted, error: convError } = await this.adminClient
        .from('subscription_history')
        .select('user_id')
        .in('action', ['upgraded', 'created'])
        .neq('to_plan', 'free');

      if (convError) throw convError;

      const conversionRate = (trials?.length || 0) > 0 
        ? ((converted?.length || 0) / trials!.length) * 100 
        : 0;

      return {
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(arr * 100) / 100,
        arpu: Math.round(arpu * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        activeSubscribers: activeCount,
        trialUsers: trialCount,
        churnRate: Math.round(churnRate * 100) / 100,
        ltv: Math.round(ltv * 100) / 100,
        conversionRate: Math.round(conversionRate * 100) / 100,
      };
    } catch (error) {
      log.error('Failed to get revenue metrics:', error);
      throw error;
    }
  }

  /**
   * Get revenue trend data
   */
  async getRevenueTrend(range: DateRange, granularity: 'day' | 'week' | 'month' = 'day'): Promise<RevenueTrend[]> {
    try {
      const { startDate, endDate } = range;
      
      // Get all payments in range
      const { data: payments, error: payError } = await this.adminClient
        .from('payment_history')
        .select('amount, paid_at, status')
        .eq('status', 'succeeded')
        .gte('paid_at', startDate.toISOString())
        .lte('paid_at', endDate.toISOString())
        .order('paid_at', { ascending: true });

      if (payError) throw payError;

      // Get subscription history
      const { data: history, error: histError } = await this.adminClient
        .from('subscription_history')
        .select('action, created_at')
        .in('action', ['created', 'upgraded', 'canceled'])
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (histError) throw histError;

      // Group by date based on granularity
      const groupedData = new Map<string, { revenue: number; subscriptions: number; churned: number; newSubscribers: number }>();

      const formatDate = (date: Date): string => {
        if (granularity === 'month') {
          return date.toISOString().slice(0, 7); // YYYY-MM
        } else if (granularity === 'week') {
          const d = new Date(date);
          d.setDate(d.getDate() - d.getDay()); // Start of week
          return d.toISOString().slice(0, 10);
        }
        return date.toISOString().slice(0, 10); // YYYY-MM-DD
      };

      // Initialize all dates in range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const key = formatDate(currentDate);
        if (!groupedData.has(key)) {
          groupedData.set(key, { revenue: 0, subscriptions: 0, churned: 0, newSubscribers: 0 });
        }
        if (granularity === 'month') {
          currentDate.setMonth(currentDate.getMonth() + 1);
        } else if (granularity === 'week') {
          currentDate.setDate(currentDate.getDate() + 7);
        } else {
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      // Aggregate payments
      (payments || []).forEach(payment => {
        if (payment.paid_at) {
          const key = formatDate(new Date(payment.paid_at));
          const data = groupedData.get(key);
          if (data) {
            data.revenue += parseFloat(payment.amount as any) || 0;
            data.subscriptions++;
          }
        }
      });

      // Aggregate subscription events
      (history || []).forEach(event => {
        if (event.created_at) {
          const key = formatDate(new Date(event.created_at));
          const data = groupedData.get(key);
          if (data) {
            if (event.action === 'canceled') {
              data.churned++;
            } else {
              data.newSubscribers++;
            }
          }
        }
      });

      // Convert to array and sort
      const result = Array.from(groupedData.entries())
        .map(([date, data]) => ({
          date,
          revenue: Math.round(data.revenue * 100) / 100,
          subscriptions: data.subscriptions,
          churned: data.churned,
          newSubscribers: data.newSubscribers,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return result;
    } catch (error) {
      log.error('Failed to get revenue trend:', error);
      throw error;
    }
  }

  /**
   * Get subscription distribution by plan
   */
  async getSubscriptionDistribution(): Promise<SubscriptionDistribution[]> {
    try {
      // Get active subscriptions grouped by plan
      const { data: subs, error: subError } = await this.adminClient
        .from('user_subscriptions')
        .select('plan_id, status')
        .neq('status', 'expired');

      if (subError) throw subError;

      // Get plan details
      const { data: plans, error: planError } = await this.adminClient
        .from('subscription_plans')
        .select('id, name, price');

      if (planError) throw planError;

      const planMap = new Map(plans?.map(p => [p.id, { name: p.name, price: parseFloat(p.price) || 0 }]) || []);
      const totalUsers = (subs || []).length;

      // Count by plan
      const planCounts = new Map<string, { count: number; revenue: number }>();
      (subs || []).forEach(sub => {
        const plan = planMap.get(sub.plan_id);
        if (!planCounts.has(sub.plan_id)) {
          planCounts.set(sub.plan_id, { count: 0, revenue: 0 });
        }
        const data = planCounts.get(sub.plan_id)!;
        data.count++;
        if (plan && sub.status === 'active') {
          data.revenue += plan.price;
        }
      });

      // Convert to array
      const result: SubscriptionDistribution[] = [];
      planCounts.forEach((data, planId) => {
        const plan = planMap.get(planId);
        result.push({
          planId,
          planName: plan?.name || planId,
          count: data.count,
          percentage: totalUsers > 0 ? Math.round((data.count / totalUsers) * 10000) / 100 : 0,
          revenue: Math.round(data.revenue * 100) / 100,
        });
      });

      return result.sort((a, b) => b.count - a.count);
    } catch (error) {
      log.error('Failed to get subscription distribution:', error);
      throw error;
    }
  }

  /**
   * Get conversion funnel data
   */
  async getConversionFunnel(): Promise<ConversionFunnel[]> {
    try {
      // Get total registered users
      const { count: totalUsers, error: userError } = await this.adminClient
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (userError) throw userError;

      // Get users who started a trial
      const { data: trialStarts, error: trialError } = await this.adminClient
        .from('subscription_history')
        .select('user_id')
        .eq('action', 'trial_started');

      if (trialError) throw trialError;

      const uniqueTrialUsers = new Set(trialStarts?.map(t => t.user_id) || []);

      // Get users who became active subscribers
      const { data: activeSubs, error: subError } = await this.adminClient
        .from('user_subscriptions')
        .select('user_id')
        .eq('status', 'active');

      if (subError) throw subError;

      const uniqueSubscribers = new Set(activeSubs?.map(s => s.user_id) || []);

      // Get users who are on paid plans
      const { data: paidSubs, error: paidError } = await this.adminClient
        .from('user_subscriptions')
        .select('user_id, plan_id')
        .eq('status', 'active')
        .neq('plan_id', 'free');

      if (paidError) throw paidError;

      const uniquePaidSubscribers = new Set(paidSubs?.map(s => s.user_id) || []);

      const total = totalUsers || 1;

      return [
        {
          stage: '注册用户',
          count: totalUsers || 0,
          percentage: 100,
        },
        {
          stage: '试用用户',
          count: uniqueTrialUsers.size,
          percentage: Math.round((uniqueTrialUsers.size / total) * 10000) / 100,
        },
        {
          stage: '活跃订阅',
          count: uniqueSubscribers.size,
          percentage: Math.round((uniqueSubscribers.size / total) * 10000) / 100,
        },
        {
          stage: '付费用户',
          count: uniquePaidSubscribers.size,
          percentage: Math.round((uniquePaidSubscribers.size / total) * 10000) / 100,
        },
      ];
    } catch (error) {
      log.error('Failed to get conversion funnel:', error);
      throw error;
    }
  }

  /**
   * Get churn analysis data
   */
  async getChurnAnalysis(months: number = 12): Promise<ChurnData[]> {
    try {
      const result: ChurnData[] = [];
      const now = new Date();

      for (let i = 0; i < months; i++) {
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
        const monthKey = monthEnd.toISOString().slice(0, 7);

        // Get churned users for this month
        const { data: churned, error: churnError } = await this.adminClient
          .from('subscription_history')
          .select('user_id, reason')
          .eq('action', 'canceled')
          .gte('created_at', monthStart.toISOString())
          .lt('created_at', monthEnd.toISOString());

        if (churnError) throw churnError;

        // Get total users at start of month
        const { count: totalUsers, error: countError } = await this.adminClient
          .from('user_subscriptions')
          .select('*', { count: 'exact', head: true })
          .lt('created_at', monthEnd.toISOString())
          .neq('status', 'expired');

        if (countError) throw countError;

        // Get top cancellation reasons
        const reasons = (churned || [])
          .map(c => c.reason)
          .filter(Boolean) as string[];

        const reasonCounts = new Map<string, number>();
        reasons.forEach(r => {
          reasonCounts.set(r, (reasonCounts.get(r) || 0) + 1);
        });

        const topReasons = Array.from(reasonCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([reason]) => reason);

        result.push({
          month: monthKey,
          churnedUsers: churned?.length || 0,
          totalUsers: totalUsers || 0,
          churnRate: (totalUsers ?? 0) > 0 
            ? Math.round(((churned?.length || 0) / (totalUsers ?? 1)) * 10000) / 100 
            : 0,
          topReasons,
        });
      }

      return result.reverse();
    } catch (error) {
      log.error('Failed to get churn analysis:', error);
      throw error;
    }
  }

  /**
   * Export revenue data as CSV
   */
  async exportRevenueData(range: DateRange): Promise<RevenueExport[]> {
    try {
      const { startDate, endDate } = range;

      // Get payments with user info
      const { data: payments, error: payError } = await this.adminClient
        .from('payment_history')
        .select(`
          id,
          user_id,
          amount,
          currency,
          status,
          plan_id,
          paid_at,
          stripe_customer_id,
          stripe_invoice_id
        `)
        .gte('paid_at', startDate.toISOString())
        .lte('paid_at', endDate.toISOString())
        .order('paid_at', { ascending: false });

      if (payError) throw payError;

      // Get user info
      const userIds = [...new Set((payments || []).map(p => p.user_id))];
      const { data: users, error: userError } = await this.adminClient
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      if (userError) throw userError;

      const userMap = new Map(users?.map(u => [u.id, u]) || []);

      // Get plan info
      const { data: plans, error: planError } = await this.adminClient
        .from('subscription_plans')
        .select('id, name');

      if (planError) throw planError;

      const planMap = new Map(plans?.map(p => [p.id, p.name]) || []);

      return (payments || []).map(payment => {
        const user = userMap.get(payment.user_id);
        return {
          date: payment.paid_at ? new Date(payment.paid_at).toISOString() : '',
          userId: payment.user_id,
          userName: user?.name || '',
          userEmail: user?.email || '',
          planId: payment.plan_id || '',
          planName: planMap.get(payment.plan_id || '') || payment.plan_id || '',
          amount: parseFloat(payment.amount as any) || 0,
          currency: payment.currency || 'CNY',
          status: payment.status,
          paymentMethod: payment.stripe_customer_id ? 'Stripe' : 'Unknown',
        };
      });
    } catch (error) {
      log.error('Failed to export revenue data:', error);
      throw error;
    }
  }

  /**
   * Export subscriber list
   */
  async exportSubscriberList(): Promise<SubscriberExport[]> {
    try {
      // Get all active subscriptions
      const { data: subs, error: subError } = await this.adminClient
        .from('user_subscriptions')
        .select(`
          user_id,
          plan_id,
          status,
          current_period_start,
          current_period_end,
          stripe_customer_id
        `)
        .neq('status', 'expired');

      if (subError) throw subError;

      // Get user info
      const userIds = [...new Set((subs || []).map(s => s.user_id))];
      const { data: users, error: userError } = await this.adminClient
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      if (userError) throw userError;

      const userMap = new Map(users?.map(u => [u.id, u]) || []);

      // Get plan info
      const { data: plans, error: planError } = await this.adminClient
        .from('subscription_plans')
        .select('id, name');

      if (planError) throw planError;

      const planMap = new Map(plans?.map(p => [p.id, p.name]) || []);

      // Get payment totals per user
      const { data: payments, error: payError } = await this.adminClient
        .from('payment_history')
        .select('user_id, amount, status')
        .eq('status', 'succeeded');

      if (payError) throw payError;

      const paymentTotals = new Map<string, { count: number; total: number }>();
      (payments || []).forEach(p => {
        const existing = paymentTotals.get(p.user_id) || { count: 0, total: 0 };
        existing.count++;
        existing.total += parseFloat(p.amount as any) || 0;
        paymentTotals.set(p.user_id, existing);
      });

      return (subs || []).map(sub => {
        const user = userMap.get(sub.user_id);
        const paymentData = paymentTotals.get(sub.user_id) || { count: 0, total: 0 };
        
        return {
          userId: sub.user_id,
          userName: user?.name || '',
          userEmail: user?.email || '',
          planId: sub.plan_id,
          planName: planMap.get(sub.plan_id) || sub.plan_id,
          status: sub.status,
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end,
          stripeCustomerId: sub.stripe_customer_id || '',
          totalPayments: paymentData.count,
          totalRevenue: Math.round(paymentData.total * 100) / 100,
        };
      });
    } catch (error) {
      log.error('Failed to export subscriber list:', error);
      throw error;
    }
  }

  /**
   * Get revenue by time period (for charts)
   */
  async getRevenueByPeriod(
    range: DateRange,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<{ period: string; revenue: number; count: number }[]> {
    try {
      const { startDate, endDate } = range;
      
      const { data: payments, error } = await this.adminClient
        .from('payment_history')
        .select('amount, paid_at')
        .eq('status', 'succeeded')
        .gte('paid_at', startDate.toISOString())
        .lte('paid_at', endDate.toISOString())
        .order('paid_at', { ascending: true });

      if (error) throw error;

      const grouped = new Map<string, { revenue: number; count: number }>();

      const getPeriodKey = (date: Date): string => {
        if (groupBy === 'month') {
          return date.toISOString().slice(0, 7);
        } else if (groupBy === 'week') {
          const d = new Date(date);
          d.setDate(d.getDate() - d.getDay());
          return d.toISOString().slice(0, 10);
        }
        return date.toISOString().slice(0, 10);
      };

      (payments || []).forEach(payment => {
        if (payment.paid_at) {
          const key = getPeriodKey(new Date(payment.paid_at));
          const existing = grouped.get(key) || { revenue: 0, count: 0 };
          existing.revenue += parseFloat(payment.amount as any) || 0;
          existing.count++;
          grouped.set(key, existing);
        }
      });

      return Array.from(grouped.entries())
        .map(([period, data]) => ({
          period,
          revenue: Math.round(data.revenue * 100) / 100,
          count: data.count,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
    } catch (error) {
      log.error('Failed to get revenue by period:', error);
      throw error;
    }
  }
}

// Singleton instance
let revenueDAO: RevenueDAO | null = null;

export function getRevenueDAO(): RevenueDAO {
  if (!revenueDAO) {
    revenueDAO = new RevenueDAO(getSupabaseAdminClient());
  }
  return revenueDAO;
}