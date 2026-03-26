/**
 * VIP Subscription System Type Definitions
 */

// Subscription plan types
export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

// Subscription status types
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'pending' | 'past_due';

// Subscription action types for history
export type SubscriptionAction = 
  | 'created' 
  | 'upgraded' 
  | 'downgraded' 
  | 'canceled' 
  | 'renewed' 
  | 'reactivated' 
  | 'expired';

// Billing period
export type BillingPeriod = 'monthly' | 'yearly';

/**
 * Subscription Plan Configuration
 */
export interface SubscriptionPlanConfig {
  plan: SubscriptionPlan;
  name: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  features: Record<string, any>;
  limits: Record<string, number>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * User Subscription
 */
export interface UserSubscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  billing_period?: BillingPeriod;
  current_period_start?: Date;
  current_period_end?: Date;
  cancel_at_period_end: boolean;
  canceled_at?: Date;
  trial_start?: Date;
  trial_end?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Subscription History Entry
 */
export interface SubscriptionHistoryEntry {
  id: string;
  user_id: string;
  action: SubscriptionAction;
  from_plan?: SubscriptionPlan;
  to_plan: SubscriptionPlan;
  reason?: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

/**
 * Feature Permission
 */
export interface FeaturePermission {
  feature_key: string;
  required_plan: SubscriptionPlan;
  description?: string;
  category?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Feature Usage Record
 */
export interface FeatureUsage {
  id: string;
  user_id: string;
  feature_key: string;
  usage_count: number;
  period_start: Date;
  period_end: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Feature Access Check Result
 */
export interface FeatureAccessResult {
  allowed: boolean;
  current_usage: number;
  limit: number;
}

/**
 * Plan Features
 */
export interface PlanFeatures {
  // Trading features
  basic_trading?: boolean;
  advanced_orders?: boolean;
  conditional_orders?: boolean;
  algorithmic_trading?: boolean;
  
  // Data features
  basic_charts?: boolean;
  advanced_charts?: boolean;
  real_time_data?: boolean;
  historical_data_7d?: boolean;
  historical_data_30d?: boolean;
  historical_data_unlimited?: boolean;
  market_data?: 'basic' | 'advanced' | 'premium';
  
  // Strategy features
  single_strategy?: boolean;
  multiple_strategies?: boolean;
  backtesting?: boolean;
  custom_strategies?: boolean;
  
  // VIP Advanced Features (Issue #640)
  multi_timeframe_charts?: boolean; // Multiple timeframes simultaneously
  advanced_indicators?: boolean; // MACD, RSI, Bollinger overlays
  chart_templates?: boolean; // Save/load indicator templates
  chart_export?: boolean; // Chart screenshot export
  backtest_optimization?: boolean; // Parameter optimization
  multi_strategy_comparison?: boolean; // Compare multiple strategies
  backtest_history?: boolean; // Save/load backtest records
  report_export_pdf?: boolean; // PDF report export
  report_export_excel?: boolean; // Excel report export
  
  // API features
  api_basic?: boolean;
  api_advanced?: boolean;
  webhooks?: boolean;
  
  // Support features
  community_support?: boolean;
  email_support?: boolean;
  priority_support?: boolean;
  dedicated_account_manager?: boolean;
  
  // Portfolio features
  portfolio_tracking?: boolean;
  portfolio_analytics?: boolean;
  tax_reporting?: boolean;
  
  // Alert features
  price_alerts?: boolean;
  advanced_alerts?: boolean;
  custom_alerts?: boolean;
  
  // Other
  alerts?: boolean;
  all_pro_features?: boolean;
  white_label?: boolean;
}

/**
 * Plan Limits
 */
export interface PlanLimits {
  strategies: number; // -1 for unlimited
  historical_data_days: number; // -1 for unlimited
  backtests_per_day: number; // -1 for unlimited
  api_calls_per_day: number; // -1 for unlimited
  // VIP Advanced Features Limits (Issue #640)
  chart_timeframes: number; // Max timeframes to display simultaneously
  saved_chart_templates: number; // Max saved indicator templates
  backtest_optimizations: number; // Max parameter optimizations per day
  backtest_history_records: number; // Max saved backtest records
  strategy_comparisons: number; // Max strategies to compare at once
}

/**
 * Create Subscription Data
 */
export interface CreateSubscriptionData {
  user_id: string;
  plan: SubscriptionPlan;
  status?: SubscriptionStatus;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  billing_period?: BillingPeriod;
  current_period_start?: Date;
  current_period_end?: Date;
  trial_start?: Date;
  trial_end?: Date;
}

/**
 * Update Subscription Data
 */
export interface UpdateSubscriptionData {
  plan?: SubscriptionPlan;
  status?: SubscriptionStatus;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  billing_period?: BillingPeriod;
  current_period_start?: Date;
  current_period_end?: Date;
  cancel_at_period_end?: boolean;
  canceled_at?: Date;
  trial_start?: Date;
  trial_end?: Date;
}

/**
 * Subscription with plan details (for client consumption)
 */
export interface SubscriptionWithPlan extends UserSubscription {
  plan_details: {
    name: string;
    price_monthly: number;
    price_yearly: number;
    currency: string;
    features: PlanFeatures;
    limits: PlanLimits;
  };
}

/**
 * Plan Hierarchy (for comparison)
 */
export const PLAN_HIERARCHY: Record<SubscriptionPlan, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

/**
 * Check if plan A is equal or higher than plan B
 */
export function isPlanEqualOrHigher(planA: SubscriptionPlan, planB: SubscriptionPlan): boolean {
  return PLAN_HIERARCHY[planA] >= PLAN_HIERARCHY[planB];
}

/**
 * Get default limits for a plan
 */
export function getDefaultPlanLimits(plan: SubscriptionPlan): PlanLimits {
  const limits: Record<SubscriptionPlan, PlanLimits> = {
    free: {
      strategies: 1,
      historical_data_days: 7,
      backtests_per_day: 1,
      api_calls_per_day: 100,
      // VIP Advanced Features - Free tier gets minimal/no access
      chart_timeframes: 1, // Single timeframe only
      saved_chart_templates: 0, // No template saving
      backtest_optimizations: 0, // No parameter optimization
      backtest_history_records: 0, // No history saving
      strategy_comparisons: 0, // No multi-strategy comparison
    },
    pro: {
      strategies: 10,
      historical_data_days: 30,
      backtests_per_day: 50,
      api_calls_per_day: 10000,
      // VIP Advanced Features - Pro tier gets full access
      chart_timeframes: 4, // Up to 4 timeframes
      saved_chart_templates: 10, // Save up to 10 templates
      backtest_optimizations: 20, // 20 optimizations per day
      backtest_history_records: 100, // Save up to 100 records
      strategy_comparisons: 4, // Compare up to 4 strategies
    },
    enterprise: {
      strategies: -1, // unlimited
      historical_data_days: -1,
      backtests_per_day: -1,
      api_calls_per_day: -1,
      // VIP Advanced Features - Enterprise gets unlimited
      chart_timeframes: -1,
      saved_chart_templates: -1,
      backtest_optimizations: -1,
      backtest_history_records: -1,
      strategy_comparisons: -1,
    },
  };
  
  return limits[plan];
}

/**
 * Plan display names
 */
export const PLAN_DISPLAY_NAMES: Record<SubscriptionPlan, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

/**
 * Plan prices (in USD)
 */
export const PLAN_PRICES: Record<SubscriptionPlan, { monthly: number; yearly: number }> = {
  free: { monthly: 0, yearly: 0 },
  pro: { monthly: 9.99, yearly: 99.99 },
  enterprise: { monthly: 49.99, yearly: 499.99 },
};