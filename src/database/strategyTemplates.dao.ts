import { getSupabaseClient } from './client';

/**
 * Strategy Template - 策略模板
 */
export interface StrategyTemplate {
  id: string;
  name: string;
  description: string | null;
  authorUserId: string | null;
  authorName: string | null;
  strategyType: string;
  category: string;
  symbol: string;
  config: Record<string, any>;
  riskParams: Record<string, any>;
  tags: string[];
  isPublic: boolean;
  isFeatured: boolean;
  isBuiltin: boolean;
  performanceMetrics: Record<string, any>;
  backtestPeriod: string | null;
  useCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Template Rating - 模板评分
 */
export interface TemplateRating {
  id: string;
  templateId: string;
  userId: string;
  rating: number; // 1-5
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Template Usage - 模板使用记录
 */
export interface TemplateUsage {
  id: string;
  templateId: string;
  userId: string;
  strategyId: string | null;
  templateConfigSnapshot: Record<string, any>;
  createdAt: Date;
}

/**
 * Create Template Input - 创建模板输入
 */
export interface CreateTemplateInput {
  name: string;
  description?: string;
  authorUserId?: string;
  authorName?: string;
  strategyType: string;
  category?: string;
  symbol?: string;
  config: Record<string, any>;
  riskParams?: Record<string, any>;
  tags?: string[];
  isPublic?: boolean;
  performanceMetrics?: Record<string, any>;
  backtestPeriod?: string;
}

/**
 * Template Filter - 模板筛选条件
 */
export interface TemplateFilter {
  strategyType?: string;
  category?: string;
  authorUserId?: string;
  isFeatured?: boolean;
  isBuiltin?: boolean;
  search?: string;
  tags?: string[];
  minRating?: number;
  sortBy?: 'rating' | 'use_count' | 'created_at' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Strategy Templates DAO
 */
export class StrategyTemplatesDAO {
  /**
   * Create a new strategy template
   */
  async create(input: CreateTemplateInput): Promise<StrategyTemplate> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_templates')
      .insert([
        {
          name: input.name,
          description: input.description || null,
          author_user_id: input.authorUserId || null,
          author_name: input.authorName || null,
          strategy_type: input.strategyType,
          category: input.category || 'general',
          symbol: input.symbol || 'BTC-USDT',
          config: input.config,
          risk_params: input.riskParams || {},
          tags: input.tags || [],
          is_public: input.isPublic !== undefined ? input.isPublic : true,
          performance_metrics: input.performanceMetrics || {},
          backtest_period: input.backtestPeriod || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToTemplate(data);
  }

  /**
   * Get template by ID
   */
  async getById(id: string): Promise<StrategyTemplate | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToTemplate(data);
  }

  /**
   * Get templates with filters
   */
  async getTemplates(filter: TemplateFilter = {}): Promise<{ templates: StrategyTemplate[]; total: number }> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('strategy_templates')
      .select('*', { count: 'exact' })
      .eq('is_public', true);

    // Apply filters
    if (filter.strategyType) {
      query = query.eq('strategy_type', filter.strategyType);
    }
    if (filter.category) {
      query = query.eq('category', filter.category);
    }
    if (filter.authorUserId) {
      query = query.eq('author_user_id', filter.authorUserId);
    }
    if (filter.isFeatured !== undefined) {
      query = query.eq('is_featured', filter.isFeatured);
    }
    if (filter.isBuiltin !== undefined) {
      query = query.eq('is_builtin', filter.isBuiltin);
    }
    if (filter.search) {
      query = query.or(`name.ilike.%${filter.search}%,description.ilike.%${filter.search}%`);
    }
    if (filter.tags && filter.tags.length > 0) {
      query = query.contains('tags', filter.tags);
    }
    if (filter.minRating) {
      query = query.gte('rating_avg', filter.minRating);
    }

    // Apply sorting
    const sortBy = filter.sortBy || 'created_at';
    const sortOrder = filter.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const limit = filter.limit || 20;
    const offset = filter.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      templates: data.map(this.mapToTemplate),
      total: count || 0,
    };
  }

  /**
   * Get featured templates
   */
  async getFeatured(limit: number = 10): Promise<StrategyTemplate[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_templates')
      .select('*')
      .eq('is_public', true)
      .eq('is_featured', true)
      .order('rating_avg', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapToTemplate);
  }

  /**
   * Get templates by author
   */
  async getByAuthor(userId: string): Promise<StrategyTemplate[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_templates')
      .select('*')
      .eq('author_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(this.mapToTemplate);
  }

  /**
   * Update template
   */
  async update(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      config: Record<string, any>;
      riskParams: Record<string, any>;
      tags: string[];
      isPublic: boolean;
      isFeatured: boolean;
      performanceMetrics: Record<string, any>;
    }>
  ): Promise<StrategyTemplate> {
    const supabase = getSupabaseClient();

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.config !== undefined) updateData.config = updates.config;
    if (updates.riskParams !== undefined) updateData.risk_params = updates.riskParams;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
    if (updates.isFeatured !== undefined) updateData.is_featured = updates.isFeatured;
    if (updates.performanceMetrics !== undefined) updateData.performance_metrics = updates.performanceMetrics;

    const { data, error } = await supabase
      .from('strategy_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToTemplate(data);
  }

  /**
   * Delete template
   */
  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase.from('strategy_templates').delete().eq('id', id);

    if (error) throw error;
  }

  /**
   * Increment use count
   */
  async incrementUseCount(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    // Use raw SQL to increment atomically
    const { error } = await supabase.rpc('increment_template_use_count', { template_id: id });

    // If RPC doesn't exist, use direct update
    if (error) {
      const template = await this.getById(id);
      if (template) {
        await supabase
          .from('strategy_templates')
          .update({ use_count: template.useCount + 1 })
          .eq('id', id);
      }
    }
  }

  /**
   * Rate a template
   */
  async rateTemplate(
    templateId: string,
    userId: string,
    rating: number,
    comment?: string
  ): Promise<TemplateRating> {
    const supabase = getSupabaseClient();

    // Upsert the rating (update if exists, insert if not)
    const { data, error } = await supabase
      .from('template_ratings')
      .upsert(
        {
          template_id: templateId,
          user_id: userId,
          rating,
          comment: comment || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'template_id,user_id',
        }
      )
      .select()
      .single();

    if (error) throw error;

    return this.mapToRating(data);
  }

  /**
   * Get user's rating for a template
   */
  async getUserRating(templateId: string, userId: string): Promise<TemplateRating | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('template_ratings')
      .select('*')
      .eq('template_id', templateId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToRating(data);
  }

  /**
   * Get ratings for a template
   */
  async getTemplateRatings(templateId: string, limit: number = 20): Promise<TemplateRating[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('template_ratings')
      .select('*')
      .eq('template_id', templateId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapToRating);
  }

  /**
   * Record template usage (when user uses template to create strategy)
   */
  async recordUsage(
    templateId: string,
    userId: string,
    strategyId?: string
  ): Promise<TemplateUsage> {
    const supabase = getSupabaseClient();

    // Get template config snapshot
    const template = await this.getById(templateId);
    if (!template) throw new Error('Template not found');

    const { data, error } = await supabase
      .from('template_usage')
      .insert([
        {
          template_id: templateId,
          user_id: userId,
          strategy_id: strategyId || null,
          template_config_snapshot: {
            name: template.name,
            strategyType: template.strategyType,
            config: template.config,
            riskParams: template.riskParams,
          },
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Increment use count
    await this.incrementUseCount(templateId);

    return this.mapToUsage(data);
  }

  /**
   * Get usage history for a user
   */
  async getUserUsageHistory(userId: string, limit: number = 20): Promise<TemplateUsage[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('template_usage')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapToUsage);
  }

  /**
   * Get popular templates (by use count)
   */
  async getPopular(limit: number = 10): Promise<StrategyTemplate[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_templates')
      .select('*')
      .eq('is_public', true)
      .order('use_count', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapToTemplate);
  }

  /**
   * Get top-rated templates
   */
  async getTopRated(limit: number = 10): Promise<StrategyTemplate[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_templates')
      .select('*')
      .eq('is_public', true)
      .gte('rating_count', 3) // At least 3 ratings
      .order('rating_avg', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapToTemplate);
  }

  /**
   * Get all unique tags
   */
  async getAllTags(): Promise<string[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_templates')
      .select('tags')
      .eq('is_public', true);

    if (error) throw error;

    const tagSet = new Set<string>();
    data.forEach((row) => {
      (row.tags || []).forEach((tag: string) => tagSet.add(tag));
    });

    return Array.from(tagSet).sort();
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_templates')
      .select('category')
      .eq('is_public', true);

    if (error) throw error;

    const categorySet = new Set<string>();
    data.forEach((row) => {
      if (row.category) categorySet.add(row.category);
    });

    return Array.from(categorySet).sort();
  }

  // Private mapping functions
  private mapToTemplate(row: any): StrategyTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      authorUserId: row.author_user_id,
      authorName: row.author_name,
      strategyType: row.strategy_type,
      category: row.category,
      symbol: row.symbol,
      config: row.config,
      riskParams: row.risk_params,
      tags: row.tags || [],
      isPublic: row.is_public,
      isFeatured: row.is_featured,
      isBuiltin: row.is_builtin,
      performanceMetrics: row.performance_metrics,
      backtestPeriod: row.backtest_period,
      useCount: row.use_count,
      ratingAvg: row.rating_avg,
      ratingCount: row.rating_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapToRating(row: any): TemplateRating {
    return {
      id: row.id,
      templateId: row.template_id,
      userId: row.user_id,
      rating: row.rating,
      comment: row.comment,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapToUsage(row: any): TemplateUsage {
    return {
      id: row.id,
      templateId: row.template_id,
      userId: row.user_id,
      strategyId: row.strategy_id,
      templateConfigSnapshot: row.template_config_snapshot,
      createdAt: new Date(row.created_at),
    };
  }
}
