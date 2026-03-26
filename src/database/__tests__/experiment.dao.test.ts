/**
 * Tests for Experiment DAO
 */

import { ExperimentDAO, getExperimentDAO } from '../experiment.dao';
import { getSupabaseClient, getSupabaseAdminClient } from '../client';

// Mock Supabase clients
jest.mock('../client');

describe('ExperimentDAO', () => {
  let experimentDAO: ExperimentDAO;
  let mockAnonClient: any;
  let mockAdminClient: any;

  beforeEach(() => {
    const mockSingle = jest.fn();
    const mockMaybeSingle = jest.fn();

    mockAnonClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: mockMaybeSingle,
            single: mockSingle,
          })),
          order: jest.fn(() => ({
            range: jest.fn(() => ({
              maybeSingle: mockMaybeSingle,
            })),
          })),
        })),
        rpc: jest.fn(),
      })),
    };

    mockAdminClient = {
      from: jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: mockSingle,
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: mockSingle,
            })),
          })),
        })),
        delete: jest.fn(() => ({
          eq: jest.fn(),
        })),
        rpc: jest.fn(),
      })),
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(mockAnonClient);
    (getSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdminClient);

    experimentDAO = new ExperimentDAO(mockAnonClient, mockAdminClient);
  });

  describe('createExperiment', () => {
    it('should create an experiment successfully', async () => {
      const mockExperiment = {
        id: 'exp-123',
        name: 'Test Experiment',
        description: 'Test description',
        experiment_type: 'referral',
        target_audience: {},
        status: 'draft',
        traffic_allocation: 100,
        significance_level: 0.05,
        minimum_sample_size: 1000,
        winning_variant_id: null,
        results: {},
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAdminClient.from().insert().select().single.mockResolvedValue({
        data: mockExperiment,
        error: null,
      });

      const result = await experimentDAO.createExperiment({
        name: 'Test Experiment',
        description: 'Test description',
      });

      expect(result.name).toBe('Test Experiment');
      expect(result.status).toBe('draft');
    });
  });

  describe('getExperimentById', () => {
    it('should return experiment when found', async () => {
      const mockExperiment = {
        id: 'exp-123',
        name: 'Test Experiment',
        description: null,
        experiment_type: 'referral',
        target_audience: {},
        status: 'draft',
        start_date: null,
        end_date: null,
        traffic_allocation: 100,
        significance_level: 0.05,
        minimum_sample_size: 1000,
        winning_variant_id: null,
        results: {},
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAnonClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: mockExperiment,
        error: null,
      });

      const result = await experimentDAO.getExperimentById('exp-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('exp-123');
    });

    it('should return null when not found', async () => {
      mockAnonClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await experimentDAO.getExperimentById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createVariant', () => {
    it('should create a variant successfully', async () => {
      const mockVariant = {
        id: 'var-123',
        experiment_id: 'exp-123',
        name: 'control',
        description: null,
        config: { value: 10 },
        traffic_percentage: 50,
        is_control: true,
        participants: 0,
        conversions: 0,
        conversion_rate: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAdminClient.from().insert().select().single.mockResolvedValue({
        data: mockVariant,
        error: null,
      });

      const result = await experimentDAO.createVariant({
        experimentId: 'exp-123',
        name: 'control',
        config: { value: 10 },
        trafficPercentage: 50,
        isControl: true,
      });

      expect(result.name).toBe('control');
      expect(result.isControl).toBe(true);
    });
  });

  describe('assignUserToExperiment', () => {
    it('should assign user to variant', async () => {
      const mockResult = {
        success: true,
        variant: {
          id: 'var-123',
          name: 'treatment',
          config: { bonus_days: 14 },
          is_control: false,
        },
        assignment_id: 'assign-123',
        already_assigned: false,
      };

      mockAdminClient.rpc.mockResolvedValue({
        data: mockResult,
        error: null,
      });

      // Mock getVariantById
      mockAnonClient.from().select().eq().maybeSingle
        .mockResolvedValueOnce({ data: null, error: null }) // First call for getVariantById
        .mockResolvedValueOnce({
          data: {
            id: 'var-123',
            experiment_id: 'exp-123',
            name: 'treatment',
            description: null,
            config: { bonus_days: 14 },
            traffic_percentage: 50,
            is_control: false,
            participants: 1,
            conversions: 0,
            conversion_rate: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        });

      const result = await experimentDAO.assignUserToExperiment(
        'exp-123',
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.variant?.name).toBe('treatment');
    });
  });

  describe('trackConversion', () => {
    it('should track conversion event', async () => {
      const mockResult = {
        success: true,
      };

      mockAdminClient.rpc.mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await experimentDAO.trackConversion(
        'exp-123',
        'user-123',
        'conversion',
        { source: 'referral' }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('calculateStatistics', () => {
    it('should return experiment statistics', async () => {
      const mockStats = {
        experiment_id: 'exp-123',
        variants: [
          {
            id: 'var-1',
            name: 'control',
            is_control: true,
            participants: 100,
            conversions: 10,
            conversion_rate: 0.1,
          },
          {
            id: 'var-2',
            name: 'treatment',
            is_control: false,
            participants: 100,
            conversions: 15,
            conversion_rate: 0.15,
          },
        ],
        total_participants: 200,
        total_conversions: 25,
      };

      mockAnonClient.rpc.mockResolvedValue({
        data: mockStats,
        error: null,
      });

      const result = await experimentDAO.calculateStatistics('exp-123');

      expect(result.experimentId).toBe('exp-123');
      expect(result.variants).toHaveLength(2);
    });
  });

  describe('updateExperiment', () => {
    it('should update experiment status', async () => {
      const mockUpdated = {
        id: 'exp-123',
        name: 'Test Experiment',
        description: null,
        experiment_type: 'referral',
        target_audience: {},
        status: 'running',
        start_date: new Date().toISOString(),
        end_date: null,
        traffic_allocation: 100,
        significance_level: 0.05,
        minimum_sample_size: 1000,
        winning_variant_id: null,
        results: {},
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAdminClient.from().update().eq().select().single.mockResolvedValue({
        data: mockUpdated,
        error: null,
      });

      const result = await experimentDAO.updateExperiment('exp-123', {
        status: 'running',
        startDate: new Date(),
      });

      expect(result.status).toBe('running');
    });
  });
});

describe('getExperimentDAO', () => {
  it('should return singleton instance', () => {
    const instance1 = getExperimentDAO();
    const instance2 = getExperimentDAO();

    expect(instance1).toBe(instance2);
  });
});