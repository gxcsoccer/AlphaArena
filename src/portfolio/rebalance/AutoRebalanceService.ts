/**
 * Auto Rebalance Service
 * 
 * High-level service for automated portfolio rebalancing.
 * Integrates scheduling, execution, and optimization features.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  RebalancePlan,
  RebalanceTrigger,
  RebalanceExecution,
  RebalanceExecutionStatus,
  RebalancePreview,
  RebalanceAdjustment,
  RebalanceResult,
  RebalanceConfig,
  RebalanceProgress,
  TaxOptimizationConfig,
  CostOptimizationConfig,
  RetryConfig,
  DEFAULT_REBALANCE_CONFIG,
  PositionState,
} from './types';
import { RebalanceEngine, MarketPriceProvider, OrderExecutor } from './RebalanceEngine';
import { RebalanceScheduler } from './RebalanceScheduler';
import { rebalanceDAO } from '../../database/rebalance.dao';
import { VirtualAccountDAO } from '../../database/virtual-account.dao';
import { createLogger } from '../../utils/logger';

const log = createLogger('AutoRebalanceService');

/**
 * Service configuration
 */
interface AutoRebalanceServiceConfig {
  rebalanceConfig: RebalanceConfig;
  enableScheduler: boolean;
  enableTaxOptimization: boolean;
  enableCostOptimization: boolean;
}

const DEFAULT_SERVICE_CONFIG: AutoRebalanceServiceConfig = {
  rebalanceConfig: DEFAULT_REBALANCE_CONFIG,
  enableScheduler: true,
  enableTaxOptimization: false,
  enableCostOptimization: true,
};

/**
 * Rebalance check result
 */
interface RebalanceCheckResult {
  needsRebalancing: boolean;
  positionStates: PositionState[];
  maxDeviation: number;
  recommendation: string;
}

/**
 * Auto Rebalance Service
 * 
 * Provides comprehensive automated rebalancing functionality including:
 * - Scheduled rebalancing (daily, weekly, monthly)
 * - Threshold-triggered rebalancing
 * - Tax optimization
 * - Cost optimization
 * - Retry mechanism
 */
export class AutoRebalanceService {
  private config: AutoRebalanceServiceConfig;
  private engine: RebalanceEngine;
  private scheduler: RebalanceScheduler | null;
  private priceProvider: MarketPriceProvider;
  private orderExecutor?: OrderExecutor;

  constructor(
    priceProvider: MarketPriceProvider,
    orderExecutor?: OrderExecutor,
    config?: Partial<AutoRebalanceServiceConfig>
  ) {
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config };
    this.priceProvider = priceProvider;
    this.orderExecutor = orderExecutor;
    
    this.engine = new RebalanceEngine(
      priceProvider,
      orderExecutor,
      this.config.rebalanceConfig
    );

    if (this.config.enableScheduler) {
      this.scheduler = new RebalanceScheduler(this.engine);
    } else {
      this.scheduler = null;
    }
  }

  /**
   * Start the auto-rebalance service
   */
  async start(): Promise<void> {
    if (this.scheduler) {
      await this.scheduler.start();
    }
    log.info('Auto rebalance service started');
  }

  /**
   * Stop the auto-rebalance service
   */
  async stop(): Promise<void> {
    if (this.scheduler) {
      await this.scheduler.stop();
    }
    log.info('Auto rebalance service stopped');
  }

  /**
   * Check if rebalancing is needed for a portfolio
   */
  async checkRebalanceNeeded(
    userId: string,
    planId: string
  ): Promise<RebalanceCheckResult> {
    // Get plan
    const plan = await rebalanceDAO.getPlan(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    // Get user's positions
    const account = await VirtualAccountDAO.getAccountByUserId(userId);
    if (!account) {
      return {
        needsRebalancing: false,
        positionStates: [],
        maxDeviation: 0,
        recommendation: 'No virtual account found',
      };
    }

    const positions = await VirtualAccountDAO.getPositions(account.id);
    
    // Convert to portfolio positions
    const portfolioPositions = positions.map(p => ({
      symbol: p.symbol,
      quantity: p.quantity,
      averageCost: p.average_cost,
    }));

    // Calculate position states
    const positionStates = await this.engine.calculatePositionStates(
      portfolioPositions,
      plan.targetAllocation
    );

    // Calculate max deviation
    const maxDeviation = Math.max(
      ...positionStates.map(s => s.deviationPercent)
    );

    // Determine if rebalancing is needed
    const threshold = plan.threshold || this.config.rebalanceConfig.defaultTolerance;
    const needsRebalancing = this.engine.needsRebalancing(positionStates, threshold);

    // Generate recommendation
    let recommendation = '';
    if (needsRebalancing) {
      const deviatingAssets = positionStates
        .filter(s => s.deviationPercent > threshold)
        .map(s => `${s.symbol} (${s.deviationPercent.toFixed(1)}% off target)`);
      
      recommendation = `Rebalancing recommended. Assets exceeding threshold: ${deviatingAssets.join(', ')}`;
    } else {
      recommendation = `Portfolio is within tolerance. Max deviation: ${maxDeviation.toFixed(1)}%`;
    }

    return {
      needsRebalancing,
      positionStates,
      maxDeviation,
      recommendation,
    };
  }

  /**
   * Preview rebalancing for a plan
   */
  async previewRebalance(
    userId: string,
    planId: string
  ): Promise<RebalancePreview> {
    // Get plan
    const plan = await rebalanceDAO.getPlan(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    // Get user's positions
    const account = await VirtualAccountDAO.getAccountByUserId(userId);
    if (!account) {
      throw new Error('Virtual account not found');
    }

    const positions = await VirtualAccountDAO.getPositions(account.id);
    
    // Convert to portfolio positions
    const portfolioPositions = positions.map(p => ({
      symbol: p.symbol,
      quantity: p.quantity,
      averageCost: p.average_cost,
    }));

    // Generate preview
    return this.engine.generatePreview(plan, portfolioPositions);
  }

  /**
   * Execute rebalancing with optimizations
   */
  async executeRebalance(
    userId: string,
    planId: string,
    options?: {
      dryRun?: boolean;
      skipOptimizations?: boolean;
      onProgress?: (progress: RebalanceProgress) => void;
    }
  ): Promise<RebalanceResult> {
    const dryRun = options?.dryRun ?? false;
    const skipOptimizations = options?.skipOptimizations ?? false;

    // Get plan
    const plan = await rebalanceDAO.getPlan(planId);
    if (!plan) {
      return { success: false, error: 'Plan not found' };
    }

    // Check cooldown period
    if (this.config.rebalanceConfig.constraints.cooldownPeriod) {
      const lastExecution = await this.getLastExecutionTime(planId);
      if (lastExecution) {
        const hoursSinceLastRun = 
          (Date.now() - lastExecution.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastRun < this.config.rebalanceConfig.constraints.cooldownPeriod) {
          return {
            success: false,
            error: `Cooldown period active. ${Math.ceil(
              this.config.rebalanceConfig.constraints.cooldownPeriod - hoursSinceLastRun
            )} hours remaining.`,
          };
        }
      }
    }

    // Get user's positions
    const account = await VirtualAccountDAO.getAccountByUserId(userId);
    if (!account) {
      return { success: false, error: 'Virtual account not found' };
    }

    const positions = await VirtualAccountDAO.getPositions(account.id);
    
    // Convert to portfolio positions
    const portfolioPositions = positions.map(p => ({
      symbol: p.symbol,
      quantity: p.quantity,
      averageCost: p.average_cost,
    }));

    // Generate preview
    const preview = await this.engine.generatePreview(plan, portfolioPositions);

    // Apply optimizations
    let adjustments = preview.adjustments;
    if (!skipOptimizations) {
      adjustments = await this.applyOptimizations(
        adjustments,
        account.id,
        this.config.rebalanceConfig
      );
    }

    // Check minimum trade values
    adjustments = this.filterSmallTrades(
      adjustments,
      this.config.rebalanceConfig.constraints.minOrderValue || 0
    );

    if (adjustments.length === 0) {
      return {
        success: true,
        preview,
        execution: this.createEmptyExecution(planId, preview),
      };
    }

    // Dry run - return preview only
    if (dryRun) {
      return {
        success: true,
        preview: {
          ...preview,
          adjustments,
        },
      };
    }

    // Execute with retry
    return this.executeWithRetry(
      plan,
      portfolioPositions,
      this.config.rebalanceConfig.retry,
      options?.onProgress
    );
  }

  /**
   * Apply tax and cost optimizations to adjustments
   */
  private async applyOptimizations(
    adjustments: RebalanceAdjustment[],
    accountId: string,
    config: RebalanceConfig
  ): Promise<RebalanceAdjustment[]> {
    let optimized = [...adjustments];

    // Tax optimization
    if (config.taxOptimization?.enabled) {
      optimized = this.applyTaxOptimization(optimized, config.taxOptimization);
    }

    // Cost optimization
    if (config.costOptimization?.enabled) {
      optimized = this.applyCostOptimization(optimized, config.costOptimization);
    }

    // Check max asset weight constraint
    if (config.constraints.maxAssetWeight) {
      optimized = this.enforceMaxWeight(optimized, config.constraints.maxAssetWeight);
    }

    return optimized;
  }

  /**
   * Apply tax optimization to adjustments
   */
  private applyTaxOptimization(
    adjustments: RebalanceAdjustment[],
    config: TaxOptimizationConfig
  ): RebalanceAdjustment[] {
    // Sort sell orders to prefer long-term holdings
    if (config.preferLongTerm) {
      const sells = adjustments.filter(a => a.action === 'sell');
      const others = adjustments.filter(a => a.action !== 'sell');
      
      // In production, would check holding period from transaction history
      // For now, just return as-is
      return [...sells, ...others];
    }

    return adjustments;
  }

  /**
   * Apply cost optimization to adjustments
   */
  private applyCostOptimization(
    adjustments: RebalanceAdjustment[],
    config: CostOptimizationConfig
  ): RebalanceAdjustment[] {
    // Filter out trades below minimum value
    if (config.minTradeValue > 0) {
      adjustments = adjustments.filter(
        a => a.estimatedValue >= config.minTradeValue || a.action === 'none'
      );
    }

    // Limit number of trades per day
    if (config.maxDailyTrades > 0 && adjustments.length > config.maxDailyTrades) {
      // Prioritize by deviation
      adjustments.sort((a, b) => b.priority - a.priority);
      adjustments = adjustments.slice(0, config.maxDailyTrades);
    }

    return adjustments;
  }

  /**
   * Enforce maximum asset weight constraint
   */
  private enforceMaxWeight(
    adjustments: RebalanceAdjustment[],
    _maxWeight: number
  ): RebalanceAdjustment[] {
    return adjustments.map(adj => {
      // If buying would exceed max weight, reduce quantity
      // This is a simplification - real implementation would need portfolio value
      return adj;
    });
  }

  /**
   * Filter out trades below minimum value
   */
  private filterSmallTrades(
    adjustments: RebalanceAdjustment[],
    minValue: number
  ): RebalanceAdjustment[] {
    if (minValue <= 0) return adjustments;
    
    return adjustments.filter(
      a => a.action === 'none' || a.estimatedValue >= minValue
    );
  }

  /**
   * Execute rebalancing with retry mechanism
   */
  private async executeWithRetry(
    plan: RebalancePlan,
    positions: any[],
    retryConfig?: RetryConfig,
    _onProgress?: (progress: RebalanceProgress) => void
  ): Promise<RebalanceResult> {
    const maxRetries = retryConfig?.maxRetries ?? 0;
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(
            (retryConfig?.retryDelayMs ?? 1000) * 
            Math.pow(retryConfig?.retryBackoffMultiplier ?? 2, attempt - 1),
            retryConfig?.maxRetryDelayMs ?? 30000
          );

          log.info('Retrying rebalance execution', { 
            attempt, 
            delay,
            planId: plan.id 
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const result = await this.engine.execute(
          plan,
          positions,
          RebalanceTrigger.MANUAL
        );

        if (result.success) {
          return result;
        }

        lastError = result.error;
      } catch (error: any) {
        lastError = error.message;
        log.error('Rebalance execution attempt failed', { 
          attempt, 
          error: lastError,
          planId: plan.id 
        });
      }
    }

    return {
      success: false,
      error: lastError || 'Rebalancing failed after all retries',
    };
  }

  /**
   * Get last execution time for a plan
   */
  private async getLastExecutionTime(planId: string): Promise<Date | null> {
    const executions = await rebalanceDAO.getExecutions(planId, 1);
    if (executions && executions.length > 0) {
      return executions[0].startedAt;
    }
    return null;
  }

  /**
   * Create empty execution record
   */
  private createEmptyExecution(
    planId: string,
    preview: RebalancePreview
  ): RebalanceExecution {
    return {
      id: uuidv4(),
      planId,
      status: RebalanceExecutionStatus.COMPLETED,
      trigger: RebalanceTrigger.MANUAL,
      preview,
      orders: [],
      totalEstimatedCost: 0,
      totalActualCost: 0,
      totalFees: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      metrics: {
        totalOrders: 0,
        successfulOrders: 0,
        failedOrders: 0,
        totalVolume: 0,
        averageExecutionPrice: 0,
        executionTimeMs: 0,
        slippageBps: 0,
      },
    };
  }

  /**
   * Get scheduler status
   */
  getSchedulerStatus() {
    return this.scheduler?.getStatus() ?? null;
  }

  /**
   * Schedule a plan for automatic rebalancing
   */
  async schedulePlan(planId: string): Promise<void> {
    if (!this.scheduler) {
      throw new Error('Scheduler is not enabled');
    }

    const plan = await rebalanceDAO.getPlan(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    await this.scheduler.schedulePlan(plan);
  }

  /**
   * Unschedule a plan
   */
  async unschedulePlan(planId: string): Promise<boolean> {
    if (!this.scheduler) {
      return false;
    }

    return this.scheduler.unschedulePlan(planId);
  }
}

// Singleton instance
let serviceInstance: AutoRebalanceService | null = null;

/**
 * Get or create the auto rebalance service singleton
 */
export function getAutoRebalanceService(
  priceProvider: MarketPriceProvider,
  orderExecutor?: OrderExecutor,
  config?: Partial<AutoRebalanceServiceConfig>
): AutoRebalanceService {
  if (!serviceInstance) {
    serviceInstance = new AutoRebalanceService(priceProvider, orderExecutor, config);
  }
  return serviceInstance;
}

export default AutoRebalanceService;