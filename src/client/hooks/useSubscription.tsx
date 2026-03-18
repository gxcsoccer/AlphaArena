/**
 * useSubscription Hook
 * Provides subscription state, usage data, and feature access checks
 */

import { useState, useEffect, useCallback, useContext, createContext, ReactNode } from 'react';
import { useAuth } from './useAuth';

// Types
export interface PlanLimits {
  concurrentStrategies: number;
  dailyBacktests: number;
  dataRetention: number;
  apiCalls: number;
  aiAssistantMessages?: number;
  [key: string]: number;
}

export interface FeatureUsage {
  featureKey: string;
  limit: number;
  currentUsage: number;
  remaining: number;
  resetAt?: Date;
}

export interface SubscriptionStatus {
  planId: string;
  planName: string;
  status: 'active' | 'canceled' | 'expired' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  features: Record<string, unknown>;
  limits: PlanLimits;
  cancelAtPeriodEnd: boolean;
}

export interface SubscriptionState {
  subscription: SubscriptionStatus | null;
  usage: Record<string, FeatureUsage>;
  isLoading: boolean;
  error: string | null;
  isPro: boolean;
  isEnterprise: boolean;
}

interface SubscriptionContextType extends SubscriptionState {
  refreshSubscription: () => Promise<void>;
  checkFeatureAccess: (featureKey: string) => Promise<FeatureUsage | null>;
  hasFeature: (featureKey: string) => boolean;
  getUsagePercentage: (featureKey: string) => number;
  isNearLimit: (featureKey: string, threshold?: number) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// API helper
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

async function fetchSubscription(): Promise<SubscriptionStatus> {
  const token = localStorage.getItem('auth_access_token') || localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE_URL}/api/subscriptions`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch subscription');
  }

  const result = await response.json();
  return result.data;
}

async function fetchFeatureUsage(featureKey: string): Promise<FeatureUsage> {
  const token = localStorage.getItem('auth_access_token') || localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE_URL}/api/subscriptions/usage/${featureKey}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch feature usage');
  }

  const result = await response.json();
  return result.data;
}

async function fetchAllUsage(): Promise<Record<string, FeatureUsage>> {
  const token = localStorage.getItem('auth_access_token') || localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE_URL}/api/subscriptions/usage`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch usage');
  }

  const result = await response.json();
  return result.data || {};
}

// Provider component
interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    subscription: null,
    usage: {},
    isLoading: true,
    error: null,
    isPro: false,
    isEnterprise: false,
  });

  const refreshSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      setState(prev => ({
        ...prev,
        subscription: null,
        usage: {},
        isLoading: false,
        isPro: false,
        isEnterprise: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [subscription, usage] = await Promise.all([
        fetchSubscription(),
        fetchAllUsage().catch(() => ({})), // Don't fail if usage fetch fails
      ]);

      const isPro = subscription.planId === 'pro' || subscription.planId === 'enterprise';
      const isEnterprise = subscription.planId === 'enterprise';

      setState({
        subscription,
        usage,
        isLoading: false,
        error: null,
        isPro,
        isEnterprise,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load subscription',
      }));
    }
  }, [isAuthenticated]);

  // Initial fetch
  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  const checkFeatureAccess = useCallback(async (featureKey: string): Promise<FeatureUsage | null> => {
    try {
      const usage = await fetchFeatureUsage(featureKey);
      setState(prev => ({
        ...prev,
        usage: { ...prev.usage, [featureKey]: usage },
      }));
      return usage;
    } catch (error) {
      console.error('Failed to check feature access:', error);
      return null;
    }
  }, []);

  const hasFeature = useCallback((featureKey: string): boolean => {
    const { subscription } = state;
    if (!subscription) return false;
    
    // Pro users have access to all features
    if (state.isPro) return true;
    
    // Check if feature is in the plan features
    const featureValue = subscription.features[featureKey];
    if (typeof featureValue === 'boolean') return featureValue;
    if (typeof featureValue === 'number') return featureValue > 0;
    
    return false;
  }, [state]);

  const getUsagePercentage = useCallback((featureKey: string): number => {
    const usage = state.usage[featureKey];
    if (!usage || usage.limit <= 0) return 0;
    return Math.min(100, (usage.currentUsage / usage.limit) * 100);
  }, [state.usage]);

  const isNearLimit = useCallback((featureKey: string, threshold: number = 80): boolean => {
    return getUsagePercentage(featureKey) >= threshold;
  }, [getUsagePercentage]);

  const value: SubscriptionContextType = {
    ...state,
    refreshSubscription,
    checkFeatureAccess,
    hasFeature,
    getUsagePercentage,
    isNearLimit,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// Hook to use subscription context
export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

export default useSubscription;
