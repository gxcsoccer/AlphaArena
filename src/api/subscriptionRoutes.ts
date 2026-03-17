/**
 * Subscription Routes
 * Handles subscription management, plan listing, and checkout
 */

import { Router, Request, Response, NextFunction } from 'express';
import { 
  SubscriptionDAO, 
  getSubscriptionDAO, 
  UserSubscription, 
  SubscriptionPlan 
} from '../database/subscription.dao';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('SubscriptionRoutes');

const router = Router();

/**
 * GET /api/subscriptions/plans
 * Get all available subscription plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const dao = getSubscriptionDAO();
    const plans = await dao.getPlans();
    
    res.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    log.error('Failed to get plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription plans',
    });
  }
});

/**
 * GET /api/subscriptions
 * Get current user's subscription
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const dao = getSubscriptionDAO();
    const subscription = await dao.getUserSubscriptionStatus(userId);
    
    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    log.error('Failed to get subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription',
    });
  }
});

/**
 * POST /api/subscriptions
 * Create a new subscription (for free plan signup or trial)
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { planId, trialDays } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: 'planId is required',
      });
    }

    const dao = getSubscriptionDAO();
    
    // Verify plan exists
    const plan = await dao.getPlanById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found',
      });
    }

    // For free plan, create directly
    if (planId === 'free') {
      const subscription = await dao.createSubscription({
        userId,
        planId: 'free',
        status: 'active',
      });

      return res.json({
        success: true,
        data: subscription,
        message: 'Successfully subscribed to free plan',
      });
    }

    // For paid plans, return checkout URL (actual payment handled by Stripe)
    const checkoutUrl = await createCheckoutSession(userId, planId, trialDays);
    
    res.json({
      success: true,
      data: {
        checkoutUrl,
        planId,
      },
      message: 'Please complete payment to activate subscription',
    });
  } catch (error) {
    log.error('Failed to create subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription',
    });
  }
});

/**
 * PUT /api/subscriptions
 * Update subscription (upgrade/downgrade)
 */
router.put('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: 'planId is required',
      });
    }

    const dao = getSubscriptionDAO();
    
    // Verify plan exists
    const plan = await dao.getPlanById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found',
      });
    }

    // Get current subscription
    const currentSub = await dao.getUserSubscription(userId);
    
    if (!currentSub) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found',
      });
    }

    // For free plan downgrade
    if (planId === 'free') {
      const subscription = await dao.cancelSubscription(userId, 'Downgraded to free plan');
      return res.json({
        success: true,
        data: subscription,
        message: 'Subscription downgraded to free plan',
      });
    }

    // For paid plans, create checkout session
    const checkoutUrl = await createCheckoutSession(userId, planId);
    
    res.json({
      success: true,
      data: {
        checkoutUrl,
        planId,
        currentPlan: currentSub.planId,
      },
      message: 'Please complete payment to change plan',
    });
  } catch (error) {
    log.error('Failed to update subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update subscription',
    });
  }
});

/**
 * DELETE /api/subscriptions
 * Cancel subscription
 */
router.delete('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { reason } = req.body;
    const dao = getSubscriptionDAO();
    
    const subscription = await dao.cancelSubscription(userId, reason);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found',
      });
    }

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription canceled. You will have access until the end of your billing period.',
    });
  } catch (error) {
    log.error('Failed to cancel subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription',
    });
  }
});

/**
 * POST /api/subscriptions/checkout
 * Create a Stripe checkout session
 */
router.post('/checkout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { planId, successUrl, cancelUrl } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: 'planId is required',
      });
    }

    const dao = getSubscriptionDAO();
    const plan = await dao.getPlanById(planId);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found',
      });
    }

    if (!plan.stripePriceId) {
      return res.status(400).json({
        success: false,
        error: 'Plan does not have a Stripe price configured',
      });
    }

    const checkoutUrl = await createStripeCheckoutSession(
      userId,
      plan.stripePriceId,
      successUrl || process.env.FRONTEND_URL + '/subscription/success',
      cancelUrl || process.env.FRONTEND_URL + '/subscription/cancel'
    );

    res.json({
      success: true,
      data: {
        checkoutUrl,
        planId,
      },
    });
  } catch (error) {
    log.error('Failed to create checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session',
    });
  }
});

/**
 * POST /api/subscriptions/webhook
 * Handle Stripe webhooks
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  
  if (!sig) {
    return res.status(400).json({
      success: false,
      error: 'Missing stripe-signature header',
    });
  }

  try {
    const event = await verifyStripeWebhook(req.body, sig);
    const dao = getSubscriptionDAO();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const stripeSubscriptionId = session.subscription;
        const stripeCustomerId = session.customer;
        
        if (userId && stripeSubscriptionId) {
          const subscription = await getStripeSubscription(stripeSubscriptionId);
          
          await dao.createSubscription({
            userId,
            planId: getPlanIdFromPriceId(subscription.items.data[0].price.id),
            status: mapStripeStatus(subscription.status) as "active" | "trialing",
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            stripeSubscriptionId,
            stripeCustomerId,
            stripePriceId: subscription.items.data[0].price.id,
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const stripeSubscriptionId = subscription.id;
        
        const userSub = await findSubscriptionByStripeId(stripeSubscriptionId);
        
        if (userSub) {
          await dao.updateSubscription(userSub.userId, {
            planId: getPlanIdFromPriceId(subscription.items.data[0].price.id),
            status: mapStripeStatus(subscription.status) as "active" | "trialing",
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            stripePriceId: subscription.items.data[0].price.id,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const stripeSubscriptionId = subscription.id;
        
        const userSub = await findSubscriptionByStripeId(stripeSubscriptionId);
        
        if (userSub) {
          await dao.updateSubscription(userSub.userId, {
            status: 'expired',
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const stripeSubscriptionId = invoice.subscription;
        
        if (stripeSubscriptionId) {
          const userSub = await findSubscriptionByStripeId(stripeSubscriptionId);
          
          if (userSub) {
            await dao.updateSubscription(userSub.userId, {
              status: 'past_due',
            });
          }
        }
        break;
      }

      default:
        log.info('Unhandled webhook event type: ' + event.type);
    }

    res.json({ received: true });
  } catch (error) {
    log.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      error: 'Webhook error',
    });
  }
});

/**
 * GET /api/subscriptions/history
 * Get subscription history for current user
 */
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const dao = getSubscriptionDAO();
    const history = await dao.getSubscriptionHistory(userId);
    
    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    log.error('Failed to get subscription history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription history',
    });
  }
});

/**
 * POST /api/subscriptions/check-feature
 * Check if user has access to a feature
 */
router.post('/check-feature', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { featureKey } = req.body;

    if (!featureKey) {
      return res.status(400).json({
        success: false,
        error: 'featureKey is required',
      });
    }

    const dao = getSubscriptionDAO();
    const access = await dao.checkFeatureAccess(userId, featureKey);
    
    res.json({
      success: true,
      data: access,
    });
  } catch (error) {
    log.error('Failed to check feature access:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check feature access',
    });
  }
});

/**
 * POST /api/subscriptions/use-feature
 * Record feature usage
 */
router.post('/use-feature', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { featureKey, increment = 1 } = req.body;

    if (!featureKey) {
      return res.status(400).json({
        success: false,
        error: 'featureKey is required',
      });
    }

    const dao = getSubscriptionDAO();
    
    // Check access first
    const access = await dao.checkFeatureAccess(userId, featureKey);
    
    if (!access.hasAccess) {
      return res.status(402).json({
        success: false,
        error: 'Feature limit exceeded',
        data: {
          limit: access.limit,
          currentUsage: access.currentUsage,
          planId: access.planId,
          upgradeUrl: '/pricing',
        },
      });
    }

    // Increment usage
    await dao.incrementFeatureUsage(userId, featureKey, increment);
    
    res.json({
      success: true,
      data: {
        featureKey,
        usageCount: access.currentUsage + increment,
        remaining: access.remaining - increment,
      },
    });
  } catch (error) {
    log.error('Failed to record feature usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record feature usage',
    });
  }
});

// ==================== Stripe Helper Functions ====================

async function createCheckoutSession(userId: string, planId: string, trialDays?: number): Promise<string> {
  // If Stripe is configured, use it
  if (process.env.STRIPE_SECRET_KEY) {
    return createStripeCheckoutSession(
      userId,
      await getStripePriceId(planId),
      process.env.FRONTEND_URL + '/subscription/success',
      process.env.FRONTEND_URL + '/subscription/cancel',
      trialDays
    );
  }

  // Otherwise return a mock checkout URL for development
  return process.env.FRONTEND_URL + '/subscription/mock-checkout?planId=' + planId + '&userId=' + userId;
}

async function createStripeCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  trialDays?: number
): Promise<string> {
  // In a real implementation, this would use the Stripe SDK
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured');
  }

  // Mock implementation - in production, use Stripe SDK
  return process.env.FRONTEND_URL + '/subscription/mock-checkout?priceId=' + priceId + '&userId=' + userId;
}

async function verifyStripeWebhook(body: any, signature: string): Promise<any> {
  // In production, use Stripe SDK to verify webhook
  return body;
}

async function getStripeSubscription(subscriptionId: string): Promise<any> {
  // In production, fetch from Stripe API
  return {
    id: subscriptionId,
    status: 'active',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    items: {
      data: [{ price: { id: 'price_pro_monthly' } }],
    },
  };
}

async function getStripePriceId(planId: string): Promise<string> {
  const dao = getSubscriptionDAO();
  const plan = await dao.getPlanById(planId);
  return plan?.stripePriceId || 'price_' + planId + '_monthly';
}

function getPlanIdFromPriceId(priceId: string): string {
  // Map Stripe price IDs back to plan IDs
  if (priceId.includes('pro')) return 'pro';
  if (priceId.includes('enterprise')) return 'enterprise';
  return 'free';
}

function mapStripeStatus(status: string): 'active' | 'canceled' | 'expired' | 'past_due' | 'trialing' {
  const statusMap: Record<string, 'active' | 'canceled' | 'expired' | 'past_due' | 'trialing'> = {
    active: 'active',
    canceled: 'canceled',
    incomplete_expired: 'expired',
    past_due: 'past_due',
    trialing: 'trialing',
    unpaid: 'expired',
  };
  return statusMap[status] || 'active';
}

async function findSubscriptionByStripeId(stripeSubscriptionId: string): Promise<UserSubscription | null> {
  // This would need a dedicated query in the DAO
  // For now, return null
  return null;
}

export function createSubscriptionRouter(): Router {
  return router;
}

export default router;
