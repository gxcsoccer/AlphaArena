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

// ==================== Signal Aggregation Types ====================

/**
 * Signal aggregation method
 */
export type SignalAggregationMethod = 'voting' | 'weighted_average' | 'consensus' | 'best_performer';

/**
 * Trading signal from a strategy
 */
export interface StrategySignal {
  strategyId: string;
  symbol: string;
  side: 'buy' | 'sell' | 'hold';
  confidence: number;  // 0-1
  quantity?: number;
  price?: number;
  reason?: string;
  timestamp: Date;
}

/**
 * Aggregated portfolio signal
 */
export interface AggregatedSignal {
  symbol: string;
  side: 'buy' | 'sell' | 'hold';
  confidence: number;
  quantity: number;
  price?: number;
  aggregationMethod: SignalAggregationMethod;
  contributingStrategies: Array<{
    strategyId: string;
    signal: StrategySignal;
    weight: number;
  }>;
  timestamp: Date;
}

/**
 * Signal aggregation configuration
 */
export interface SignalAggregationConfig {
  method: SignalAggregationMethod;
  minConfidence: number;  // Minimum confidence to include signal
  consensusThreshold: number;  // For consensus method (0.5 = 50% agreement)
  requireMajority: boolean;  // For voting method
}

// ==================== Risk Control Types ====================

/**
 * Position limit configuration
 */
export interface PositionLimits {
  maxTotalPosition: number;  // Maximum total position value
  maxSingleAssetPosition: number;  // Maximum position for single asset
  maxSingleStrategyPosition: number;  // Maximum position for single strategy
  maxLeverage: number;  // Maximum leverage ratio
}

/**
 * Strategy conflict type
 */
export type ConflictType = 'same_direction' | 'opposite_direction' | 'resource_contention';

/**
 * Strategy conflict detection result
 */
export interface StrategyConflict {
  id: string;
  type: ConflictType;
  strategyIds: string[];
  symbol: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestedResolution?: string;
  detectedAt: Date;
}

/**
 * Conflict resolution strategy
 */
export type ConflictResolution = 'first_come' | 'highest_confidence' | 'weighted_vote' | 'manual';

/**
 * Risk control configuration
 */
export interface RiskControlConfig {
  positionLimits: PositionLimits;
  conflictResolution: ConflictResolution;
  enableConflictDetection: boolean;
  autoResolveConflicts: boolean;
}

// ==================== Correlation Analysis Types ====================

/**
 * Strategy correlation data
 */
export interface StrategyCorrelation {
  strategyId1: string;
  strategyId2: string;
  correlation: number;  // -1 to 1
  period: string;  // e.g., '30d', '90d'
  calculatedAt: Date;
}

/**
 * Correlation matrix
 */
export interface CorrelationMatrix {
  strategyIds: string[];
  matrix: number[][];  // 2D array of correlations
  period: string;
  calculatedAt: Date;
}

/**
 * Correlation analysis result
 */
export interface CorrelationAnalysis {
  matrix: CorrelationMatrix;
  highCorrelationPairs: Array<{
    strategyId1: string;
    strategyId2: string;
    correlation: number;
  }>;
  diversificationScore: number;  // 0-100, higher is better
  recommendations: string[];
}

// ==================== Optimization Types ====================

/**
 * Portfolio optimization suggestion
 */
export interface OptimizationSuggestion {
  id: string;
  type: 'rebalance' | 'add_strategy' | 'remove_strategy' | 'adjust_weight' | 'risk_reduction';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  impact: {
    expectedReturnChange?: number;
    riskReduction?: number;
    diversificationImprovement?: number;
  };
  actions: Array<{
    type: string;
    strategyId?: string;
    currentValue?: number;
    suggestedValue?: number;
  }>;
  createdAt: Date;
}

/**
 * Optimization analysis result
 */
export interface OptimizationAnalysis {
  currentScore: number;  // 0-100
  suggestions: OptimizationSuggestion[];
  riskReturnProfile: {
    expectedReturn: number;
    risk: number;
    sharpeRatio: number;
  };
  lastAnalyzed: Date;
}

// ==================== Template Types ====================

/**
 * Portfolio template
 */
export interface PortfolioTemplate {
  id: string;
  name: string;
  description: string;
  category: 'conservative' | 'balanced' | 'aggressive' | 'custom';
  riskLevel: 'low' | 'medium' | 'high';
  targetReturn: number;  // Annual target return %
  allocations: Array<{
    strategyType: string;  // e.g., 'momentum', 'mean_reversion', 'arbitrage'
    weight: number;
    description?: string;
  }>;
  rebalanceConfig: RebalanceConfig;
  riskControlConfig: RiskControlConfig;
  signalAggregationConfig: SignalAggregationConfig;
  tags: string[];
  usageCount: number;
  rating: number;  // Average rating 1-5
  createdBy: string;  // User ID or 'system'
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Template creation input
 */
export interface CreateTemplateInput {
  name: string;
  description: string;
  category: 'conservative' | 'balanced' | 'aggressive' | 'custom';
  riskLevel: 'low' | 'medium' | 'high';
  targetReturn?: number;
  allocations: Array<{
    strategyType: string;
    weight: number;
    description?: string;
  }>;
  rebalanceConfig?: Partial<RebalanceConfig>;
  riskControlConfig?: Partial<RiskControlConfig>;
  signalAggregationConfig?: Partial<SignalAggregationConfig>;
  tags?: string[];
  isPublic?: boolean;
}

// ==================== Share Types ====================

/**
 * Shared portfolio
 */
export interface SharedPortfolio {
  id: string;
  portfolioId: string;
  shareCode: string;  // Unique share code
  ownerUserId: string;
  sharedWith: Array<{
    userId: string;
    permission: 'view' | 'copy';
    sharedAt: Date;
  }>;
  isPublic: boolean;
  expiresAt?: Date;
  createdAt: Date;
  viewCount: number;
  copyCount: number;
}

/**
 * Share permission
 */
export type SharePermission = 'view' | 'copy' | 'edit';

/**
 * Share configuration
 */
export interface ShareConfig {
  isPublic: boolean;
  expiresIn?: number;  // Days until expiration
  permissions: SharePermission[];
}