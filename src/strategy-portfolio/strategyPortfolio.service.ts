/**
 * Strategy Portfolio Service
 * 
 * Business logic for strategy portfolio management including:
 * - Capital allocation across strategies
 * - Portfolio rebalancing
 * - Performance calculation
 * - Risk analysis
 */

import { StrategyPortfolioDAO, strategyPortfolioDAO } from './strategyPortfolio.dao';
import {
  StrategyPortfolio,
  PortfolioStrategy,
  CreatePortfolioInput,
  UpdatePortfolioInput,
  Allocation,
  AllocationMethod,
  RebalancePreview,
  RebalanceReason,
  PortfolioPerformance,
  StrategyPerformance,
  PortfolioPerformanceSnapshot,
  SnapshotType,
  RebalanceConfig,
} from './types';

/**
 * Strategy Portfolio Service class
 */
export class StrategyPortfolioService {
  constructor(private dao: StrategyPortfolioDAO = strategyPortfolioDAO) {}

  // ==================== Portfolio Management ====================

  /**
   * Create a new portfolio
   */
  async createPortfolio(userId: string, input: CreatePortfolioInput): Promise<StrategyPortfolio> {
    // Validate input
    if (!input.strategies || input.strategies.length === 0) {
      throw new Error('At least one strategy is required');
    }

    if (input.totalCapital <= 0) {
      throw new Error('Total capital must be positive');
    }

    // Validate custom weights if provided
    if (input.allocationMethod === 'custom') {
      const hasWeights = input.strategies.some(s => s.weight !== undefined);
      if (!hasWeights) {
        throw new Error('Custom allocation requires weight for each strategy');
      }

      const totalWeight = input.strategies.reduce(
        (sum, s) => sum + (s.weight || 0),
        0
      );
      if (totalWeight === 0) {
        throw new Error('Total weight must be greater than 0');
      }
    }

    return this.dao.createPortfolio(userId, input);
  }

  /**
   * Get portfolio by ID
   */
  async getPortfolio(portfolioId: string): Promise<StrategyPortfolio | null> {
    return this.dao.getPortfolioById(portfolioId);
  }

  /**
   * Get portfolios for user
   */
  async getUserPortfolios(
    userId: string,
    filters?: { status?: string; limit?: number }
  ): Promise<StrategyPortfolio[]> {
    return this.dao.getPortfolios(userId, filters as any);
  }

  /**
   * Update portfolio
   */
  async updatePortfolio(
    portfolioId: string,
    input: UpdatePortfolioInput
  ): Promise<StrategyPortfolio> {
    return this.dao.updatePortfolio(portfolioId, input);
  }

  /**
   * Delete portfolio
   */
  async deletePortfolio(portfolioId: string): Promise<void> {
    return this.dao.deletePortfolio(portfolioId);
  }

  // ==================== Strategy Management ====================

  /**
   * Add strategy to portfolio
   */
  async addStrategy(
    portfolioId: string,
    strategyId: string,
    weight?: number
  ): Promise<PortfolioStrategy> {
    const portfolio = await this.dao.getPortfolioById(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // Get current strategies
    const strategies = portfolio.strategies || [];
    const newStrategies = [...strategies.map(s => ({ strategyId: s.strategyId, weight: s.weight }))];
    newStrategies.push({ strategyId, weight: weight || 1 });

    // Recalculate allocations
    const allocations = this.calculateAllocations(
      newStrategies.map(s => s.strategyId),
      portfolio.totalCapital,
      portfolio.allocationMethod,
      newStrategies.reduce((map, s) => {
        map.set(s.strategyId, s.weight);
        return map;
      }, new Map())
    );

    // Update all strategy allocations
    await this.dao.updateStrategyAllocations(portfolioId, allocations);

    // Return the new strategy
    const updatedStrategies = await this.dao.getPortfolioStrategies(portfolioId);
    return updatedStrategies.find(s => s.strategyId === strategyId)!;
  }

  /**
   * Remove strategy from portfolio
   */
  async removeStrategy(portfolioId: string, strategyId: string): Promise<void> {
    const portfolio = await this.dao.getPortfolioById(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const strategies = portfolio.strategies || [];
    if (strategies.length <= 1) {
      throw new Error('Cannot remove the last strategy from portfolio');
    }

    // Remove strategy
    await this.dao.removeStrategyFromPortfolio(portfolioId, strategyId);

    // Recalculate allocations for remaining strategies
    const remainingStrategies = strategies.filter(s => s.strategyId !== strategyId);
    const allocations = this.calculateAllocations(
      remainingStrategies.map(s => s.strategyId),
      portfolio.totalCapital,
      portfolio.allocationMethod,
      remainingStrategies.reduce((map, s) => {
        map.set(s.strategyId, s.weight);
        return map;
      }, new Map())
    );

    await this.dao.updateStrategyAllocations(portfolioId, allocations);
  }

  /**
   * Update strategy weight
   */
  async updateStrategyWeight(
    portfolioId: string,
    strategyId: string,
    newWeight: number
  ): Promise<void> {
    if (newWeight <= 0 || newWeight > 1) {
      throw new Error('Weight must be between 0 and 1');
    }

    const portfolio = await this.dao.getPortfolioById(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const strategies = portfolio.strategies || [];
    const updatedStrategies = strategies.map(s => ({
      strategyId: s.strategyId,
      weight: s.strategyId === strategyId ? newWeight : s.weight,
    }));

    // Normalize weights
    const totalWeight = updatedStrategies.reduce((sum, s) => sum + s.weight, 0);
    const normalizedStrategies = updatedStrategies.map(s => ({
      ...s,
      weight: s.weight / totalWeight,
    }));

    // Calculate new allocations
    const allocations = this.calculateAllocations(
      normalizedStrategies.map(s => s.strategyId),
      portfolio.totalCapital,
      'custom',
      normalizedStrategies.reduce((map, s) => {
        map.set(s.strategyId, s.weight);
        return map;
      }, new Map())
    );

    await this.dao.updateStrategyAllocations(portfolioId, allocations);
  }

  // ==================== Portfolio Operations ====================

  /**
   * Start portfolio (activate all strategies)
   */
  async startPortfolio(portfolioId: string): Promise<StrategyPortfolio> {
    const portfolio = await this.dao.getPortfolioById(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // Update portfolio status
    await this.dao.updatePortfolio(portfolioId, { status: 'active' });

    // Update all strategies to running
    const strategies = portfolio.strategies || [];
    for (const strategy of strategies) {
      await this.dao.updatePortfolioStrategy(portfolioId, strategy.strategyId, {
        status: 'running',
      });
    }

    return this.dao.getPortfolioById(portfolioId) as Promise<StrategyPortfolio>;
  }

  /**
   * Stop portfolio (pause all strategies)
   */
  async stopPortfolio(portfolioId: string): Promise<StrategyPortfolio> {
    const portfolio = await this.dao.getPortfolioById(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // Update portfolio status
    await this.dao.updatePortfolio(portfolioId, { status: 'stopped' });

    // Update all strategies to stopped
    const strategies = portfolio.strategies || [];
    for (const strategy of strategies) {
      await this.dao.updatePortfolioStrategy(portfolioId, strategy.strategyId, {
        status: 'stopped',
      });
    }

    return this.dao.getPortfolioById(portfolioId) as Promise<StrategyPortfolio>;
  }

  /**
   * Pause portfolio
   */
  async pausePortfolio(portfolioId: string): Promise<StrategyPortfolio> {
    return this.dao.updatePortfolio(portfolioId, { status: 'paused' });
  }

  // ==================== Rebalancing ====================

  /**
   * Check if portfolio needs rebalancing
   */
  async checkRebalanceNeeded(portfolioId: string): Promise<RebalancePreview> {
    const portfolio = await this.dao.getPortfolioById(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const strategies = portfolio.strategies || [];
    if (strategies.length === 0) {
      return {
        needsRebalance: false,
        reason: 'No strategies in portfolio',
        currentAllocations: [],
        targetAllocations: [],
        adjustments: [],
        estimatedImpact: { totalTrades: 0, totalVolume: 0, estimatedFees: 0 },
      };
    }

    const config = portfolio.rebalanceConfig;
    const threshold = config.threshold || 5; // Default 5%

    // Calculate current allocations based on current values
    const totalValue = strategies.reduce(
      (sum, s) => sum + (s.currentAllocation || s.allocation),
      0
    );

    const currentAllocations: Allocation[] = strategies.map(s => ({
      strategyId: s.strategyId,
      weight: totalValue > 0 ? (s.currentAllocation || s.allocation) / totalValue : s.weight,
      allocation: s.currentAllocation || s.allocation,
    }));

    // Target allocations (based on configured weights)
    const targetAllocations: Allocation[] = strategies.map(s => ({
      strategyId: s.strategyId,
      weight: s.weight,
      allocation: portfolio.totalCapital * s.weight,
    }));

    // Check for deviations
    const adjustments: RebalancePreview['adjustments'] = [];
    let needsRebalance = false;

    for (let i = 0; i < strategies.length; i++) {
      const current = currentAllocations[i];
      const target = targetAllocations[i];
      const deviation = Math.abs(current.weight - target.weight) * 100;

      if (deviation > threshold) {
        needsRebalance = true;
      }

      const currentAllocation = current.allocation;
      const targetAllocation = target.allocation;
      const amount = targetAllocation - currentAllocation;

      adjustments.push({
        strategyId: current.strategyId,
        action: amount > 0.01 ? 'increase' : amount < -0.01 ? 'decrease' : 'none',
        currentAllocation,
        targetAllocation,
        amount: Math.abs(amount),
      });
    }

    // Calculate estimated impact
    const totalTrades = adjustments.filter(a => a.action !== 'none').length;
    const totalVolume = adjustments.reduce((sum, a) => sum + a.amount, 0);
    const estimatedFees = totalVolume * 0.001; // 0.1% fee

    return {
      needsRebalance,
      reason: needsRebalance
        ? `Weight deviation exceeds ${threshold}% threshold`
        : 'Portfolio is balanced',
      currentAllocations,
      targetAllocations,
      adjustments,
      estimatedImpact: {
        totalTrades,
        totalVolume,
        estimatedFees,
      },
    };
  }

  /**
   * Execute portfolio rebalance
   */
  async rebalancePortfolio(
    portfolioId: string,
    reason: RebalanceReason = 'manual'
  ): Promise<{ success: boolean; message: string }> {
    const preview = await this.checkRebalanceNeeded(portfolioId);

    if (!preview.needsRebalance && reason !== 'manual') {
      return { success: false, message: 'Portfolio does not need rebalancing' };
    }

    const portfolio = await this.dao.getPortfolioById(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // Create rebalance record
    await this.dao.createRebalance(
      portfolioId,
      reason,
      preview.currentAllocations,
      preview.targetAllocations
    );

    // Update strategy allocations
    for (const adjustment of preview.adjustments) {
      if (adjustment.action !== 'none') {
        const targetAlloc = preview.targetAllocations.find(
          a => a.strategyId === adjustment.strategyId
        );
        if (targetAlloc) {
          await this.dao.updatePortfolioStrategy(portfolioId, adjustment.strategyId, {
            allocation: targetAlloc.allocation,
            currentAllocation: targetAlloc.allocation,
          });
        }
      }
    }

    // Update last rebalanced timestamp
    await this.dao.updateLastRebalanced(portfolioId);

    return { success: true, message: 'Portfolio rebalanced successfully' };
  }

  /**
   * Get rebalance history
   */
  async getRebalanceHistory(portfolioId: string, limit = 50) {
    return this.dao.getRebalances(portfolioId, limit);
  }

  // ==================== Performance ====================

  /**
   * Calculate portfolio performance
   */
  async calculatePerformance(portfolioId: string): Promise<PortfolioPerformance> {
    const portfolio = await this.dao.getPortfolioById(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const strategies = portfolio.strategies || [];
    const totalCapital = portfolio.totalCapital;

    // Calculate each strategy's performance
    const strategyPerformances: StrategyPerformance[] = strategies.map(s => {
      const currentValue = s.currentValue || s.allocation;
      const returnAmount = currentValue - s.allocation;
      const returnPct = s.allocation > 0 ? (returnAmount / s.allocation) * 100 : 0;
      const contribution = returnAmount * s.weight;

      return {
        strategyId: s.strategyId,
        name: s.strategyName || 'Unknown',
        allocation: s.allocation,
        currentValue,
        return: returnAmount,
        returnPct,
        contribution,
      };
    });

    // Calculate portfolio totals
    const totalValue = strategyPerformances.reduce((sum, s) => sum + s.currentValue, 0);
    const totalReturn = totalValue - totalCapital;
    const totalReturnPct = totalCapital > 0 ? (totalReturn / totalCapital) * 100 : 0;

    // Update cached performance
    await this.dao.updatePortfolioPerformance(portfolioId, {
      totalValue,
      totalReturn,
      totalReturnPct,
    });

    return {
      totalValue,
      totalReturn,
      totalReturnPct,
      strategies: strategyPerformances,
    };
  }

  /**
   * Get performance history
   */
  async getPerformanceHistory(
    portfolioId: string,
    startDate?: Date,
    endDate?: Date,
    snapshotType?: SnapshotType,
    limit = 100
  ): Promise<PortfolioPerformanceSnapshot[]> {
    return this.dao.getPerformanceHistory({
      portfolioId,
      startDate,
      endDate,
      snapshotType,
      limit,
    });
  }

  /**
   * Create performance snapshot
   */
  async createSnapshot(
    portfolioId: string,
    snapshotType: SnapshotType = 'hourly'
  ): Promise<PortfolioPerformanceSnapshot> {
    const performance = await this.calculatePerformance(portfolioId);

    return this.dao.createPerformanceSnapshot(
      portfolioId,
      snapshotType,
      {
        totalValue: performance.totalValue,
        totalReturn: performance.totalReturn,
        totalReturnPct: performance.totalReturnPct,
        strategyPerformances: performance.strategies,
      }
    );
  }

  // ==================== Risk Analysis ====================

  /**
   * Calculate portfolio risk metrics
   */
  async calculateRisk(portfolioId: string): Promise<{
    concentrationRisk: number;
    maxStrategyWeight: number;
    diversificationScore: number;
  }> {
    const portfolio = await this.dao.getPortfolioById(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const strategies = portfolio.strategies || [];
    if (strategies.length === 0) {
      return {
        concentrationRisk: 0,
        maxStrategyWeight: 0,
        diversificationScore: 0,
      };
    }

    // Concentration risk (Herfindahl-Hirschman Index)
    const hhi = strategies.reduce((sum, s) => sum + s.weight * s.weight, 0);
    const maxHHI = 1; // All in one strategy
    const concentrationRisk = (hhi / maxHHI) * 100;

    // Max strategy weight
    const maxStrategyWeight = Math.max(...strategies.map(s => s.weight)) * 100;

    // Diversification score (inverse of concentration)
    const diversificationScore = 100 - concentrationRisk;

    return {
      concentrationRisk,
      maxStrategyWeight,
      diversificationScore,
    };
  }

  // ==================== Allocation Helpers ====================

  /**
   * Calculate allocations based on method
   */
  private calculateAllocations(
    strategyIds: string[],
    totalCapital: number,
    method: AllocationMethod,
    weights?: Map<string, number>
  ): Allocation[] {
    switch (method) {
      case 'equal':
        return this.equalWeightAllocation(strategyIds, totalCapital);

      case 'custom':
        if (!weights || weights.size === 0) {
          return this.equalWeightAllocation(strategyIds, totalCapital);
        }
        return this.customAllocation(strategyIds, totalCapital, weights);

      case 'risk_parity':
        // Simplified - real implementation would need volatility data
        return this.equalWeightAllocation(strategyIds, totalCapital);

      default:
        return this.equalWeightAllocation(strategyIds, totalCapital);
    }
  }

  /**
   * Equal weight allocation
   */
  private equalWeightAllocation(
    strategyIds: string[],
    totalCapital: number
  ): Allocation[] {
    const weight = 1 / strategyIds.length;
    return strategyIds.map(id => ({
      strategyId: id,
      weight,
      allocation: totalCapital * weight,
    }));
  }

  /**
   * Custom weight allocation
   */
  private customAllocation(
    strategyIds: string[],
    totalCapital: number,
    weights: Map<string, number>
  ): Allocation[] {
    const totalWeight = strategyIds.reduce(
      (sum, id) => sum + (weights.get(id) || 0),
      0
    );

    if (totalWeight === 0) {
      return this.equalWeightAllocation(strategyIds, totalCapital);
    }

    return strategyIds.map(id => {
      const rawWeight = weights.get(id) || 0;
      const normalizedWeight = rawWeight / totalWeight;
      return {
        strategyId: id,
        weight: normalizedWeight,
        allocation: totalCapital * normalizedWeight,
      };
    });
  }
}

// Singleton instance
export const strategyPortfolioService = new StrategyPortfolioService();