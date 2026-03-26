/**
 * Subscription API Routes
 * REST endpoints for subscription management
 */

import { Router, Request, Response } from 'express';
import { SubscriptionDAO } from '../database/subscription.dao';
import { authMiddleware as authenticate } from './authMiddleware';
import { requireFeature, trackFeatureUsage } from '../middleware/subscription.middleware';
import { createLogger } from '../utils/logger';
import { SubscriptionPlan, BillingPeriod } from '../types/subscription.types';

const log = createLogger('SubscriptionRoutes');

const router = Router();

// ============================================================================
// Public Routes
// ============================================================================

/**
 * GET /api/subscription/plans
 * Get all available subscription plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await SubscriptionDAO.getAllPlans();
    res.json({ plans });
  } catch (error) {
    log.error('Error getting plans:', error);
    res.status(500).json({ error: 'Failed to get subscription plans' });
  }
});

/**
 * GET /api/subscription/plans/:plan
 * Get a specific plan's details
 */
router.get('/plans/:plan', async (req: Request, res: Response) => {
  try {
    const { plan } = req.params;
    
    if (!['free', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    
    const planDetails = await SubscriptionDAO.getPlan(plan as SubscriptionPlan);
    
    if (!planDetails) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    res.json({ plan: planDetails });
  } catch (error) {
    log.error('Error getting plan:', error);
    res.status(500).json({ error: 'Failed to get plan details' });
  }
});

// ============================================================================
// Authenticated Routes
// ============================================================================

/**
 * GET /api/subscription/current
 * Get current user's subscription
 */
router.get('/current', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const subscription = await SubscriptionDAO.getUserSubscriptionWithPlan(userId);
    
    res.json({ subscription });
  } catch (error) {
    log.error('Error getting current subscription:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

/**
 * GET /api/subscription/history
 * Get subscription history for current user
 */
router.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 20;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const history = await SubscriptionDAO.getSubscriptionHistory(userId, limit);
    
    res.json({ history });
  } catch (error) {
    log.error('Error getting subscription history:', error);
    res.status(500).json({ error: 'Failed to get subscription history' });
  }
});

/**
 * POST /api/subscription/cancel
 * Cancel current subscription
 */
router.post('/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { immediately } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const success = await SubscriptionDAO.cancelSubscription(userId, immediately);
    
    if (!success) {
      return res.status(400).json({ error: 'No active subscription to cancel' });
    }
    
    res.json({ success: true, message: 'Subscription canceled' });
  } catch (error) {
    log.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// ============================================================================
// Feature Access Routes
// ============================================================================

/**
 * GET /api/subscription/features
 * Get all feature permissions
 */
router.get('/features', async (req: Request, res: Response) => {
  try {
    const features = await SubscriptionDAO.getAllFeaturePermissions();
    
    res.json({ features });
  } catch (error) {
    log.error('Error getting features:', error);
    res.status(500).json({ error: 'Failed to get feature permissions' });
  }
});

/**
 * GET /api/subscription/features/:featureKey/check
 * Check if user has access to a feature
 */
router.get('/features/:featureKey/check', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { featureKey } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const hasAccess = await SubscriptionDAO.checkFeatureAccess(userId, featureKey);
    
    res.json({ hasAccess, featureKey });
  } catch (error) {
    log.error('Error checking feature access:', error);
    res.status(500).json({ error: 'Failed to check feature access' });
  }
});

/**
 * POST /api/subscription/features/check-batch
 * Check multiple feature accesses at once
 */
router.post('/features/check-batch', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { features } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!Array.isArray(features)) {
      return res.status(400).json({ error: 'Features must be an array' });
    }
    
    const accesses = await SubscriptionDAO.checkMultipleFeatureAccesses(userId, features);
    
    res.json({ accesses });
  } catch (error) {
    log.error('Error checking batch feature access:', error);
    res.status(500).json({ error: 'Failed to check feature accesses' });
  }
});

/**
 * GET /api/subscription/features/:featureKey/limit
 * Check feature usage limit
 */
router.get('/features/:featureKey/limit', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { featureKey } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await SubscriptionDAO.checkFeatureLimit(userId, featureKey);
    
    res.json({
      feature: featureKey,
      allowed: result.allowed,
      current_usage: result.current_usage,
      limit: result.limit,
    });
  } catch (error) {
    log.error('Error checking feature limit:', error);
    res.status(500).json({ error: 'Failed to check feature limit' });
  }
});

/**
 * GET /api/subscription/features/:featureKey/usage
 * Get feature usage for current period
 */
router.get('/features/:featureKey/usage', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { featureKey } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const usage = await SubscriptionDAO.getFeatureUsage(userId, featureKey);
    
    res.json({ feature: featureKey, usage_count: usage });
  } catch (error) {
    log.error('Error getting feature usage:', error);
    res.status(500).json({ error: 'Failed to get feature usage' });
  }
});

/**
 * POST /api/subscription/features/:featureKey/usage
 * Increment feature usage
 */
router.post('/features/:featureKey/usage', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { featureKey } = req.params;
    const { increment } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Check limit first
    const limitCheck = await SubscriptionDAO.checkFeatureLimit(userId, featureKey);
    
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: 'Feature limit exceeded',
        current_usage: limitCheck.current_usage,
        limit: limitCheck.limit,
      });
    }
    
    const newUsage = await SubscriptionDAO.incrementFeatureUsage(
      userId,
      featureKey,
      increment || 1
    );
    
    res.json({ feature: featureKey, usage_count: newUsage });
  } catch (error) {
    log.error('Error incrementing feature usage:', error);
    res.status(500).json({ error: 'Failed to increment feature usage' });
  }
});

/**
 * GET /api/subscription/usage
 * Get all feature usage for current user
 */
router.get('/usage', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const usage = await SubscriptionDAO.getAllFeatureUsage(userId);
    
    res.json({ usage });
  } catch (error) {
    log.error('Error getting all feature usage:', error);
    res.status(500).json({ error: 'Failed to get feature usage' });
  }
});

// ============================================================================
// Admin Routes (TODO: Add admin middleware)
// ============================================================================

/**
 * POST /api/subscription/admin/create
 * Create a new subscription (admin only)
 */
router.post('/admin/create', authenticate, async (req: Request, res: Response) => {
  try {
    // TODO: Add admin check
    const { user_id, plan, billing_period, stripe_subscription_id, stripe_customer_id } = req.body;
    
    if (!user_id || !plan) {
      return res.status(400).json({ error: 'user_id and plan are required' });
    }
    
    const subscription = await SubscriptionDAO.upsertSubscription({
      user_id,
      plan: plan as SubscriptionPlan,
      billing_period: billing_period as BillingPeriod,
      stripe_subscription_id,
      stripe_customer_id,
      status: 'active',
    });
    
    res.json({ subscription });
  } catch (error) {
    log.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

/**
 * POST /api/subscription/admin/update-expired
 * Update all expired subscriptions (admin only)
 */
router.post('/admin/update-expired', authenticate, async (req: Request, res: Response) => {
  try {
    // TODO: Add admin check
    const count = await SubscriptionDAO.updateExpiredSubscriptions();
    
    res.json({ message: `Updated ${count} expired subscriptions` });
  } catch (error) {
    log.error('Error updating expired subscriptions:', error);
    res.status(500).json({ error: 'Failed to update expired subscriptions' });
  }
});

/**
 * GET /api/subscription/admin/expiring
 * Get subscriptions expiring soon (admin only)
 */
router.get('/admin/expiring', authenticate, async (req: Request, res: Response) => {
  try {
    // TODO: Add admin check
    const days = parseInt(req.query.days as string) || 7;
    
    const subscriptions = await SubscriptionDAO.getExpiringSubscriptions(days);
    
    res.json({ subscriptions, days });
  } catch (error) {
    log.error('Error getting expiring subscriptions:', error);
    res.status(500).json({ error: 'Failed to get expiring subscriptions' });
  }
});

export default router;