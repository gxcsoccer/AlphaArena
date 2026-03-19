/**
 * Portfolio Rebalancing Types
 * 
 * Type definitions for the portfolio rebalancing automation feature.
 * Supports scheduled, threshold-triggered, and manual rebalancing strategies.
 */

/**
 * Target allocation for a single asset
 */
export interface AssetAllocation {
  symbol: string;
  targetWeight: number; // 0-100 percentage
  tolerance?: number; // Allowed deviation from target (default: 5%)
}

/**
 * Target allocation configuration
 */
export interface TargetAllocation {
  id: string;
  name: string;
  description?: string;
  allocations: AssetAllocation[];
  totalWeight: number; // Should be 100 for proper allocation
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rebalance trigger type
 */
export enum RebalanceTrigger {
  SCHEDULED = 'scheduled',
  THRESHOLD = 'threshold',
  MANUAL = 'manual',
}

/**
 * Schedule frequency for scheduled rebalancing
 */
export enum ScheduleFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

/**
 * Schedule configuration
 */
export interface ScheduleConfig {
  frequency: ScheduleFrequency;
  time: string; // HH:mm format
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
  dayOfMonth?: number; // 1-31 for monthly
}

/**
 * Rebalance plan configuration
 */
export interface RebalancePlan {
  id: string;
  name: string;
  description?: string;
  targetAllocationId: string;
  targetAllocation: TargetAllocation;
  trigger: RebalanceTrigger;
  threshold?: number; // Deviation threshold percentage for THRESHOLD trigger
  schedule?: ScheduleConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Current position state
 */
export interface PositionState {
  symbol: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  currentWeight: number; // Percentage of total portfolio
  targetWeight: number;
  deviation: number; // Absolute difference from target
  deviationPercent: number; // Percentage deviation
}

/**
 * Rebalance adjustment for a single asset
 */
export interface RebalanceAdjustment {
  symbol: string;
  action: 'buy' | 'sell' | 'none';
  quantity: number;
  currentQuantity: number;
  targetQuantity: number;
  estimatedPrice: number;
  estimatedValue: number;
  estimatedFee: number;
  priority: number; // Higher priority = execute first
}

/**
 * Rebalance preview result
 */
export interface RebalancePreview {
  planId: string;
  portfolioValue: number;
  positions: PositionState[];
  adjustments: RebalanceAdjustment[];
  totalEstimatedCost: number;
  totalEstimatedFees: number;
  estimatedSlippage: number;
  executionStrategy: 'parallel' | 'sequential' | 'optimized';
  warnings: string[];
  timestamp: Date;
}

/**
 * Order type for execution
 */
export enum RebalanceOrderType {
  MARKET = 'market',
  LIMIT = 'limit',
}

/**
 * Rebalance order
 */
export interface RebalanceOrder {
  id: string;
  planId: string;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: RebalanceOrderType;
  quantity: number;
  limitPrice?: number;
  status: RebalanceOrderStatus;
  filledQuantity: number;
  filledPrice: number;
  fee: number;
  createdAt: Date;
  executedAt?: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Rebalance order status
 */
export enum RebalanceOrderStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  PARTIALLY_FILLED = 'partially_filled',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

/**
 * Rebalance execution status
 */
export enum RebalanceExecutionStatus {
  PENDING = 'pending',
  PREVIEWING = 'previewing',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  PARTIALLY_COMPLETED = 'partially_completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Rebalance execution record
 */
export interface RebalanceExecution {
  id: string;
  planId: string;
  status: RebalanceExecutionStatus;
  trigger: RebalanceTrigger;
  preview: RebalancePreview;
  orders: RebalanceOrder[];
  totalEstimatedCost: number;
  totalActualCost: number;
  totalFees: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  metrics: ExecutionMetrics;
}

/**
 * Execution metrics
 */
export interface ExecutionMetrics {
  totalOrders: number;
  successfulOrders: number;
  failedOrders: number;
  totalVolume: number;
  averageExecutionPrice: number;
  executionTimeMs: number;
  slippageBps: number; // Basis points
}

/**
 * Rebalance history entry
 */
export interface RebalanceHistoryEntry {
  id: string;
  planId: string;
  planName: string;
  execution: RebalanceExecution;
  createdAt: Date;
}

/**
 * Fee structure for cost estimation
 */
export interface FeeStructure {
  makerFee: number; // Percentage
  takerFee: number; // Percentage
  minimumFee: number; // Minimum fee per order
}

/**
 * Rebalancing constraints
 */
export interface RebalanceConstraints {
  maxOrderValue?: number; // Maximum value per single order
  minOrderValue?: number; // Minimum value per order
  allowPartialRebalance?: boolean; // Allow adjusting only assets exceeding threshold
  prioritizeLowCost?: boolean; // Prioritize lower trading costs
  executionWindow?: number; // Time window for execution in minutes
  cooldownPeriod?: number; // Cooldown period in hours between rebalances
  maxAssetWeight?: number; // Maximum weight for single asset (0-100)
}

/**
 * Tax optimization settings
 */
export interface TaxOptimizationConfig {
  enabled: boolean;
  shortTermThresholdDays: number; // Days threshold for short-term vs long-term
  preferLongTerm: boolean; // Prefer selling long-term holdings
  taxLotMethod: 'fifo' | 'lifo' | 'hifo' | 'specific'; // Tax lot identification method
}

/**
 * Cost optimization settings
 */
export interface CostOptimizationConfig {
  enabled: boolean;
  minTradeValue: number; // Minimum trade value to execute
  batchSmallTrades: boolean; // Batch small trades together
  maxDailyTrades: number; // Maximum trades per day
  spreadThreshold: number; // Maximum acceptable spread percentage
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number; // Maximum number of retry attempts
  retryDelayMs: number; // Initial delay between retries
  retryBackoffMultiplier: number; // Exponential backoff multiplier
  maxRetryDelayMs: number; // Maximum retry delay
}

/**
 * Execution options for rebalancing
 */
export interface RebalanceExecutionOptions {
  dryRun: boolean; // Preview only, don't execute
  skipConfirmations: boolean; // Skip user confirmations
  timeoutMs: number; // Execution timeout
  onProgress?: (progress: RebalanceProgress) => void; // Progress callback
}

/**
 * Rebalance progress information
 */
export interface RebalanceProgress {
  planId: string;
  executionId: string;
  phase: 'calculating' | 'previewing' | 'executing' | 'completed' | 'failed';
  totalOrders: number;
  completedOrders: number;
  currentSymbol?: string;
  percentComplete: number;
  message: string;
}

/**
 * Rebalance configuration options
 */
export interface RebalanceConfig {
  fees: FeeStructure;
  constraints: RebalanceConstraints;
  slippageTolerance: number; // Percentage
  defaultTolerance: number; // Default deviation tolerance
  taxOptimization?: TaxOptimizationConfig;
  costOptimization?: CostOptimizationConfig;
  retry?: RetryConfig;
}

/**
 * Default rebalance configuration
 */
export const DEFAULT_REBALANCE_CONFIG: RebalanceConfig = {
  fees: {
    makerFee: 0.1, // 0.1%
    takerFee: 0.1, // 0.1%
    minimumFee: 0,
  },
  constraints: {
    maxOrderValue: undefined,
    minOrderValue: 10, // $10 minimum
    allowPartialRebalance: true,
    prioritizeLowCost: true,
    executionWindow: 60, // 60 minutes
    cooldownPeriod: 24, // 24 hours
    maxAssetWeight: 50, // 50% max single asset
  },
  slippageTolerance: 0.5, // 0.5%
  defaultTolerance: 5, // 5%
  taxOptimization: {
    enabled: false,
    shortTermThresholdDays: 365,
    preferLongTerm: true,
    taxLotMethod: 'fifo',
  },
  costOptimization: {
    enabled: true,
    minTradeValue: 10,
    batchSmallTrades: true,
    maxDailyTrades: 20,
    spreadThreshold: 0.5, // 0.5%
  },
  retry: {
    maxRetries: 3,
    retryDelayMs: 1000,
    retryBackoffMultiplier: 2,
    maxRetryDelayMs: 30000,
  },
};

/**
 * Rebalance engine result
 */
export interface RebalanceResult {
  success: boolean;
  preview?: RebalancePreview;
  execution?: RebalanceExecution;
  error?: string;
}
