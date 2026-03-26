/**
 * Tests for Experiment Service
 */

import { ExperimentService, getExperimentService } from '../ExperimentService';
import { getExperimentDAO } from '../../../database/experiment.dao';

// Mock DAO
jest.mock('../../../database/experiment.dao');

describe('ExperimentService', () => {
  let service: ExperimentService;
  let mockDAO: any;

  beforeEach(() => {
    mockDAO = {
      createExperiment: jest.fn(),
      createVariant: jest.fn(),
      getExperimentByName: jest.fn(),
      getExperimentById: jest.fn(),
      getVariantById: jest.fn(),
      assignUserToExperiment: jest.fn(),
      trackConversion: jest.fn(),
      getVariantsByExperimentId: jest.fn(),
      calculateStatistics: jest.fn(),
      listExperiments: jest.fn(),
      getUserActiveExperiments: jest.fn(),
      updateExperiment: jest.fn(),
      updateVariant: jest.fn(),
      deleteVariant: jest.fn(),
      startExperiment: jest.fn(),
      pauseExperiment: jest.fn(),
      completeExperiment: jest.fn(),
    };

    (getExperimentDAO as jest.Mock).mockReturnValue(mockDAO);
    service = new ExperimentService();
  });

  describe('createExperiment', () => {
    it('should create experiment with variants', async () => {
      mockDAO.createExperiment.mockResolvedValue({
        id: 'exp-123',
        name: 'Test Experiment',
        status: 'draft',
      });

      mockDAO.createVariant.mockResolvedValueOnce({
        id: 'var-1',
        name: 'control',
        isControl: true,
        trafficPercentage: 50,
      });

      mockDAO.createVariant.mockResolvedValueOnce({
        id: 'var-2',
        name: 'treatment',
        isControl: false,
        trafficPercentage: 50,
      });

      const result = await service.createExperiment({
        name: 'Test Experiment',
        variants: [
          { name: 'control', config: {}, trafficPercentage: 50, isControl: true },
          { name: 'treatment', config: {}, trafficPercentage: 50, isControl: false },
        ],
      });

      expect(result.experiment.name).toBe('Test Experiment');
      expect(result.variants).toHaveLength(2);
      expect(mockDAO.createVariant).toHaveBeenCalledTimes(2);
    });

    it('should reject if traffic percentages do not sum to 100', async () => {
      await expect(service.createExperiment({
        name: 'Test',
        variants: [
          { name: 'control', config: {}, trafficPercentage: 40, isControl: true },
          { name: 'treatment', config: {}, trafficPercentage: 40, isControl: false },
        ],
      })).rejects.toThrow('Variant traffic percentages must sum to 100');
    });

    it('should reject if no control variant', async () => {
      await expect(service.createExperiment({
        name: 'Test',
        variants: [
          { name: 'treatment', config: {}, trafficPercentage: 100, isControl: false },
        ],
      })).rejects.toThrow('At least one variant must be marked as control');
    });

    it('should reject if multiple control variants', async () => {
      await expect(service.createExperiment({
        name: 'Test',
        variants: [
          { name: 'control1', config: {}, trafficPercentage: 50, isControl: true },
          { name: 'control2', config: {}, trafficPercentage: 50, isControl: true },
        ],
      })).rejects.toThrow('Only one variant can be marked as control');
    });
  });

  describe('getVariant', () => {
    it('should return variant for user', async () => {
      mockDAO.getExperimentByName.mockResolvedValue({
        id: 'exp-123',
        name: 'Test Experiment',
        status: 'running',
      });

      mockDAO.assignUserToExperiment.mockResolvedValue({
        success: true,
        variant: {
          id: 'var-123',
          name: 'treatment',
          config: { bonus_days: 14 },
          isControl: false,
        },
        isNewAssignment: true,
      });

      mockDAO.getVariantById.mockResolvedValue({
        id: 'var-123',
        name: 'treatment',
        config: { bonus_days: 14 },
        isControl: false,
      });

      const result = await service.getVariant({
        experimentName: 'Test Experiment',
        userId: 'user-123',
      });

      expect(result.variant?.name).toBe('treatment');
      expect(result.experiment?.name).toBe('Test Experiment');
      expect(result.isNewAssignment).toBe(true);
    });

    it('should return null if experiment not found', async () => {
      mockDAO.getExperimentByName.mockResolvedValue(null);

      const result = await service.getVariant({
        experimentName: 'Nonexistent',
        userId: 'user-123',
      });

      expect(result.variant).toBeNull();
      expect(result.experiment).toBeNull();
    });

    it('should return null if experiment not running', async () => {
      mockDAO.getExperimentByName.mockResolvedValue({
        id: 'exp-123',
        name: 'Test Experiment',
        status: 'draft',
      });

      const result = await service.getVariant({
        experimentName: 'Test Experiment',
        userId: 'user-123',
      });

      expect(result.variant).toBeNull();
    });
  });

  describe('getVariantConfig', () => {
    it('should return config for user', async () => {
      mockDAO.getExperimentByName.mockResolvedValue({
        id: 'exp-123',
        name: 'Test',
        status: 'running',
      });

      mockDAO.assignUserToExperiment.mockResolvedValue({
        success: true,
        variant: {
          id: 'var-123',
          name: 'treatment',
          config: { bonus_days: 14, max_referrals: 100 },
          isControl: false,
        },
      });

      const config = await service.getVariantConfig('Test', 'user-123');

      expect(config).toEqual({ bonus_days: 14, max_referrals: 100 });
    });

    it('should return null if no variant', async () => {
      mockDAO.getExperimentByName.mockResolvedValue(null);

      const config = await service.getVariantConfig('Nonexistent', 'user-123');

      expect(config).toBeNull();
    });
  });

  describe('trackConversion', () => {
    it('should track conversion successfully', async () => {
      mockDAO.getExperimentByName.mockResolvedValue({
        id: 'exp-123',
        name: 'Test',
      });

      mockDAO.trackConversion.mockResolvedValue({
        success: true,
      });

      const result = await service.trackConversion({
        experimentName: 'Test',
        userId: 'user-123',
        eventName: 'referral_completed',
      });

      expect(result.success).toBe(true);
    });

    it('should return false if experiment not found', async () => {
      mockDAO.getExperimentByName.mockResolvedValue(null);

      const result = await service.trackConversion({
        experimentName: 'Nonexistent',
        userId: 'user-123',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('startExperiment', () => {
    it('should start experiment', async () => {
      mockDAO.startExperiment.mockResolvedValue({
        id: 'exp-123',
        name: 'Test',
        status: 'running',
      });

      const result = await service.startExperiment('exp-123');

      expect(result.status).toBe('running');
      expect(mockDAO.startExperiment).toHaveBeenCalledWith('exp-123');
    });
  });

  describe('pauseExperiment', () => {
    it('should pause experiment', async () => {
      mockDAO.pauseExperiment.mockResolvedValue({
        id: 'exp-123',
        name: 'Test',
        status: 'paused',
      });

      const result = await service.pauseExperiment('exp-123');

      expect(result.status).toBe('paused');
    });
  });

  describe('completeExperiment', () => {
    it('should complete experiment with winning variant', async () => {
      mockDAO.completeExperiment.mockResolvedValue({
        id: 'exp-123',
        name: 'Test',
        status: 'completed',
        winningVariantId: 'var-123',
      });

      const result = await service.completeExperiment('exp-123', 'var-123');

      expect(result.status).toBe('completed');
      expect(result.winningVariantId).toBe('var-123');
    });
  });

  describe('getExperimentResults', () => {
    it('should return experiment results with statistics', async () => {
      mockDAO.getExperimentById.mockResolvedValue({
        id: 'exp-123',
        name: 'Test',
      });

      mockDAO.getVariantsByExperimentId.mockResolvedValue([
        { id: 'var-1', name: 'control', isControl: true },
        { id: 'var-2', name: 'treatment', isControl: false },
      ]);

      mockDAO.calculateStatistics.mockResolvedValue({
        experimentId: 'exp-123',
        totalParticipants: 1000,
        totalConversions: 100,
      });

      const result = await service.getExperimentResults('exp-123');

      expect(result.experiment.id).toBe('exp-123');
      expect(result.variants).toHaveLength(2);
      expect(result.statistics.totalParticipants).toBe(1000);
    });

    it('should throw if experiment not found', async () => {
      mockDAO.getExperimentById.mockResolvedValue(null);

      await expect(service.getExperimentResults('nonexistent'))
        .rejects.toThrow('Experiment not found');
    });
  });

  describe('listExperiments', () => {
    it('should list experiments with variants', async () => {
      mockDAO.listExperiments.mockResolvedValue({
        experiments: [
          { id: 'exp-1', name: 'Test 1' },
          { id: 'exp-2', name: 'Test 2' },
        ],
        total: 2,
      });

      mockDAO.getVariantsByExperimentId.mockResolvedValue([
        { id: 'var-1', name: 'control' },
      ]);

      const result = await service.listExperiments();

      expect(result.experiments).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('getUserActiveExperiments', () => {
    it('should return user active experiments', async () => {
      mockDAO.getUserActiveExperiments.mockResolvedValue([
        {
          experiment: { name: 'Exp 1' },
          variant: { name: 'treatment', config: {}, isControl: false },
        },
      ]);

      const result = await service.getUserActiveExperiments('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].experimentName).toBe('Exp 1');
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true if feature is enabled in config', async () => {
      mockDAO.getExperimentByName.mockResolvedValue({
        id: 'exp-123',
        status: 'running',
      });

      mockDAO.assignUserToExperiment.mockResolvedValue({
        success: true,
        variant: {
          id: 'var-123',
          name: 'treatment',
          config: { new_feature: true },
          isControl: false,
        },
      });

      const result = await service.isFeatureEnabled('Test', 'user-123', 'new_feature');

      expect(result).toBe(true);
    });

    it('should return false if feature is not in config', async () => {
      mockDAO.getExperimentByName.mockResolvedValue({
        id: 'exp-123',
        status: 'running',
      });

      mockDAO.assignUserToExperiment.mockResolvedValue({
        success: true,
        variant: { id: 'var-123' },
      });

      mockDAO.getVariantById.mockResolvedValue({
        id: 'var-123',
        config: {},
      });

      const result = await service.isFeatureEnabled('Test', 'user-123', 'new_feature');

      expect(result).toBe(false);
    });
  });

  describe('getConfigValue', () => {
    it('should return numeric value from config', async () => {
      mockDAO.getExperimentByName.mockResolvedValue({
        id: 'exp-123',
        status: 'running',
      });

      mockDAO.assignUserToExperiment.mockResolvedValue({
        success: true,
        variant: {
          id: 'var-123',
          name: 'treatment',
          config: { bonus_days: 14 },
          isControl: false,
        },
      });

      const result = await service.getConfigValue('Test', 'user-123', 'bonus_days', 7);

      expect(result).toBe(14);
    });

    it('should return default value if key not in config', async () => {
      mockDAO.getExperimentByName.mockResolvedValue(null);

      const result = await service.getConfigValue('Test', 'user-123', 'bonus_days', 7);

      expect(result).toBe(7);
    });
  });
});

describe('getExperimentService', () => {
  it('should return singleton instance', () => {
    const instance1 = getExperimentService();
    const instance2 = getExperimentService();

    expect(instance1).toBe(instance2);
  });
});