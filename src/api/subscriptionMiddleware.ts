/**
 * Subscription Middleware
 * Validates user subscription and feature access
 */

import { Request, Response, NextFunction } from 'express';
import {  getSubscriptionDAO, PlanLimits } from '../database/subscription.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('SubscriptionMiddleware');

// Plan hierarchy for comparison
const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

/**
 * Feature key definitions
 */
export const FEATURE_KEYS = {
  // Strategy features
  CONCURRENT_STRATEGIES: 'concurrentStrategies',
  DAILY_BACKTESTS: 'dailyBacktests',
  
  // Data features
  DATA_RETENTION: 'dataRetention',
  API_CALLS: 'apiCalls',
  
  // Premium features
  AI_ASSISTANT: 'aiAssistant',
  LEVEL_2_DATA: 'level2Data',
  RISK_ALERTS: 'riskAlerts',
  DATA_EXPORT: 'dataExport',
  
  // Enterprise features
  TEAM_MANAGEMENT: 'teamManagement',
  PRIVATE_DEPLOYMENT: 'privateDeployment',
} as const;

/**
 * Middleware to require a minimum subscription plan
 * Usage: requirePlan('pro')
 */
export function requirePlan(requiredPlan: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'AUTH_REQUIRED',
        });
      }

      const dao = getSubscriptionDAO();
      const subscription = await dao.getUserSubscriptionStatus(userId);
      
      const userPlanLevel = PLAN_HIERARCHY[subscription.planId] ?? 0;
      const requiredPlanLevel = PLAN_HIERARCHY[requiredPlan] ?? 0;
      
      if (userPlanLevel < requiredPlanLevel) {
        return res.status(402).json({
          success: false,
          error: 'Premium feature',
          code: 'PLAN_UPGRADE_REQUIRED',
          data: {
            currentPlan: subscription.planId,
            requiredPlan,
            upgradeUrl: '/pricing',
            message: 'This feature requires a ' + requiredPlan + ' plan or higher. Your current plan: ' + subscription.planName,
          },
        });
      }
      
      next();
    } catch (error) {
      log.error('Error checking plan access:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify subscription',
        code: 'SUBSCRIPTION_CHECK_ERROR',
      });
    }
  };
}

/**
 * Middleware to check feature usage limits
 * Usage: checkFeatureLimit(FEATURE_KEYS.DAILY_BACKTESTS)
 */
export function checkFeatureLimit(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'AUTH_REQUIRED',
        });
      }

      const dao = getSubscriptionDAO();
      const access = await dao.checkFeatureAccess(userId, featureKey);
      
      if (!access.hasAccess) {
        return res.status(402).json({
          success: false,
          error: 'Feature limit exceeded',
          code: 'FEATURE_LIMIT_EXCEEDED',
          data: {
            featureKey,
            limit: access.limit,
            currentUsage: access.currentUsage,
            remaining: access.remaining,
            planId: access.planId,
            upgradeUrl: '/pricing',
            message: 'You have reached your daily limit of ' + access.limit + ' ' + featureKey + '. Upgrade for unlimited access.',
          },
        });
      }
      
      // Attach feature info to request for later use
      (req as any).featureAccess = access;
      
      next();
    } catch (error) {
      log.error('Error checking feature limit:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify feature access',
        code: 'FEATURE_CHECK_ERROR',
      });
    }
  };
}

/**
 * Middleware to track and increment feature usage after successful request
 * Usage: trackFeatureUsage(FEATURE_KEYS.DAILY_BACKTESTS)
 */
export function trackFeatureUsage(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original json function
    const originalJson = res.json;
    
    // Override res.json to intercept successful responses
    res.json = function(body: any): Response {
      // Only track if response was successful (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.id;
        
        if (userId) {
          getSubscriptionDAO()
            .incrementFeatureUsage(userId, featureKey)
            .catch(err => log.error('Failed to increment feature usage:', err));
        }
      }
      
      return originalJson.call(this, body);
    };
    
    next();
  };
}

/**
 * Combined middleware: check limit, then track usage
 * Usage: useFeature(FEATURE_KEYS.DAILY_BACKTESTS)
 */
export function useFeature(featureKey: string) {
  return [checkFeatureLimit(featureKey), trackFeatureUsage(featureKey)];
}

/**
 * Decorator for class methods to require subscription
 * Usage: @RequirePlan('pro')
 */
export function RequirePlan(requiredPlan: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const req = args[0] as Request;
      const res = args[1] as Response;
      
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'AUTH_REQUIRED',
        });
      }

      try {
        const dao = getSubscriptionDAO();
        const subscription = await dao.getUserSubscriptionStatus(userId);
        
        const userPlanLevel = PLAN_HIERARCHY[subscription.planId] ?? 0;
        const requiredPlanLevel = PLAN_HIERARCHY[requiredPlan] ?? 0;
        
        if (userPlanLevel < requiredPlanLevel) {
          return res.status(402).json({
            success: false,
            error: 'Premium feature',
            code: 'PLAN_UPGRADE_REQUIRED',
            data: {
              currentPlan: subscription.planId,
              requiredPlan,
              upgradeUrl: '/pricing',
            },
          });
        }
        
        return originalMethod.apply(this, args);
      } catch (error) {
        log.error('Error in RequirePlan decorator:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to verify subscription',
        });
      }
    };
    
    return descriptor;
  };
}

/**
 * Helper function to get user's plan limits
 */
export async function getUserPlanLimits(userId: string): Promise<PlanLimits> {
  try {
    const dao = getSubscriptionDAO();
    const subscription = await dao.getUserSubscriptionStatus(userId);
    return subscription.limits;
  } catch (error) {
    log.error('Error getting user plan limits:', error);
    // Return free tier limits as fallback
    return {
      concurrentStrategies: 3,
      dailyBacktests: 10,
      dataRetention: 7,
      apiCalls: 100,
    };
  }
}

/**
 * Helper function to check if user has a premium plan
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  try {
    const dao = getSubscriptionDAO();
    const subscription = await dao.getUserSubscriptionStatus(userId);
    return subscription.planId !== 'free';
  } catch (error) {
    log.error('Error checking premium status:', error);
    return false;
  }
}

/**
 * Middleware to add subscription info to request for optional use
 */
export async function addSubscriptionInfo(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    
    if (userId) {
      const dao = getSubscriptionDAO();
      const subscription = await dao.getUserSubscriptionStatus(userId);
      (req as any).subscription = subscription;
    }
    
    next();
  } catch (error) {
    // Don't block request, just log error
    log.error('Error adding subscription info:', error);
    next();
  }
}

export default {
  requirePlan,
  checkFeatureLimit,
  trackFeatureUsage,
  useFeature,
  RequirePlan,
  getUserPlanLimits,
  isPremiumUser,
  addSubscriptionInfo,
  FEATURE_KEYS,
};
