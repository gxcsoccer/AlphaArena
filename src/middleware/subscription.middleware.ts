/**
 * Subscription Permission Middleware
 * Guards routes and features based on subscription tier
 */

import { Request, Response, NextFunction } from 'express';
import { SubscriptionDAO } from '../database/subscription.dao';
import { SubscriptionPlan, PLAN_HIERARCHY } from '../types/subscription.types';
import { createLogger } from '../utils/logger';

const log = createLogger('SubscriptionMiddleware');

/**
 * Check if user has required plan or higher
 */
export function requirePlan(requiredPlans: SubscriptionPlan | SubscriptionPlan[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
      }

      // Normalize to array
      const plans = Array.isArray(requiredPlans) ? requiredPlans : [requiredPlans];
      
      // Get user's current subscription
      const subscription = await SubscriptionDAO.getUserSubscription(userId);
      const userPlan: SubscriptionPlan = subscription?.plan || 'free';
      
      // Check if user's plan is in the allowed plans or higher
      const userPlanLevel = PLAN_HIERARCHY[userPlan];
      const hasAccess = plans.some(plan => {
        const requiredLevel = PLAN_HIERARCHY[plan];
        return userPlanLevel >= requiredLevel;
      });

      if (!hasAccess) {
        log.warn(`User ${userId} with plan ${userPlan} denied access to feature requiring ${plans.join('/')}`);
        
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Your subscription plan does not include this feature',
          current_plan: userPlan,
          required_plans: plans,
          upgrade_url: '/pricing',
        });
      }

      // Attach subscription info to request
      req.subscription = subscription;
      next();
    } catch (error) {
      log.error('Error in subscription middleware:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to check subscription status',
      });
    }
  };
}

/**
 * Check if user has access to a specific feature
 */
export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
      }

      // Check feature access
      const hasAccess = await SubscriptionDAO.checkFeatureAccess(userId, featureKey);

      if (!hasAccess) {
        log.warn(`User ${userId} denied access to feature ${featureKey}`);
        
        // Get required plan for feature
        const permission = await SubscriptionDAO.getFeaturePermission(featureKey);
        
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Your subscription plan does not include this feature',
          feature: featureKey,
          required_plan: permission?.required_plan || 'enterprise',
          upgrade_url: '/pricing',
        });
      }

      next();
    } catch (error) {
      log.error('Error in feature middleware:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to check feature access',
      });
    }
  };
}

/**
 * Check and track feature usage (with limits)
 */
export function trackFeatureUsage(featureKey: string, increment: number = 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
      }

      // Check limit
      const limitCheck = await SubscriptionDAO.checkFeatureLimit(userId, featureKey);

      // -1 means unlimited
      if (limitCheck.limit !== -1 && !limitCheck.allowed) {
        log.warn(`User ${userId} exceeded limit for feature ${featureKey}`);
        
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You have reached your usage limit for this feature',
          feature: featureKey,
          current_usage: limitCheck.current_usage,
          limit: limitCheck.limit,
          reset_info: 'Limits reset monthly',
        });
      }

      // Increment usage after successful response
      const originalSend = res.send;
      res.send = function (data: any) {
        // Only increment on successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          SubscriptionDAO.incrementFeatureUsage(userId, featureKey, increment)
            .catch(err => log.error('Failed to increment feature usage:', err));
        }
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      log.error('Error in feature usage middleware:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to check feature usage',
      });
    }
  };
}

/**
 * Require active subscription (not canceled or expired)
 */
export function requireActiveSubscription() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
      }

      const subscription = await SubscriptionDAO.getUserSubscription(userId);

      if (!subscription || subscription.status !== 'active') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Active subscription required',
          subscription_status: subscription?.status || 'none',
        });
      }

      req.subscription = subscription;
      next();
    } catch (error) {
      log.error('Error in active subscription middleware:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to check subscription status',
      });
    }
  };
}

/**
 * Optional: Attach subscription info to request without blocking
 */
export function attachSubscription() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      
      if (userId) {
        const subscription = await SubscriptionDAO.getUserSubscription(userId);
        req.subscription = subscription;
      }

      next();
    } catch (error) {
      log.error('Error attaching subscription:', error);
      // Don't block on error, just continue without subscription
      next();
    }
  };
}

// Extend Express Request type
declare module 'express' {
  interface Request {
    subscription?: any;
  }
}