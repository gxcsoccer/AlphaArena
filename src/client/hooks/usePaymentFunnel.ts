/**
 * Payment Funnel Tracking Hook
 * Issue #662: 支付转化漏斗优化
 * 
 * Client-side hook for tracking payment funnel events
 */

import { useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

// ==================== Types ====================

export type FunnelStage =
  | 'subscription_page_view'
  | 'plan_selected'
  | 'checkout_initiated'
  | 'checkout_loaded'
  | 'payment_method_entered'
  | 'payment_submitted'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'checkout_canceled';

export type DropOffReason =
  | 'price_concern'
  | 'comparison'
  | 'complexity'
  | 'technical_issue'
  | 'payment_declined'
  | 'timeout'
  | 'distracted'
  | 'not_ready'
  | 'trust_issue'
  | 'missing_features'
  | 'unknown';

export interface FunnelEventOptions {
  stage: FunnelStage;
  userId?: string;
  planId?: string;
  billingPeriod?: 'monthly' | 'yearly';
  priceAmount?: number;
  stripeSessionId?: string;
  dropOffReason?: DropOffReason;
  dropOffDetails?: Record<string, any>;
  experimentId?: string;
  variantId?: string;
  pageUrl?: string;
}

export interface UsePaymentFunnelOptions {
  /** Session ID (will be generated if not provided) */
  sessionId?: string;
  /** User ID (if logged in) */
  userId?: string;
  /** A/B experiment ID */
  experimentId?: string;
  /** A/B variant ID */
  variantId?: string;
  /** Enable debug logging */
  debug?: boolean;
}

// ==================== Helpers ====================

/**
 * Detect device type
 */
function detectDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown';
  
  const ua = navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile';
  }
  if (/tablet|ipad/i.test(ua)) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * Detect browser
 */
function detectBrowser(): string {
  if (typeof window === 'undefined') return 'unknown';
  
  const ua = navigator.userAgent;
  if (ua.includes('Chrome')) return 'chrome';
  if (ua.includes('Safari')) return 'safari';
  if (ua.includes('Firefox')) return 'firefox';
  if (ua.includes('Edge')) return 'edge';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'opera';
  return 'other';
}

/**
 * Detect OS
 */
function detectOS(): string {
  if (typeof window === 'undefined') return 'unknown';
  
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'windows';
  if (ua.includes('Mac')) return 'macos';
  if (ua.includes('Linux')) return 'linux';
  if (ua.includes('Android')) return 'android';
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'ios';
  return 'other';
}

// ==================== Hook ====================

export function usePaymentFunnel(options: UsePaymentFunnelOptions = {}) {
  const {
    sessionId: providedSessionId,
    userId,
    experimentId,
    variantId,
    debug = false,
  } = options;

  // Generate or use provided session ID
  const sessionIdRef = useRef<string>(
    providedSessionId || sessionStorage.getItem('payment_funnel_session') || uuidv4()
  );

  // Store session ID in sessionStorage for persistence
  useEffect(() => {
    if (!providedSessionId) {
      sessionStorage.setItem('payment_funnel_session', sessionIdRef.current);
    }
  }, [providedSessionId]);

  // Track page view time
  const pageLoadTimeRef = useRef<number>(Date.now());

  // Track stage times
  const stageTimesRef = useRef<Map<FunnelStage, number>>(new Map());

  /**
   * Track a funnel event
   */
  const trackEvent = useCallback(async (eventOptions: FunnelEventOptions) => {
    const timeOnPage = Math.floor((Date.now() - pageLoadTimeRef.current) / 1000);
    
    // Calculate time to this action from previous stage
    const previousStages = Array.from(stageTimesRef.current.keys());
    const timeToAction = previousStages.length > 0
      ? Math.floor((Date.now() - (stageTimesRef.current.get(previousStages[previousStages.length - 1]) || 0)) / 1000)
      : timeOnPage;

    const eventData = {
      sessionId: sessionIdRef.current,
      stage: eventOptions.stage,
      userId: eventOptions.userId || userId,
      planId: eventOptions.planId,
      billingPeriod: eventOptions.billingPeriod,
      priceAmount: eventOptions.priceAmount,
      stripeSessionId: eventOptions.stripeSessionId,
      dropOffReason: eventOptions.dropOffReason,
      dropOffDetails: eventOptions.dropOffDetails,
      experimentId: eventOptions.experimentId || experimentId,
      variantId: eventOptions.variantId || variantId,
      timeOnPageSeconds: timeOnPage,
      timeToActionSeconds: timeToAction,
      pageUrl: eventOptions.pageUrl || (typeof window !== 'undefined' ? window.location.href : undefined),
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      deviceType: detectDeviceType(),
      country: undefined, // Will be detected server-side
    };

    // Record stage time
    stageTimesRef.current.set(eventOptions.stage, Date.now());

    if (debug) {
      console.log('[PaymentFunnel] Tracking event:', eventData);
    }

    try {
      const response = await fetch('/api/payment-funnel/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(eventData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('[PaymentFunnel] Failed to track event:', result.error);
      } else if (debug) {
        console.log('[PaymentFunnel] Event tracked:', result.eventId);
      }

      return result;
    } catch (error) {
      console.error('[PaymentFunnel] Error tracking event:', error);
      return { success: false, error };
    }
  }, [userId, experimentId, variantId, debug]);

  /**
   * Track subscription page view
   */
  const trackPageView = useCallback(() => {
    return trackEvent({ stage: 'subscription_page_view' });
  }, [trackEvent]);

  /**
   * Track plan selection
   */
  const trackPlanSelected = useCallback((
    planId: string,
    billingPeriod: 'monthly' | 'yearly',
    priceAmount: number
  ) => {
    return trackEvent({
      stage: 'plan_selected',
      planId,
      billingPeriod,
      priceAmount,
    });
  }, [trackEvent]);

  /**
   * Track checkout initiated
   */
  const trackCheckoutInitiated = useCallback((
    planId: string,
    billingPeriod: 'monthly' | 'yearly',
    priceAmount: number
  ) => {
    return trackEvent({
      stage: 'checkout_initiated',
      planId,
      billingPeriod,
      priceAmount,
    });
  }, [trackEvent]);

  /**
   * Track checkout loaded (after Stripe page loads)
   */
  const trackCheckoutLoaded = useCallback((stripeSessionId: string) => {
    return trackEvent({
      stage: 'checkout_loaded',
      stripeSessionId,
    });
  }, [trackEvent]);

  /**
   * Track payment success
   */
  const trackPaymentSucceeded = useCallback((
    stripeSessionId: string,
    planId?: string
  ) => {
    return trackEvent({
      stage: 'payment_succeeded',
      stripeSessionId,
      planId,
    });
  }, [trackEvent]);

  /**
   * Track payment failure
   */
  const trackPaymentFailed = useCallback((
    stripeSessionId: string,
    reason: DropOffReason,
    details?: Record<string, any>
  ) => {
    return trackEvent({
      stage: 'payment_failed',
      stripeSessionId,
      dropOffReason: reason,
      dropOffDetails: details,
    });
  }, [trackEvent]);

  /**
   * Track checkout canceled
   */
  const trackCheckoutCanceled = useCallback((
    reason: DropOffReason,
    details?: Record<string, any>
  ) => {
    return trackEvent({
      stage: 'checkout_canceled',
      dropOffReason: reason,
      dropOffDetails: details,
    });
  }, [trackEvent]);

  /**
   * Get session ID
   */
  const getSessionId = useCallback(() => {
    return sessionIdRef.current;
  }, []);

  /**
   * Reset session (e.g., after successful payment)
   */
  const resetSession = useCallback(() => {
    sessionIdRef.current = uuidv4();
    sessionStorage.setItem('payment_funnel_session', sessionIdRef.current);
    stageTimesRef.current.clear();
    pageLoadTimeRef.current = Date.now();

    if (debug) {
      console.log('[PaymentFunnel] Session reset:', sessionIdRef.current);
    }
  }, [debug]);

  return {
    // Core tracking
    trackEvent,
    
    // Convenience methods
    trackPageView,
    trackPlanSelected,
    trackCheckoutInitiated,
    trackCheckoutLoaded,
    trackPaymentSucceeded,
    trackPaymentFailed,
    trackCheckoutCanceled,
    
    // Utilities
    getSessionId,
    resetSession,
    
    // Session info
    sessionId: sessionIdRef.current,
  };
}

export default usePaymentFunnel;