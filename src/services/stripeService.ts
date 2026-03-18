/**
 * Stripe Service
 * Handles Stripe API interactions for subscription management
 */

import Stripe from 'stripe';
import { createLogger } from '../utils/logger';

const log = createLogger('StripeService');

// Initialize Stripe with secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  log.warn('STRIPE_SECRET_KEY not configured - Stripe integration will be mocked');
}

export const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2026-02-25.clover' as unknown as Stripe.LatestApiVersion,
      typescript: true,
    })
  : null;

// Price IDs mapping (should be configured in environment or database)
const PRICE_IDS: Record<string, { monthly: string; yearly: string }> = {
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
    yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly',
  },
};

export interface CheckoutSessionParams {
  userId: string;
  email?: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  customerId?: string;
}

export interface SubscriptionResult {
  subscriptionId: string;
  customerId: string;
  status: Stripe.Subscription.Status;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  priceId: string;
  trialEnd?: Date;
}

export interface CustomerPortalParams {
  customerId: string;
  returnUrl: string;
}

/**
 * Create a Stripe Checkout Session for subscription
 */
export async function createCheckoutSession(params: CheckoutSessionParams): Promise<string> {
  if (!stripe) {
    log.warn('Stripe not configured - returning mock checkout URL');
    return `${process.env.FRONTEND_URL || ''}/subscription/mock-checkout?priceId=${params.priceId}&userId=${params.userId}`;
  }

  try {
    // Create or retrieve customer
    let customerId = params.customerId;
    
    if (!customerId && params.email) {
      const existingCustomers = await stripe.customers.list({
        email: params.email,
        limit: 1,
      });
      
      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: params.email,
          metadata: {
            userId: params.userId,
          },
        });
        customerId = customer.id;
      }
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.userId,
      metadata: {
        userId: params.userId,
      },
    };

    if (customerId) {
      sessionParams.customer = customerId;
    }

    if (params.trialDays && params.trialDays > 0) {
      sessionParams.subscription_data = {
        trial_period_days: params.trialDays,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    log.info('Created checkout session', { 
      sessionId: session.id, 
      userId: params.userId,
      priceId: params.priceId 
    });

    return session.url || '';
  } catch (error) {
    log.error('Failed to create checkout session:', error);
    throw error;
  }
}

/**
 * Create a Stripe Customer Portal session
 */
export async function createCustomerPortalSession(params: CustomerPortalParams): Promise<string> {
  if (!stripe) {
    log.warn('Stripe not configured - returning mock portal URL');
    return `${process.env.FRONTEND_URL || ''}/subscription/manage`;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });

    return session.url;
  } catch (error) {
    log.error('Failed to create customer portal session:', error);
    throw error;
  }
}

/**
 * Get Stripe subscription details
 */
export async function getSubscription(subscriptionId: string): Promise<SubscriptionResult | null> {
  if (!stripe) {
    log.warn('Stripe not configured - returning mock subscription');
    return {
      subscriptionId,
      customerId: 'cus_mock',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      priceId: 'price_pro_monthly',
    };
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const priceId = subscription.items.data[0]?.price?.id || '';
    
    return {
      subscriptionId: subscription.id,
      customerId: subscription.customer as string,
      status: subscription.status,
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      priceId,
      trialEnd: (subscription as any).trial_end ? new Date((subscription as any).trial_end * 1000) : undefined,
    };
  } catch (error) {
    log.error('Failed to get subscription:', error);
    return null;
  }
}

/**
 * Cancel a Stripe subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  if (!stripe) {
    log.warn('Stripe not configured - mock cancel');
    return true;
  }

  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    log.info('Subscription marked for cancellation', { subscriptionId });
    return true;
  } catch (error) {
    log.error('Failed to cancel subscription:', error);
    return false;
  }
}

/**
 * Reactivate a canceled subscription
 */
export async function reactivateSubscription(subscriptionId: string): Promise<boolean> {
  if (!stripe) {
    log.warn('Stripe not configured - mock reactivate');
    return true;
  }

  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    log.info('Subscription reactivated', { subscriptionId });
    return true;
  } catch (error) {
    log.error('Failed to reactivate subscription:', error);
    return false;
  }
}

/**
 * Verify Stripe webhook signature and parse event
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event | null {
  if (!stripe || !stripeWebhookSecret) {
    log.warn('Stripe webhook verification not configured - returning parsed event without verification');
    try {
      return JSON.parse(payload.toString());
    } catch {
      return null;
    }
  }

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      stripeWebhookSecret
    );
    return event;
  } catch (error) {
    log.error('Webhook signature verification failed:', error);
    return null;
  }
}

/**
 * Get price ID for a plan
 */
export function getPriceId(planId: string, billingPeriod: 'monthly' | 'yearly' = 'monthly'): string {
  const prices = PRICE_IDS[planId];
  if (!prices) {
    throw new Error('No Stripe price configured for plan: ' + planId);
  }
  return billingPeriod === 'yearly' ? prices.yearly : prices.monthly;
}

/**
 * Map Stripe subscription status to internal status
 */
export function mapStripeStatus(status: Stripe.Subscription.Status): 'active' | 'canceled' | 'expired' | 'past_due' | 'trialing' {
  const statusMap: Record<Stripe.Subscription.Status, 'active' | 'canceled' | 'expired' | 'past_due' | 'trialing'> = {
    active: 'active',
    canceled: 'canceled',
    incomplete: 'expired',
    incomplete_expired: 'expired',
    past_due: 'past_due',
    paused: 'past_due',
    trialing: 'trialing',
    unpaid: 'expired',
  };
  return statusMap[status] || 'active';
}

/**
 * Get plan ID from Stripe price ID
 */
/**
 * Get plan ID from Stripe price ID
 * Uses exact matching or pattern matching to avoid false positives
 */
export function getPlanIdFromPriceId(priceId: string): string {
  // Match patterns like: price_pro_monthly, price_pro_yearly, price_pro_...
  // Or exact match: pro, enterprise, free
  // Or Stripe-style: prod_xxx_price_pro_monthly
  
  const normalizedPriceId = priceId.toLowerCase();
  
  // Exact match first
  if (normalizedPriceId === 'pro' || normalizedPriceId === 'price_pro') {
    return 'pro';
  }
  if (normalizedPriceId === 'enterprise' || normalizedPriceId === 'price_enterprise') {
    return 'enterprise';
  }
  if (normalizedPriceId === 'free' || normalizedPriceId === 'price_free') {
    return 'free';
  }
  
  // Pattern match with underscores to avoid false positives
  // e.g., "price_pro_monthly" contains "_pro_" or starts with "price_pro_"
  if (/(?:^|[_-])pro(?:[_-]|$)/i.test(priceId)) {
    return 'pro';
  }
  if (/(?:^|[_-])enterprise(?:[_-]|$)/i.test(priceId)) {
    return 'enterprise';
  }
  
  return 'free';
}

/**
 * Get customer by email
 */
export async function getCustomerByEmail(email: string): Promise<Stripe.Customer | null> {
  if (!stripe) return null;

  try {
    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });

    return customers.data[0] || null;
  } catch (error) {
    log.error('Failed to get customer by email:', error);
    return null;
  }
}

/**
 * Create a new Stripe customer
 */
export async function createCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<string> {
  if (!stripe) {
    log.warn('Stripe not configured - returning mock customer ID');
    return 'cus_mock_' + userId;
  }

  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        userId,
      },
    });

    log.info('Created Stripe customer', { customerId: customer.id, userId });
    return customer.id;
  } catch (error) {
    log.error('Failed to create customer:', error);
    throw error;
  }
}

export default {
  stripe,
  createCheckoutSession,
  createCustomerPortalSession,
  getSubscription,
  cancelSubscription,
  reactivateSubscription,
  verifyWebhookSignature,
  getPriceId,
  mapStripeStatus,
  getPlanIdFromPriceId,
  getCustomerByEmail,
  createCustomer,
};

// ==================== Coupon & Promotion Code Functions ====================

/**
 * Create a Stripe coupon
 */
export async function createCoupon(params: {
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  duration?: 'once' | 'repeating' | 'forever';
  durationInMonths?: number;
  name?: string;
}): Promise<string> {
  if (!stripe) {
    log.warn('Stripe not configured - returning mock coupon ID');
    return 'coupon_mock_' + Date.now();
  }

  try {
    const couponParams: Stripe.CouponCreateParams = {
      duration: params.duration || 'once',
    };

    if (params.percentOff) {
      couponParams.percent_off = params.percentOff;
    } else if (params.amountOff) {
      couponParams.amount_off = params.amountOff * 100; // Stripe uses cents
      couponParams.currency = params.currency || 'cny';
    }

    if (params.name) {
      couponParams.name = params.name;
    }

    if (params.duration === 'repeating' && params.durationInMonths) {
      couponParams.duration_in_months = params.durationInMonths;
    }

    const coupon = await stripe.coupons.create(couponParams);

    log.info('Created Stripe coupon', { couponId: coupon.id });
    return coupon.id;
  } catch (error) {
    log.error('Failed to create coupon:', error);
    throw error;
  }
}

/**
 * Create a Stripe promotion code
 */
export async function createPromotionCode(params: {
  couponId: string;
  code: string;
  active?: boolean;
  maxRedemptions?: number;
  expiresAt?: Date;
  firstTimeTransaction?: boolean;
  restrictions?: {
    minimumAmount?: number;
    currency?: string;
  };
}): Promise<string> {
  if (!stripe) {
    log.warn('Stripe not configured - returning mock promotion code ID');
    return 'promo_mock_' + Date.now();
  }

  try {
    const promoParams: any = {
      coupon: params.couponId,
      code: params.code.toLowerCase(),
      active: params.active ?? true,
    };

    if (params.maxRedemptions) {
      promoParams.max_redemptions = params.maxRedemptions;
    }

    if (params.expiresAt) {
      promoParams.expires_at = Math.floor(params.expiresAt.getTime() / 1000);
    }

    if (params.firstTimeTransaction) {
      promoParams.restrictions = {
        first_time_transaction: true,
      };
    }

    if (params.restrictions?.minimumAmount) {
      promoParams.restrictions = {
        ...promoParams.restrictions,
        minimum_amount: params.restrictions.minimumAmount * 100,
        minimum_amount_currency: params.restrictions.currency || 'cny',
      };
    }

    const promoCode = await stripe.promotionCodes.create(promoParams);

    log.info('Created Stripe promotion code', { promoCodeId: promoCode.id, code: params.code });
    return promoCode.id;
  } catch (error) {
    log.error('Failed to create promotion code:', error);
    throw error;
  }
}

/**
 * Get Stripe coupon by ID
 */
export async function getCoupon(couponId: string): Promise<Stripe.Coupon | null> {
  if (!stripe) return null;

  try {
    return await stripe.coupons.retrieve(couponId);
  } catch (error) {
    log.error('Failed to get coupon:', error);
    return null;
  }
}

/**
 * Delete a Stripe coupon
 */
export async function deleteCoupon(couponId: string): Promise<boolean> {
  if (!stripe) {
    log.warn('Stripe not configured - mock delete coupon');
    return true;
  }

  try {
    await stripe.coupons.del(couponId);
    log.info('Deleted Stripe coupon', { couponId });
    return true;
  } catch (error) {
    log.error('Failed to delete coupon:', error);
    return false;
  }
}

/**
 * Update a Stripe promotion code
 */
export async function updatePromotionCode(
  promotionCodeId: string,
  params: {
    active?: boolean;
    metadata?: Record<string, string>;
  }
): Promise<Stripe.PromotionCode | null> {
  if (!stripe) return null;

  try {
    return await stripe.promotionCodes.update(promotionCodeId, params);
  } catch (error) {
    log.error('Failed to update promotion code:', error);
    return null;
  }
}

/**
 * Apply promotion code to checkout session
 */
export function applyPromotionCodeToCheckout(
  sessionParams: Stripe.Checkout.SessionCreateParams,
  promotionCodeId?: string
): Stripe.Checkout.SessionCreateParams {
  if (promotionCodeId) {
    sessionParams.discounts = [
      {
        promotion_code: promotionCodeId,
      },
    ];
  }
  return sessionParams;
}
