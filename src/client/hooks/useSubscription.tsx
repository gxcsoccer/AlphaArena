/**
 * useSubscription Hook
 * React hook for accessing and managing user subscription state
 */

import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { validateConfig } from '../utils/config';
import {
  SubscriptionPlan,
  UserSubscription,
  SubscriptionWithPlan,
  PlanFeatures,
  PlanLimits,
  PLAN_HIERARCHY,
} from '../../types/subscription.types';

/**
 * Subscription context value
 */
interface SubscriptionContextValue {
  subscription: SubscriptionWithPlan | null;
  loading: boolean;
  error: Error | null;
  plan: SubscriptionPlan;
  isPro: boolean;
  isEnterprise: boolean;
  isFree: boolean;
  features: PlanFeatures | null;
  limits: PlanLimits | null;
  isActive: boolean;
  isTrial: boolean;
  daysUntilExpiry: number | null;
  refresh: () => Promise<void>;
  checkFeatureAccess: (featureKey: string) => Promise<boolean>;
  checkMultipleFeatures: (featureKeys: string[]) => Promise<Record<string, boolean>>;
  checkFeatureLimit: (featureKey: string) => Promise<{ allowed: boolean; current: number; limit: number }>;
  incrementFeatureUsage: (featureKey: string) => Promise<number>;
}

// Create context
const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

/**
 * Subscription Provider Component
 * Wrap your app or a section with this to provide subscription state
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const config = validateConfig();
  // Use config.apiUrl - no hardcoded fallbacks
  const apiUrl = config.apiUrl;
  if (!apiUrl) {
    console.error('[useSubscription] VITE_API_URL not configured');
    return null;
  }

  // Fetch subscription data
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${apiUrl}/subscription/current`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated, use free plan
          setSubscription(null);
          return;
        }
        throw new Error(`Failed to fetch subscription: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSubscription(data.subscription);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      console.error('Error fetching subscription:', err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  // Fetch on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Check feature access
  const checkFeatureAccess = useCallback(async (featureKey: string): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/subscription/features/${featureKey}/check`, {
        credentials: 'include',
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      return data.hasAccess;
    } catch (err) {
      console.error('Error checking feature access:', err);
      return false;
    }
  }, [apiUrl]);

  // Check multiple features
  const checkMultipleFeatures = useCallback(async (
    featureKeys: string[]
  ): Promise<Record<string, boolean>> => {
    try {
      const response = await fetch(`${apiUrl}/subscription/features/check-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ features: featureKeys }),
      });
      
      if (!response.ok) return {};
      
      const data = await response.json();
      return data.accesses || {};
    } catch (err) {
      console.error('Error checking multiple features:', err);
      return {};
    }
  }, [apiUrl]);

  // Check feature limit
  const checkFeatureLimit = useCallback(async (
    featureKey: string
  ): Promise<{ allowed: boolean; current: number; limit: number }> => {
    try {
      const response = await fetch(`${apiUrl}/subscription/features/${featureKey}/limit`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        return { allowed: false, current: 0, limit: 0 };
      }
      
      const data = await response.json();
      return {
        allowed: data.allowed,
        current: data.current_usage,
        limit: data.limit,
      };
    } catch (err) {
      console.error('Error checking feature limit:', err);
      return { allowed: false, current: 0, limit: 0 };
    }
  }, [apiUrl]);

  // Increment feature usage
  const incrementFeatureUsage = useCallback(async (featureKey: string): Promise<number> => {
    try {
      const response = await fetch(`${apiUrl}/subscription/features/${featureKey}/usage`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) return 0;
      
      const data = await response.json();
      return data.usage_count;
    } catch (err) {
      console.error('Error incrementing feature usage:', err);
      return 0;
    }
  }, [apiUrl]);

  // Derived values
  const plan: SubscriptionPlan = subscription?.plan || 'free';
  const isFree = plan === 'free';
  const isPro = plan === 'pro';
  const isEnterprise = plan === 'enterprise';
  const features: PlanFeatures | null = subscription?.plan_details?.features || null;
  const limits: PlanLimits | null = subscription?.plan_details?.limits || null;
  const isActive = subscription?.status === 'active' || subscription?.status === 'past_due';
  
  const isTrial = subscription?.trial_end && new Date(subscription.trial_end) > new Date() || false;
  
  const daysUntilExpiry = subscription?.current_period_end
    ? Math.ceil(
        (new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  const value: SubscriptionContextValue = {
    subscription,
    loading,
    error,
    plan,
    isPro,
    isEnterprise,
    isFree,
    features,
    limits,
    isActive,
    isTrial,
    daysUntilExpiry,
    refresh,
    checkFeatureAccess,
    checkMultipleFeatures,
    checkFeatureLimit,
    incrementFeatureUsage,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * useSubscription Hook
 * Access subscription state and methods
 */
export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  
  return context;
}

/**
 * useFeatureAccess Hook
 * Simplified hook for checking a single feature
 */
export function useFeatureAccess(featureKey: string): {
  hasAccess: boolean;
  loading: boolean;
  check: () => Promise<boolean>;
} {
  const { checkFeatureAccess, plan } = useSubscription();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    setLoading(true);
    const result = await checkFeatureAccess(featureKey);
    setHasAccess(result);
    setLoading(false);
    return result;
  }, [featureKey, checkFeatureAccess]);

  useEffect(() => {
    check();
  }, [check]);

  return { hasAccess, loading, check };
}

/**
 * useFeatureLimit Hook
 * Track usage and limits for a feature
 */
export function useFeatureLimit(featureKey: string): {
  allowed: boolean;
  current: number;
  limit: number;
  loading: boolean;
  increment: () => Promise<number>;
  refresh: () => Promise<void>;
} {
  const { checkFeatureLimit, incrementFeatureUsage } = useSubscription();
  const [state, setState] = useState({
    allowed: true,
    current: 0,
    limit: -1,
    loading: true,
  });

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    const result = await checkFeatureLimit(featureKey);
    setState({
      ...result,
      loading: false,
    });
  }, [featureKey, checkFeatureLimit]);

  const increment = useCallback(async () => {
    const newCount = await incrementFeatureUsage(featureKey);
    setState(prev => ({
      ...prev,
      current: newCount,
      allowed: prev.limit === -1 || newCount < prev.limit,
    }));
    return newCount;
  }, [featureKey, incrementFeatureUsage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, increment, refresh };
}

/**
 * usePlan Hook
 * Get current plan and compare with required plan
 */
export function usePlan(): {
  plan: SubscriptionPlan;
  isFree: boolean;
  isPro: boolean;
  isEnterprise: boolean;
  isAtLeast: (requiredPlan: SubscriptionPlan) => boolean;
} {
  const { plan } = useSubscription();
  
  const isAtLeast = useCallback((requiredPlan: SubscriptionPlan): boolean => {
    return PLAN_HIERARCHY[plan] >= PLAN_HIERARCHY[requiredPlan];
  }, [plan]);

  return {
    plan,
    isFree: plan === 'free',
    isPro: plan === 'pro',
    isEnterprise: plan === 'enterprise',
    isAtLeast,
  };
}

// Export types
export type { SubscriptionContextValue };