/**
 * Backtest-Live Integration DAO
 *
 * Data access layer for backtest-live integration
 *
 * @module database/backtest-live.dao
 */

import { getSupabaseClient, type Database } from './client';
import type {
  IntegratedStrategyConfig,
  PerformanceComparison,
  OptimizationSuggestion,
  BacktestResultRecord,
  HistoricalComparisonRecord,
  StrategyConfig,
  TradingEnvironment,
  IntegrationStatus,
} from '../backtest-live/types';
import { BacktestConfig, BacktestStats } from '../backtest/types';
import { createLogger } from '../utils/logger';

const log = createLogger('BacktestLiveDAO');

/**
 * Database table row types
 */
type IntegratedStrategyRow = Database['public']['Tables']['integrated_strategies']['Row'];
type IntegratedStrategyInsert = Database['public']['Tables']['integrated_strategies']['Insert'];
type BacktestResultRow = Database['public']['Tables']['backtest_results']['Row'];
type BacktestResultInsert = Database['public']['Tables']['backtest_results']['Insert'];
type PerformanceComparisonRow = Database['public']['Tables']['performance_comparisons']['Row'];
type PerformanceComparisonInsert = Database['public']['Tables']['performance_comparisons']['Insert'];
type OptimizationSuggestionRow = Database['public']['Tables']['optimization_suggestions']['Row'];
type OptimizationSuggestionInsert = Database['public']['Tables']['optimization_suggestions']['Insert'];

/**
 * BacktestLiveDAO - Data access for backtest-live integration
 */
export class BacktestLiveDAO {
  private supabase = getSupabaseClient();

  // ============================================
  // Integrated Strategy Config Methods
  // ============================================

  /**
   * Create a new integrated strategy configuration
   */
  async createIntegration(config: IntegratedStrategyConfig): Promise<IntegratedStrategyConfig> {
    const insert: any = {
      id: config.id,
      user_id: config.userId,
      strategy: config.strategy,
      backtest_config: config.backtestConfig,
      environment: config.environment,
      paper_config: config.paperConfig,
      live_config: config.liveConfig,
      backtest_result_id: config.backtestResultId,
      monitoring: config.monitoring,
      status: config.status,
      created_at: new Date(config.createdAt).toISOString(),
      updated_at: new Date(config.updatedAt).toISOString(),
    };

    const { data, error } = await this.supabase
      .from('integrated_strategies')
      .insert(insert)
      .select()
      .single();

    if (error) {
      log.error('Failed to create integration:', error);
      throw new Error(`Failed to create integration: ${error.message}`);
    }

    return this.mapToIntegratedStrategyConfig(data);
  }

  /**
   * Get integration by ID
   */
  async getIntegration(id: string): Promise<IntegratedStrategyConfig | null> {
    const { data, error } = await this.supabase
      .from('integrated_strategies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Failed to get integration:', error);
      throw new Error(`Failed to get integration: ${error.message}`);
    }

    return this.mapToIntegratedStrategyConfig(data);
  }

  /**
   * Get all integrations for a user
   */
  async getUserIntegrations(userId: string): Promise<IntegratedStrategyConfig[]> {
    const { data, error } = await this.supabase
      .from('integrated_strategies')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Failed to get user integrations:', error);
      throw new Error(`Failed to get user integrations: ${error.message}`);
    }

    return data.map(this.mapToIntegratedStrategyConfig);
  }

  /**
   * Update integration
   */
  async updateIntegration(
    id: string,
    updates: Partial<IntegratedStrategyConfig>
  ): Promise<IntegratedStrategyConfig> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.strategy) updateData.strategy = updates.strategy;
    if (updates.backtestConfig) updateData.backtest_config = updates.backtestConfig;
    if (updates.environment) updateData.environment = updates.environment;
    if (updates.paperConfig) updateData.paper_config = updates.paperConfig;
    if (updates.liveConfig) updateData.live_config = updates.liveConfig;
    if (updates.backtestResultId) updateData.backtest_result_id = updates.backtestResultId;
    if (updates.monitoring) updateData.monitoring = updates.monitoring;
    if (updates.status) updateData.status = updates.status;

    const { data, error } = await this.supabase
      .from('integrated_strategies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      log.error('Failed to update integration:', error);
      throw new Error(`Failed to update integration: ${error.message}`);
    }

    return this.mapToIntegratedStrategyConfig(data);
  }

  /**
   * Delete integration
   */
  async deleteIntegration(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('integrated_strategies')
      .delete()
      .eq('id', id);

    if (error) {
      log.error('Failed to delete integration:', error);
      throw new Error(`Failed to delete integration: ${error.message}`);
    }
  }

  /**
   * Update integration status
   */
  async updateStatus(id: string, status: IntegrationStatus): Promise<void> {
    const { error } = await this.supabase
      .from('integrated_strategies')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      log.error('Failed to update status:', error);
      throw new Error(`Failed to update status: ${error.message}`);
    }
  }

  /**
   * Get integrations by environment
   */
  async getIntegrationsByEnvironment(
    userId: string,
    environment: TradingEnvironment
  ): Promise<IntegratedStrategyConfig[]> {
    const { data, error } = await this.supabase
      .from('integrated_strategies')
      .select('*')
      .eq('user_id', userId)
      .eq('environment', environment)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Failed to get integrations by environment:', error);
      throw new Error(`Failed to get integrations by environment: ${error.message}`);
    }

    return data.map(this.mapToIntegratedStrategyConfig);
  }

  // ============================================
  // Backtest Result Methods
  // ============================================

  /**
   * Save backtest result
   */
  async saveBacktestResult(record: BacktestResultRecord): Promise<BacktestResultRecord> {
    const insert: any = {
      id: record.id,
      integration_id: record.integrationId,
      user_id: record.userId,
      config: record.config,
      stats: record.stats,
      trade_summary: record.tradeSummary,
      performance_metrics: record.performanceMetrics,
      tags: record.tags,
      created_at: new Date(record.createdAt).toISOString(),
    };

    const { data, error } = await this.supabase
      .from('backtest_results')
      .insert(insert)
      .select()
      .single();

    if (error) {
      log.error('Failed to save backtest result:', error);
      throw new Error(`Failed to save backtest result: ${error.message}`);
    }

    return this.mapToBacktestResultRecord(data);
  }

  /**
   * Get backtest result by ID
   */
  async getBacktestResult(id: string): Promise<BacktestResultRecord | null> {
    const { data, error } = await this.supabase
      .from('backtest_results')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Failed to get backtest result:', error);
      throw new Error(`Failed to get backtest result: ${error.message}`);
    }

    return this.mapToBacktestResultRecord(data);
  }

  /**
   * Get backtest results for user
   */
  async getUserBacktestResults(
    userId: string,
    limit: number = 20
  ): Promise<BacktestResultRecord[]> {
    const { data, error } = await this.supabase
      .from('backtest_results')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to get user backtest results:', error);
      throw new Error(`Failed to get user backtest results: ${error.message}`);
    }

    return data.map(this.mapToBacktestResultRecord);
  }

  /**
   * Delete backtest result
   */
  async deleteBacktestResult(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('backtest_results')
      .delete()
      .eq('id', id);

    if (error) {
      log.error('Failed to delete backtest result:', error);
      throw new Error(`Failed to delete backtest result: ${error.message}`);
    }
  }

  // ============================================
  // Performance Comparison Methods
  // ============================================

  /**
   * Save performance comparison
   */
  async savePerformanceComparison(
    comparison: PerformanceComparison
  ): Promise<HistoricalComparisonRecord> {
    const insert: any = {
      integration_id: comparison.integrationId,
      timestamp: new Date(comparison.timestamp).toISOString(),
      comparison: comparison,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('performance_comparisons')
      .insert(insert)
      .select()
      .single();

    if (error) {
      log.error('Failed to save performance comparison:', error);
      throw new Error(`Failed to save performance comparison: ${error.message}`);
    }

    return {
      id: data.id,
      integrationId: data.integration_id,
      timestamp: new Date(data.timestamp).getTime(),
      comparison: data.comparison,
      createdAt: new Date(data.created_at).getTime(),
    };
  }

  /**
   * Get historical comparisons for integration
   */
  async getHistoricalComparisons(
    integrationId: string,
    limit: number = 100
  ): Promise<HistoricalComparisonRecord[]> {
    const { data, error } = await this.supabase
      .from('performance_comparisons')
      .select('*')
      .eq('integration_id', integrationId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to get historical comparisons:', error);
      throw new Error(`Failed to get historical comparisons: ${error.message}`);
    }

    return data.map((row: any) => ({
      id: row.id,
      integrationId: row.integration_id,
      timestamp: new Date(row.timestamp).getTime(),
      comparison: row.comparison,
      createdAt: new Date(row.created_at).getTime(),
    }));
  }

  /**
   * Get latest comparison for integration
   */
  async getLatestComparison(integrationId: string): Promise<HistoricalComparisonRecord | null> {
    const { data, error } = await this.supabase
      .from('performance_comparisons')
      .select('*')
      .eq('integration_id', integrationId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Failed to get latest comparison:', error);
      throw new Error(`Failed to get latest comparison: ${error.message}`);
    }

    return {
      id: data.id,
      integrationId: data.integration_id,
      timestamp: new Date(data.timestamp).getTime(),
      comparison: data.comparison,
      createdAt: new Date(data.created_at).getTime(),
    };
  }

  // ============================================
  // Optimization Suggestion Methods
  // ============================================

  /**
   * Save optimization suggestion
   */
  async saveOptimizationSuggestion(suggestion: OptimizationSuggestion): Promise<void> {
    const insert: any = {
      id: suggestion.id,
      integration_id: suggestion.integrationId,
      type: suggestion.type,
      priority: suggestion.priority,
      title: suggestion.title,
      description: suggestion.description,
      current_value: suggestion.currentValue,
      suggested_value: suggestion.suggestedValue,
      expected_improvement: suggestion.expectedImprovement,
      confidence: suggestion.confidence,
      supporting_data: suggestion.supportingData,
      applied: suggestion.applied,
      applied_at: suggestion.appliedAt ? new Date(suggestion.appliedAt).toISOString() : null,
      created_at: new Date(suggestion.createdAt).toISOString(),
    };

    const { error } = await this.supabase
      .from('optimization_suggestions')
      .insert(insert);

    if (error) {
      log.error('Failed to save optimization suggestion:', error);
      throw new Error(`Failed to save optimization suggestion: ${error.message}`);
    }
  }

  /**
   * Get optimization suggestions for integration
   */
  async getOptimizationSuggestions(
    integrationId: string,
    includeApplied: boolean = false
  ): Promise<OptimizationSuggestion[]> {
    let query = this.supabase
      .from('optimization_suggestions')
      .select('*')
      .eq('integration_id', integrationId)
      .order('created_at', { ascending: false });

    if (!includeApplied) {
      query = query.eq('applied', false);
    }

    const { data, error } = await query;

    if (error) {
      log.error('Failed to get optimization suggestions:', error);
      throw new Error(`Failed to get optimization suggestions: ${error.message}`);
    }

    return data.map(this.mapToOptimizationSuggestion);
  }

  /**
   * Mark suggestion as applied
   */
  async applySuggestion(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('optimization_suggestions')
      .update({
        applied: true,
        applied_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      log.error('Failed to apply suggestion:', error);
      throw new Error(`Failed to apply suggestion: ${error.message}`);
    }
  }

  /**
   * Delete suggestion
   */
  async deleteSuggestion(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('optimization_suggestions')
      .delete()
      .eq('id', id);

    if (error) {
      log.error('Failed to delete suggestion:', error);
      throw new Error(`Failed to delete suggestion: ${error.message}`);
    }
  }

  // ============================================
  // Mapping Methods
  // ============================================

  private mapToIntegratedStrategyConfig(row: any): IntegratedStrategyConfig {
    return {
      id: row.id,
      userId: row.user_id,
      strategy: row.strategy,
      backtestConfig: row.backtest_config,
      environment: row.environment,
      paperConfig: row.paper_config,
      liveConfig: row.live_config,
      backtestResultId: row.backtest_result_id,
      monitoring: row.monitoring,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  private mapToBacktestResultRecord(row: any): BacktestResultRecord {
    return {
      id: row.id,
      integrationId: row.integration_id,
      userId: row.user_id,
      config: row.config,
      stats: row.stats,
      tradeSummary: row.trade_summary,
      performanceMetrics: row.performance_metrics,
      tags: row.tags,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  private mapToOptimizationSuggestion(row: any): OptimizationSuggestion {
    return {
      id: row.id,
      integrationId: row.integration_id,
      type: row.type,
      priority: row.priority,
      title: row.title,
      description: row.description,
      currentValue: row.current_value,
      suggestedValue: row.suggested_value,
      expectedImprovement: row.expected_improvement,
      confidence: row.confidence,
      supportingData: row.supporting_data,
      createdAt: new Date(row.created_at).getTime(),
      applied: row.applied,
      appliedAt: row.applied_at ? new Date(row.applied_at).getTime() : undefined,
    };
  }
}

// Singleton instance
export const backtestLiveDAO = new BacktestLiveDAO();