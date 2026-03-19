/**
 * Strategy Portfolio Management Types
 * 
 * Type definitions for managing multiple strategies as a combined portfolio
 * with capital allocation, rebalancing, and performance tracking.
 */

/**
 * Allocation method for distributing capital across strategies
 */
export type AllocationMethod = 'equal' | 'custom' | 'risk_parity';

/**
 * Portfolio status
 */
export type PortfolioStatus = 'active' | 'paused' | 'stopped';

/**
 * Strategy status within a portfolio
 */
export type PortfolioStrategyStatus = 'running' | 'paused' | 'stopped';

/**
 * Rebalance trigger reason
 */
export type RebalanceReason = 'threshold' | 'scheduled' | 'manual' | 'strategy_change';

/**
 * Rebalance execution status
 */
export type RebalanceExecutionStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';

/**
 * Snapshot type for performance tracking
 */
export type SnapshotType = 'minute' | 'hourly' | 'daily' | 'weekly';

/**
 * Rebalance frequency
 */
export type RebalanceFrequency = 'daily' | 'weekly' | 'monthly' | 'threshold';

/**
 * Rebalance configuration
 */
export interface RebalanceConfig {
  enabled: boolean;
  frequency: RebalanceFrequency;
  threshold?: number;  // Deviation threshold percentage (e.g., 5 for 5%)
  lastRebalanced?: Date;
}

/**
 * Strategy allocation within a portfolio
 */
export interface PortfolioStrategy {
  id: string;
  portfolioId: string;
  strategyId: string;
  
  // Allocation
  weight: number;              // 0-1, normalized
  allocation: number;          // Initial allocated amount
  currentAllocation: number;   // Current actual allocation
  
  // Status
  status: PortfolioStrategyStatus;
  enabled: boolean;
  
  // Performance
  currentValue?: number;
  returnAmount?: number;
  returnPct?: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Strategy with additional info for UI display
 */
export interface PortfolioStrategyWithDetails extends PortfolioStrategy {
  strategyName?: string;
  strategySymbol?: string;
  strategyStatus?: string;
}

/**
 * Strategy Portfolio
 */
export interface StrategyPortfolio {
  id: string;
  userId: string;
  name: string;
  description?: string;
  
  // Capital
  totalCapital: number;
  allocationMethod: AllocationMethod;
  
  // Rebalancing
  rebalanceConfig: RebalanceConfig;
  
  // Status
  status: PortfolioStatus;
  
  // Performance (cached)
  totalValue?: number;
  totalReturn?: number;
  totalReturnPct?: number;
  
  // Related data (populated on fetch)
  strategies?: PortfolioStrategyWithDetails[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create portfolio input
 */
export interface CreatePortfolioInput {
  name: string;
  description?: string;
  totalCapital: number;
  allocationMethod: AllocationMethod;
  rebalanceConfig?: Partial<RebalanceConfig>;
  strategies: Array<{
    strategyId: string;
    weight?: number;  // Optional, will be calculated based on allocationMethod
  }>;
}

/**
 * Update portfolio input
 */
export interface UpdatePortfolioInput {
  name?: string;
  description?: string;
  totalCapital?: number;
  allocationMethod?: AllocationMethod;
  rebalanceConfig?: Partial<RebalanceConfig>;
  status?: PortfolioStatus;
}

/**
 * Allocation result
 */
export interface Allocation {
  strategyId: string;
  weight: number;
  allocation: number;
}

/**
 * Portfolio rebalance record
 */
export interface PortfolioRebalance {
  id: string;
  portfolioId: string;
  reason: RebalanceReason;
  allocationsBefore: Allocation[];
  allocationsAfter: Allocation[];
  trades: RebalanceTrade[];
  status: RebalanceExecutionStatus;
  errorMessage?: string;
  executedAt: Date;
  completedAt?: Date;
}

/**
 * Trade executed during rebalancing
 */
export interface RebalanceTrade {
  strategyId: string;
  action: 'increase' | 'decrease';
  amount: number;
  previousAllocation: number;
  newAllocation: number;
}

/**
 * Strategy performance data
 */
export interface StrategyPerformance {
  strategyId: string;
  name: string;
  allocation: number;
  currentValue: number;
  return: number;
  returnPct: number;
  contribution: number;  // Contribution to portfolio return
}

/**
 * Portfolio performance snapshot
 */
export interface PortfolioPerformanceSnapshot {
  id: string;
  portfolioId: string;
  snapshotAt: Date;
  snapshotType: SnapshotType;
  
  // Portfolio metrics
  totalValue: number;
  totalReturn: number;
  totalReturnPct: number;
  
  // Individual strategies
  strategyPerformances: StrategyPerformance[];
  
  // Risk metrics
  diversificationRatio?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
}

/**
 * Portfolio performance result
 */
export interface PortfolioPerformance {
  totalValue: number;
  totalReturn: number;
  totalReturnPct: number;
  strategies: StrategyPerformance[];
  correlation?: number[][];  // Correlation matrix between strategies
  diversificationRatio?: number;
}

/**
 * Portfolio risk analysis
 */
export interface PortfolioRisk {
  totalRisk: number;  // Portfolio volatility
  strategyRisks: Map<string, number>;  // Risk contribution per strategy
  concentrationRisk: number;  // Risk from concentration
  correlationRisk: number;  // Risk from correlated strategies
  
  // Risk limits
  maxSingleStrategyWeight: number;
  maxCorrelation: number;
}

/**
 * Rebalance preview
 */
export interface RebalancePreview {
  needsRebalance: boolean;
  reason: string;
  currentAllocations: Allocation[];
  targetAllocations: Allocation[];
  adjustments: Array<{
    strategyId: string;
    action: 'increase' | 'decrease' | 'none';
    currentAllocation: number;
    targetAllocation: number;
    amount: number;
  }>;
  estimatedImpact: {
    totalTrades: number;
    totalVolume: number;
    estimatedFees: number;
  };
}

/**
 * Default rebalance configuration
 */
export const DEFAULT_REBALANCE_CONFIG: RebalanceConfig = {
  enabled: true,
  frequency: 'threshold',
  threshold: 5,  // 5% deviation triggers rebalance
};

/**
 * Portfolio query filters
 */
export interface PortfolioFilters {
  status?: PortfolioStatus;
  allocationMethod?: AllocationMethod;
  limit?: number;
  offset?: number;
}

/**
 * Performance history query
 */
export interface PerformanceHistoryQuery {
  portfolioId: string;
  startDate?: Date;
  endDate?: Date;
  snapshotType?: SnapshotType;
  limit?: number;
}