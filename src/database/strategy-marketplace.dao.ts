/**
 * Strategy Marketplace DAO
 * Data access layer for strategy marketplace operations
 */

import { getSupabaseClient } from './client';

// ==================== Types ====================

export type StrategyVisibility = 'public' | 'private' | 'unlisted';
export type StrategyStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'delisted';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired';
export type SignalType = 'entry' | 'exit' | 'stop_loss' | 'take_profit' | 'update';
export type RiskLevel = 'low' | 'medium' | 'high' | 'very_high';
export type ReviewStatus = 'active' | 'hidden' | 'deleted';
export type TransactionType = 'subscription_fee' | 'performance_fee' | 'withdrawal' | 'refund';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface PerformanceMetrics {
  totalReturn?: number | null;
  annualizedReturn?: number | null;
  sharpeRatio?: number | null;
  maxDrawdown?: number | null;
  winRate?: number | null;
  profitFactor?: number | null;
  avgTradeDuration?: number | null;
  totalTrades?: number | null;
}

export interface MarketplaceStrategy {
  id: string;
  publisherId: string;
  name: string;
  description: string | null;
  strategyType: string;
  category: string;
  symbols: string[];
  config: Record<string, unknown>;
  riskParams: Record<string, unknown>;
  tags: string[];
  visibility: StrategyVisibility;
  status: StrategyStatus;
  performanceMetrics: PerformanceMetrics;
  backtestPeriod: Record<string, unknown> | null;
  backtestStats: Record<string, unknown> | null;
  subscriptionFee: number;
  feeCurrency: string;
  revenueSharePercent: number;
  subscriberCount: number;
  viewCount: number;
  ratingAvg: number;
  ratingCount: number;
  signalCount: number;
  isFeatured: boolean;
  isVerified: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStrategyInput {
  publisherId: string;
  name: string;
  description?: string;
  strategyType: string;
  category?: string;
  symbols?: string[];
  config?: Record<string, unknown>;
  riskParams?: Record<string, unknown>;
  tags?: string[];
  visibility?: StrategyVisibility;
  subscriptionFee?: number;
  feeCurrency?: string;
  revenueSharePercent?: number;
  performanceMetrics?: PerformanceMetrics;
  backtestPeriod?: Record<string, unknown>;
  backtestStats?: Record<string, unknown>;
}

export interface UpdateStrategyInput {
  name?: string;
  description?: string;
  category?: string;
  symbols?: string[];
  config?: Record<string, unknown>;
  riskParams?: Record<string, unknown>;
  tags?: string[];
  visibility?: StrategyVisibility;
  status?: StrategyStatus;
  subscriptionFee?: number;
  performanceMetrics?: PerformanceMetrics;
  isFeatured?: boolean;
  isVerified?: boolean;
}

export interface StrategyFilters {
  publisherId?: string;
  strategyType?: string;
  category?: string;
  status?: StrategyStatus;
  visibility?: StrategyVisibility;
  isFeatured?: boolean;
  isVerified?: boolean;
  minRating?: number;
  search?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'rating_avg' | 'subscriber_count' | 'view_count' | 'name';
  orderDirection?: 'asc' | 'desc';
}

// ==================== Marketplace Strategies DAO ====================

export class MarketplaceStrategiesDAO {
  async create(input: CreateStrategyInput): Promise<MarketplaceStrategy> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('marketplace_strategies')
      .insert({
        publisher_id: input.publisherId,
        name: input.name,
        description: input.description || null,
        strategy_type: input.strategyType,
        category: input.category || 'general',
        symbols: input.symbols || [],
        config: input.config || {},
        risk_params: input.riskParams || {},
        tags: input.tags || [],
        visibility: input.visibility || 'public',
        subscription_fee: input.subscriptionFee || 0,
        fee_currency: input.feeCurrency || 'USDT',
        revenue_share_percent: input.revenueSharePercent || 70,
        performance_metrics: input.performanceMetrics || {},
        backtest_period: input.backtestPeriod || null,
        backtest_stats: input.backtestStats || null,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToStrategy(data);
  }

  async getById(id: string): Promise<MarketplaceStrategy | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('marketplace_strategies')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToStrategy(data);
  }

  async getMany(filters: StrategyFilters = {}): Promise<MarketplaceStrategy[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('marketplace_strategies').select('*');

    if (filters.publisherId) {
      query = query.eq('publisher_id', filters.publisherId);
    }
    if (filters.strategyType) {
      query = query.eq('strategy_type', filters.strategyType);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.visibility) {
      query = query.eq('visibility', filters.visibility);
    }
    if (filters.isFeatured !== undefined) {
      query = query.eq('is_featured', filters.isFeatured);
    }
    if (filters.isVerified !== undefined) {
      query = query.eq('is_verified', filters.isVerified);
    }
    if (filters.minRating !== undefined) {
      query = query.gte('rating_avg', filters.minRating);
    }
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }
    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    const orderBy = filters.orderBy || 'created_at';
    const orderDirection = filters.orderDirection || 'desc';
    query = query.order(orderBy, { ascending: orderDirection === 'asc' });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map(this.mapToStrategy);
  }

  async update(id: string, input: UpdateStrategyInput): Promise<MarketplaceStrategy> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.symbols !== undefined) updateData.symbols = input.symbols;
    if (input.config !== undefined) updateData.config = input.config;
    if (input.riskParams !== undefined) updateData.risk_params = input.riskParams;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.visibility !== undefined) updateData.visibility = input.visibility;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.subscriptionFee !== undefined) updateData.subscription_fee = input.subscriptionFee;
    if (input.performanceMetrics !== undefined) updateData.performance_metrics = input.performanceMetrics;
    if (input.isFeatured !== undefined) updateData.is_featured = input.isFeatured;
    if (input.isVerified !== undefined) updateData.is_verified = input.isVerified;

    const { data, error } = await supabase
      .from('marketplace_strategies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToStrategy(data);
  }

  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('marketplace_strategies')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async publish(id: string): Promise<MarketplaceStrategy> {
    return this.update(id, {
      status: 'pending_review',
      visibility: 'public',
    });
  }

  async approve(id: string): Promise<MarketplaceStrategy> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('marketplace_strategies')
      .update({
        status: 'approved',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToStrategy(data);
  }

  async reject(id: string): Promise<MarketplaceStrategy> {
    return this.update(id, { status: 'rejected' });
  }

  async incrementViews(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc('increment_strategy_views', { strategy_uuid: id });
    if (error) console.error('Failed to increment strategy views:', error);
  }

  async getCategories(): Promise<string[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('marketplace_strategies')
      .select('category')
      .eq('status', 'approved')
      .eq('visibility', 'public');

    if (error) throw error;

    const categories = Array.from(new Set((data || []).map((row) => row.category)));
    return categories.sort();
  }

  async getTags(): Promise<string[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('marketplace_strategies')
      .select('tags')
      .eq('status', 'approved')
      .eq('visibility', 'public');

    if (error) throw error;

    const tags = new Set<string>();
    (data || []).forEach((row) => {
      (row.tags as string[]).forEach((tag) => tags.add(tag));
    });

    return Array.from(tags).sort();
  }

  private mapToStrategy(row: Record<string, unknown>): MarketplaceStrategy {
    return {
      id: row.id as string,
      publisherId: row.publisher_id as string,
      name: row.name as string,
      description: row.description as string | null,
      strategyType: row.strategy_type as string,
      category: row.category as string,
      symbols: row.symbols as string[] || [],
      config: row.config as Record<string, unknown> || {},
      riskParams: row.risk_params as Record<string, unknown> || {},
      tags: row.tags as string[] || [],
      visibility: row.visibility as StrategyVisibility,
      status: row.status as StrategyStatus,
      performanceMetrics: row.performance_metrics as PerformanceMetrics || {},
      backtestPeriod: row.backtest_period as Record<string, unknown> | null,
      backtestStats: row.backtest_stats as Record<string, unknown> | null,
      subscriptionFee: parseFloat(row.subscription_fee as string) || 0,
      feeCurrency: row.fee_currency as string,
      revenueSharePercent: parseFloat(row.revenue_share_percent as string) || 70,
      subscriberCount: row.subscriber_count as number || 0,
      viewCount: row.view_count as number || 0,
      ratingAvg: parseFloat(row.rating_avg as string) || 0,
      ratingCount: row.rating_count as number || 0,
      signalCount: row.signal_count as number || 0,
      isFeatured: row.is_featured as boolean || false,
      isVerified: row.is_verified as boolean || false,
      publishedAt: row.published_at ? new Date(row.published_at as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// ==================== Strategy Subscriptions DAO ====================

export interface StrategySubscription {
  id: string;
  subscriberId: string;
  strategyId: string;
  autoExecute: boolean;
  copyRatio: number;
  fixedAmount: number | null;
  maxRiskPerTrade: number | null;
  allowedSymbols: string[];
  blockedSymbols: string[];
  notifySignal: boolean;
  notifyExecution: boolean;
  status: SubscriptionStatus;
  startedAt: Date;
  expiresAt: Date | null;
  cancelledAt: Date | null;
  signalsReceived: number;
  signalsExecuted: number;
  totalPnl: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  subscriberId: string;
  strategyId: string;
  autoExecute?: boolean;
  copyRatio?: number;
  fixedAmount?: number;
  maxRiskPerTrade?: number;
  allowedSymbols?: string[];
  blockedSymbols?: string[];
  notifySignal?: boolean;
  notifyExecution?: boolean;
  expiresAt?: Date;
}

export interface UpdateSubscriptionInput {
  autoExecute?: boolean;
  copyRatio?: number;
  fixedAmount?: number;
  maxRiskPerTrade?: number;
  allowedSymbols?: string[];
  blockedSymbols?: string[];
  notifySignal?: boolean;
  notifyExecution?: boolean;
  status?: SubscriptionStatus;
  expiresAt?: Date;
  cancelledAt?: Date;
}

export interface SubscriptionFilters {
  subscriberId?: string;
  strategyId?: string;
  status?: SubscriptionStatus;
  limit?: number;
  offset?: number;
}

export class StrategySubscriptionsDAO {
  async create(input: CreateSubscriptionInput): Promise<StrategySubscription> {
    const supabase = getSupabaseClient();

    // Check if already subscribed
    const existing = await this.getBySubscriberAndStrategy(input.subscriberId, input.strategyId);
    if (existing && existing.status === 'active') {
      throw new Error('Already subscribed to this strategy');
    }

    // If cancelled/expired, reactivate
    if (existing) {
      return this.update(existing.id, { status: 'active', cancelledAt: undefined });
    }

    const { data, error } = await supabase
      .from('strategy_marketplace_subscriptions')
      .insert({
        subscriber_id: input.subscriberId,
        strategy_id: input.strategyId,
        auto_execute: input.autoExecute ?? false,
        copy_ratio: input.copyRatio ?? 1.0,
        fixed_amount: input.fixedAmount || null,
        max_risk_per_trade: input.maxRiskPerTrade || null,
        allowed_symbols: input.allowedSymbols || [],
        blocked_symbols: input.blockedSymbols || [],
        notify_signal: input.notifySignal ?? true,
        notify_execution: input.notifyExecution ?? true,
        expires_at: input.expiresAt?.toISOString() || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Increment subscriber count
    await supabase.rpc('increment_strategy_subscribers', { strategy_uuid: input.strategyId });

    return this.mapToSubscription(data);
  }

  async getById(id: string): Promise<StrategySubscription | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_marketplace_subscriptions')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToSubscription(data);
  }

  async getBySubscriberAndStrategy(subscriberId: string, strategyId: string): Promise<StrategySubscription | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_marketplace_subscriptions')
      .select('*')
      .eq('subscriber_id', subscriberId)
      .eq('strategy_id', strategyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToSubscription(data);
  }

  async getMany(filters: SubscriptionFilters = {}): Promise<StrategySubscription[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('strategy_marketplace_subscriptions').select('*');

    if (filters.subscriberId) {
      query = query.eq('subscriber_id', filters.subscriberId);
    }
    if (filters.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('created_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data.map(this.mapToSubscription);
  }

  async update(id: string, input: UpdateSubscriptionInput): Promise<StrategySubscription> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.autoExecute !== undefined) updateData.auto_execute = input.autoExecute;
    if (input.copyRatio !== undefined) updateData.copy_ratio = input.copyRatio;
    if (input.fixedAmount !== undefined) updateData.fixed_amount = input.fixedAmount;
    if (input.maxRiskPerTrade !== undefined) updateData.max_risk_per_trade = input.maxRiskPerTrade;
    if (input.allowedSymbols !== undefined) updateData.allowed_symbols = input.allowedSymbols;
    if (input.blockedSymbols !== undefined) updateData.blocked_symbols = input.blockedSymbols;
    if (input.notifySignal !== undefined) updateData.notify_signal = input.notifySignal;
    if (input.notifyExecution !== undefined) updateData.notify_execution = input.notifyExecution;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.expiresAt !== undefined) updateData.expires_at = input.expiresAt?.toISOString() || null;
    if (input.cancelledAt !== undefined) updateData.cancelled_at = input.cancelledAt?.toISOString() || null;

    const { data, error } = await supabase
      .from('strategy_marketplace_subscriptions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToSubscription(data);
  }

  async pause(id: string): Promise<StrategySubscription> {
    return this.update(id, { status: 'paused' });
  }

  async resume(id: string): Promise<StrategySubscription> {
    return this.update(id, { status: 'active' });
  }

  async cancel(id: string): Promise<StrategySubscription> {
    const subscription = await this.update(id, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    // Decrement subscriber count
    const supabase = getSupabaseClient();
    await supabase.rpc('decrement_strategy_subscribers', { strategy_uuid: subscription.strategyId });

    return subscription;
  }

  async getActiveSubscriptionsForStrategy(strategyId: string): Promise<StrategySubscription[]> {
    return this.getMany({ strategyId, status: 'active' });
  }

  async getActiveSubscriptionsForUser(subscriberId: string): Promise<StrategySubscription[]> {
    return this.getMany({ subscriberId, status: 'active' });
  }

  async incrementSignalsReceived(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc('increment_subscription_signal_received', { sub_uuid: id });
    if (error) console.error('Failed to increment signals received:', error);
  }

  async incrementSignalsExecuted(id: string, pnl: number): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc('increment_subscription_signal_executed', {
      sub_uuid: id,
      pnl_value: pnl,
    });
    if (error) console.error('Failed to increment signals executed:', error);
  }

  private mapToSubscription(row: Record<string, unknown>): StrategySubscription {
    return {
      id: row.id as string,
      subscriberId: row.subscriber_id as string,
      strategyId: row.strategy_id as string,
      autoExecute: row.auto_execute as boolean,
      copyRatio: parseFloat(row.copy_ratio as string) || 1.0,
      fixedAmount: row.fixed_amount ? parseFloat(row.fixed_amount as string) : null,
      maxRiskPerTrade: row.max_risk_per_trade ? parseFloat(row.max_risk_per_trade as string) : null,
      allowedSymbols: row.allowed_symbols as string[] || [],
      blockedSymbols: row.blocked_symbols as string[] || [],
      notifySignal: row.notify_signal as boolean,
      notifyExecution: row.notify_execution as boolean,
      status: row.status as SubscriptionStatus,
      startedAt: new Date(row.started_at as string),
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at as string) : null,
      signalsReceived: row.signals_received as number || 0,
      signalsExecuted: row.signals_executed as number || 0,
      totalPnl: parseFloat(row.total_pnl as string) || 0,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// ==================== Strategy Reviews DAO ====================

export interface StrategyReview {
  id: string;
  strategyId: string;
  userId: string;
  rating: number;
  title: string | null;
  content: string | null;
  isVerifiedSubscriber: boolean;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReviewInput {
  strategyId: string;
  userId: string;
  rating: number;
  title?: string;
  content?: string;
  isVerifiedSubscriber?: boolean;
}

export interface UpdateReviewInput {
  rating?: number;
  title?: string;
  content?: string;
  status?: ReviewStatus;
}

export interface ReviewFilters {
  strategyId?: string;
  userId?: string;
  status?: ReviewStatus;
  limit?: number;
  offset?: number;
}

export class StrategyReviewsDAO {
  async create(input: CreateReviewInput): Promise<StrategyReview> {
    const supabase = getSupabaseClient();

    // Check if already reviewed
    const existing = await this.getByUserAndStrategy(input.userId, input.strategyId);
    if (existing) {
      throw new Error('Already reviewed this strategy');
    }

    const { data, error } = await supabase
      .from('strategy_reviews')
      .insert({
        strategy_id: input.strategyId,
        user_id: input.userId,
        rating: input.rating,
        title: input.title || null,
        content: input.content || null,
        is_verified_subscriber: input.isVerifiedSubscriber || false,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToReview(data);
  }

  async getById(id: string): Promise<StrategyReview | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_reviews')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToReview(data);
  }

  async getByUserAndStrategy(userId: string, strategyId: string): Promise<StrategyReview | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('strategy_id', strategyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToReview(data);
  }

  async getMany(filters: ReviewFilters = {}): Promise<StrategyReview[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('strategy_reviews').select('*');

    if (filters.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('created_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data.map(this.mapToReview);
  }

  async update(id: string, input: UpdateReviewInput): Promise<StrategyReview> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.rating !== undefined) updateData.rating = input.rating;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.content !== undefined) updateData.content = input.content;
    if (input.status !== undefined) updateData.status = input.status;

    const { data, error } = await supabase
      .from('strategy_reviews')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToReview(data);
  }

  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('strategy_reviews')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  private mapToReview(row: Record<string, unknown>): StrategyReview {
    return {
      id: row.id as string,
      strategyId: row.strategy_id as string,
      userId: row.user_id as string,
      rating: row.rating as number,
      title: row.title as string | null,
      content: row.content as string | null,
      isVerifiedSubscriber: row.is_verified_subscriber as boolean,
      status: row.status as ReviewStatus,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// ==================== Marketplace Strategy Signals DAO ====================

export interface MarketplaceSignal {
  id: string;
  strategyId: string;
  publisherId: string;
  symbol: string;
  side: 'buy' | 'sell';
  signalType: SignalType;
  entryPrice: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
  quantity: number | null;
  riskPercent: number | null;
  title: string | null;
  description: string | null;
  analysis: string | null;
  confidenceScore: number | null;
  riskLevel: RiskLevel;
  status: 'active' | 'executed' | 'cancelled' | 'expired';
  executedAt: Date | null;
  executionPrice: number | null;
  pnl: number | null;
  subscribersNotified: number;
  executionsCount: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSignalInput {
  strategyId: string;
  publisherId: string;
  symbol: string;
  side: 'buy' | 'sell';
  signalType?: SignalType;
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  quantity?: number;
  riskPercent?: number;
  title?: string;
  description?: string;
  analysis?: string;
  confidenceScore?: number;
  riskLevel?: RiskLevel;
  expiresAt?: Date;
}

export interface UpdateSignalInput {
  status?: 'active' | 'executed' | 'cancelled' | 'expired';
  executedAt?: Date;
  executionPrice?: number;
  pnl?: number;
}

export interface SignalFilters {
  strategyId?: string;
  publisherId?: string;
  symbol?: string;
  side?: 'buy' | 'sell';
  signalType?: SignalType;
  status?: 'active' | 'executed' | 'cancelled' | 'expired';
  riskLevel?: RiskLevel;
  limit?: number;
  offset?: number;
}

export class MarketplaceSignalsDAO {
  async create(input: CreateSignalInput): Promise<MarketplaceSignal> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('marketplace_strategy_signals')
      .insert({
        strategy_id: input.strategyId,
        publisher_id: input.publisherId,
        symbol: input.symbol,
        side: input.side,
        signal_type: input.signalType || 'entry',
        entry_price: input.entryPrice || null,
        target_price: input.targetPrice || null,
        stop_loss: input.stopLoss || null,
        quantity: input.quantity || null,
        risk_percent: input.riskPercent || null,
        title: input.title || null,
        description: input.description || null,
        analysis: input.analysis || null,
        confidence_score: input.confidenceScore || null,
        risk_level: input.riskLevel || 'medium',
        expires_at: input.expiresAt?.toISOString() || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Increment signal count on strategy
    await supabase
      .from('marketplace_strategies')
      .update({ signal_count: supabase.rpc('increment_signal_count') })
      .eq('id', input.strategyId);

    return this.mapToSignal(data);
  }

  async getById(id: string): Promise<MarketplaceSignal | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('marketplace_strategy_signals')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToSignal(data);
  }

  async getMany(filters: SignalFilters = {}): Promise<MarketplaceSignal[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('marketplace_strategy_signals').select('*');

    if (filters.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }
    if (filters.publisherId) {
      query = query.eq('publisher_id', filters.publisherId);
    }
    if (filters.symbol) {
      query = query.eq('symbol', filters.symbol);
    }
    if (filters.side) {
      query = query.eq('side', filters.side);
    }
    if (filters.signalType) {
      query = query.eq('signal_type', filters.signalType);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.riskLevel) {
      query = query.eq('risk_level', filters.riskLevel);
    }

    query = query.order('created_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data.map(this.mapToSignal);
  }

  async update(id: string, input: UpdateSignalInput): Promise<MarketplaceSignal> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.status !== undefined) updateData.status = input.status;
    if (input.executedAt !== undefined) updateData.executed_at = input.executedAt?.toISOString() || null;
    if (input.executionPrice !== undefined) updateData.execution_price = input.executionPrice;
    if (input.pnl !== undefined) updateData.pnl = input.pnl;

    const { data, error } = await supabase
      .from('marketplace_strategy_signals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToSignal(data);
  }

  async getActiveSignalsForStrategy(strategyId: string): Promise<MarketplaceSignal[]> {
    return this.getMany({ strategyId, status: 'active' });
  }

  async expireSignals(): Promise<number> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('marketplace_strategy_signals')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) throw error;
    return data?.length || 0;
  }

  private mapToSignal(row: Record<string, unknown>): MarketplaceSignal {
    return {
      id: row.id as string,
      strategyId: row.strategy_id as string,
      publisherId: row.publisher_id as string,
      symbol: row.symbol as string,
      side: row.side as 'buy' | 'sell',
      signalType: row.signal_type as SignalType,
      entryPrice: row.entry_price ? parseFloat(row.entry_price as string) : null,
      targetPrice: row.target_price ? parseFloat(row.target_price as string) : null,
      stopLoss: row.stop_loss ? parseFloat(row.stop_loss as string) : null,
      quantity: row.quantity ? parseFloat(row.quantity as string) : null,
      riskPercent: row.risk_percent ? parseFloat(row.risk_percent as string) : null,
      title: row.title as string | null,
      description: row.description as string | null,
      analysis: row.analysis as string | null,
      confidenceScore: row.confidence_score as number | null,
      riskLevel: row.risk_level as RiskLevel,
      status: row.status as 'active' | 'executed' | 'cancelled' | 'expired',
      executedAt: row.executed_at ? new Date(row.executed_at as string) : null,
      executionPrice: row.execution_price ? parseFloat(row.execution_price as string) : null,
      pnl: row.pnl ? parseFloat(row.pnl as string) : null,
      subscribersNotified: row.subscribers_notified as number || 0,
      executionsCount: row.executions_count as number || 0,
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// ==================== Strategy Publisher Stats DAO ====================

export interface PublisherStats {
  id: string;
  publisherId: string;
  totalStrategies: number;
  activeStrategies: number;
  featuredStrategies: number;
  totalSubscribers: number;
  activeSubscribers: number;
  avgRating: number;
  totalReviews: number;
  totalRevenue: number;
  withdrawnRevenue: number;
  pendingRevenue: number;
  totalSignalsSent: number;
  totalSignalsExecuted: number;
  createdAt: Date;
  updatedAt: Date;
}

export class StrategyPublisherStatsDAO {
  async getOrCreate(publisherId: string): Promise<PublisherStats> {
    const supabase = getSupabaseClient();

    // Try to get existing
    const { data: existing, error: fetchError } = await supabase
      .from('strategy_publisher_stats')
      .select('*')
      .eq('publisher_id', publisherId)
      .single();

    if (!fetchError && existing) {
      return this.mapToStats(existing);
    }

    // Create new
    const { data, error } = await supabase
      .from('strategy_publisher_stats')
      .insert({ publisher_id: publisherId })
      .select()
      .single();

    if (error) throw error;
    return this.mapToStats(data);
  }

  async getByPublisher(publisherId: string): Promise<PublisherStats | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_publisher_stats')
      .select('*')
      .eq('publisher_id', publisherId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToStats(data);
  }

  async updateStats(publisherId: string): Promise<PublisherStats> {
    const supabase = getSupabaseClient();

    // Calculate stats from related tables
    const [strategiesRes, subscribersRes, reviewsRes, revenueRes, signalsRes] = await Promise.all([
      supabase.from('marketplace_strategies').select('*').eq('publisher_id', publisherId),
      supabase.from('strategy_marketplace_subscriptions').select('*').in(
        'strategy_id',
        (await supabase.from('marketplace_strategies').select('id').eq('publisher_id', publisherId)).data?.map(s => s.id) || []
      ),
      supabase.from('strategy_reviews').select('rating').in(
        'strategy_id',
        (await supabase.from('marketplace_strategies').select('id').eq('publisher_id', publisherId)).data?.map(s => s.id) || []
      ),
      supabase.from('strategy_revenue_transactions').select('publisher_amount, status').eq('publisher_id', publisherId),
      supabase.from('marketplace_strategy_signals').select('*').eq('publisher_id', publisherId),
    ]);

    const strategies = strategiesRes.data || [];
    const subscribers = subscribersRes.data || [];
    const reviews = reviewsRes.data || [];
    const revenue = revenueRes.data || [];
    const signals = signalsRes.data || [];

    const stats = {
      total_strategies: strategies.length,
      active_strategies: strategies.filter(s => s.status === 'approved').length,
      featured_strategies: strategies.filter(s => s.is_featured).length,
      total_subscribers: subscribers.length,
      active_subscribers: subscribers.filter(s => s.status === 'active').length,
      avg_rating: reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0,
      total_reviews: reviews.length,
      total_revenue: revenue.filter(r => r.status === 'completed').reduce((sum, r) => sum + parseFloat(r.publisher_amount), 0),
      withdrawn_revenue: 0, // Would need withdrawal table
      pending_revenue: revenue.filter(r => r.status === 'pending').reduce((sum, r) => sum + parseFloat(r.publisher_amount), 0),
      total_signals_sent: signals.length,
      total_signals_executed: signals.filter(s => s.status === 'executed').length,
    };

    const { data, error } = await supabase
      .from('strategy_publisher_stats')
      .upsert({
        publisher_id: publisherId,
        ...stats,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToStats(data);
  }

  async getTopPublishers(limit: number = 10): Promise<PublisherStats[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_publisher_stats')
      .select('*')
      .order('total_subscribers', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data.map(this.mapToStats);
  }

  private mapToStats(row: Record<string, unknown>): PublisherStats {
    return {
      id: row.id as string,
      publisherId: row.publisher_id as string,
      totalStrategies: row.total_strategies as number || 0,
      activeStrategies: row.active_strategies as number || 0,
      featuredStrategies: row.featured_strategies as number || 0,
      totalSubscribers: row.total_subscribers as number || 0,
      activeSubscribers: row.active_subscribers as number || 0,
      avgRating: parseFloat(row.avg_rating as string) || 0,
      totalReviews: row.total_reviews as number || 0,
      totalRevenue: parseFloat(row.total_revenue as string) || 0,
      withdrawnRevenue: parseFloat(row.withdrawn_revenue as string) || 0,
      pendingRevenue: parseFloat(row.pending_revenue as string) || 0,
      totalSignalsSent: row.total_signals_sent as number || 0,
      totalSignalsExecuted: row.total_signals_executed as number || 0,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// ==================== Singleton Instances ====================

let marketplaceStrategiesDAO: MarketplaceStrategiesDAO | null = null;
let strategySubscriptionsDAO: StrategySubscriptionsDAO | null = null;
let strategyReviewsDAO: StrategyReviewsDAO | null = null;
let marketplaceSignalsDAO: MarketplaceSignalsDAO | null = null;
let strategyPublisherStatsDAO: StrategyPublisherStatsDAO | null = null;

export function getMarketplaceStrategiesDAO(): MarketplaceStrategiesDAO {
  if (!marketplaceStrategiesDAO) {
    marketplaceStrategiesDAO = new MarketplaceStrategiesDAO();
  }
  return marketplaceStrategiesDAO;
}

export function getStrategySubscriptionsDAO(): StrategySubscriptionsDAO {
  if (!strategySubscriptionsDAO) {
    strategySubscriptionsDAO = new StrategySubscriptionsDAO();
  }
  return strategySubscriptionsDAO;
}

export function getStrategyReviewsDAO(): StrategyReviewsDAO {
  if (!strategyReviewsDAO) {
    strategyReviewsDAO = new StrategyReviewsDAO();
  }
  return strategyReviewsDAO;
}

export function getMarketplaceSignalsDAO(): MarketplaceSignalsDAO {
  if (!marketplaceSignalsDAO) {
    marketplaceSignalsDAO = new MarketplaceSignalsDAO();
  }
  return marketplaceSignalsDAO;
}

export function getStrategyPublisherStatsDAO(): StrategyPublisherStatsDAO {
  if (!strategyPublisherStatsDAO) {
    strategyPublisherStatsDAO = new StrategyPublisherStatsDAO();
  }
  return strategyPublisherStatsDAO;
}