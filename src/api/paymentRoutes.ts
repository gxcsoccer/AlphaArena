/**
 * Payment API Routes
 * REST endpoints for payment management
 */

import { Router, Request, Response } from 'express';
import { authMiddleware as authenticate } from './authMiddleware';
import {
  createCheckoutSession,
  createCustomerPortalSession,
  getSubscription,
  cancelSubscription,
  reactivateSubscription,
  verifyWebhookSignature,
  mapStripeStatus,
  getPlanIdFromPriceId,
  createCustomer,
  getCustomerByEmail,
} from '../services/stripeService';
import { SubscriptionDAO } from '../database/subscription.dao';
import { getPaymentDAO, PaymentRecord } from '../database/payment.dao';
import { createLogger } from '../utils/logger';
import { getSupabaseAdminClient } from '../database/client';
import Stripe from 'stripe';

const log = createLogger('PaymentRoutes');

const router = Router();

// ============================================================================
// Public Routes (Webhook)
// ============================================================================

/**
 * POST /api/payments/webhook/stripe
 * Handle Stripe webhook events
 * Note: Requires raw body parser middleware in the main server for signature verification
 */
router.post('/webhook/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  // Use raw body if available (set by express.json verify), otherwise use body
  const payload = (req as any).rawBody || JSON.stringify(req.body);

  // Verify webhook signature
  const event = verifyWebhookSignature(payload, sig);

  if (!event) {
    log.error('Webhook signature verification failed');
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  log.info('Received Stripe webhook event', { 
    type: event.type, 
    id: event.id 
  });

  const adminClient = getSupabaseAdminClient();

  // Check if event was already processed (idempotency)
  const { data: existingEvent } = await adminClient
    .from('stripe_webhook_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle();

  if (existingEvent) {
    log.info('Event already processed', { eventId: event.id });
    return res.json({ received: true, message: 'Event already processed' });
  }

  try {
    // Process event based on type
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, event.id);
        break;
      }

      case 'invoice.paid': {
        await handleInvoicePaid(event.data.object as Stripe.Invoice, event.id);
        break;
      }

      case 'invoice.payment_failed': {
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, event.id);
        break;
      }

      case 'customer.subscription.created': {
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription, event.id);
        break;
      }

      case 'customer.subscription.updated': {
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, event.id);
        break;
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, event.id);
        break;
      }

      default:
        log.info('Unhandled event type', { type: event.type });
    }

    // Mark event as processed
    await adminClient
      .from('stripe_webhook_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        status: 'processed',
      });

    res.json({ received: true });
  } catch (error) {
    log.error('Error processing webhook event:', error);

    // Mark event as failed
    await adminClient
      .from('stripe_webhook_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================================================
// Authenticated Routes
// ============================================================================

/**
 * POST /api/payments/create-subscription
 * Create a subscription checkout session
 */
router.post('/create-subscription', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const { plan, billingPeriod = 'monthly' } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!plan || !['pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be "pro" or "enterprise"' });
    }

    if (!['monthly', 'yearly'].includes(billingPeriod)) {
      return res.status(400).json({ error: 'Invalid billing period. Must be "monthly" or "yearly"' });
    }

    // Get or create Stripe customer
    let customerId: string | undefined;
    if (userEmail) {
      const existingCustomer = await getCustomerByEmail(userEmail);
      if (existingCustomer) {
        customerId = existingCustomer.id;
      }
    }

    if (!customerId) {
      customerId = await createCustomer(userId, userEmail || '', undefined);
    }

    // Get price ID based on plan and billing period
    const priceId = getPriceIdForPlan(plan, billingPeriod);

    // Create checkout session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const checkoutUrl = await createCheckoutSession({
      userId,
      email: userEmail,
      priceId,
      successUrl: `${frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl}/subscription/canceled`,
      customerId,
    });

    log.info('Created subscription checkout session', { userId, plan, billingPeriod });

    res.json({ checkoutUrl });
  } catch (error) {
    log.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

/**
 * POST /api/payments/create-portal-session
 * Create a customer portal session for managing subscription
 */
router.post('/create-portal-session', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's subscription to find Stripe customer ID
    const subscription = await SubscriptionDAO.getUserSubscription(userId);

    if (!subscription?.stripeCustomerId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Create portal session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const portalUrl = await createCustomerPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: `${frontendUrl}/subscription/manage`,
    });

    log.info('Created customer portal session', { userId });

    res.json({ portalUrl });
  } catch (error) {
    log.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

/**
 * POST /api/payments/cancel
 * Cancel subscription
 */
router.post('/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's subscription
    const subscription = await SubscriptionDAO.getUserSubscription(userId);

    if (!subscription?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Cancel in Stripe
    const success = await cancelSubscription(subscription.stripeSubscriptionId);

    if (!success) {
      return res.status(500).json({ error: 'Failed to cancel subscription' });
    }

    // Update in database
    await SubscriptionDAO.cancelSubscription(userId);

    log.info('Canceled subscription', { userId });

    res.json({ success: true, message: 'Subscription canceled' });
  } catch (error) {
    log.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * POST /api/payments/reactivate
 * Reactivate a canceled subscription
 */
router.post('/reactivate', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's subscription
    const subscription = await SubscriptionDAO.getUserSubscription(userId);

    if (!subscription?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    // Reactivate in Stripe
    const success = await reactivateSubscription(subscription.stripeSubscriptionId);

    if (!success) {
      return res.status(500).json({ error: 'Failed to reactivate subscription' });
    }

    // Update in database using upsertSubscription
    await SubscriptionDAO.upsertSubscription({
      user_id: userId,
      plan: subscription.planId as any,
      stripe_subscription_id: subscription.stripeSubscriptionId,
      stripe_customer_id: subscription.stripeCustomerId || undefined,
      status: 'active',
    });

    log.info('Reactivated subscription', { userId });

    res.json({ success: true, message: 'Subscription reactivated' });
  } catch (error) {
    log.error('Error reactivating subscription:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

/**
 * GET /api/payments/history
 * Get payment history for current user
 */
router.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const paymentDAO = getPaymentDAO();
    const history = await paymentDAO.getPaymentHistory(userId, limit);

    res.json({ history });
  } catch (error) {
    log.error('Error getting payment history:', error);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get price ID for a plan and billing period
 */
function getPriceIdForPlan(plan: string, billingPeriod: 'monthly' | 'yearly'): string {
  const priceIds: Record<string, { monthly: string; yearly: string }> = {
    pro: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly',
    },
    enterprise: {
      monthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || 'price_enterprise_monthly',
      yearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || 'price_enterprise_yearly',
    },
  };

  const prices = priceIds[plan];
  if (!prices) {
    throw new Error(`No Stripe price configured for plan: ${plan}`);
  }

  return billingPeriod === 'yearly' ? prices.yearly : prices.monthly;
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, eventId: string): Promise<void> {
  const userId = session.client_reference_id || session.metadata?.userId;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    log.error('No user ID in checkout session', { sessionId: session.id });
    return;
  }

  // Get subscription details from Stripe
  const subscription = await getSubscription(subscriptionId);

  if (!subscription) {
    log.error('Failed to get subscription from Stripe', { subscriptionId });
    return;
  }

  // Update or create subscription in database
  await SubscriptionDAO.upsertSubscription({
    user_id: userId,
    plan: getPlanIdFromPriceId(subscription.priceId) as any,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: customerId,
    status: mapStripeStatus(subscription.status) as any,
  });

  // Store Stripe customer
  const paymentDAO = getPaymentDAO();
  await paymentDAO.getOrCreateStripeCustomer(userId, customerId, session.customer_email || undefined, session.customer_details?.name || undefined);

  log.info('Processed checkout.session.completed', { userId, subscriptionId });
}

/**
 * Handle invoice.paid event
 */
async function handleInvoicePaid(invoice: Stripe.Invoice, eventId: string): Promise<void> {
  const customerId = invoice.customer as string;
  const subscriptionId = (invoice as any).subscription as string | null;
  const invoiceId = invoice.id;

  // Get user from invoice metadata
  const userId = invoice.metadata?.userId;

  if (!userId) {
    log.warn('No user ID found for invoice', { invoiceId });
    return;
  }

  // Record payment
  const amount = (invoice.amount_paid || 0) / 100; // Convert from cents
  const currency = invoice.currency?.toUpperCase() || 'USD';

  const paymentDAO = getPaymentDAO();
  await paymentDAO.recordPayment({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId || undefined,
    stripeInvoiceId: invoiceId,
    amount,
    currency,
    status: 'succeeded',
    planId: getPlanIdFromPriceId((invoice.lines.data[0] as any)?.price?.id || ''),
    billingPeriod: (invoice.lines.data[0] as any)?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly',
    description: `Subscription payment - Invoice ${invoice.number}`,
    invoiceUrl: invoice.hosted_invoice_url || undefined,
    receiptUrl: (invoice as any).receipt_url || undefined,
    paidAt: new Date(),
  });

  // Update subscription status
  if (subscriptionId) {
    const subscription = await SubscriptionDAO.getUserSubscription(userId);
    if (subscription) {
      await SubscriptionDAO.upsertSubscription({
        user_id: userId,
        plan: subscription.planId as any,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        status: 'active',
      });
    }
  }

  log.info('Processed invoice.paid', { userId, invoiceId, amount });
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, eventId: string): Promise<void> {
  const customerId = invoice.customer as string;
  const subscriptionId = (invoice as any).subscription as string | null;
  const invoiceId = invoice.id;

  // Get user from invoice metadata
  const userId = invoice.metadata?.userId;

  if (!userId) {
    log.warn('No user ID found for failed invoice', { invoiceId });
    return;
  }

  // Record failed payment
  const paymentDAO = getPaymentDAO();
  const amount = (invoice.amount_due || 0) / 100;
  const currency = invoice.currency?.toUpperCase() || 'USD';

  await paymentDAO.recordPayment({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId || undefined,
    stripeInvoiceId: invoiceId,
    amount,
    currency,
    status: 'failed',
    description: `Failed payment - Invoice ${invoice.number}`,
  });

  // Update subscription status
  if (subscriptionId) {
    const subscription = await SubscriptionDAO.getUserSubscription(userId);
    if (subscription) {
      await SubscriptionDAO.upsertSubscription({
        user_id: userId,
        plan: subscription.planId as any,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        status: 'past_due',
      });
    }
  }

  log.info('Processed invoice.payment_failed', { userId, invoiceId });
}

/**
 * Handle customer.subscription.created event
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription, eventId: string): Promise<void> {
  log.info('Processed customer.subscription.created', { subscriptionId: subscription.id });
  // Subscription creation is handled in checkout.session.completed
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription, eventId: string): Promise<void> {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;

  log.info('Processed customer.subscription.updated', { subscriptionId, status: subscription.status });
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, eventId: string): Promise<void> {
  const subscriptionId = subscription.id;

  log.info('Processed customer.subscription.deleted', { subscriptionId });
}

export default router;