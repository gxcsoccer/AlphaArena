/**
 * Strategy Recommendation Service
 * AI-powered strategy recommendations using collaborative filtering and content-based filtering
 */

import { EventEmitter } from 'events';
import {
  UserFeedbackDAO,
  UserInteractionDAO,
  UserProfileDAO,
  StrategyRecommendationDAO,
  getUserFeedbackDAO,
  getUserInteractionDAO,
  getUserProfileDAO,
  getStrategyRecommendationDAO,
  UserFeedback,
  UserInteraction,
  UserProfile,
  CreateFeedbackInput,
  CreateInteractionInput,
  UpdateUserProfileInput,
} from '../database/strategy-recommendation.dao';
import {
  MarketplaceStrategiesDAO,
  StrategySubscriptionsDAO,
  getMarketplaceStrategiesDAO,
  getStrategySubscriptionsDAO,
  MarketplaceStrategy,
} from '../database/strategy-marketplace.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('StrategyRecommendationService');

// ==================== Types ====================

export interface RecommendationResult {
  strategy: MarketplaceStrategy;
  score: number;
  reasons: string[];
  algorithm: 'collaborative' | 'content_based' | 'hybrid' | 'trending';
}

export interface UserPreferences {
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  capitalScale?: 'small' | 'medium' | 'large' | 'institutional';
  preferredCategories?: string[];
  preferredStrategyTypes?: string[];
  preferredSymbols?: string[];
}

export interface RecommendationConfig {
  collaborativeWeight: number;
  contentBasedWeight: number;
  trendingWeight: number;
  maxRecommendations: number;
  expirationHours: number;
}

const DEFAULT_CONFIG: RecommendationConfig = {
  collaborativeWeight: 0.4,
  contentBasedWeight: 0.4,
  trendingWeight: 0.2,
  maxRecommendations: 10,
  expirationHours: 24,
};

// ==================== Collaborative Filtering ====================

interface UserSimilarity {
  userId: string;
  similarity: number;
}

interface StrategyScore {
  strategyId: string;
  score: number;
  reasons: string[];
}

class CollaborativeFilteringEngine {
  private interactionDAO: UserInteractionDAO;
  private feedbackDAO: UserFeedbackDAO;

  constructor(interactionDAO: UserInteractionDAO, feedbackDAO: UserFeedbackDAO) {
    this.interactionDAO = interactionDAO;
    this.feedbackDAO = feedbackDAO;
  }

  /**
   * Calculate similarity between users using cosine similarity
   */
  async calculateUserSimilarity(targetUserId: string, candidateUserIds: string[]): Promise<UserSimilarity[]> {
    const targetWeights = await this.interactionDAO.getStrategyInteractionWeights(targetUserId);
    
    if (targetWeights.size === 0) {
      return [];
    }

    const similarities: UserSimilarity[] = [];

    for (const candidateId of candidateUserIds) {
      if (candidateId === targetUserId) continue;

      const candidateWeights = await this.interactionDAO.getStrategyInteractionWeights(candidateId);
      
      if (candidateWeights.size === 0) continue;

      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(targetWeights, candidateWeights);
      
      if (similarity > 0) {
        similarities.push({ userId: candidateId, similarity });
      }
    }

    // Sort by similarity descending
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities.slice(0, 50); // Top 50 similar users
  }

  /**
   * Get strategies that similar users liked
   */
  async getCollaborativeRecommendations(
    userId: string,
    excludeStrategyIds: string[],
    limit: number = 20
  ): Promise<StrategyScore[]> {
    // Find similar users
    const similarUsers = await this.interactionDAO.getSimilarUsers(userId, 100);
    
    if (similarUsers.length === 0) {
      return [];
    }

    // Calculate similarities
    const userSimilarities = await this.calculateUserSimilarity(userId, similarUsers);
    
    if (userSimilarities.length === 0) {
      return [];
    }

    // Aggregate strategy scores from similar users
    const strategyScores = new Map<string, { score: number; userCount: number }>();

    for (const { userId: similarUserId, similarity } of userSimilarities) {
      // Get strategies this similar user liked
      const likedStrategyIds = await this.feedbackDAO.getLikedStrategyIds(similarUserId);
      
      for (const strategyId of likedStrategyIds) {
        if (excludeStrategyIds.includes(strategyId)) continue;
        
        const existing = strategyScores.get(strategyId) || { score: 0, userCount: 0 };
        existing.score += similarity;
        existing.userCount += 1;
        strategyScores.set(strategyId, existing);
      }
    }

    // Convert to sorted array
    const results: StrategyScore[] = [];
    for (const [strategyId, data] of Array.from(strategyScores.entries())) {
      // Normalize by user count
      const avgScore = data.score / Math.max(1, data.userCount);
      results.push({
        strategyId,
        score: avgScore * data.userCount, // Boost by number of similar users
        reasons: [`被 ${data.userCount} 位相似用户喜欢`],
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private cosineSimilarity(
    vec1: Map<string, number>,
    vec2: Map<string, number>
  ): number {
    // Get all keys
    const allKeys = new Set([...Array.from(vec1.keys()), ...Array.from(vec2.keys())]);
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const key of Array.from(allKeys)) {
      const v1 = vec1.get(key) || 0;
      const v2 = vec2.get(key) || 0;
      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}

// ==================== Content-Based Filtering ====================

class ContentBasedFilteringEngine {
  private profileDAO: UserProfileDAO;
  private interactionDAO: UserInteractionDAO;

  constructor(profileDAO: UserProfileDAO, interactionDAO: UserInteractionDAO) {
    this.profileDAO = profileDAO;
    this.interactionDAO = interactionDAO;
  }

  /**
   * Calculate strategy match score based on user profile
   */
  async calculateMatchScore(
    strategy: MarketplaceStrategy,
    userProfile: UserProfile
  ): Promise<{ score: number; reasons: string[] }> {
    let score = 0;
    const reasons: string[] = [];

    // Category match
    if (userProfile.preferredCategories.includes(strategy.category)) {
      score += 30;
      reasons.push(`匹配您的偏好分类: ${strategy.category}`);
    }

    // Strategy type match
    if (userProfile.preferredStrategyTypes.includes(strategy.strategyType)) {
      score += 25;
      reasons.push(`匹配您的策略类型偏好: ${strategy.strategyType}`);
    }

    // Symbol match
    const symbolOverlap = strategy.symbols.filter(s => userProfile.preferredSymbols.includes(s));
    if (symbolOverlap.length > 0) {
      score += 15 * Math.min(symbolOverlap.length, 3);
      reasons.push(`包含您关注的交易对: ${symbolOverlap.slice(0, 3).join(', ')}`);
    }

    // Risk tolerance match
    score += this.calculateRiskMatch(strategy, userProfile, reasons);

    // Performance metrics boost
    if (strategy.performanceMetrics) {
      if (strategy.performanceMetrics.sharpeRatio && strategy.performanceMetrics.sharpeRatio > 1.5) {
        score += 10;
        reasons.push('高夏普比率策略');
      }
      if (strategy.performanceMetrics.winRate && strategy.performanceMetrics.winRate > 0.6) {
        score += 5;
        reasons.push('胜率超过 60%');
      }
    }

    // Quality indicators
    if (strategy.isVerified) {
      score += 5;
      reasons.push('已验证策略');
    }
    if (strategy.isFeatured) {
      score += 3;
    }
    if (strategy.ratingAvg >= 4.0) {
      score += 5;
      reasons.push(`高评分: ${strategy.ratingAvg.toFixed(1)} 星`);
    }

    return { score: Math.min(score, 100), reasons };
  }

  private calculateRiskMatch(
    strategy: MarketplaceStrategy,
    profile: UserProfile,
    reasons: string[]
  ): number {
    // Determine strategy risk level from performance metrics
    const maxDrawdown = strategy.performanceMetrics?.maxDrawdown;
    const strategyRiskLevel = this.inferStrategyRiskLevel(maxDrawdown);

    const riskMatchScore: Record<string, Record<string, number>> = {
      conservative: { low: 15, medium: 5, high: 0, very_high: 0 },
      moderate: { low: 10, medium: 15, high: 5, very_high: 0 },
      aggressive: { low: 5, medium: 10, high: 15, very_high: 5 },
      very_aggressive: { low: 0, medium: 5, high: 12, very_high: 15 },
    };

    const score = riskMatchScore[profile.riskTolerance]?.[strategyRiskLevel] || 0;
    
    if (score > 0) {
      const riskLabels: Record<string, string> = {
        conservative: '保守型',
        moderate: '稳健型',
        aggressive: '进取型',
        very_aggressive: '激进型',
      };
      reasons.push(`适合您的${riskLabels[profile.riskTolerance]}投资风格`);
    }

    return score;
  }

  private inferStrategyRiskLevel(maxDrawdown?: number | null): string {
    if (!maxDrawdown) return 'medium';
    if (maxDrawdown < 0.1) return 'low';
    if (maxDrawdown < 0.25) return 'medium';
    if (maxDrawdown < 0.4) return 'high';
    return 'very_high';
  }

  /**
   * Get content-based recommendations
   */
  async getContentBasedRecommendations(
    userId: string,
    strategies: MarketplaceStrategy[],
    excludeStrategyIds: string[],
    limit: number = 20
  ): Promise<StrategyScore[]> {
    const userProfile = await this.profileDAO.getOrCreate(userId);
    
    // Also learn from user's interaction history
    const interactions = await this.interactionDAO.getInteractionsByUser(userId, 50);
    const _interactionCategories = new Set<string>();
    const _interactionTypes = new Set<string>();
    const _interactionSymbols = new Set<string>();

    for (const _interaction of interactions) {
      // We need to fetch strategy details for each interaction
      // For now, we'll use the profile preferences
    }

    const results: StrategyScore[] = [];

    for (const strategy of strategies) {
      if (excludeStrategyIds.includes(strategy.id)) continue;

      const { score, reasons } = await this.calculateMatchScore(strategy, userProfile);
      
      if (score > 0) {
        results.push({
          strategyId: strategy.id,
          score,
          reasons,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
}

// ==================== Main Service ====================

export class StrategyRecommendationService extends EventEmitter {
  private feedbackDAO: UserFeedbackDAO;
  private interactionDAO: UserInteractionDAO;
  private profileDAO: UserProfileDAO;
  private recommendationDAO: StrategyRecommendationDAO;
  private strategiesDAO: MarketplaceStrategiesDAO;
  private subscriptionsDAO: StrategySubscriptionsDAO;
  private collaborativeEngine: CollaborativeFilteringEngine;
  private contentEngine: ContentBasedFilteringEngine;
  private config: RecommendationConfig;

  constructor(config: Partial<RecommendationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.feedbackDAO = getUserFeedbackDAO();
    this.interactionDAO = getUserInteractionDAO();
    this.profileDAO = getUserProfileDAO();
    this.recommendationDAO = getStrategyRecommendationDAO();
    this.strategiesDAO = getMarketplaceStrategiesDAO();
    this.subscriptionsDAO = getStrategySubscriptionsDAO();
    this.collaborativeEngine = new CollaborativeFilteringEngine(this.interactionDAO, this.feedbackDAO);
    this.contentEngine = new ContentBasedFilteringEngine(this.profileDAO, this.interactionDAO);
  }

  // ==================== Public API ====================

  /**
   * Get personalized recommendations for a user
   */
  async getRecommendations(userId: string, limit: number = 10): Promise<RecommendationResult[]> {
    log.info(`Getting recommendations for user ${userId}`);

    // Get strategies to exclude (already interacted with)
    const excludeIds = await this.getExcludedStrategyIds(userId);

    // Get all approved strategies
    const allStrategies = await this.strategiesDAO.getMany({
      status: 'approved',
      visibility: 'public',
      limit: 100,
    });

    // Run recommendation algorithms in parallel
    const [collaborativeResults, contentResults, trendingResults] = await Promise.all([
      this.collaborativeEngine.getCollaborativeRecommendations(userId, excludeIds, 20),
      this.contentEngine.getContentBasedRecommendations(userId, allStrategies, excludeIds, 20),
      this.getTrendingRecommendations(userId, excludeIds, 10),
    ]);

    // Combine results using hybrid scoring
    const combinedResults = this.combineResults(
      collaborativeResults,
      contentResults,
      trendingResults,
      allStrategies
    );

    // Take top N and create result objects
    const topResults = combinedResults.slice(0, limit);
    const results: RecommendationResult[] = [];

    for (const item of topResults) {
      const strategy = allStrategies.find(s => s.id === item.strategyId);
      if (strategy) {
        results.push({
          strategy,
          score: item.score,
          reasons: item.reasons,
          algorithm: item.algorithm,
        });
      }
    }

    // Store recommendations for tracking
    await this.storeRecommendations(userId, results);

    log.info(`Generated ${results.length} recommendations for user ${userId}`);
    return results;
  }

  /**
   * Record user feedback on a strategy
   */
  async recordFeedback(input: CreateFeedbackInput): Promise<UserFeedback> {
    log.info(`Recording feedback: ${input.feedbackType} from ${input.userId} for strategy ${input.strategyId}`);

    const feedback = await this.feedbackDAO.create(input);
    
    this.emit('feedbackRecorded', feedback);
    return feedback;
  }

  /**
   * Record user interaction with a strategy
   */
  async recordInteraction(input: CreateInteractionInput): Promise<UserInteraction> {
    log.info(`Recording interaction: ${input.interactionType} from ${input.userId} for strategy ${input.strategyId}`);

    const interaction = await this.interactionDAO.create(input);
    
    this.emit('interactionRecorded', interaction);
    return interaction;
  }

  /**
   * Update user preferences/profile
   */
  async updateUserProfile(userId: string, input: UpdateUserProfileInput): Promise<UserProfile> {
    log.info(`Updating profile for user ${userId}`);

    const profile = await this.profileDAO.update(userId, input);
    
    this.emit('profileUpdated', profile);
    return profile;
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    return this.profileDAO.getOrCreate(userId);
  }

  /**
   * Dismiss a recommendation
   */
  async dismissRecommendation(recommendationId: string): Promise<void> {
    await this.recommendationDAO.markDismissed(recommendationId);
  }

  /**
   * Mark recommendation as clicked
   */
  async clickRecommendation(recommendationId: string): Promise<void> {
    await this.recommendationDAO.markClicked(recommendationId);
  }

  /**
   * Get recommendation explanation for a strategy
   */
  async explainRecommendation(userId: string, strategyId: string): Promise<{
    score: number;
    reasons: string[];
    factors: Record<string, number>;
  }> {
    const [strategy, userProfile] = await Promise.all([
      this.strategiesDAO.getById(strategyId),
      this.profileDAO.getByUserId(userId),
    ]);

    if (!strategy) {
      throw new Error('Strategy not found');
    }

    if (!userProfile) {
      return {
        score: 50,
        reasons: ['新用户，基于策略热度推荐'],
        factors: { base: 50 },
      };
    }

    const { score, reasons } = await this.contentEngine.calculateMatchScore(strategy, userProfile);

    // Calculate individual factors
    const factors: Record<string, number> = {};

    if (userProfile.preferredCategories.includes(strategy.category)) {
      factors.category = 30;
    }
    if (userProfile.preferredStrategyTypes.includes(strategy.strategyType)) {
      factors.type = 25;
    }
    const symbolOverlap = strategy.symbols.filter(s => userProfile.preferredSymbols.includes(s));
    if (symbolOverlap.length > 0) {
      factors.symbols = 15 * Math.min(symbolOverlap.length, 3);
    }
    if (strategy.ratingAvg >= 4.0) {
      factors.rating = 5;
    }
    if (strategy.isVerified) {
      factors.verified = 5;
    }

    return { score, reasons, factors };
  }

  // ==================== Private Methods ====================

  private async getExcludedStrategyIds(userId: string): Promise<string[]> {
    // Get subscribed strategies
    const subscriptions = await this.subscriptionsDAO.getActiveSubscriptionsForUser(userId);
    const subscribedIds = subscriptions.map(s => s.strategyId);

    // Get disliked strategies
    const dislikedIds = await this.feedbackDAO.getDislikedStrategyIds(userId);

    // Combine
    return Array.from(new Set([...subscribedIds, ...dislikedIds]));
  }

  private async getTrendingRecommendations(
    userId: string,
    excludeIds: string[],
    limit: number
  ): Promise<StrategyScore[]> {
    // Get trending strategies (high subscriber growth, recent activity)
    const trending = await this.strategiesDAO.getMany({
      status: 'approved',
      visibility: 'public',
      orderBy: 'subscriber_count',
      orderDirection: 'desc',
      limit: 50,
    });

    const results: StrategyScore[] = [];

    for (const strategy of trending) {
      if (excludeIds.includes(strategy.id)) continue;

      let score = 20; // Base trending score
      
      if (strategy.subscriberCount > 100) {
        score += 15;
      } else if (strategy.subscriberCount > 50) {
        score += 10;
      }

      if (strategy.ratingAvg >= 4.0) {
        score += 10;
      }

      if (strategy.isFeatured) {
        score += 5;
      }

      results.push({
        strategyId: strategy.id,
        score,
        reasons: ['热门策略', `已有 ${strategy.subscriberCount} 位订阅者`],
      });
    }

    return results.slice(0, limit);
  }

  private combineResults(
    collaborative: StrategyScore[],
    contentBased: StrategyScore[],
    trending: StrategyScore[],
    _allStrategies: MarketplaceStrategy[]
  ): Array<StrategyScore & { algorithm: 'collaborative' | 'content_based' | 'hybrid' | 'trending' }> {
    const combined = new Map<string, {
      score: number;
      reasons: string[];
      algorithms: string[];
    }>();

    // Add collaborative results
    for (const item of collaborative) {
      combined.set(item.strategyId, {
        score: item.score * this.config.collaborativeWeight,
        reasons: [...item.reasons],
        algorithms: ['collaborative'],
      });
    }

    // Add content-based results
    for (const item of contentBased) {
      const existing = combined.get(item.strategyId);
      if (existing) {
        existing.score += item.score * this.config.contentBasedWeight;
        existing.reasons.push(...item.reasons.filter(r => !existing.reasons.includes(r)));
        existing.algorithms.push('content_based');
      } else {
        combined.set(item.strategyId, {
          score: item.score * this.config.contentBasedWeight,
          reasons: [...item.reasons],
          algorithms: ['content_based'],
        });
      }
    }

    // Add trending results
    for (const item of trending) {
      const existing = combined.get(item.strategyId);
      if (existing) {
        existing.score += item.score * this.config.trendingWeight;
        existing.reasons.push(...item.reasons.filter(r => !existing.reasons.includes(r)));
        existing.algorithms.push('trending');
      } else {
        combined.set(item.strategyId, {
          score: item.score * this.config.trendingWeight,
          reasons: [...item.reasons],
          algorithms: ['trending'],
        });
      }
    }

    // Convert to array and determine algorithm
    const results: Array<StrategyScore & { algorithm: 'collaborative' | 'content_based' | 'hybrid' | 'trending' }> = [];

    for (const [strategyId, data] of Array.from(combined.entries())) {
      const algorithm = data.algorithms.length > 1 ? 'hybrid' : data.algorithms[0] as any;
      results.push({
        strategyId,
        score: data.score,
        reasons: data.reasons,
        algorithm,
      });
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  private async storeRecommendations(userId: string, results: RecommendationResult[]): Promise<void> {
    const expiresAt = new Date(Date.now() + this.config.expirationHours * 60 * 60 * 1000);

    const recommendations = results.map((r, index) => ({
      strategyId: r.strategy.id,
      userId,
      score: r.score,
      reasons: r.reasons,
      algorithm: r.algorithm,
      position: index + 1,
      dismissed: false,
      clicked: false,
      expiresAt,
    }));

    if (recommendations.length > 0) {
      await this.recommendationDAO.batchCreate(recommendations);
    }
  }

  // ==================== Admin/Maintenance ====================

  /**
   * Clear expired recommendations
   */
  async clearExpiredRecommendations(): Promise<number> {
    return this.recommendationDAO.clearExpired();
  }

  /**
   * Get recommendation statistics
   */
  async getStats(): Promise<{
    totalFeedback: number;
    totalInteractions: number;
    totalProfiles: number;
    activeRecommendations: number;
  }> {
    const supabase = (await import('../database/client')).getSupabaseClient();

    const [feedback, interactions, profiles, recommendations] = await Promise.all([
      supabase.from('strategy_user_feedback').select('id', { count: 'exact', head: true }),
      supabase.from('strategy_user_interactions').select('id', { count: 'exact', head: true }),
      supabase.from('strategy_user_profiles').select('user_id', { count: 'exact', head: true }),
      supabase.from('strategy_recommendations').select('id', { count: 'exact', head: true })
        .eq('dismissed', false)
        .gt('expires_at', new Date().toISOString()),
    ]);

    return {
      totalFeedback: feedback.count || 0,
      totalInteractions: interactions.count || 0,
      totalProfiles: profiles.count || 0,
      activeRecommendations: recommendations.count || 0,
    };
  }
}

// Singleton instance
let strategyRecommendationService: StrategyRecommendationService | null = null;

export function getStrategyRecommendationService(): StrategyRecommendationService {
  if (!strategyRecommendationService) {
    strategyRecommendationService = new StrategyRecommendationService();
  }
  return strategyRecommendationService;
}