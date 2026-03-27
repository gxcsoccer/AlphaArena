/**
 * Portfolio Template Service
 * 
 * Manages portfolio templates for quick setup and best practices:
 * - Pre-built templates for different risk profiles
 * - Custom template creation
 * - Template sharing and rating
 */

import {
  PortfolioTemplate,
  CreateTemplateInput,
  RebalanceConfig,
  RiskControlConfig,
  SignalAggregationConfig,
} from './types';
import { getSupabaseClient } from '../database/client';
import { createLogger } from '../utils/logger';

const log = createLogger('TemplateService');

/**
 * Default rebalance config
 */
const DEFAULT_REBALANCE_CONFIG: RebalanceConfig = {
  enabled: true,
  frequency: 'threshold',
  threshold: 5,
};

/**
 * Default risk control config
 */
const DEFAULT_RISK_CONTROL_CONFIG: RiskControlConfig = {
  positionLimits: {
    maxTotalPosition: 100000,
    maxSingleAssetPosition: 20000,
    maxSingleStrategyPosition: 50000,
    maxLeverage: 2,
  },
  conflictResolution: 'weighted_vote',
  enableConflictDetection: true,
  autoResolveConflicts: true,
};

/**
 * Default signal aggregation config
 */
const DEFAULT_SIGNAL_AGGREGATION_CONFIG: SignalAggregationConfig = {
  method: 'weighted_average',
  minConfidence: 0.3,
  consensusThreshold: 0.6,
  requireMajority: true,
};

/**
 * Pre-built system templates
 */
const SYSTEM_TEMPLATES: PortfolioTemplate[] = [
  {
    id: 'template_conservative',
    name: 'Conservative Portfolio',
    description: 'Low-risk portfolio focused on stable returns with minimal drawdown. Suitable for risk-averse investors.',
    category: 'conservative',
    riskLevel: 'low',
    targetReturn: 8,
    allocations: [
      { strategyType: 'mean_reversion', weight: 0.4, description: 'Stable mean-reversion strategies' },
      { strategyType: 'arbitrage', weight: 0.3, description: 'Low-risk arbitrage opportunities' },
      { strategyType: 'trend_following', weight: 0.2, description: 'Slow trend following' },
      { strategyType: 'cash', weight: 0.1, description: 'Cash reserve for opportunities' },
    ],
    rebalanceConfig: { ...DEFAULT_REBALANCE_CONFIG, threshold: 3 },
    riskControlConfig: {
      ...DEFAULT_RISK_CONTROL_CONFIG,
      positionLimits: {
        maxTotalPosition: 50000,
        maxSingleAssetPosition: 10000,
        maxSingleStrategyPosition: 20000,
        maxLeverage: 1,
      },
    },
    signalAggregationConfig: {
      ...DEFAULT_SIGNAL_AGGREGATION_CONFIG,
      method: 'consensus',
      consensusThreshold: 0.7,
    },
    tags: ['low-risk', 'stable', 'conservative'],
    usageCount: 0,
    rating: 4.5,
    createdBy: 'system',
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'template_balanced',
    name: 'Balanced Portfolio',
    description: 'Balanced approach combining growth and stability. Suitable for most investors seeking moderate returns.',
    category: 'balanced',
    riskLevel: 'medium',
    targetReturn: 15,
    allocations: [
      { strategyType: 'momentum', weight: 0.3, description: 'Momentum-based strategies' },
      { strategyType: 'mean_reversion', weight: 0.25, description: 'Mean reversion for stability' },
      { strategyType: 'trend_following', weight: 0.25, description: 'Trend following' },
      { strategyType: 'arbitrage', weight: 0.2, description: 'Arbitrage opportunities' },
    ],
    rebalanceConfig: { ...DEFAULT_REBALANCE_CONFIG, threshold: 5 },
    riskControlConfig: DEFAULT_RISK_CONTROL_CONFIG,
    signalAggregationConfig: {
      ...DEFAULT_SIGNAL_AGGREGATION_CONFIG,
      method: 'weighted_average',
    },
    tags: ['balanced', 'moderate', 'diversified'],
    usageCount: 0,
    rating: 4.3,
    createdBy: 'system',
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'template_aggressive',
    name: 'Aggressive Growth Portfolio',
    description: 'High-risk, high-reward portfolio for investors seeking maximum returns. Requires active monitoring.',
    category: 'aggressive',
    riskLevel: 'high',
    targetReturn: 30,
    allocations: [
      { strategyType: 'momentum', weight: 0.35, description: 'Aggressive momentum strategies' },
      { strategyType: 'breakout', weight: 0.25, description: 'Breakout trading' },
      { strategyType: 'ml_based', weight: 0.25, description: 'Machine learning strategies' },
      { strategyType: 'trend_following', weight: 0.15, description: 'Strong trend following' },
    ],
    rebalanceConfig: { ...DEFAULT_REBALANCE_CONFIG, threshold: 10 },
    riskControlConfig: {
      ...DEFAULT_RISK_CONTROL_CONFIG,
      positionLimits: {
        maxTotalPosition: 200000,
        maxSingleAssetPosition: 50000,
        maxSingleStrategyPosition: 100000,
        maxLeverage: 3,
      },
    },
    signalAggregationConfig: {
      ...DEFAULT_SIGNAL_AGGREGATION_CONFIG,
      method: 'best_performer',
      minConfidence: 0.5,
    },
    tags: ['high-risk', 'growth', 'aggressive'],
    usageCount: 0,
    rating: 4.0,
    createdBy: 'system',
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'template_ml_focused',
    name: 'AI/ML Focused Portfolio',
    description: 'Portfolio leveraging machine learning and AI-based strategies. Requires data infrastructure.',
    category: 'custom',
    riskLevel: 'medium',
    targetReturn: 20,
    allocations: [
      { strategyType: 'ml_based', weight: 0.4, description: 'Machine learning strategies' },
      { strategyType: 'reinforcement_learning', weight: 0.3, description: 'RL-based trading' },
      { strategyType: 'anomaly_detection', weight: 0.2, description: 'Anomaly detection strategies' },
      { strategyType: 'sentiment', weight: 0.1, description: 'Sentiment analysis' },
    ],
    rebalanceConfig: { ...DEFAULT_REBALANCE_CONFIG, frequency: 'daily' },
    riskControlConfig: DEFAULT_RISK_CONTROL_CONFIG,
    signalAggregationConfig: {
      ...DEFAULT_SIGNAL_AGGREGATION_CONFIG,
      method: 'weighted_average',
    },
    tags: ['ai', 'machine-learning', 'advanced'],
    usageCount: 0,
    rating: 4.2,
    createdBy: 'system',
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'template_market_neutral',
    name: 'Market Neutral Portfolio',
    description: 'Market-neutral approach using long/short strategies. Aims for consistent returns regardless of market direction.',
    category: 'balanced',
    riskLevel: 'low',
    targetReturn: 12,
    allocations: [
      { strategyType: 'long_short', weight: 0.35, description: 'Long/short equity' },
      { strategyType: 'pairs_trading', weight: 0.3, description: 'Pairs trading' },
      { strategyType: 'statistical_arbitrage', weight: 0.25, description: 'Statistical arbitrage' },
      { strategyType: 'hedging', weight: 0.1, description: 'Hedging strategies' },
    ],
    rebalanceConfig: { ...DEFAULT_REBALANCE_CONFIG, threshold: 3 },
    riskControlConfig: DEFAULT_RISK_CONTROL_CONFIG,
    signalAggregationConfig: {
      ...DEFAULT_SIGNAL_AGGREGATION_CONFIG,
      method: 'voting',
      requireMajority: true,
    },
    tags: ['market-neutral', 'hedging', 'low-volatility'],
    usageCount: 0,
    rating: 4.4,
    createdBy: 'system',
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/**
 * Template Service class
 */
export class TemplateService {
  private supabase: any;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Get all available templates
   */
  async getTemplates(filters?: {
    category?: string;
    riskLevel?: string;
    isPublic?: boolean;
    limit?: number;
  }): Promise<PortfolioTemplate[]> {
    try {
      // Get system templates
      let templates = [...SYSTEM_TEMPLATES];

      // Get user-created templates from database
      const { data, error } = await this.supabase
        .from('portfolio_templates')
        .select('*')
        .eq('is_public', true);

      if (!error && data) {
        const userTemplates = data.map(this.mapToTemplate);
        templates = [...templates, ...userTemplates];
      }

      // Apply filters
      if (filters?.category) {
        templates = templates.filter(t => t.category === filters.category);
      }
      if (filters?.riskLevel) {
        templates = templates.filter(t => t.riskLevel === filters.riskLevel);
      }
      if (filters?.isPublic !== undefined) {
        templates = templates.filter(t => t.isPublic === filters.isPublic);
      }

      // Sort by rating
      templates.sort((a, b) => b.rating - a.rating);

      // Apply limit
      if (filters?.limit) {
        templates = templates.slice(0, filters.limit);
      }

      return templates;
    } catch (error) {
      log.error('Failed to get templates:', error);
      return SYSTEM_TEMPLATES;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<PortfolioTemplate | null> {
    // Check system templates first
    const systemTemplate = SYSTEM_TEMPLATES.find(t => t.id === id);
    if (systemTemplate) {
      return systemTemplate;
    }

    // Check database
    try {
      const { data, error } = await this.supabase
        .from('portfolio_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapToTemplate(data);
    } catch (error) {
      log.error('Failed to get template:', error);
      return null;
    }
  }

  /**
   * Create custom template
   */
  async createTemplate(
    userId: string,
    input: CreateTemplateInput
  ): Promise<PortfolioTemplate> {
    const template: PortfolioTemplate = {
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: input.name,
      description: input.description,
      category: input.category,
      riskLevel: input.riskLevel,
      targetReturn: input.targetReturn || 10,
      allocations: input.allocations,
      rebalanceConfig: {
        ...DEFAULT_REBALANCE_CONFIG,
        ...input.rebalanceConfig,
      },
      riskControlConfig: {
        ...DEFAULT_RISK_CONTROL_CONFIG,
        ...input.riskControlConfig,
      },
      signalAggregationConfig: {
        ...DEFAULT_SIGNAL_AGGREGATION_CONFIG,
        ...input.signalAggregationConfig,
      },
      tags: input.tags || [],
      usageCount: 0,
      rating: 0,
      createdBy: userId,
      isPublic: input.isPublic ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const { error } = await this.supabase
        .from('portfolio_templates')
        .insert([this.mapToRow(template)]);

      if (error) {
        log.error('Failed to create template:', error);
      }

      return template;
    } catch (error) {
      log.error('Failed to create template:', error);
      return template;
    }
  }

  /**
   * Update template
   */
  async updateTemplate(
    id: string,
    userId: string,
    updates: Partial<CreateTemplateInput>
  ): Promise<PortfolioTemplate | null> {
    // Cannot update system templates
    if (SYSTEM_TEMPLATES.find(t => t.id === id)) {
      throw new Error('Cannot modify system templates');
    }

    try {
      const { data, error } = await this.supabase
        .from('portfolio_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('created_by', userId)
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapToTemplate(data);
    } catch (error) {
      log.error('Failed to update template:', error);
      return null;
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string, userId: string): Promise<boolean> {
    // Cannot delete system templates
    if (SYSTEM_TEMPLATES.find(t => t.id === id)) {
      throw new Error('Cannot delete system templates');
    }

    try {
      const { error } = await this.supabase
        .from('portfolio_templates')
        .delete()
        .eq('id', id)
        .eq('created_by', userId);

      return !error;
    } catch (error) {
      log.error('Failed to delete template:', error);
      return false;
    }
  }

  /**
   * Rate template
   */
  async rateTemplate(
    templateId: string,
    userId: string,
    rating: number
  ): Promise<boolean> {
    try {
      // Check if user already rated
      const { data: existing } = await this.supabase
        .from('template_ratings')
        .select('*')
        .eq('template_id', templateId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Update existing rating
        const { error } = await this.supabase
          .from('template_ratings')
          .update({ rating })
          .eq('id', existing.id);

        if (error) return false;
      } else {
        // Create new rating
        const { error } = await this.supabase
          .from('template_ratings')
          .insert([{
            template_id: templateId,
            user_id: userId,
            rating,
          }]);

        if (error) return false;
      }

      // Update average rating
      await this.updateAverageRating(templateId);

      return true;
    } catch (error) {
      log.error('Failed to rate template:', error);
      return false;
    }
  }

  /**
   * Update average rating for template
   */
  private async updateAverageRating(templateId: string): Promise<void> {
    try {
      const { data } = await this.supabase
        .from('template_ratings')
        .select('rating')
        .eq('template_id', templateId);

      if (data && data.length > 0) {
        const avgRating = data.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / data.length;

        await this.supabase
          .from('portfolio_templates')
          .update({ rating: avgRating })
          .eq('id', templateId);
      }
    } catch (error) {
      log.error('Failed to update average rating:', error);
    }
  }

  /**
   * Increment usage count
   */
  async incrementUsage(templateId: string): Promise<void> {
    try {
      // For system templates, we don't track usage in DB
      if (SYSTEM_TEMPLATES.find(t => t.id === templateId)) {
        return;
      }

      await this.supabase.rpc('increment_template_usage', { template_id: templateId });
    } catch (error) {
      log.error('Failed to increment usage:', error);
    }
  }

  /**
   * Get recommended templates based on user preferences
   */
  async getRecommendedTemplates(
    preferences: {
      riskTolerance?: 'low' | 'medium' | 'high';
      targetReturn?: number;
      capitalAmount?: number;
    }
  ): Promise<PortfolioTemplate[]> {
    const templates = await this.getTemplates();

    // Filter by risk tolerance
    let recommended = templates;
    if (preferences.riskTolerance) {
      recommended = recommended.filter(
        t => t.riskLevel === preferences.riskTolerance
      );
    }

    // Filter by target return
    if (preferences.targetReturn) {
      const target = preferences.targetReturn;
      recommended = recommended.filter(
        t => Math.abs(t.targetReturn - target) <= 10
      );
    }

    // Sort by rating
    return recommended.sort((a, b) => b.rating - a.rating).slice(0, 3);
  }

  /**
   * Map database row to template
   */
  private mapToTemplate(row: any): PortfolioTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      riskLevel: row.risk_level,
      targetReturn: row.target_return,
      allocations: row.allocations,
      rebalanceConfig: row.rebalance_config,
      riskControlConfig: row.risk_control_config,
      signalAggregationConfig: row.signal_aggregation_config,
      tags: row.tags || [],
      usageCount: row.usage_count || 0,
      rating: row.rating || 0,
      createdBy: row.created_by,
      isPublic: row.is_public,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map template to database row
   */
  private mapToRow(template: PortfolioTemplate): any {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      risk_level: template.riskLevel,
      target_return: template.targetReturn,
      allocations: template.allocations,
      rebalance_config: template.rebalanceConfig,
      risk_control_config: template.riskControlConfig,
      signal_aggregation_config: template.signalAggregationConfig,
      tags: template.tags,
      usage_count: template.usageCount,
      rating: template.rating,
      created_by: template.createdBy,
      is_public: template.isPublic,
      created_at: template.createdAt.toISOString(),
      updated_at: template.updatedAt.toISOString(),
    };
  }
}

// Singleton instance
export const templateService = new TemplateService();