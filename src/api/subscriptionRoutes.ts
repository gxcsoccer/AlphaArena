/**
 * Subscription Routes
 * Handles subscription management, plan listing, and checkout
 */

import { Router, Request, Response } from 'express';
import { 
  SubscriptionDAO, 
  getSubscriptionDAO, 
  UserSubscription,
} from '../database/subscription.dao';
import { PaymentDAO, getPaymentDAO } from '../database/payment.dao';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';
import {
  stripe,
  createCheckoutSession,
  createCustomerPortalSession,
  getSubscription as getStripeSubscription,
  cancelSubscription as cancelStripeSubscription,
  reactivateSubscription,
  verifyWebhookSignature,
  getPriceId,
  mapStripeStatus,
  getPlanIdFromPriceId,
  createCustomer,
  getCustomerByEmail,
} from '../services/stripeService';

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
    const userEmail = req.user?.email;
    const userName = (req.user as any)?.name || (req.user as any)?.user_metadata?.name;
    
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

    // For paid plans, create checkout session
    const paymentDao = getPaymentDAO();
    let stripeCustomer = await paymentDao.getStripeCustomerByUserId(userId);
    
    let customerId: string | undefined;
    if (stripeCustomer) {
      customerId = stripeCustomer.stripeCustomerId;
    } else if (userEmail && stripe) {
      // Check if customer exists in Stripe
      const existingCustomer = await getCustomerByEmail(userEmail);
      if (existingCustomer) {
        customerId = existingCustomer.id;
        await paymentDao.getOrCreateStripeCustomer(userId, customerId, userEmail);
      } else {
        // Create new customer
        customerId = await createCustomer(userId, userEmail, userName);
        await paymentDao.getOrCreateStripeCustomer(userId, customerId, userEmail, userName);
      }
    }

    const priceId = plan.stripePriceId || getPriceId(planId, 'monthly');
    const checkoutUrl = await createCheckoutSession({
      userId,
      email: userEmail,
      priceId,
      successUrl: process.env.FRONTEND_URL + '/subscription/success',
      cancelUrl: process.env.FRONTEND_URL + '/subscription/cancel',
      trialDays,
      customerId,
    });
    
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
    const paymentDao = getPaymentDAO();
    let stripeCustomer = await paymentDao.getStripeCustomerByUserId(userId);
    let customerId: string | undefined;
    
    if (stripeCustomer) {
      customerId = stripeCustomer.stripeCustomerId;
    }

    const priceId = plan.stripePriceId || getPriceId(planId, 'monthly');
    const checkoutUrl = await createCheckoutSession({
      userId,
      email: req.user?.email,
      priceId,
      successUrl: process.env.FRONTEND_URL + '/subscription/success',
      cancelUrl: process.env.FRONTEND_URL + '/subscription/cancel',
      customerId,
    });
    
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
    
    // Get current subscription
    const currentSub = await dao.getUserSubscription(userId);
    
    if (!currentSub) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found',
      });
    }

    // Cancel in Stripe if we have a subscription ID
    if (currentSub.stripeSubscriptionId && stripe) {
      await cancelStripeSubscription(currentSub.stripeSubscriptionId);
    }

    const subscription = await dao.cancelSubscription(userId, reason);
    
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
    const userEmail = req.user?.email;
    const userName = (req.user as any)?.name || (req.user as any)?.user_metadata?.name;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { planId, successUrl, cancelUrl, billingPeriod = 'monthly' } = req.body;

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

    const paymentDao = getPaymentDAO();
    let stripeCustomer = await paymentDao.getStripeCustomerByUserId(userId);
    let customerId: string | undefined;
    
    if (stripeCustomer) {
      customerId = stripeCustomer.stripeCustomerId;
    } else if (userEmail && stripe) {
      const existingCustomer = await getCustomerByEmail(userEmail);
      if (existingCustomer) {
        customerId = existingCustomer.id;
        await paymentDao.getOrCreateStripeCustomer(userId, customerId, userEmail);
      } else {
        customerId = await createCustomer(userId, userEmail, userName);
        await paymentDao.getOrCreateStripeCustomer(userId, customerId, userEmail, userName);
      }
    }

    const priceId = plan.stripePriceId || getPriceId(planId, billingPeriod);
    
    const checkoutUrl = await createCheckoutSession({
      userId,
      email: userEmail,
      priceId,
      successUrl: successUrl || process.env.FRONTEND_URL + '/subscription/success',
      cancelUrl: cancelUrl || process.env.FRONTEND_URL + '/subscription/cancel',
      customerId,
    });

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
 * POST /api/subscriptions/portal
 * Create a Stripe customer portal session
 */
router.post('/portal', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const paymentDao = getPaymentDAO();
    const stripeCustomer = await paymentDao.getStripeCustomerByUserId(userId);
    
    if (!stripeCustomer || !stripeCustomer.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        error: 'No Stripe customer found',
      });
    }

    const portalUrl = await createCustomerPortalSession({
      customerId: stripeCustomer.stripeCustomerId,
      returnUrl: process.env.FRONTEND_URL + '/subscription',
    });

    res.json({
      success: true,
      data: {
        portalUrl,
      },
    });
  } catch (error) {
    log.error('Failed to create portal session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create billing portal session',
    });
  }
});

/**
 * POST /api/subscriptions/webhook
 * Handle Stripe webhooks
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  
  if (!sig) {
    return res.status(400).json({
      success: false,
      error: 'Missing stripe-signature header',
    });
  }

  try {
    const event = verifyWebhookSignature(rawBody, sig);
    
    if (!event) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook signature',
      });
    }

    const dao = getSubscriptionDAO();
    const paymentDao = getPaymentDAO();

    log.info('Received Stripe webhook', { type: event.type, id: event.id });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.client_reference_id;
        const stripeSubscriptionId = session.subscription;
        const stripeCustomerId = session.customer;
        const stripePriceId = session.display_items?.[0]?.price?.id || 
          session.line_items?.data?.[0]?.price?.id;
        
        if (userId && stripeSubscriptionId) {
          const subscriptionData = await getStripeSubscription(stripeSubscriptionId);
          
          if (subscriptionData) {
            // Create or update Stripe customer record
            await paymentDao.getOrCreateStripeCustomer(
              userId, 
              stripeCustomerId,
              session.customer_email || session.customer_details?.email
            );

            // Create subscription
            await dao.createSubscription({
              userId,
              planId: getPlanIdFromPriceId(subscriptionData.priceId || stripePriceId),
              status: mapStripeStatus(subscriptionData.status) as "active" | "trialing",
              currentPeriodStart: subscriptionData.currentPeriodStart,
              currentPeriodEnd: subscriptionData.currentPeriodEnd,
              stripeSubscriptionId,
              stripeCustomerId,
              stripePriceId: subscriptionData.priceId || stripePriceId,
              trialEnd: subscriptionData.trialEnd,
            });
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const stripeSubscriptionId = subscription.id;
        
        // Find user by Stripe customer ID
        const userSubscription = await findSubscriptionByStripeId(stripeSubscriptionId);
        
        if (userSubscription) {
          const priceId = subscription.items.data[0]?.price?.id;
          
          await dao.updateSubscription(userSubscription.userId, {
            planId: getPlanIdFromPriceId(priceId),
            status: mapStripeStatus(subscription.status) as any,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            stripePriceId: priceId,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const stripeSubscriptionId = subscription.id;
        
        const userSubscription = await findSubscriptionByStripeId(stripeSubscriptionId);
        
        if (userSubscription) {
          await dao.updateSubscription(userSubscription.userId, {
            status: 'expired',
            cancelAtPeriodEnd: false,
            canceledAt: new Date(),
          });
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const stripeCustomerId = invoice.customer;
        const stripeSubscriptionId = invoice.subscription;
        const stripeInvoiceId = invoice.id;
        
        // Find user by customer ID
        const customer = await findCustomerByStripeId(stripeCustomerId);
        
        if (customer && invoice.amount_paid > 0) {
          await paymentDao.recordPayment({
            userId: customer.userId,
            stripeCustomerId,
            stripeSubscriptionId,
            stripeInvoiceId,
            amount: invoice.amount_paid / 100, // Stripe amounts are in cents
            currency: invoice.currency.toUpperCase(),
            status: 'succeeded',
            planId: getPlanIdFromPriceId(invoice.lines?.data?.[0]?.price?.id),
            billingPeriod: invoice.lines?.data?.[0]?.plan?.interval,
            invoiceUrl: invoice.hosted_invoice_url,
            paidAt: new Date(),
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const stripeSubscriptionId = invoice.subscription;
        const stripeCustomerId = invoice.customer;
        
        if (stripeSubscriptionId) {
          const userSubscription = await findSubscriptionByStripeId(stripeSubscriptionId);
          
          if (userSubscription) {
            await dao.updateSubscription(userSubscription.userId, {
              status: 'past_due',
            });

            // Record failed payment
            const customer = await findCustomerByStripeId(stripeCustomerId);
            if (customer) {
              await paymentDao.recordPayment({
                userId: customer.userId,
                stripeCustomerId,
                stripeSubscriptionId,
                stripeInvoiceId: invoice.id,
                amount: invoice.amount_due / 100,
                currency: invoice.currency.toUpperCase(),
                status: 'failed',
                planId: getPlanIdFromPriceId(invoice.lines?.data?.[0]?.price?.id),
              });
            }
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
 * GET /api/subscriptions/payments
 * Get payment history for current user
 */
router.get('/payments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const paymentDao = getPaymentDAO();
    const payments = await paymentDao.getPaymentHistory(userId);
    
    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    log.error('Failed to get payment history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payment history',
    });
  }
});

/**
 * POST /api/subscriptions/reactivate
 * Reactivate a canceled subscription
 */
router.post('/reactivate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const dao = getSubscriptionDAO();
    const currentSub = await dao.getUserSubscription(userId);
    
    if (!currentSub || !currentSub.stripeSubscriptionId) {
      return res.status(404).json({
        success: false,
        error: 'No subscription to reactivate',
      });
    }

    if (!currentSub.cancelAtPeriodEnd) {
      return res.status(400).json({
        success: false,
        error: 'Subscription is not scheduled for cancellation',
      });
    }

    // Reactivate in Stripe
    const success = await reactivateSubscription(currentSub.stripeSubscriptionId);
    
    if (success) {
      // Update local record
      await dao.updateSubscription(userId, {
        cancelAtPeriodEnd: false,
      });

      res.json({
        success: true,
        message: 'Subscription reactivated successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to reactivate subscription',
      });
    }
  } catch (error) {
    log.error('Failed to reactivate subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reactivate subscription',
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

// Helper functions
async function findSubscriptionByStripeId(stripeSubscriptionId: string): Promise<UserSubscription | null> {
  const { getSupabaseAdminClient } = await import('../database/client');
  const adminClient = getSupabaseAdminClient();
  
  const { data, error } = await adminClient
    .from('user_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    planId: data.plan_id,
    status: data.status,
    currentPeriodStart: new Date(data.current_period_start),
    currentPeriodEnd: new Date(data.current_period_end),
    stripeSubscriptionId: data.stripe_subscription_id,
    stripeCustomerId: data.stripe_customer_id,
    stripePriceId: data.stripe_price_id,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    canceledAt: data.canceled_at ? new Date(data.canceled_at) : null,
    cancellationReason: data.cancellation_reason,
    trialStart: data.trial_start ? new Date(data.trial_start) : null,
    trialEnd: data.trial_end ? new Date(data.trial_end) : null,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

async function findCustomerByStripeId(stripeCustomerId: string): Promise<{ userId: string } | null> {
  const { getSupabaseAdminClient } = await import('../database/client');
  const adminClient = getSupabaseAdminClient();
  
  const { data, error } = await adminClient
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return { userId: data.user_id };
}

export function createSubscriptionRouter(): Router {
  return router;
}

export default router;
