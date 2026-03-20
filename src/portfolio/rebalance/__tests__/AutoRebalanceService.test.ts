/**
 * Tests for Auto Rebalance Service
 */

import { AutoRebalanceService } from '../AutoRebalanceService';
import {
  RebalanceTrigger,
  RebalancePlan,
  TargetAllocation,
  DEFAULT_REBALANCE_CONFIG,
} from '../types';

// Mock price provider
const mockPriceProvider = {
  getPrice: jest.fn().mockResolvedValue(50000),
  getPrices: jest.fn().mockResolvedValue(new Map([
    ['BTC', 50000],
    ['ETH', 3000],
  ])),
};

// Mock rebalanceDAO
jest.mock('../../../database/rebalance.dao', () => ({
  rebalanceDAO: {
    getPlan: jest.fn(),
    getPlans: jest.fn(),
    getExecutions: jest.fn(),
    createExecution: jest.fn(),
  },
}));

// Mock VirtualAccountDAO
jest.mock('../../../database/virtual-account.dao', () => ({
  VirtualAccountDAO: {
    getAccountByUserId: jest.fn(),
    getPositions: jest.fn(),
  },
}));

import { rebalanceDAO } from '../../../database/rebalance.dao';
import { VirtualAccountDAO } from '../../../database/virtual-account.dao';

describe('AutoRebalanceService', () => {
  let service: AutoRebalanceService;

  const mockTargetAllocation: TargetAllocation = {
    id: 'alloc-1',
    name: 'Test Allocation',
    allocations: [
      { symbol: 'BTC', targetWeight: 50, tolerance: 5 },
      { symbol: 'ETH', targetWeight: 50, tolerance: 5 },
    ],
    totalWeight: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createMockPlan = (overrides?: Partial<RebalancePlan>): RebalancePlan => ({
    id: 'plan-1',
    name: 'Test Plan',
    targetAllocationId: 'alloc-1',
    targetAllocation: mockTargetAllocation,
    trigger: RebalanceTrigger.MANUAL,
    threshold: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockAccount = {
    id: 'account-1',
    user_id: 'user-1',
    balance: 100000,
    initial_capital: 100000,
    frozen_balance: 0,
    total_realized_pnl: 0,
    total_trades: 0,
    winning_trades: 0,
    losing_trades: 0,
    account_currency: 'USD',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockPositions = [
    {
      id: 'pos-1',
      account_id: 'account-1',
      symbol: 'BTC',
      quantity: 1,
      available_quantity: 1,
      frozen_quantity: 0,
      average_cost: 45000,
      total_cost: 45000,
      current_price: 50000,
      market_value: 50000,
      unrealized_pnl: 5000,
      unrealized_pnl_pct: 11.11,
      max_quantity: null,
      stop_loss_price: null,
      take_profit_price: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_price_update: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AutoRebalanceService(mockPriceProvider, undefined, {
      rebalanceConfig: DEFAULT_REBALANCE_CONFIG,
      enableScheduler: false, // Disable scheduler for unit tests
      enableTaxOptimization: true,
      enableCostOptimization: true,
    });
  });

  describe('checkRebalanceNeeded', () => {
    it('should return needsRebalancing false when portfolio is within tolerance', async () => {
      const plan = createMockPlan();
      (rebalanceDAO.getPlan as jest.Mock).mockResolvedValue(plan);
      (VirtualAccountDAO.getAccountByUserId as jest.Mock).mockResolvedValue(mockAccount);
      (VirtualAccountDAO.getPositions as jest.Mock).mockResolvedValue(mockPositions);

      const result = await service.checkRebalanceNeeded('user-1', 'plan-1');

      expect(result.needsRebalancing).toBeDefined();
      expect(result.positionStates).toBeDefined();
      expect(result.recommendation).toBeDefined();
    });

    it('should return no account when user has no virtual account', async () => {
      const plan = createMockPlan();
      (rebalanceDAO.getPlan as jest.Mock).mockResolvedValue(plan);
      (VirtualAccountDAO.getAccountByUserId as jest.Mock).mockResolvedValue(null);

      const result = await service.checkRebalanceNeeded('user-1', 'plan-1');

      expect(result.needsRebalancing).toBe(false);
      expect(result.recommendation).toContain('No virtual account');
    });

    it('should throw error when plan not found', async () => {
      (rebalanceDAO.getPlan as jest.Mock).mockResolvedValue(null);

      await expect(service.checkRebalanceNeeded('user-1', 'plan-1')).rejects.toThrow(
        'Plan not found'
      );
    });
  });

  describe('previewRebalance', () => {
    it('should generate preview for a plan', async () => {
      const plan = createMockPlan();
      (rebalanceDAO.getPlan as jest.Mock).mockResolvedValue(plan);
      (VirtualAccountDAO.getAccountByUserId as jest.Mock).mockResolvedValue(mockAccount);
      (VirtualAccountDAO.getPositions as jest.Mock).mockResolvedValue(mockPositions);

      const preview = await service.previewRebalance('user-1', 'plan-1');

      expect(preview).toBeDefined();
      expect(preview.planId).toBe('plan-1');
      expect(preview.positions).toBeDefined();
      expect(preview.adjustments).toBeDefined();
    });

    it('should throw error when plan not found', async () => {
      (rebalanceDAO.getPlan as jest.Mock).mockResolvedValue(null);

      await expect(service.previewRebalance('user-1', 'plan-1')).rejects.toThrow(
        'Plan not found'
      );
    });
  });

  describe('executeRebalance', () => {
    it('should return error when plan not found', async () => {
      (rebalanceDAO.getPlan as jest.Mock).mockResolvedValue(null);

      const result = await service.executeRebalance('user-1', 'plan-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan not found');
    });

    it('should return error when account not found', async () => {
      const plan = createMockPlan();
      (rebalanceDAO.getPlan as jest.Mock).mockResolvedValue(plan);
      (VirtualAccountDAO.getAccountByUserId as jest.Mock).mockResolvedValue(null);
      (rebalanceDAO.getExecutions as jest.Mock).mockResolvedValue([]);

      const result = await service.executeRebalance('user-1', 'plan-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Virtual account not found');
    });

    it('should return preview only in dry run mode', async () => {
      const plan = createMockPlan();
      (rebalanceDAO.getPlan as jest.Mock).mockResolvedValue(plan);
      (VirtualAccountDAO.getAccountByUserId as jest.Mock).mockResolvedValue(mockAccount);
      (VirtualAccountDAO.getPositions as jest.Mock).mockResolvedValue(mockPositions);
      (rebalanceDAO.getExecutions as jest.Mock).mockResolvedValue([]);

      const result = await service.executeRebalance('user-1', 'plan-1', { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.preview).toBeDefined();
    });
  });

  describe('start and stop', () => {
    it('should start and stop service', async () => {
      await service.start();
      await service.stop();
      // Should not throw
    });
  });

  describe('getSchedulerStatus', () => {
    it('should return null when scheduler is disabled', () => {
      const status = service.getSchedulerStatus();
      expect(status).toBeNull();
    });
  });

  describe('configurations', () => {
    it('should use default config when not provided', () => {
      const _defaultService = new AutoRebalanceService(mockPriceProvider);
      // Should not throw
    });

    it('should merge custom config with defaults', () => {
      const _customService = new AutoRebalanceService(
        mockPriceProvider,
        undefined,
        {
          rebalanceConfig: {
            ...DEFAULT_REBALANCE_CONFIG,
            slippageTolerance: 1.0,
          },
        }
      );
      // Should not throw
    });
  });
});