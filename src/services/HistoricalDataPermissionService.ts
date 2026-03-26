/**
 * Historical Data Permission Service
 * Controls access to historical data based on subscription tier
 * 
 * Free: 7 days
 * Pro: 30 days
 * Enterprise: Unlimited
 */

import { getSupabaseClient } from '../database/client';
import { createLogger } from '../utils/logger';
import { SubscriptionPlan, PLAN_HIERARCHY } from '../types/subscription.types';

const log = createLogger('HistoricalDataPermissionService');

// Data limits by plan
const HISTORICAL_DATA_LIMITS: Record<SubscriptionPlan, number> = {
  free: 7, // 7 days
  pro: 30, // 30 days
  enterprise: -1, // unlimited
};

export interface DataPermissionResult {
  allowed: boolean;
  maxDays: number;
  requestedDays: number;
  message?: string;
}

/**
 * Get user's subscription plan
 */
export async function getUserPlan(userId: string): Promise<SubscriptionPlan> {
  try {
    const supabase = getSupabaseClient();
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select('plan_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !subscription) {
      return 'free';
    }

    return subscription.plan_id as SubscriptionPlan;
  } catch (error) {
    log.error('Failed to get user plan:', error);
    return 'free';
  }
}

/**
 * Get maximum historical data days for a plan
 */
export function getMaxHistoricalDays(plan: SubscriptionPlan): number {
  return HISTORICAL_DATA_LIMITS[plan];
}

/**
 * Calculate days between two dates
 */
export function calculateDaysBetween(startDate: Date, endDate: Date): number {
  const oneDay = 24 * 60 * 60 * 1000; // hours * minutes * seconds * milliseconds
  return Math.round(Math.abs((endDate.getTime() - startDate.getTime()) / oneDay));
}

/**
 * Check if user has permission to access historical data for the requested period
 */
export async function checkHistoricalDataPermission(
  userId: string,
  requestedStartTime: Date,
  requestedEndTime: Date = new Date()
): Promise<DataPermissionResult> {
  const plan = await getUserPlan(userId);
  const maxDays = getMaxHistoricalDays(plan);
  const requestedDays = calculateDaysBetween(requestedStartTime, requestedEndTime);

  // Enterprise users have unlimited access
  if (maxDays === -1) {
    return {
      allowed: true,
      maxDays: -1,
      requestedDays,
    };
  }

  // Check if requested period exceeds limit
  if (requestedDays > maxDays) {
    return {
      allowed: false,
      maxDays,
      requestedDays,
      message: `您的订阅计划仅允许访问 ${maxDays} 天的历史数据。请求的数据范围为 ${requestedDays} 天。请升级到更高级别的订阅计划以获取更多历史数据。`,
    };
  }

  return {
    allowed: true,
    maxDays,
    requestedDays,
  };
}

/**
 * Adjust date range to match user's subscription limits
 * Returns the adjusted start date
 */
export function adjustDateRangeToPlan(
  plan: SubscriptionPlan,
  requestedStartTime: Date,
  requestedEndTime: Date = new Date()
): Date {
  const maxDays = getMaxHistoricalDays(plan);
  
  // Unlimited access
  if (maxDays === -1) {
    return requestedStartTime;
  }

  const requestedDays = calculateDaysBetween(requestedStartTime, requestedEndTime);
  
  // If within limits, return original
  if (requestedDays <= maxDays) {
    return requestedStartTime;
  }

  // Adjust start date to only include allowed days
  const adjustedStartTime = new Date(requestedEndTime);
  adjustedStartTime.setDate(adjustedStartTime.getDate() - maxDays);
  
  log.info(`Adjusted date range for plan ${plan}: ${requestedStartTime.toISOString()} -> ${adjustedStartTime.toISOString()}`);
  
  return adjustedStartTime;
}

/**
 * Middleware for historical data API routes
 * Validates and adjusts data range based on user subscription
 */
export function createHistoricalDataMiddleware() {
  return async (req: any, res: any, next: any) => {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: '用户未登录',
      });
    }

    try {
      const plan = await getUserPlan(userId);
      const maxDays = getMaxHistoricalDays(plan);
      
      // Attach permission info to request
      req.dataPermission = {
        plan,
        maxDays,
        adjustDateRange: (startTime: Date, endTime: Date = new Date()) => 
          adjustDateRangeToPlan(plan, startTime, endTime),
      };
      
      next();
    } catch (error) {
      log.error('Error in historical data middleware:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: '检查数据权限时发生错误',
      });
    }
  };
}

/**
 * Get historical data limit info for display
 */
export function getHistoricalDataLimitInfo(plan: SubscriptionPlan): {
  maxDays: number;
  isUnlimited: boolean;
  description: string;
} {
  const maxDays = getMaxHistoricalDays(plan);
  
  if (maxDays === -1) {
    return {
      maxDays: -1,
      isUnlimited: true,
      description: '无限历史数据访问',
    };
  }
  
  return {
    maxDays,
    isUnlimited: false,
    description: `最近 ${maxDays} 天历史数据`,
  };
}

export default {
  getUserPlan,
  getMaxHistoricalDays,
  checkHistoricalDataPermission,
  adjustDateRangeToPlan,
  createHistoricalDataMiddleware,
  getHistoricalDataLimitInfo,
};