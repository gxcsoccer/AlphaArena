/**
 * Experiment Service
 * Main service for managing A/B testing experiments
 */

import { getExperimentDAO, Experiment, ExperimentVariant, ExperimentStats } from '../../database/experiment.dao';
import { createLogger } from '../../utils/logger';

const log = createLogger('ExperimentService');

// ============================================
// Type Definitions
// ============================================

export type { Experiment, ExperimentVariant, ExperimentStatus, ExperimentType } from '../../database/experiment.dao';

export interface CreateExperimentInput {
  name: string;
  description?: string;
  experimentType?: 'referral' | 'ui' | 'feature' | 'pricing' | 'notification';
  targetAudience?: Record<string, unknown>;
  trafficAllocation?: number;
  significanceLevel?: number;
  minimumSampleSize?: number;
  variants: Array<{
    name: string;
    description?: string;
    config: Record<string, unknown>;
    trafficPercentage: number;
    isControl?: boolean;
  }>;
  createdBy?: string;
}

export interface GetVariantInput {
  experimentName: string;
  userId: string;
  context?: Record<string, unknown>;
}

export interface TrackConversionInput {
  experimentName: string;
  userId: string;
  eventName?: string;
  eventData?: Record<string, unknown>;
  conversionValue?: number;
}

export interface ExperimentResult {
  experiment: Experiment;
  variants: ExperimentVariant[];
  statistics: ExperimentStats;
}

// ============================================
// Experiment Service Class
// ============================================

export class ExperimentService {
  /**
   * Create a new experiment with variants
   */
  async createExperiment(input: CreateExperimentInput): Promise<{
    experiment: Experiment;
    variants: ExperimentVariant[];
  }> {
    const experimentDAO = getExperimentDAO();

    // Validate variant traffic percentages sum to 100
    const totalTraffic = input.variants.reduce((sum, v) => sum + v.trafficPercentage, 0);
    if (Math.abs(totalTraffic - 100) > 0.01) {
      throw new Error(`Variant traffic percentages must sum to 100, got ${totalTraffic}`);
    }

    // Validate only one control variant
    const controlVariants = input.variants.filter(v => v.isControl);
    if (controlVariants.length === 0) {
      throw new Error('At least one variant must be marked as control');
    }
    if (controlVariants.length > 1) {
      throw new Error('Only one variant can be marked as control');
    }

    // Create experiment
    const experiment = await experimentDAO.createExperiment({
      name: input.name,
      description: input.description,
      experimentType: input.experimentType,
      targetAudience: input.targetAudience,
      trafficAllocation: input.trafficAllocation,
      significanceLevel: input.significanceLevel,
      minimumSampleSize: input.minimumSampleSize,
      createdBy: input.createdBy,
    });

    // Create variants
    const variants: ExperimentVariant[] = [];
    for (const variantInput of input.variants) {
      const variant = await experimentDAO.createVariant({
        experimentId: experiment.id,
        name: variantInput.name,
        description: variantInput.description,
        config: variantInput.config,
        trafficPercentage: variantInput.trafficPercentage,
        isControl: variantInput.isControl,
      });
      variants.push(variant);
    }

    log.info('Created experiment:', { experimentId: experiment.id, name: experiment.name });

    return { experiment, variants };
  }

  /**
   * Get or create user assignment for an experiment
   * Returns the variant configuration for the user
   */
  async getVariant(input: GetVariantInput): Promise<{
    variant: ExperimentVariant | null;
    experiment: Experiment | null;
    isNewAssignment: boolean;
  }> {
    const experimentDAO = getExperimentDAO();

    // Find the experiment
    const experiment = await experimentDAO.getExperimentByName(input.experimentName);
    if (!experiment) {
      log.debug('Experiment not found:', { name: input.experimentName });
      return { variant: null, experiment: null, isNewAssignment: false };
    }

    // Check if experiment is running
    if (experiment.status !== 'running') {
      log.debug('Experiment not running:', { name: input.experimentName, status: experiment.status });
      return { variant: null, experiment, isNewAssignment: false };
    }

    // Assign user to variant
    const result = await experimentDAO.assignUserToExperiment(
      experiment.id,
      input.userId,
      input.context
    );

    if (!result.success || !result.variant) {
      return { variant: null, experiment, isNewAssignment: false };
    }

    return {
      variant: result.variant,
      experiment,
      isNewAssignment: !result.alreadyAssigned,
    };
  }

  /**
   * Get variant config for a user (convenience method)
   * Returns null if user is not in experiment or experiment doesn't exist
   */
  async getVariantConfig(
    experimentName: string,
    userId: string
  ): Promise<Record<string, unknown> | null> {
    const { variant } = await this.getVariant({
      experimentName,
      userId,
    });

    return variant?.config || null;
  }

  /**
   * Track a conversion event for an experiment
   */
  async trackConversion(input: TrackConversionInput): Promise<{
    success: boolean;
    alreadyConverted?: boolean;
  }> {
    const experimentDAO = getExperimentDAO();

    // Find the experiment
    const experiment = await experimentDAO.getExperimentByName(input.experimentName);
    if (!experiment) {
      log.debug('Experiment not found for conversion tracking:', { name: input.experimentName });
      return { success: false };
    }

    const result = await experimentDAO.trackConversion(
      experiment.id,
      input.userId,
      input.eventName,
      input.eventData,
      input.conversionValue
    );

    if (result.success && !result.alreadyConverted) {
      log.info('Conversion tracked:', {
        experimentName: input.experimentName,
        userId: input.userId,
        eventName: input.eventName,
      });
    }

    return result;
  }

  /**
   * Start an experiment
   */
  async startExperiment(experimentId: string): Promise<Experiment> {
    const experimentDAO = getExperimentDAO();
    const experiment = await experimentDAO.startExperiment(experimentId);

    log.info('Experiment started:', { experimentId, name: experiment.name });

    return experiment;
  }

  /**
   * Pause an experiment
   */
  async pauseExperiment(experimentId: string): Promise<Experiment> {
    const experimentDAO = getExperimentDAO();
    const experiment = await experimentDAO.pauseExperiment(experimentId);

    log.info('Experiment paused:', { experimentId, name: experiment.name });

    return experiment;
  }

  /**
   * Complete an experiment with optional winning variant
   */
  async completeExperiment(
    experimentId: string,
    winningVariantId?: string
  ): Promise<Experiment> {
    const experimentDAO = getExperimentDAO();
    const experiment = await experimentDAO.completeExperiment(experimentId, winningVariantId);

    log.info('Experiment completed:', {
      experimentId,
      name: experiment.name,
      winningVariantId: experiment.winningVariantId,
    });

    return experiment;
  }

  /**
   * Get experiment results with statistics
   */
  async getExperimentResults(experimentId: string): Promise<ExperimentResult> {
    const experimentDAO = getExperimentDAO();

    const experiment = await experimentDAO.getExperimentById(experimentId);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    const variants = await experimentDAO.getVariantsByExperimentId(experimentId);
    const statistics = await experimentDAO.calculateStatistics(experimentId);

    return {
      experiment,
      variants,
      statistics,
    };
  }

  /**
   * List experiments with filters
   */
  async listExperiments(options?: {
    status?: 'draft' | 'running' | 'paused' | 'completed' | 'archived';
    type?: 'referral' | 'ui' | 'feature' | 'pricing' | 'notification';
    limit?: number;
    offset?: number;
  }): Promise<{
    experiments: Array<{
      experiment: Experiment;
      variants: ExperimentVariant[];
    }>;
    total: number;
  }> {
    const experimentDAO = getExperimentDAO();

    const { experiments, total } = await experimentDAO.listExperiments(options);

    const enrichedExperiments = await Promise.all(
      experiments.map(async (experiment) => {
        const variants = await experimentDAO.getVariantsByExperimentId(experiment.id);
        return { experiment, variants };
      })
    );

    return {
      experiments: enrichedExperiments,
      total,
    };
  }

  /**
   * Get user's active experiments with variant assignments
   */
  async getUserActiveExperiments(userId: string): Promise<Array<{
    experimentName: string;
    variantName: string;
    config: Record<string, unknown>;
    isControl: boolean;
  }>> {
    const experimentDAO = getExperimentDAO();

    const assignments = await experimentDAO.getUserActiveExperiments(userId);

    return assignments.map((a) => ({
      experimentName: a.experiment.name,
      variantName: a.variant.name,
      config: a.variant.config,
      isControl: a.variant.isControl,
    }));
  }

  /**
   * Update experiment configuration
   */
  async updateExperiment(
    experimentId: string,
    data: Partial<{
      name: string;
      description: string;
      trafficAllocation: number;
    }>
  ): Promise<Experiment> {
    const experimentDAO = getExperimentDAO();
    return experimentDAO.updateExperiment(experimentId, data);
  }

  /**
   * Update variant configuration
   */
  async updateVariant(
    variantId: string,
    data: Partial<{
      name: string;
      description: string;
      config: Record<string, unknown>;
      trafficPercentage: number;
    }>
  ): Promise<ExperimentVariant> {
    const experimentDAO = getExperimentDAO();
    return experimentDAO.updateVariant(variantId, data);
  }

  /**
   * Delete an experiment (draft only)
   */
  async deleteExperiment(experimentId: string): Promise<void> {
    const experimentDAO = getExperimentDAO();

    const experiment = await experimentDAO.getExperimentById(experimentId);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    if (experiment.status !== 'draft') {
      throw new Error('Can only delete draft experiments');
    }

    // Delete variants first (cascade should handle this, but be explicit)
    const variants = await experimentDAO.getVariantsByExperimentId(experimentId);
    for (const variant of variants) {
      await experimentDAO.deleteVariant(variant.id);
    }

    // Delete experiment
    await this.adminDeleteExperiment(experimentId);

    log.info('Experiment deleted:', { experimentId, name: experiment.name });
  }

  /**
   * Helper to determine if user should see a feature based on experiment
   */
  async isFeatureEnabled(
    experimentName: string,
    userId: string,
    featureKey: string
  ): Promise<boolean> {
    const config = await this.getVariantConfig(experimentName, userId);

    if (!config) {
      return false;
    }

    return config[featureKey] === true;
  }

  /**
   * Helper to get a numeric value from experiment config
   */
  async getConfigValue(
    experimentName: string,
    userId: string,
    key: string,
    defaultValue: number
  ): Promise<number> {
    const config = await this.getVariantConfig(experimentName, userId);

    if (!config || config[key] === undefined) {
      return defaultValue;
    }

    const value = config[key];
    return typeof value === 'number' ? value : defaultValue;
  }

  // Private helper
  private async adminDeleteExperiment(experimentId: string): Promise<void> {
    const { getSupabaseAdminClient } = await import('../../database/client');
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('experiments')
      .delete()
      .eq('id', experimentId);

    if (error) {
      throw error;
    }
  }
}

// Singleton instance
let experimentService: ExperimentService | null = null;

export function getExperimentService(): ExperimentService {
  if (!experimentService) {
    experimentService = new ExperimentService();
  }
  return experimentService;
}

export default ExperimentService;