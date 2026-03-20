/**
 * Backtest-Live Integration Service
 *
 * Main service for backtest-to-live trading integration
 *
 * @module backtest-live/BacktestLiveIntegration
 */

import {
  IntegratedStrategyConfig,
  StrategyConfig,
  PerformanceComparison,
  OptimizationSuggestion,
  EnvironmentMigrationRequest,
  EnvironmentMigrationResult,
  BacktestResultRecord,
} from './types';
import { BacktestConfig, BacktestResult } from '../backtest/types';
import { BacktestEngine } from '../backtest/BacktestEngine';
import { configSync } from './ConfigSync';
import { performanceMonitor } from './PerformanceMonitor';
import { optimizationFeedback } from './OptimizationFeedback';
import { backtestLiveDAO } from '../database/backtest-live.dao';
import { createLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const log = createLogger('BacktestLiveIntegration');

/**
 * BacktestLiveIntegration - Main integration service
 */
export class BacktestLiveIntegration {
  private activeIntegrations: Map<string, IntegratedStrategyConfig> = new Map();

  /**
   * Initialize the integration service
   */
  async initialize(): Promise<void> {
    log.info('Initializing Backtest-Live Integration service');

    // Load all active integrations
    // TODO: Load from database based on status
  }

  /**
   * Create a new integrated strategy
   */
  async createStrategy(
    userId: string,
    strategyConfig: Omit<StrategyConfig, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
    backtestConfig: BacktestConfig
  ): Promise<IntegratedStrategyConfig> {
    log.info(`Creating new integrated strategy for user ${userId}`);

    // Create integration with config sync service
    const integration = await configSync.createIntegratedStrategy(
      userId,
      strategyConfig,
      backtestConfig
    );

    log.info(`Created integration ${integration.id}`);
    return integration;
  }

  /**
   * Run backtest for an integration
   */
  async runBacktest(
    integrationId: string,
    config?: Partial<BacktestConfig>
  ): Promise<{
    success: boolean;
    result?: BacktestResult;
    record?: BacktestResultRecord;
    error?: string;
  }> {
    log.info(`Running backtest for integration ${integrationId}`);

    try {
      const integration = await backtestLiveDAO.getIntegration(integrationId);
      if (!integration) {
        return { success: false, error: 'Integration not found' };
      }

      // Merge config with any overrides
      const backtestConfig: BacktestConfig = {
        ...integration.backtestConfig,
        ...config,
      };

      // Update status
      await backtestLiveDAO.updateStatus(integrationId, 'backtesting');

      // Run backtest
      const engine = new BacktestEngine(backtestConfig);
      const result = engine.run();

      // Save backtest result
      const record: BacktestResultRecord = {
        id: uuidv4(),
        integrationId,
        userId: integration.userId,
        config: backtestConfig,
        stats: result.stats,
        tradeSummary: {
          totalTrades: result.stats.totalTrades,
          buyTrades: Math.floor(result.stats.totalTrades * 0.5),
          sellTrades: Math.ceil(result.stats.totalTrades * 0.5),
          avgTradeSize: backtestConfig.capital / Math.max(result.stats.totalTrades, 1),
        },
        performanceMetrics: result.performanceMetrics ? {
          duration: result.duration,
          memoryUsed: result.performanceMetrics.memoryUsage.heapUsed,
          ticksPerSecond: result.performanceMetrics.timings.tickProcessing?.avg ?? 0,
        } : undefined,
        createdAt: Date.now(),
      };

      await backtestLiveDAO.saveBacktestResult(record);

      // Update integration with result reference
      await backtestLiveDAO.updateIntegration(integrationId, {
        backtestResultId: record.id,
        status: 'draft',
      });

      log.info(`Backtest completed for ${integrationId}`, result.stats);

      return { success: true, result, record };
    } catch (error: any) {
      log.error(`Backtest failed for ${integrationId}:`, error);
      
      // Update status to error
      await backtestLiveDAO.updateStatus(integrationId, 'error');

      return {
        success: false,
        error: error.message || 'Backtest failed',
      };
    }
  }

  /**
   * Migrate to paper trading
   */
  async migrateToPaper(integrationId: string): Promise<EnvironmentMigrationResult> {
    log.info(`Migrating ${integrationId} to paper trading`);

    const migrationRequest: EnvironmentMigrationRequest = {
      integrationId,
      targetEnvironment: 'paper',
    };

    const result = await configSync.migrateEnvironment(migrationRequest);

    if (result.success) {
      // Start monitoring
      const integration = await backtestLiveDAO.getIntegration(integrationId);
      if (integration) {
        this.activeIntegrations.set(integrationId, integration);
        performanceMonitor.startMonitoring(integration);
      }
    }

    return result;
  }

  /**
   * Migrate to live trading
   */
  async migrateToLive(
    integrationId: string,
    liveConfig: {
      exchangeId: string;
      apiKeyRef: string;
      symbol: string;
      riskLimits?: any;
    }
  ): Promise<EnvironmentMigrationResult> {
    log.info(`Migrating ${integrationId} to live trading`);

    // First update with live config
    await backtestLiveDAO.updateIntegration(integrationId, {
      liveConfig: {
        ...liveConfig,
        autoStart: false,
        riskLimits: liveConfig.riskLimits ?? {
          maxPositionSize: 0.1,
          maxDailyLoss: 3,
          maxDrawdown: 10,
        },
      },
    });

    const migrationRequest: EnvironmentMigrationRequest = {
      integrationId,
      targetEnvironment: 'live',
    };

    const result = await configSync.migrateEnvironment(migrationRequest);

    if (result.success) {
      // Start monitoring with tighter thresholds
      const integration = await backtestLiveDAO.getIntegration(integrationId);
      if (integration) {
        this.activeIntegrations.set(integrationId, integration);
        performanceMonitor.startMonitoring(integration);
      }
    }

    return result;
  }

  /**
   * Pause an integration
   */
  async pauseIntegration(integrationId: string): Promise<void> {
    log.info(`Pausing integration ${integrationId}`);

    performanceMonitor.stopMonitoring(integrationId);
    await backtestLiveDAO.updateStatus(integrationId, 'paused');
    this.activeIntegrations.delete(integrationId);
  }

  /**
   * Resume an integration
   */
  async resumeIntegration(integrationId: string): Promise<void> {
    log.info(`Resuming integration ${integrationId}`);

    const integration = await backtestLiveDAO.getIntegration(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    if (integration.status !== 'paused') {
      throw new Error('Integration is not paused');
    }

    const newStatus = integration.environment === 'paper' ? 'paper_trading' : 'live';
    await backtestLiveDAO.updateStatus(integrationId, newStatus);

    this.activeIntegrations.set(integrationId, integration);
    performanceMonitor.startMonitoring(integration);
  }

  /**
   * Stop an integration permanently
   */
  async stopIntegration(integrationId: string): Promise<void> {
    log.info(`Stopping integration ${integrationId}`);

    performanceMonitor.stopMonitoring(integrationId);
    await backtestLiveDAO.updateStatus(integrationId, 'stopped');
    this.activeIntegrations.delete(integrationId);
  }

  /**
   * Get integration status
   */
  async getStatus(integrationId: string): Promise<{
    integration: IntegratedStrategyConfig | null;
    latestComparison: PerformanceComparison | null;
    pendingOptimizations: OptimizationSuggestion[];
  }> {
    const integration = await backtestLiveDAO.getIntegration(integrationId);
    const latestRecord = await backtestLiveDAO.getLatestComparison(integrationId);
    const pendingOptimizations = integration
      ? await backtestLiveDAO.getOptimizationSuggestions(integrationId, false)
      : [];

    return {
      integration,
      latestComparison: latestRecord?.comparison ?? null,
      pendingOptimizations,
    };
  }

  /**
   * Get performance history
   */
  async getPerformanceHistory(
    integrationId: string,
    limit: number = 100
  ): Promise<PerformanceComparison[]> {
    const records = await backtestLiveDAO.getHistoricalComparisons(integrationId, limit);
    return records.map(r => r.comparison);
  }

  /**
   * Run optimization analysis
   */
  async analyzeOptimization(integrationId: string): Promise<{
    suggestions: OptimizationSuggestion[];
    confidence: number;
  }> {
    const integration = await backtestLiveDAO.getIntegration(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    if (!integration.monitoring.enableOptimization) {
      throw new Error('Optimization is not enabled for this integration');
    }

    const analysis = await optimizationFeedback.analyzePerformance(integration);

    // Save suggestions
    if (analysis.suggestions.length > 0) {
      await optimizationFeedback.saveSuggestions(analysis.suggestions);
    }

    return {
      suggestions: analysis.suggestions,
      confidence: analysis.confidence,
    };
  }

  /**
   * Apply optimization suggestion
   */
  async applyOptimization(
    integrationId: string,
    suggestionId: string
  ): Promise<{
    success: boolean;
    message: string;
    integration?: IntegratedStrategyConfig;
  }> {
    const integration = await backtestLiveDAO.getIntegration(integrationId);
    if (!integration) {
      return { success: false, message: 'Integration not found' };
    }

    const suggestions = await backtestLiveDAO.getOptimizationSuggestions(integrationId, true);
    const suggestion = suggestions.find(s => s.id === suggestionId);

    if (!suggestion) {
      return { success: false, message: 'Suggestion not found' };
    }

    if (suggestion.applied) {
      return { success: false, message: 'Suggestion already applied' };
    }

    const result = await optimizationFeedback.applySuggestion(integration, suggestion);

    return {
      success: result.success,
      message: result.message,
      integration: result.updatedIntegration,
    };
  }

  /**
   * Get all integrations for a user
   */
  async getUserIntegrations(userId: string): Promise<IntegratedStrategyConfig[]> {
    return await backtestLiveDAO.getUserIntegrations(userId);
  }

  /**
   * Delete an integration
   */
  async deleteIntegration(integrationId: string): Promise<void> {
    log.info(`Deleting integration ${integrationId}`);

    // Stop monitoring first
    performanceMonitor.stopMonitoring(integrationId);
    this.activeIntegrations.delete(integrationId);

    // Delete from database
    await backtestLiveDAO.deleteIntegration(integrationId);
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(integrationId: string): Promise<{
    latestComparison: PerformanceComparison | null;
    historicalTrend: { timestamp: number; overallScore: number }[];
    averageDeviation: number;
  }> {
    return await performanceMonitor.getPerformanceSummary(integrationId);
  }

  /**
   * Update strategy parameters
   */
  async updateParameters(
    integrationId: string,
    params: Record<string, any>
  ): Promise<IntegratedStrategyConfig> {
    return await configSync.updateStrategyParams(integrationId, params);
  }

  /**
   * Update risk management settings
   */
  async updateRiskManagement(
    integrationId: string,
    riskConfig: Partial<import('./types').RiskManagementConfig>
  ): Promise<IntegratedStrategyConfig> {
    return await configSync.updateRiskManagement(integrationId, riskConfig);
  }

  /**
   * Validate configuration consistency
   */
  async validateConfiguration(integrationId: string): Promise<{
    consistent: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    return await configSync.validateConsistency(integrationId);
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    log.info('Shutting down Backtest-Live Integration service');

    performanceMonitor.stopAllMonitoring();
    this.activeIntegrations.clear();
  }
}

// Singleton instance
export const backtestLiveIntegration = new BacktestLiveIntegration();