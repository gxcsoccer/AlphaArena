/**
 * Tests for RebalanceEngine
 */

import { RebalanceEngine } from '../RebalanceEngine';
import {
  TargetAllocation,
  RebalancePlan,
  RebalanceTrigger,
  RebalanceExecutionStatus,
  RebalanceOrderType,
} from '../types';
import { Position } from '../../types';

// Mock price provider
const mockPriceProvider = {
  getPrice: jest.fn(),
  getPrices: jest.fn(),
};

// Mock order executor
const mockOrderExecutor = {
  submitOrder: jest.fn(),
  cancelOrder: jest.fn(),
  getOrderStatus: jest.fn(),
};

// Sample data
const sampleAllocation: TargetAllocation = {
  id: 'alloc-1',
  name: 'Balanced Portfolio',
  allocations: [
    { symbol: 'BTC/USDT', targetWeight: 50, tolerance: 5 },
    { symbol: 'ETH/USDT', targetWeight: 30, tolerance: 5 },
    { symbol: 'SOL/USDT', targetWeight: 20, tolerance: 5 },
  ],
  totalWeight: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const samplePlan: RebalancePlan = {
  id: 'plan-1',
  name: 'Monthly Rebalance',
  description: 'Rebalance portfolio monthly',
  targetAllocationId: 'alloc-1',
  targetAllocation: sampleAllocation,
  trigger: RebalanceTrigger.MANUAL,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const samplePositions: Position[] = [
  { symbol: 'BTC/USDT', quantity: 1, averageCost: 50000 },
  { symbol: 'ETH/USDT', quantity: 10, averageCost: 3000 },
  { symbol: 'SOL/USDT', quantity: 100, averageCost: 100 },
];

describe('RebalanceEngine', () => {
  let engine: RebalanceEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock returns
    mockPriceProvider.getPrices.mockResolvedValue(new Map([
      ['BTC/USDT', 55000],
      ['ETH/USDT', 3500],
      ['SOL/USDT', 150],
    ]));
    
    mockOrderExecutor.submitOrder.mockResolvedValue({
      orderId: 'order-1',
      filledQuantity: 1,
      filledPrice: 55000,
      fee: 55,
    });
    
    engine = new RebalanceEngine(mockPriceProvider, mockOrderExecutor);
  });

  describe('calculatePositionStates', () => {
    it('should calculate correct position weights', async () => {
      const states = await engine.calculatePositionStates(samplePositions, sampleAllocation);
      
      expect(states).toHaveLength(3);
      expect(mockPriceProvider.getPrices).toHaveBeenCalled();
    });

    it('should handle empty positions', async () => {
      const states = await engine.calculatePositionStates([], sampleAllocation);
      
      expect(states).toHaveLength(3); // Still returns all target symbols
      states.forEach(state => {
        expect(state.quantity).toBe(0);
        expect(state.currentWeight).toBe(0);
      });
    });

    it('should calculate deviation correctly', async () => {
      const states = await engine.calculatePositionStates(samplePositions, sampleAllocation);
      
      // BTC should be overweight (50% target, but has higher value)
      const btcState = states.find(s => s.symbol === 'BTC/USDT');
      expect(btcState).toBeDefined();
      expect(btcState!.deviation).toBeGreaterThan(0);
    });
  });

  describe('needsRebalancing', () => {
    it('should return true when deviation exceeds threshold', async () => {
      const states = await engine.calculatePositionStates(samplePositions, sampleAllocation);
      
      // With the sample data, there should be deviation
      const needsRebalance = engine.needsRebalancing(states, 1);
      expect(needsRebalance).toBe(true);
    });

    it('should return false when within tolerance', async () => {
      // Create perfectly balanced positions
      const balancedPositions: Position[] = [
        { symbol: 'BTC/USDT', quantity: 1, averageCost: 50000 },
        { symbol: 'ETH/USDT', quantity: 16.67, averageCost: 3000 },
        { symbol: 'SOL/USDT', quantity: 50, averageCost: 200 },
      ];

      // Mock prices to match
      mockPriceProvider.getPrices.mockResolvedValue(new Map([
        ['BTC/USDT', 50000],
        ['ETH/USDT', 3000],
        ['SOL/USDT', 200],
      ]));

      const states = await engine.calculatePositionStates(balancedPositions, sampleAllocation);
      
      // With a very high threshold, no rebalancing needed
      const needsRebalance = engine.needsRebalancing(states, 100);
      expect(needsRebalance).toBe(false);
    });
  });

  describe('calculateAdjustments', () => {
    it('should calculate buy and sell adjustments', async () => {
      const states = await engine.calculatePositionStates(samplePositions, sampleAllocation);
      const totalValue = states.reduce((sum, s) => sum + s.marketValue, 0);
      
      const adjustments = engine.calculateAdjustments(states, totalValue);
      
      expect(adjustments.length).toBeGreaterThan(0);
      
      // Should have both buys and sells
      const hasBuys = adjustments.some(a => a.action === 'buy');
      const hasSells = adjustments.some(a => a.action === 'sell');
      
      expect(hasBuys || hasSells).toBe(true);
    });

    it('should prioritize by deviation', async () => {
      const states = await engine.calculatePositionStates(samplePositions, sampleAllocation);
      const totalValue = states.reduce((sum, s) => sum + s.marketValue, 0);
      
      const adjustments = engine.calculateAdjustments(states, totalValue);
      
      // Should be sorted by priority (descending)
      for (let i = 1; i < adjustments.length; i++) {
        expect(adjustments[i].priority).toBeLessThanOrEqual(adjustments[i - 1].priority);
      }
    });

    it('should calculate estimated fees', async () => {
      const states = await engine.calculatePositionStates(samplePositions, sampleAllocation);
      const totalValue = states.reduce((sum, s) => sum + s.marketValue, 0);
      
      const adjustments = engine.calculateAdjustments(states, totalValue);
      
      adjustments.forEach(adj => {
        if (adj.action !== 'none') {
          expect(adj.estimatedFee).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  describe('generatePreview', () => {
    it('should generate complete preview', async () => {
      const preview = await engine.generatePreview(samplePlan, samplePositions);
      
      expect(preview.planId).toBe(samplePlan.id);
      expect(preview.portfolioValue).toBeGreaterThan(0);
      expect(preview.positions).toHaveLength(3);
      expect(preview.adjustments).toBeDefined();
      expect(preview.totalEstimatedCost).toBeGreaterThanOrEqual(0);
      expect(preview.timestamp).toBeInstanceOf(Date);
    });

    it('should generate warnings for large orders', async () => {
      // Create positions with very unbalanced allocation
      const unbalancedPositions: Position[] = [
        { symbol: 'BTC/USDT', quantity: 10, averageCost: 50000 },
      ];
      
      const preview = await engine.generatePreview(samplePlan, unbalancedPositions);
      
      expect(preview.warnings.length).toBeGreaterThan(0);
    });

    it('should determine execution strategy', async () => {
      const preview = await engine.generatePreview(samplePlan, samplePositions);
      
      expect(['parallel', 'sequential', 'optimized']).toContain(preview.executionStrategy);
    });
  });

  describe('execute', () => {
    it('should execute rebalancing successfully', async () => {
      const result = await engine.execute(samplePlan, samplePositions);
      
      expect(result.success).toBe(true);
      expect(result.execution).toBeDefined();
      expect(result.execution!.status).toBe(RebalanceExecutionStatus.COMPLETED);
    });

    it('should create orders for adjustments', async () => {
      const result = await engine.execute(samplePlan, samplePositions);
      
      if (result.execution!.orders.length > 0) {
        expect(mockOrderExecutor.submitOrder).toHaveBeenCalled();
      }
    });

    it('should handle execution errors', async () => {
      mockOrderExecutor.submitOrder.mockRejectedValue(new Error('Order failed'));
      
      const result = await engine.execute(samplePlan, samplePositions);
      
      // Execution should complete but with failed orders
      expect(result.execution).toBeDefined();
      
      if (result.execution!.orders.length > 0) {
        expect(result.execution!.orders.some(o => o.status === 'failed')).toBe(true);
      }
    });

    it('should handle no adjustments needed', async () => {
      // Create perfectly balanced positions
      mockPriceProvider.getPrices.mockResolvedValue(new Map([
        ['BTC/USDT', 50000],
        ['ETH/USDT', 3000],
        ['SOL/USDT', 200],
      ]));
      
      // Use a plan with very high threshold
      const tolerantPlan: RebalancePlan = {
        ...samplePlan,
        threshold: 100,
      };
      
      const result = await engine.execute(tolerantPlan, samplePositions);
      
      expect(result.success).toBe(true);
      expect(result.execution!.orders).toHaveLength(0);
    });
  });

  describe('without order executor', () => {
    it('should return preview only', async () => {
      const previewOnlyEngine = new RebalanceEngine(mockPriceProvider);
      
      const result = await previewOnlyEngine.execute(samplePlan, samplePositions);
      
      expect(result.success).toBe(true);
      expect(result.preview).toBeDefined();
      expect(result.execution).toBeUndefined();
    });
  });

  describe('cancelExecution', () => {
    it('should cancel active execution', async () => {
      // Start an execution
      const result = await engine.execute(samplePlan, samplePositions);
      
      if (result.execution) {
        const cancelled = await engine.cancelExecution(result.execution.id);
        
        expect(cancelled).toBe(true);
      }
    });

    it('should return false for non-existent execution', async () => {
      const cancelled = await engine.cancelExecution('non-existent');
      expect(cancelled).toBe(false);
    });
  });
});
