/**
 * Tests for Strategy Portfolio Management
 * 
 * Tests the core functionality of portfolio creation, management, and operations
 */

// Mock database client before importing service
jest.mock('../../database/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    })),
  })),
}));

import { StrategyPortfolioService } from '../strategyPortfolio.service';
import { StrategyPortfolioDAO } from '../strategyPortfolio.dao';
import {
  CreatePortfolioInput,
  UpdatePortfolioInput,
  AllocationMethod,
} from '../types';

// Mock the DAO
jest.mock('../strategyPortfolio.dao');

describe('StrategyPortfolioService', () => {
  let service: StrategyPortfolioService;
  let mockDao: jest.Mocked<StrategyPortfolioDAO>;

  beforeEach(() => {
    mockDao = {
      createPortfolio: jest.fn(),
      getPortfolioById: jest.fn(),
      getPortfolios: jest.fn(),
      updatePortfolio: jest.fn(),
      deletePortfolio: jest.fn(),
      getPortfolioStrategies: jest.fn(),
      addStrategyToPortfolio: jest.fn(),
      updatePortfolioStrategy: jest.fn(),
      removeStrategyFromPortfolio: jest.fn(),
      updateStrategyAllocations: jest.fn(),
      createRebalance: jest.fn(),
      getRebalances: jest.fn(),
      updateRebalanceStatus: jest.fn(),
      updateLastRebalanced: jest.fn(),
      createPerformanceSnapshot: jest.fn(),
      getPerformanceHistory: jest.fn(),
      updatePortfolioPerformance: jest.fn(),
    } as any;

    service = new StrategyPortfolioService(mockDao);
  });

  describe('createPortfolio', () => {
    it('should create a portfolio with equal weight allocation', async () => {
      const userId = 'user-123';
      const input: CreatePortfolioInput = {
        name: 'Test Portfolio',
        description: 'Test description',
        totalCapital: 10000,
        allocationMethod: 'equal',
        strategies: [
          { strategyId: 'strategy-1' },
          { strategyId: 'strategy-2' },
        ],
      };

      const mockPortfolio = {
        id: 'portfolio-1',
        userId,
        name: input.name,
        description: input.description,
        totalCapital: input.totalCapital,
        allocationMethod: input.allocationMethod,
        rebalanceConfig: { enabled: true, frequency: 'threshold', threshold: 5 },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        strategies: [
          {
            id: 'ps-1',
            portfolioId: 'portfolio-1',
            strategyId: 'strategy-1',
            weight: 0.5,
            allocation: 5000,
            currentAllocation: 5000,
            status: 'running',
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'ps-2',
            portfolioId: 'portfolio-1',
            strategyId: 'strategy-2',
            weight: 0.5,
            allocation: 5000,
            currentAllocation: 5000,
            status: 'running',
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockDao.createPortfolio.mockResolvedValue(mockPortfolio);
      mockDao.getPortfolioById.mockResolvedValue(mockPortfolio);

      const result = await service.createPortfolio(userId, input);

      expect(mockDao.createPortfolio).toHaveBeenCalledWith(userId, input);
      expect(result).toEqual(mockPortfolio);
    });

    it('should throw error when no strategies provided', async () => {
      const userId = 'user-123';
      const input: CreatePortfolioInput = {
        name: 'Test Portfolio',
        totalCapital: 10000,
        allocationMethod: 'equal',
        strategies: [],
      };

      await expect(service.createPortfolio(userId, input)).rejects.toThrow(
        'At least one strategy is required'
      );
    });

    it('should throw error when total capital is not positive', async () => {
      const userId = 'user-123';
      const input: CreatePortfolioInput = {
        name: 'Test Portfolio',
        totalCapital: 0,
        allocationMethod: 'equal',
        strategies: [{ strategyId: 'strategy-1' }],
      };

      await expect(service.createPortfolio(userId, input)).rejects.toThrow(
        'Total capital must be positive'
      );
    });

    it('should create a portfolio with custom weights', async () => {
      const userId = 'user-123';
      const input: CreatePortfolioInput = {
        name: 'Custom Portfolio',
        totalCapital: 10000,
        allocationMethod: 'custom',
        strategies: [
          { strategyId: 'strategy-1', weight: 0.6 },
          { strategyId: 'strategy-2', weight: 0.4 },
        ],
      };

      const mockPortfolio = {
        id: 'portfolio-1',
        userId,
        name: input.name,
        totalCapital: input.totalCapital,
        allocationMethod: input.allocationMethod,
        rebalanceConfig: { enabled: true, frequency: 'threshold', threshold: 5 },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        strategies: [
          {
            id: 'ps-1',
            portfolioId: 'portfolio-1',
            strategyId: 'strategy-1',
            weight: 0.6,
            allocation: 6000,
            currentAllocation: 6000,
            status: 'running',
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'ps-2',
            portfolioId: 'portfolio-1',
            strategyId: 'strategy-2',
            weight: 0.4,
            allocation: 4000,
            currentAllocation: 4000,
            status: 'running',
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockDao.createPortfolio.mockResolvedValue(mockPortfolio);
      mockDao.getPortfolioById.mockResolvedValue(mockPortfolio);

      const result = await service.createPortfolio(userId, input);

      expect(result.strategies).toHaveLength(2);
      expect(result.strategies![0].weight).toBe(0.6);
      expect(result.strategies![1].weight).toBe(0.4);
    });
  });

  describe('getPortfolio', () => {
    it('should return portfolio by ID', async () => {
      const portfolioId = 'portfolio-1';
      const mockPortfolio = {
        id: portfolioId,
        userId: 'user-123',
        name: 'Test Portfolio',
        totalCapital: 10000,
        allocationMethod: 'equal' as AllocationMethod,
        rebalanceConfig: { enabled: true, frequency: 'threshold', threshold: 5 },
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDao.getPortfolioById.mockResolvedValue(mockPortfolio);

      const result = await service.getPortfolio(portfolioId);

      expect(mockDao.getPortfolioById).toHaveBeenCalledWith(portfolioId);
      expect(result).toEqual(mockPortfolio);
    });

    it('should return null if portfolio not found', async () => {
      mockDao.getPortfolioById.mockResolvedValue(null);

      const result = await service.getPortfolio('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updatePortfolio', () => {
    it('should update portfolio', async () => {
      const portfolioId = 'portfolio-1';
      const input: UpdatePortfolioInput = {
        name: 'Updated Portfolio',
        totalCapital: 20000,
      };

      const mockPortfolio = {
        id: portfolioId,
        userId: 'user-123',
        name: 'Updated Portfolio',
        totalCapital: 20000,
        allocationMethod: 'equal' as AllocationMethod,
        rebalanceConfig: { enabled: true, frequency: 'threshold', threshold: 5 },
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDao.updatePortfolio.mockResolvedValue(mockPortfolio);

      const result = await service.updatePortfolio(portfolioId, input);

      expect(mockDao.updatePortfolio).toHaveBeenCalledWith(portfolioId, input);
      expect(result.name).toBe('Updated Portfolio');
      expect(result.totalCapital).toBe(20000);
    });
  });

  describe('deletePortfolio', () => {
    it('should delete portfolio', async () => {
      const portfolioId = 'portfolio-1';
      mockDao.deletePortfolio.mockResolvedValue(undefined);

      await service.deletePortfolio(portfolioId);

      expect(mockDao.deletePortfolio).toHaveBeenCalledWith(portfolioId);
    });
  });

  describe('startPortfolio', () => {
    it('should start portfolio and all strategies', async () => {
      const portfolioId = 'portfolio-1';
      const mockPortfolio = {
        id: portfolioId,
        userId: 'user-123',
        name: 'Test Portfolio',
        totalCapital: 10000,
        allocationMethod: 'equal' as AllocationMethod,
        rebalanceConfig: { enabled: true, frequency: 'threshold', threshold: 5 },
        status: 'stopped' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        strategies: [
          {
            id: 'ps-1',
            portfolioId,
            strategyId: 'strategy-1',
            weight: 1,
            allocation: 10000,
            currentAllocation: 10000,
            status: 'stopped' as const,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockDao.getPortfolioById.mockResolvedValue(mockPortfolio);
      mockDao.updatePortfolio.mockResolvedValue({ ...mockPortfolio, status: 'active' });
      mockDao.updatePortfolioStrategy.mockResolvedValue({} as any);

      await service.startPortfolio(portfolioId);

      expect(mockDao.updatePortfolio).toHaveBeenCalledWith(portfolioId, { status: 'active' });
      expect(mockDao.updatePortfolioStrategy).toHaveBeenCalledWith(
        portfolioId,
        'strategy-1',
        { status: 'running' }
      );
    });
  });

  describe('stopPortfolio', () => {
    it('should stop portfolio and all strategies', async () => {
      const portfolioId = 'portfolio-1';
      const mockPortfolio = {
        id: portfolioId,
        userId: 'user-123',
        name: 'Test Portfolio',
        totalCapital: 10000,
        allocationMethod: 'equal' as AllocationMethod,
        rebalanceConfig: { enabled: true, frequency: 'threshold', threshold: 5 },
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        strategies: [
          {
            id: 'ps-1',
            portfolioId,
            strategyId: 'strategy-1',
            weight: 1,
            allocation: 10000,
            currentAllocation: 10000,
            status: 'running' as const,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockDao.getPortfolioById.mockResolvedValue(mockPortfolio);
      mockDao.updatePortfolio.mockResolvedValue({ ...mockPortfolio, status: 'stopped' });
      mockDao.updatePortfolioStrategy.mockResolvedValue({} as any);

      await service.stopPortfolio(portfolioId);

      expect(mockDao.updatePortfolio).toHaveBeenCalledWith(portfolioId, { status: 'stopped' });
      expect(mockDao.updatePortfolioStrategy).toHaveBeenCalledWith(
        portfolioId,
        'strategy-1',
        { status: 'stopped' }
      );
    });
  });

  describe('checkRebalanceNeeded', () => {
    it('should detect when rebalance is needed', async () => {
      const portfolioId = 'portfolio-1';
      const mockPortfolio = {
        id: portfolioId,
        userId: 'user-123',
        name: 'Test Portfolio',
        totalCapital: 10000,
        allocationMethod: 'equal' as AllocationMethod,
        rebalanceConfig: { enabled: true, frequency: 'threshold', threshold: 5 },
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        strategies: [
          {
            id: 'ps-1',
            portfolioId,
            strategyId: 'strategy-1',
            weight: 0.5,
            allocation: 5000,
            currentAllocation: 6000, // 60% - 10% deviation
            status: 'running' as const,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'ps-2',
            portfolioId,
            strategyId: 'strategy-2',
            weight: 0.5,
            allocation: 5000,
            currentAllocation: 4000, // 40%
            status: 'running' as const,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockDao.getPortfolioById.mockResolvedValue(mockPortfolio);

      const result = await service.checkRebalanceNeeded(portfolioId);

      expect(result.needsRebalance).toBe(true);
      expect(result.adjustments).toHaveLength(2);
    });

    it('should not need rebalance when weights are balanced', async () => {
      const portfolioId = 'portfolio-1';
      const mockPortfolio = {
        id: portfolioId,
        userId: 'user-123',
        name: 'Test Portfolio',
        totalCapital: 10000,
        allocationMethod: 'equal' as AllocationMethod,
        rebalanceConfig: { enabled: true, frequency: 'threshold', threshold: 5 },
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        strategies: [
          {
            id: 'ps-1',
            portfolioId,
            strategyId: 'strategy-1',
            weight: 0.5,
            allocation: 5000,
            currentAllocation: 5000,
            status: 'running' as const,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'ps-2',
            portfolioId,
            strategyId: 'strategy-2',
            weight: 0.5,
            allocation: 5000,
            currentAllocation: 5000,
            status: 'running' as const,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockDao.getPortfolioById.mockResolvedValue(mockPortfolio);

      const result = await service.checkRebalanceNeeded(portfolioId);

      expect(result.needsRebalance).toBe(false);
    });
  });

  describe('calculatePerformance', () => {
    it('should calculate portfolio performance', async () => {
      const portfolioId = 'portfolio-1';
      const mockPortfolio = {
        id: portfolioId,
        userId: 'user-123',
        name: 'Test Portfolio',
        totalCapital: 10000,
        allocationMethod: 'equal' as AllocationMethod,
        rebalanceConfig: { enabled: true, frequency: 'threshold', threshold: 5 },
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        strategies: [
          {
            id: 'ps-1',
            portfolioId,
            strategyId: 'strategy-1',
            strategyName: 'Strategy 1',
            weight: 0.5,
            allocation: 5000,
            currentAllocation: 5000,
            currentValue: 5500,
            status: 'running' as const,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'ps-2',
            portfolioId,
            strategyId: 'strategy-2',
            strategyName: 'Strategy 2',
            weight: 0.5,
            allocation: 5000,
            currentAllocation: 5000,
            currentValue: 4800,
            status: 'running' as const,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockDao.getPortfolioById.mockResolvedValue(mockPortfolio);
      mockDao.updatePortfolioPerformance.mockResolvedValue(undefined);

      const result = await service.calculatePerformance(portfolioId);

      expect(result.totalValue).toBe(10300); // 5500 + 4800
      expect(result.totalReturn).toBe(300); // 10300 - 10000
      expect(result.totalReturnPct).toBeCloseTo(3); // 3%
      expect(result.strategies).toHaveLength(2);
    });
  });

  describe('calculateRisk', () => {
    it('should calculate portfolio risk metrics', async () => {
      const portfolioId = 'portfolio-1';
      const mockPortfolio = {
        id: portfolioId,
        userId: 'user-123',
        name: 'Test Portfolio',
        totalCapital: 10000,
        allocationMethod: 'equal' as AllocationMethod,
        rebalanceConfig: { enabled: true, frequency: 'threshold', threshold: 5 },
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        strategies: [
          {
            id: 'ps-1',
            portfolioId,
            strategyId: 'strategy-1',
            weight: 0.5,
            allocation: 5000,
            currentAllocation: 5000,
            status: 'running' as const,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'ps-2',
            portfolioId,
            strategyId: 'strategy-2',
            weight: 0.5,
            allocation: 5000,
            currentAllocation: 5000,
            status: 'running' as const,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockDao.getPortfolioById.mockResolvedValue(mockPortfolio);

      const result = await service.calculateRisk(portfolioId);

      // HHI = 0.5^2 + 0.5^2 = 0.5
      // Concentration risk = 0.5 / 1 * 100 = 50%
      expect(result.concentrationRisk).toBe(50);
      expect(result.maxStrategyWeight).toBe(50);
      expect(result.diversificationScore).toBe(50);
    });
  });
});