/**
 * Configuration Sync Service
 *
 * Handles synchronization of strategy configurations across environments
 *
 * @module backtest-live/ConfigSync
 */

import {
  StrategyConfig,
  IntegratedStrategyConfig,
  TradingEnvironment,
  EnvironmentMigrationRequest,
  EnvironmentMigrationResult,
  RiskManagementConfig,
  PaperTradingConfig,
  LiveTradingConfig,
} from './types';
import { BacktestConfig } from '../backtest/types';
import { backtestLiveDAO } from '../database/backtest-live.dao';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';

const log = createLogger('ConfigSync');

/**
 * Default risk management configuration
 */
const DEFAULT_RISK_CONFIG: RiskManagementConfig = {
  maxPositionSize: 0.1, // 10% of portfolio per position
  stopLossPercentage: 5,
  takeProfitPercentage: 10,
  maxDailyLoss: 3,
  maxDrawdown: 15,
  maxConcurrentPositions: 5,
};

/**
 * Default paper trading configuration
 */
const DEFAULT_PAPER_CONFIG: PaperTradingConfig = {
  initialCapital: 100000,
  tradingFees: 0.001, // 0.1%
  slippage: 0.0005, // 0.05%
  latencyMs: 100,
};

/**
 * ConfigSync - Configuration synchronization service
 */
export class ConfigSync {
  /**
   * Create a new integrated strategy configuration
   */
  async createIntegratedStrategy(
    userId: string,
    strategy: Omit<StrategyConfig, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
    backtestConfig: BacktestConfig
  ): Promise<IntegratedStrategyConfig> {
    const now = Date.now();
    const strategyId = uuidv4();
    const integrationId = uuidv4();

    const fullStrategy: StrategyConfig = {
      ...strategy,
      id: strategyId,
      userId,
      createdAt: now,
      updatedAt: now,
      riskManagement: strategy.riskManagement ?? DEFAULT_RISK_CONFIG,
    };

    const integration: IntegratedStrategyConfig = {
      id: integrationId,
      userId,
      strategy: fullStrategy,
      backtestConfig,
      environment: 'backtest',
      monitoring: {
        enableComparison: true,
        deviationThreshold: 10, // 10% deviation triggers alert
        comparisonInterval: 60000, // 1 minute
        enableOptimization: true,
        notificationChannels: [],
      },
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    return await backtestLiveDAO.createIntegration(integration);
  }

  /**
   * Migrate strategy to a new environment
   */
  async migrateEnvironment(
    request: EnvironmentMigrationRequest
  ): Promise<EnvironmentMigrationResult> {
    const { integrationId, targetEnvironment, _copyBacktestResults, _resetPaperStats, configOverride } = request;

    log.info(`Migrating integration ${integrationId} to ${targetEnvironment}`);

    try {
      // Get current integration
      const integration = await backtestLiveDAO.getIntegration(integrationId);
      if (!integration) {
        return {
          success: false,
          environment: targetEnvironment,
          migratedAt: Date.now(),
          warnings: [],
          error: 'Integration not found',
        };
      }

      const warnings: string[] = [];

      // Validate migration path
      const validationResult = this.validateMigration(
        integration.environment,
        targetEnvironment,
        integration
      );
      warnings.push(...validationResult.warnings);

      if (!validationResult.valid) {
        return {
          success: false,
          environment: targetEnvironment,
          migratedAt: Date.now(),
          warnings,
          error: validationResult.error,
        };
      }

      // Apply config overrides
      if (configOverride) {
        integration.strategy = {
          ...integration.strategy,
          ...configOverride,
          updatedAt: Date.now(),
        };
      }

      // Set up environment-specific configuration
      if (targetEnvironment === 'paper' && !integration.paperConfig) {
        integration.paperConfig = DEFAULT_PAPER_CONFIG;
        warnings.push('Applied default paper trading configuration');
      }

      if (targetEnvironment === 'live') {
        if (!integration.liveConfig) {
          return {
            success: false,
            environment: targetEnvironment,
            migratedAt: Date.now(),
            warnings,
            error: 'Live trading configuration is required for live environment',
          };
        }
        // Validate live config
        const liveValidation = this.validateLiveConfig(integration.liveConfig);
        if (!liveValidation.valid) {
          return {
            success: false,
            environment: targetEnvironment,
            migratedAt: Date.now(),
            warnings,
            error: liveValidation.error,
          };
        }
      }

      // Update integration
      const updates: Partial<IntegratedStrategyConfig> = {
        environment: targetEnvironment,
        strategy: integration.strategy,
        paperConfig: integration.paperConfig,
        liveConfig: integration.liveConfig,
        status: targetEnvironment === 'backtest' ? 'backtesting' :
                targetEnvironment === 'paper' ? 'paper_trading' : 'live',
        updatedAt: Date.now(),
      };

      await backtestLiveDAO.updateIntegration(integrationId, updates);

      log.info(`Successfully migrated integration ${integrationId} to ${targetEnvironment}`);

      return {
        success: true,
        environment: targetEnvironment,
        migratedAt: Date.now(),
        warnings,
      };
    } catch (error: any) {
      log.error('Migration failed:', error);
      return {
        success: false,
        environment: targetEnvironment,
        migratedAt: Date.now(),
        warnings: [],
        error: error.message || 'Migration failed',
      };
    }
  }

  /**
   * Validate migration path
   */
  private validateMigration(
    from: TradingEnvironment,
    to: TradingEnvironment,
    integration: IntegratedStrategyConfig
  ): { valid: boolean; warnings: string[]; error?: string } {
    const warnings: string[] = [];

    // Recommended migration path: backtest -> paper -> live
    if (from === 'backtest' && to === 'live') {
      warnings.push('Direct migration from backtest to live is not recommended. Consider paper trading first.');
    }

    if (from === 'live' && to === 'backtest') {
      warnings.push('Migrating from live to backtest will stop live trading.');
    }

    // Validate backtest results exist for non-backtest environments
    if (to !== 'backtest' && !integration.backtestResultId) {
      warnings.push('No backtest results found. Consider running backtest first.');
    }

    // Validate strategy parameters
    if (!integration.strategy.params || Object.keys(integration.strategy.params).length === 0) {
      return {
        valid: false,
        warnings,
        error: 'Strategy parameters are required',
      };
    }

    return { valid: true, warnings };
  }

  /**
   * Validate live trading configuration
   */
  private validateLiveConfig(config: LiveTradingConfig): { valid: boolean; error?: string } {
    if (!config.exchangeId) {
      return { valid: false, error: 'Exchange ID is required for live trading' };
    }

    if (!config.apiKeyRef) {
      return { valid: false, error: 'API key reference is required for live trading' };
    }

    if (!config.symbol) {
      return { valid: false, error: 'Trading symbol is required for live trading' };
    }

    // Validate risk limits
    if (config.riskLimits) {
      if (config.riskLimits.maxPositionSize > 0.5) {
        return { valid: false, error: 'Maximum position size cannot exceed 50% of portfolio' };
      }
      if (config.riskLimits.maxDailyLoss && config.riskLimits.maxDailyLoss > 20) {
        return { valid: false, error: 'Maximum daily loss cannot exceed 20%' };
      }
    }

    return { valid: true };
  }

  /**
   * Clone strategy configuration
   */
  async cloneStrategy(integrationId: string, newUserId?: string): Promise<IntegratedStrategyConfig> {
    const original = await backtestLiveDAO.getIntegration(integrationId);
    if (!original) {
      throw new Error('Integration not found');
    }

    const now = Date.now();
    const newIntegration: IntegratedStrategyConfig = {
      ...original,
      id: uuidv4(),
      userId: newUserId ?? original.userId,
      strategy: {
        ...original.strategy,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
      },
      environment: 'backtest',
      status: 'draft',
      backtestResultId: undefined,
      createdAt: now,
      updatedAt: now,
    };

    return await backtestLiveDAO.createIntegration(newIntegration);
  }

  /**
   * Update strategy parameters
   */
  async updateStrategyParams(
    integrationId: string,
    params: Record<string, any>
  ): Promise<IntegratedStrategyConfig> {
    const integration = await backtestLiveDAO.getIntegration(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    const updatedStrategy: StrategyConfig = {
      ...integration.strategy,
      params: {
        ...integration.strategy.params,
        ...params,
      },
      updatedAt: Date.now(),
    };

    return await backtestLiveDAO.updateIntegration(integrationId, {
      strategy: updatedStrategy,
    });
  }

  /**
   * Update risk management configuration
   */
  async updateRiskManagement(
    integrationId: string,
    riskConfig: Partial<RiskManagementConfig>
  ): Promise<IntegratedStrategyConfig> {
    const integration = await backtestLiveDAO.getIntegration(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    const updatedStrategy: StrategyConfig = {
      ...integration.strategy,
      riskManagement: {
        ...integration.strategy.riskManagement,
        ...riskConfig,
      } as RiskManagementConfig,
      updatedAt: Date.now(),
    };

    return await backtestLiveDAO.updateIntegration(integrationId, {
      strategy: updatedStrategy,
    });
  }

  /**
   * Get configuration comparison across environments
   */
  async getConfigComparison(userId: string): Promise<{
    integrations: IntegratedStrategyConfig[];
    byStrategy: Map<string, IntegratedStrategyConfig[]>;
  }> {
    const integrations = await backtestLiveDAO.getUserIntegrations(userId);
    
    // Group by strategy type
    const byStrategy = new Map<string, IntegratedStrategyConfig[]>();
    for (const integration of integrations) {
      const strategyType = integration.strategy.type;
      if (!byStrategy.has(strategyType)) {
        byStrategy.set(strategyType, []);
      }
      byStrategy.get(strategyType)!.push(integration);
    }

    return { integrations, byStrategy };
  }

  /**
   * Validate configuration consistency
   */
  async validateConsistency(integrationId: string): Promise<{
    consistent: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const integration = await backtestLiveDAO.getIntegration(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check if backtest config matches strategy
    if (integration.backtestConfig.strategy !== integration.strategy.type) {
      issues.push(`Strategy type mismatch: backtest uses ${integration.backtestConfig.strategy}, strategy is ${integration.strategy.type}`);
    }

    // Check parameters consistency
    if (integration.backtestConfig.strategyParams) {
      for (const [key, value] of Object.entries(integration.backtestConfig.strategyParams)) {
        if (integration.strategy.params[key] !== value) {
          issues.push(`Parameter ${key} differs between backtest (${value}) and strategy (${integration.strategy.params[key]})`);
        }
      }
    }

    // Check risk management
    if (!integration.strategy.riskManagement) {
      suggestions.push('Consider adding risk management configuration');
    }

    // Check monitoring for live trading
    if (integration.environment === 'live') {
      if (!integration.monitoring.enableComparison) {
        suggestions.push('Enable performance comparison for live trading');
      }
      if (integration.monitoring.notificationChannels.length === 0) {
        suggestions.push('Add notification channels for live trading alerts');
      }
    }

    return {
      consistent: issues.length === 0,
      issues,
      suggestions,
    };
  }
}

// Singleton instance
export const configSync = new ConfigSync();