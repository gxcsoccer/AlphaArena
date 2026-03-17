/**
 * Portfolio Rebalancing Engine
 * 
 * Core engine for calculating and executing portfolio rebalancing operations.
 * Supports scheduled, threshold-triggered, and manual rebalancing strategies.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AssetAllocation,
  TargetAllocation,
  RebalancePlan,
  PositionState,
  RebalanceAdjustment,
  RebalancePreview,
  RebalanceExecution,
  RebalanceOrder,
  RebalanceResult,
  RebalanceTrigger,
  RebalanceExecutionStatus,
  RebalanceOrderStatus,
  RebalanceOrderType,
  ExecutionMetrics,
  RebalanceConfig,
  DEFAULT_REBALANCE_CONFIG,
} from './types';
import { Position } from '../types';
import { createLogger } from '../../utils/logger';

const log = createLogger('RebalanceEngine');

/**
 * Market price provider interface
 */
export interface MarketPriceProvider {
  getPrice(symbol: string): Promise<number>;
  getPrices(symbols: string[]): Promise<Map<string, number>>;
}

/**
 * Order executor interface
 */
export interface OrderExecutor {
  submitOrder(order: {
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    type: RebalanceOrderType;
    limitPrice?: number;
  }): Promise<{ orderId: string; filledQuantity: number; filledPrice: number; fee: number }>;
  cancelOrder(orderId: string): Promise<boolean>;
  getOrderStatus(orderId: string): Promise<{
    status: RebalanceOrderStatus;
    filledQuantity: number;
    filledPrice: number;
  }>;
}

/**
 * Rebalancing Engine
 * 
 * Handles all rebalancing calculations and execution logic.
 */
export class RebalanceEngine {
  private config: RebalanceConfig;
  private priceProvider: MarketPriceProvider;
  private orderExecutor?: OrderExecutor;
  private activeExecutions: Map<string, RebalanceExecution>;

  constructor(
    priceProvider: MarketPriceProvider,
    orderExecutor?: OrderExecutor,
    config?: Partial<RebalanceConfig>
  ) {
    this.config = { ...DEFAULT_REBALANCE_CONFIG, ...config };
    this.priceProvider = priceProvider;
    this.orderExecutor = orderExecutor;
    this.activeExecutions = new Map();
  }

  /**
   * Calculate current position weights
   */
  async calculatePositionStates(
    positions: Position[],
    targetAllocation: TargetAllocation
  ): Promise<PositionState[]> {
    // Get current market prices
    const symbols = positions.map(p => p.symbol);
    const targetSymbols = targetAllocation.allocations.map(a => a.symbol);
    const allSymbols = [...new Set([...symbols, ...targetSymbols])];
    
    const prices = await this.priceProvider.getPrices(allSymbols);
    
    // Calculate total portfolio value
    let totalValue = 0;
    const positionValues = new Map<string, number>();
    
    for (const position of positions) {
      const price = prices.get(position.symbol) || position.averageCost;
      const value = position.quantity * price;
      positionValues.set(position.symbol, value);
      totalValue += value;
    }
    
    // Build position states with target weights
    const states: PositionState[] = [];
    
    for (const symbol of allSymbols) {
      const position = positions.find(p => p.symbol === symbol);
      const allocation = targetAllocation.allocations.find(a => a.symbol === symbol);
      
      const quantity = position?.quantity || 0;
      const averageCost = position?.averageCost || 0;
      const currentPrice = prices.get(symbol) || 0;
      const marketValue = quantity * currentPrice;
      const currentWeight = totalValue > 0 ? (marketValue / totalValue) * 100 : 0;
      const targetWeight = allocation?.targetWeight || 0;
      const deviation = Math.abs(currentWeight - targetWeight);
      const deviationPercent = targetWeight > 0 ? (deviation / targetWeight) * 100 : deviation;
      
      states.push({
        symbol,
        quantity,
        averageCost,
        currentPrice,
        marketValue,
        currentWeight,
        targetWeight,
        deviation,
        deviationPercent,
      });
    }
    
    return states;
  }

  /**
   * Check if rebalancing is needed based on threshold
   */
  needsRebalancing(
    positionStates: PositionState[],
    threshold: number
  ): boolean {
    return positionStates.some(state => state.deviationPercent > threshold);
  }

  /**
   * Calculate rebalancing adjustments
   */
  calculateAdjustments(
    positionStates: PositionState[],
    totalPortfolioValue: number,
    constraints?: Partial<RebalanceConfig['constraints']>
  ): RebalanceAdjustment[] {
    const { constraints: defaultConstraints } = this.config;
    const effectiveConstraints = { ...defaultConstraints, ...constraints };
    
    const adjustments: RebalanceAdjustment[] = [];
    
    for (const state of positionStates) {
      const targetValue = (state.targetWeight / 100) * totalPortfolioValue;
      const targetQuantity = state.currentPrice > 0 ? targetValue / state.currentPrice : 0;
      const quantityDiff = targetQuantity - state.quantity;
      
      let action: 'buy' | 'sell' | 'none' = 'none';
      let quantity = 0;
      
      if (Math.abs(quantityDiff) > 0.0001) {
        action = quantityDiff > 0 ? 'buy' : 'sell';
        quantity = Math.abs(quantityDiff);
      }
      
      // Calculate estimated fees
      const estimatedValue = quantity * state.currentPrice;
      const estimatedFee = this.calculateFee(estimatedValue);
      
      // Calculate priority (larger deviation = higher priority)
      const priority = Math.round(state.deviationPercent * 100);
      
      adjustments.push({
        symbol: state.symbol,
        action,
        quantity,
        currentQuantity: state.quantity,
        targetQuantity,
        estimatedPrice: state.currentPrice,
        estimatedValue,
        estimatedFee,
        priority,
      });
    }
    
    // Sort by priority (descending) if prioritizing low cost
    if (effectiveConstraints.prioritizeLowCost) {
      adjustments.sort((a, b) => b.priority - a.priority);
    }
    
    return adjustments;
  }

  /**
   * Generate rebalance preview
   */
  async generatePreview(
    plan: RebalancePlan,
    positions: Position[]
  ): Promise<RebalancePreview> {
    const positionStates = await this.calculatePositionStates(
      positions,
      plan.targetAllocation
    );
    
    // Calculate total portfolio value
    const portfolioValue = positionStates.reduce(
      (sum, state) => sum + state.marketValue,
      0
    );
    
    // Calculate adjustments
    const allAdjustments = this.calculateAdjustments(
      positionStates,
      portfolioValue
    );
    
    // Filter out 'none' actions and apply constraints
    let adjustments = allAdjustments.filter(a => a.action !== 'none');
    
    // Apply partial rebalancing if enabled
    if (this.config.constraints.allowPartialRebalance && plan.threshold) {
      adjustments = adjustments.filter(
        a => a.priority > plan.threshold! * 100
      );
    }
    
    // Calculate totals
    const totalEstimatedCost = adjustments.reduce(
      (sum, a) => sum + a.estimatedValue,
      0
    );
    const totalEstimatedFees = adjustments.reduce(
      (sum, a) => sum + a.estimatedFee,
      0
    );
    const estimatedSlippage = this.calculateSlippage(totalEstimatedCost);
    
    // Generate warnings
    const warnings = this.generateWarnings(adjustments, portfolioValue);
    
    return {
      planId: plan.id,
      portfolioValue,
      positions: positionStates,
      adjustments,
      totalEstimatedCost,
      totalEstimatedFees,
      estimatedSlippage,
      executionStrategy: this.determineExecutionStrategy(adjustments),
      warnings,
      timestamp: new Date(),
    };
  }

  /**
   * Execute rebalancing
   */
  async execute(
    plan: RebalancePlan,
    positions: Position[],
    trigger: RebalanceTrigger = RebalanceTrigger.MANUAL
  ): Promise<RebalanceResult> {
    try {
      // Generate preview first
      const preview = await this.generatePreview(plan, positions);
      
      if (preview.adjustments.length === 0) {
        log.info('No adjustments needed for rebalancing', { planId: plan.id });
        return {
          success: true,
          preview,
          execution: this.createEmptyExecution(plan.id, trigger, preview),
        };
      }
      
      // Check if we have an order executor
      if (!this.orderExecutor) {
        log.warn('No order executor configured, returning preview only');
        return {
          success: true,
          preview,
        };
      }
      
      // Create execution record
      const execution: RebalanceExecution = {
        id: uuidv4(),
        planId: plan.id,
        status: RebalanceExecutionStatus.EXECUTING,
        trigger,
        preview,
        orders: [],
        totalEstimatedCost: preview.totalEstimatedCost,
        totalActualCost: 0,
        totalFees: 0,
        startedAt: new Date(),
        metrics: this.createEmptyMetrics(),
      };
      
      this.activeExecutions.set(execution.id, execution);
      
      // Execute orders
      const orders = await this.executeOrders(execution, preview.adjustments);
      execution.orders = orders;
      
      // Calculate final metrics
      execution.metrics = this.calculateMetrics(orders);
      execution.totalActualCost = orders.reduce(
        (sum, o) => sum + o.filledQuantity * o.filledPrice,
        0
      );
      execution.totalFees = orders.reduce((sum, o) => sum + o.fee, 0);
      
      // Determine final status
      const failedOrders = orders.filter(
        o => o.status === RebalanceOrderStatus.FAILED
      );
      const successOrders = orders.filter(
        o => o.status === RebalanceOrderStatus.FILLED
      );
      
      if (failedOrders.length === 0 && successOrders.length === orders.length) {
        execution.status = RebalanceExecutionStatus.COMPLETED;
      } else if (successOrders.length > 0) {
        execution.status = RebalanceExecutionStatus.PARTIALLY_COMPLETED;
      } else {
        execution.status = RebalanceExecutionStatus.FAILED;
        execution.error = 'All orders failed';
      }
      
      execution.completedAt = new Date();
      
      return {
        success: execution.status === RebalanceExecutionStatus.COMPLETED,
        preview,
        execution,
      };
    } catch (error: any) {
      log.error('Rebalancing execution failed', { error: error.message, planId: plan.id });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute orders for rebalancing
   */
  private async executeOrders(
    execution: RebalanceExecution,
    adjustments: RebalanceAdjustment[]
  ): Promise<RebalanceOrder[]> {
    const orders: RebalanceOrder[] = [];
    
    for (const adjustment of adjustments) {
      if (adjustment.action === 'none') continue;
      
      const order: RebalanceOrder = {
        id: uuidv4(),
        planId: execution.planId,
        symbol: adjustment.symbol,
        side: adjustment.action,
        orderType: RebalanceOrderType.MARKET,
        quantity: adjustment.quantity,
        status: RebalanceOrderStatus.PENDING,
        filledQuantity: 0,
        filledPrice: 0,
        fee: 0,
        createdAt: new Date(),
      };
      
      try {
        order.status = RebalanceOrderStatus.SUBMITTED;
        order.executedAt = new Date();
        
        const result = await this.orderExecutor!.submitOrder({
          symbol: adjustment.symbol,
          side: adjustment.action,
          quantity: adjustment.quantity,
          type: RebalanceOrderType.MARKET,
        });
        
        order.filledQuantity = result.filledQuantity;
        order.filledPrice = result.filledPrice;
        order.fee = result.fee;
        order.status = RebalanceOrderStatus.FILLED;
        order.completedAt = new Date();
        
        log.info('Order executed successfully', {
          orderId: order.id,
          symbol: order.symbol,
          side: order.side,
          quantity: order.filledQuantity,
          price: order.filledPrice,
        });
      } catch (error: any) {
        order.status = RebalanceOrderStatus.FAILED;
        order.error = error.message;
        order.completedAt = new Date();
        
        log.error('Order execution failed', {
          orderId: order.id,
          symbol: order.symbol,
          error: error.message,
        });
      }
      
      orders.push(order);
    }
    
    return orders;
  }

  /**
   * Calculate trading fee
   */
  private calculateFee(value: number): number {
    const { makerFee, minimumFee } = this.config.fees;
    const fee = value * (makerFee / 100);
    return Math.max(fee, minimumFee);
  }

  /**
   * Calculate estimated slippage
   */
  private calculateSlippage(totalValue: number): number {
    return totalValue * (this.config.slippageTolerance / 100);
  }

  /**
   * Generate warnings for the preview
   */
  private generateWarnings(
    adjustments: RebalanceAdjustment[],
    portfolioValue: number
  ): string[] {
    const warnings: string[] = [];
    
    // Check for large orders
    for (const adj of adjustments) {
      if (adj.estimatedValue > portfolioValue * 0.5) {
        warnings.push(
          `Large order for ${adj.symbol}: ${((adj.estimatedValue / portfolioValue) * 100).toFixed(1)}% of portfolio`
        );
      }
    }
    
    // Check for potential market impact
    const totalTurnover = adjustments.reduce((sum, a) => sum + a.estimatedValue, 0);
    if (totalTurnover > portfolioValue * 0.3) {
      warnings.push(
        `High turnover: ${((totalTurnover / portfolioValue) * 100).toFixed(1)}% of portfolio will be traded`
      );
    }
    
    return warnings;
  }

  /**
   * Determine execution strategy
   */
  private determineExecutionStrategy(
    adjustments: RebalanceAdjustment[]
  ): 'parallel' | 'sequential' | 'optimized' {
    if (adjustments.length <= 2) {
      return 'parallel';
    }
    
    // Check if there are conflicting orders (buy and sell same asset)
    const symbols = adjustments.map(a => a.symbol);
    const uniqueSymbols = new Set(symbols);
    
    if (symbols.length === uniqueSymbols.size) {
      return 'parallel';
    }
    
    return 'optimized';
  }

  /**
   * Create empty execution record
   */
  private createEmptyExecution(
    planId: string,
    trigger: RebalanceTrigger,
    preview: RebalancePreview
  ): RebalanceExecution {
    return {
      id: uuidv4(),
      planId,
      status: RebalanceExecutionStatus.COMPLETED,
      trigger,
      preview,
      orders: [],
      totalEstimatedCost: 0,
      totalActualCost: 0,
      totalFees: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      metrics: this.createEmptyMetrics(),
    };
  }

  /**
   * Create empty metrics
   */
  private createEmptyMetrics(): ExecutionMetrics {
    return {
      totalOrders: 0,
      successfulOrders: 0,
      failedOrders: 0,
      totalVolume: 0,
      averageExecutionPrice: 0,
      executionTimeMs: 0,
      slippageBps: 0,
    };
  }

  /**
   * Calculate execution metrics
   */
  private calculateMetrics(orders: RebalanceOrder[]): ExecutionMetrics {
    const successfulOrders = orders.filter(
      o => o.status === RebalanceOrderStatus.FILLED
    );
    const failedOrders = orders.filter(
      o => o.status === RebalanceOrderStatus.FAILED
    );
    
    const totalVolume = successfulOrders.reduce(
      (sum, o) => sum + o.filledQuantity * o.filledPrice,
      0
    );
    
    const avgPrice = successfulOrders.length > 0
      ? totalVolume / successfulOrders.reduce((sum, o) => sum + o.filledQuantity, 0)
      : 0;
    
    const executionTime = orders.reduce((max, o) => {
      if (o.completedAt && o.executedAt) {
        const time = o.completedAt.getTime() - o.executedAt.getTime();
        return Math.max(max, time);
      }
      return max;
    }, 0);
    
    return {
      totalOrders: orders.length,
      successfulOrders: successfulOrders.length,
      failedOrders: failedOrders.length,
      totalVolume,
      averageExecutionPrice: avgPrice,
      executionTimeMs: executionTime,
      slippageBps: 0, // Would need expected vs actual prices
    };
  }

  /**
   * Get active execution
   */
  getActiveExecution(executionId: string): RebalanceExecution | undefined {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Cancel active execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }
    
    // Cancel pending orders
    if (this.orderExecutor) {
      for (const order of execution.orders) {
        if (order.status === RebalanceOrderStatus.PENDING || 
            order.status === RebalanceOrderStatus.SUBMITTED) {
          try {
            await this.orderExecutor.cancelOrder(order.id);
            order.status = RebalanceOrderStatus.CANCELLED;
          } catch (error: any) {
            log.error('Failed to cancel order', {
              orderId: order.id,
              error: error.message,
            });
          }
        }
      }
    }
    
    execution.status = RebalanceExecutionStatus.CANCELLED;
    execution.completedAt = new Date();
    
    return true;
  }
}

export default RebalanceEngine;
