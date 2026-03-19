/**
 * Strategy Recommendation DAO
 * Data access layer for strategy recommendations and user feedback
 */

import { getSupabaseClient } from './client';

// ==================== Types ====================

export type FeedbackType = 'like' | 'dislike' | 'not_interested';
export type InteractionType = 'view' | 'subscribe' | 'review' | 'signal_follow';

export interface UserFeedback {
  id: string;
  userId: string;
  strategyId: string;
  feedbackType: FeedbackType;
  reason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserInteraction {
  id: string;
  userId: string;
  strategyId: string;
  interactionType: InteractionType;
  weight: number;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface UserProfile {
  userId: string;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  capitalScale: 'small' | 'medium' | 'large' | 'institutional';
  preferredCategories: string[];
  preferredStrategyTypes: string[];
  preferredSymbols: string[];
  avgHoldingPeriod: number | null; // in hours
  totalTrades: number;
  winRate: number | null;
  avgPnl: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StrategyRecommendation {
  id: string;
  strategyId: string;
  userId: string;
  score: number;
  reasons: string[];
  algorithm: 'collaborative' | 'content_based' | 'hybrid' | 'trending';
  position: number;
  dismissed: boolean;
  clicked: boolean;
  createdAt: Date;
  expiresAt: Date;
}

export interface CreateFeedbackInput {
  userId: string;
  strategyId: string;
  feedbackType: FeedbackType;
  reason?: string;
}

export interface CreateInteractionInput {
  userId: string;
  strategyId: string;
  interactionType: InteractionType;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateUserProfileInput {
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  capitalScale?: 'small' | 'medium' | 'large' | 'institutional';
  preferredCategories?: string[];
  preferredStrategyTypes?: string[];
  preferredSymbols?: string[];
  avgHoldingPeriod?: number | null;
  totalTrades?: number;
  winRate?: number | null;
  avgPnl?: number | null;
}

export interface RecommendationFilters {
  userId?: string;
  strategyId?: string;
  algorithm?: 'collaborative' | 'content_based' | 'hybrid' | 'trending';
  dismissed?: boolean;
  limit?: number;
  offset?: number;
}

// ==================== User Feedback DAO ====================

export class UserFeedbackDAO {
  async create(input: CreateFeedbackInput): Promise<UserFeedback> {
    const supabase = getSupabaseClient();

    // Upsert to handle repeated feedback
    const { data, error } = await supabase
      .from('strategy_user_feedback')
      .upsert({
        user_id: input.userId,
        strategy_id: input.strategyId,
        feedback_type: input.feedbackType,
        reason: input.reason || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,strategy_id',
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToFeedback(data);
  }

  async getById(id: string): Promise<UserFeedback | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_user_feedback')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToFeedback(data);
  }

  async getByUserAndStrategy(userId: string, strategyId: string): Promise<UserFeedback | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_user_feedback')
      .select('*')
      .eq('user_id', userId)
      .eq('strategy_id', strategyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToFeedback(data);
  }

  async getDislikedStrategyIds(userId: string): Promise<string[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_user_feedback')
      .select('strategy_id')
      .eq('user_id', userId)
      .in('feedback_type', ['dislike', 'not_interested']);

    if (error) throw error;
    return (data || []).map(row => row.strategy_id as string);
  }

  async getLikedStrategyIds(userId: string): Promise<string[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_user_feedback')
      .select('strategy_id')
      .eq('user_id', userId)
      .eq('feedback_type', 'like');

    if (error) throw error;
    return (data || []).map(row => row.strategy_id as string);
  }

  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('strategy_user_feedback')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  private mapToFeedback(row: Record<string, unknown>): UserFeedback {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      strategyId: row.strategy_id as string,
      feedbackType: row.feedback_type as FeedbackType,
      reason: row.reason as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// ==================== User Interaction DAO ====================

export class UserInteractionDAO {
  async create(input: CreateInteractionInput): Promise<UserInteraction> {
    const supabase = getSupabaseClient();

    const weights: Record<InteractionType, number> = {
      view: 1,
      subscribe: 5,
      review: 3,
      signal_follow: 4,
    };

    const { data, error } = await supabase
      .from('strategy_user_interactions')
      .insert({
        user_id: input.userId,
        strategy_id: input.strategyId,
        interaction_type: input.interactionType,
        weight: input.weight ?? weights[input.interactionType] ?? 1,
        metadata: input.metadata || null,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToInteraction(data);
  }

  async getInteractionsByUser(userId: string, limit: number = 100): Promise<UserInteraction[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_user_interactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(this.mapToInteraction);
  }

  async getInteractionsByStrategy(strategyId: string, limit: number = 100): Promise<UserInteraction[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_user_interactions')
      .select('*')
      .eq('strategy_id', strategyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(this.mapToInteraction);
  }

  async getStrategyInteractionWeights(userId: string): Promise<Map<string, number>> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_user_interactions')
      .select('strategy_id, weight')
      .eq('user_id', userId);

    if (error) throw error;

    const weights = new Map<string, number>();
    for (const row of data || []) {
      const strategyId = row.strategy_id as string;
      const weight = (row.weight as number) || 0;
      weights.set(strategyId, (weights.get(strategyId) || 0) + weight);
    }

    return weights;
  }

  async getSimilarUsers(userId: string, limit: number = 50): Promise<string[]> {
    const supabase = getSupabaseClient();

    // Find users who interacted with the same strategies
    const { data, error } = await supabase.rpc('find_similar_users', {
      target_user_id: userId,
      limit_count: limit,
    });

    if (error) {
      // If RPC doesn't exist, use a simpler query
      // Get strategies this user interacted with
      const userInteractions = await this.getInteractionsByUser(userId, 50);
      if (userInteractions.length === 0) return [];

      const strategyIds = Array.from(new Set(userInteractions.map(i => i.strategyId)));

      // Find other users who interacted with these strategies
      const { data: similarData, error: similarError } = await supabase
        .from('strategy_user_interactions')
        .select('user_id')
        .in('strategy_id', strategyIds)
        .neq('user_id', userId);

      if (similarError) throw similarError;

      // Count occurrences and sort by frequency
      const userCounts = new Map<string, number>();
      for (const row of similarData || []) {
        const uid = row.user_id as string;
        userCounts.set(uid, (userCounts.get(uid) || 0) + 1);
      }

      return Array.from(userCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([uid]) => uid);
    }

    return (data || []).map((row: any) => row.user_id as string);
  }

  private mapToInteraction(row: Record<string, unknown>): UserInteraction {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      strategyId: row.strategy_id as string,
      interactionType: row.interaction_type as InteractionType,
      weight: row.weight as number,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: new Date(row.created_at as string),
    };
  }
}

// ==================== User Profile DAO ====================

export class UserProfileDAO {
  async getOrCreate(userId: string): Promise<UserProfile> {
    const supabase = getSupabaseClient();

    const { data: existing, error: fetchError } = await supabase
      .from('strategy_user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!fetchError && existing) {
      return this.mapToProfile(existing);
    }

    // Create new profile
    const { data, error } = await supabase
      .from('strategy_user_profiles')
      .insert({ user_id: userId })
      .select()
      .single();

    if (error) throw error;
    return this.mapToProfile(data);
  }

  async getByUserId(userId: string): Promise<UserProfile | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToProfile(data);
  }

  async update(userId: string, input: UpdateUserProfileInput): Promise<UserProfile> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.riskTolerance !== undefined) updateData.risk_tolerance = input.riskTolerance;
    if (input.capitalScale !== undefined) updateData.capital_scale = input.capitalScale;
    if (input.preferredCategories !== undefined) updateData.preferred_categories = input.preferredCategories;
    if (input.preferredStrategyTypes !== undefined) updateData.preferred_strategy_types = input.preferredStrategyTypes;
    if (input.preferredSymbols !== undefined) updateData.preferred_symbols = input.preferredSymbols;
    if (input.avgHoldingPeriod !== undefined) updateData.avg_holding_period = input.avgHoldingPeriod;
    if (input.totalTrades !== undefined) updateData.total_trades = input.totalTrades;
    if (input.winRate !== undefined) updateData.win_rate = input.winRate;
    if (input.avgPnl !== undefined) updateData.avg_pnl = input.avgPnl;

    const { data, error } = await supabase
      .from('strategy_user_profiles')
      .upsert({
        user_id: userId,
        ...updateData,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToProfile(data);
  }

  async getUsersByPreferences(
    riskTolerance?: string,
    capitalScale?: string
  ): Promise<string[]> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('strategy_user_profiles')
      .select('user_id');

    if (riskTolerance) {
      query = query.eq('risk_tolerance', riskTolerance);
    }
    if (capitalScale) {
      query = query.eq('capital_scale', capitalScale);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map(row => row.user_id as string);
  }

  private mapToProfile(row: Record<string, unknown>): UserProfile {
    return {
      userId: row.user_id as string,
      riskTolerance: (row.risk_tolerance as UserProfile['riskTolerance']) || 'moderate',
      capitalScale: (row.capital_scale as UserProfile['capitalScale']) || 'medium',
      preferredCategories: (row.preferred_categories as string[]) || [],
      preferredStrategyTypes: (row.preferred_strategy_types as string[]) || [],
      preferredSymbols: (row.preferred_symbols as string[]) || [],
      avgHoldingPeriod: row.avg_holding_period ? parseFloat(row.avg_holding_period as string) : null,
      totalTrades: (row.total_trades as number) || 0,
      winRate: row.win_rate ? parseFloat(row.win_rate as string) : null,
      avgPnl: row.avg_pnl ? parseFloat(row.avg_pnl as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// ==================== Strategy Recommendation DAO ====================

export class StrategyRecommendationDAO {
  async create(input: Omit<StrategyRecommendation, 'id' | 'createdAt'>): Promise<StrategyRecommendation> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_recommendations')
      .insert({
        strategy_id: input.strategyId,
        user_id: input.userId,
        score: input.score,
        reasons: input.reasons,
        algorithm: input.algorithm,
        position: input.position,
        dismissed: input.dismissed || false,
        clicked: input.clicked || false,
        expires_at: input.expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToRecommendation(data);
  }

  async getActiveRecommendations(userId: string, limit: number = 10): Promise<StrategyRecommendation[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_recommendations')
      .select('*')
      .eq('user_id', userId)
      .eq('dismissed', false)
      .gt('expires_at', new Date().toISOString())
      .order('score', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(this.mapToRecommendation);
  }

  async getMany(filters: RecommendationFilters = {}): Promise<StrategyRecommendation[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('strategy_recommendations').select('*');

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }
    if (filters.algorithm) {
      query = query.eq('algorithm', filters.algorithm);
    }
    if (filters.dismissed !== undefined) {
      query = query.eq('dismissed', filters.dismissed);
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
    return (data || []).map(this.mapToRecommendation);
  }

  async markDismissed(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('strategy_recommendations')
      .update({ dismissed: true })
      .eq('id', id);

    if (error) throw error;
  }

  async markClicked(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('strategy_recommendations')
      .update({ clicked: true })
      .eq('id', id);

    if (error) throw error;
  }

  async clearExpired(): Promise<number> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_recommendations')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) throw error;
    return data?.length || 0;
  }

  async batchCreate(recommendations: Omit<StrategyRecommendation, 'id' | 'createdAt'>[]): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('strategy_recommendations')
      .insert(recommendations.map(r => ({
        strategy_id: r.strategyId,
        user_id: r.userId,
        score: r.score,
        reasons: r.reasons,
        algorithm: r.algorithm,
        position: r.position,
        dismissed: r.dismissed || false,
        clicked: r.clicked || false,
        expires_at: r.expiresAt.toISOString(),
      })));

    if (error) throw error;
  }

  private mapToRecommendation(row: Record<string, unknown>): StrategyRecommendation {
    return {
      id: row.id as string,
      strategyId: row.strategy_id as string,
      userId: row.user_id as string,
      score: parseFloat(row.score as string) || 0,
      reasons: (row.reasons as string[]) || [],
      algorithm: row.algorithm as StrategyRecommendation['algorithm'],
      position: row.position as number,
      dismissed: row.dismissed as boolean || false,
      clicked: row.clicked as boolean || false,
      createdAt: new Date(row.created_at as string),
      expiresAt: new Date(row.expires_at as string),
    };
  }
}

// ==================== Singleton Instances ====================

let userFeedbackDAO: UserFeedbackDAO | null = null;
let userInteractionDAO: UserInteractionDAO | null = null;
let userProfileDAO: UserProfileDAO | null = null;
let strategyRecommendationDAO: StrategyRecommendationDAO | null = null;

export function getUserFeedbackDAO(): UserFeedbackDAO {
  if (!userFeedbackDAO) {
    userFeedbackDAO = new UserFeedbackDAO();
  }
  return userFeedbackDAO;
}

export function getUserInteractionDAO(): UserInteractionDAO {
  if (!userInteractionDAO) {
    userInteractionDAO = new UserInteractionDAO();
  }
  return userInteractionDAO;
}

export function getUserProfileDAO(): UserProfileDAO {
  if (!userProfileDAO) {
    userProfileDAO = new UserProfileDAO();
  }
  return userProfileDAO;
}

export function getStrategyRecommendationDAO(): StrategyRecommendationDAO {
  if (!strategyRecommendationDAO) {
    strategyRecommendationDAO = new StrategyRecommendationDAO();
  }
  return strategyRecommendationDAO;
}