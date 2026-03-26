/**
 * Experiment System Data Access Object
 * Handles database operations for A/B testing experiments
 */

import { getSupabaseClient, getSupabaseAdminClient } from './client';
import { createLogger } from '../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';

const log = createLogger('ExperimentDAO');

// ============================================
// Type Definitions
// ============================================

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';
export type ExperimentType = 'referral' | 'ui' | 'feature' | 'pricing' | 'notification';

export interface Experiment {
  id: string;
  name: string;
  description: string | null;
  experimentType: ExperimentType;
  targetAudience: Record<string, unknown>;
  status: ExperimentStatus;
  startDate: Date | null;
  endDate: Date | null;
  trafficAllocation: number;
  significanceLevel: number;
  minimumSampleSize: number;
  winningVariantId: string | null;
  results: Record<string, unknown>;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentVariant {
  id: string;
  experimentId: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  trafficPercentage: number;
  isControl: boolean;
  participants: number;
  conversions: number;
  conversionRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentAssignment {
  id: string;
  experimentId: string;
  variantId: string;
  userId: string;
  assignedAt: Date;
  assignmentReason: 'random' | 'forced' | 'sticky';
  context: Record<string, unknown>;
  converted: boolean;
  convertedAt: Date | null;
  conversionValue: number | null;
  createdAt: Date;
}

export interface ExperimentEvent {
  id: string;
  experimentId: string;
  variantId: string | null;
  userId: string;
  assignmentId: string | null;
  eventType: string;
  eventName: string | null;
  eventData: Record<string, unknown>;
  sessionId: string | null;
  deviceType: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface CreateExperimentData {
  name: string;
  description?: string;
  experimentType?: ExperimentType;
  targetAudience?: Record<string, unknown>;
  trafficAllocation?: number;
  significanceLevel?: number;
  minimumSampleSize?: number;
  createdBy?: string;
}

export interface CreateVariantData {
  experimentId: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  trafficPercentage: number;
  isControl?: boolean;
}

export interface ExperimentStats {
  experimentId: string;
  variants: Array<{
    id: string;
    name: string;
    isControl: boolean;
    participants: number;
    conversions: number;
    conversionRate: number;
    config: Record<string, unknown>;
  }>;
  comparisons: Array<{
    variant_id: string;
    variant_name: string;
    lift: number;
    is_significant: boolean;
    z_score: number;
    p_value: number;
  }>;
  winningVariantId: string | null;
  totalParticipants: number;
  totalConversions: number;
}

// ============================================
// DAO Class
// ============================================

export class ExperimentDAO {
  private anonClient: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor(anonClient: SupabaseClient, adminClient: SupabaseClient) {
    this.anonClient = anonClient;
    this.adminClient = adminClient;
  }

  // ============================================
  // Experiment Operations
  // ============================================

  /**
   * Create a new experiment
   */
  async createExperiment(data: CreateExperimentData): Promise<Experiment> {
    const { data: experiment, error } = await this.adminClient
      .from('experiments')
      .insert({
        name: data.name,
        description: data.description || null,
        experiment_type: data.experimentType || 'referral',
        target_audience: data.targetAudience || {},
        traffic_allocation: data.trafficAllocation || 100,
        significance_level: data.significanceLevel || 0.05,
        minimum_sample_size: data.minimumSampleSize || 1000,
        created_by: data.createdBy || null,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create experiment:', error);
      throw error;
    }

    return this.mapExperimentRow(experiment);
  }

  /**
   * Get experiment by ID
   */
  async getExperimentById(experimentId: string): Promise<Experiment | null> {
    const { data, error } = await this.anonClient
      .from('experiments')
      .select('*')
      .eq('id', experimentId)
      .maybeSingle();

    if (error) {
      log.error('Failed to get experiment:', error);
      throw error;
    }

    return data ? this.mapExperimentRow(data) : null;
  }

  /**
   * Get experiment by name
   */
  async getExperimentByName(name: string): Promise<Experiment | null> {
    const { data, error } = await this.anonClient
      .from('experiments')
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (error) {
      log.error('Failed to get experiment by name:', error);
      throw error;
    }

    return data ? this.mapExperimentRow(data) : null;
  }

  /**
   * List experiments with filters
   */
  async listExperiments(options?: {
    status?: ExperimentStatus;
    type?: ExperimentType;
    limit?: number;
    offset?: number;
  }): Promise<{ experiments: Experiment[]; total: number }> {
    let query = this.anonClient
      .from('experiments')
      .select('*', { count: 'exact' });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.type) {
      query = query.eq('experiment_type', options.type);
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      log.error('Failed to list experiments:', error);
      throw error;
    }

    return {
      experiments: (data || []).map(this.mapExperimentRow),
      total: count || 0,
    };
  }

  /**
   * Update experiment
   */
  async updateExperiment(
    experimentId: string,
    data: Partial<{
      name: string;
      description: string;
      status: ExperimentStatus;
      startDate: Date;
      endDate: Date;
      trafficAllocation: number;
      winningVariantId: string;
      results: Record<string, unknown>;
    }>
  ): Promise<Experiment> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.startDate !== undefined) updateData.start_date = data.startDate;
    if (data.endDate !== undefined) updateData.end_date = data.endDate;
    if (data.trafficAllocation !== undefined) updateData.traffic_allocation = data.trafficAllocation;
    if (data.winningVariantId !== undefined) updateData.winning_variant_id = data.winningVariantId;
    if (data.results !== undefined) updateData.results = data.results;

    const { data: experiment, error } = await this.adminClient
      .from('experiments')
      .update(updateData)
      .eq('id', experimentId)
      .select()
      .single();

    if (error) {
      log.error('Failed to update experiment:', error);
      throw error;
    }

    return this.mapExperimentRow(experiment);
  }

  /**
   * Start an experiment
   */
  async startExperiment(experimentId: string): Promise<Experiment> {
    return this.updateExperiment(experimentId, {
      status: 'running',
      startDate: new Date(),
    });
  }

  /**
   * Pause an experiment
   */
  async pauseExperiment(experimentId: string): Promise<Experiment> {
    return this.updateExperiment(experimentId, {
      status: 'paused',
    });
  }

  /**
   * Complete an experiment
   */
  async completeExperiment(experimentId: string, winningVariantId?: string): Promise<Experiment> {
    const updateData: Partial<{
      status: ExperimentStatus;
      endDate: Date;
      winningVariantId: string;
    }> = {
      status: 'completed',
      endDate: new Date(),
    };

    if (winningVariantId) {
      updateData.winningVariantId = winningVariantId;
    }

    return this.updateExperiment(experimentId, updateData);
  }

  // ============================================
  // Variant Operations
  // ============================================

  /**
   * Create a variant
   */
  async createVariant(data: CreateVariantData): Promise<ExperimentVariant> {
    const { data: variant, error } = await this.adminClient
      .from('experiment_variants')
      .insert({
        experiment_id: data.experimentId,
        name: data.name,
        description: data.description || null,
        config: data.config,
        traffic_percentage: data.trafficPercentage,
        is_control: data.isControl || false,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create variant:', error);
      throw error;
    }

    return this.mapVariantRow(variant);
  }

  /**
   * Get variants for an experiment
   */
  async getVariantsByExperimentId(experimentId: string): Promise<ExperimentVariant[]> {
    const { data, error } = await this.anonClient
      .from('experiment_variants')
      .select('*')
      .eq('experiment_id', experimentId)
      .order('is_control', { ascending: false })
      .order('name');

    if (error) {
      log.error('Failed to get variants:', error);
      throw error;
    }

    return (data || []).map(this.mapVariantRow);
  }

  /**
   * Get variant by ID
   */
  async getVariantById(variantId: string): Promise<ExperimentVariant | null> {
    const { data, error } = await this.anonClient
      .from('experiment_variants')
      .select('*')
      .eq('id', variantId)
      .maybeSingle();

    if (error) {
      log.error('Failed to get variant:', error);
      throw error;
    }

    return data ? this.mapVariantRow(data) : null;
  }

  /**
   * Update variant
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
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.trafficPercentage !== undefined) updateData.traffic_percentage = data.trafficPercentage;

    const { data: variant, error } = await this.adminClient
      .from('experiment_variants')
      .update(updateData)
      .eq('id', variantId)
      .select()
      .single();

    if (error) {
      log.error('Failed to update variant:', error);
      throw error;
    }

    return this.mapVariantRow(variant);
  }

  /**
   * Delete variant
   */
  async deleteVariant(variantId: string): Promise<void> {
    const { error } = await this.adminClient
      .from('experiment_variants')
      .delete()
      .eq('id', variantId);

    if (error) {
      log.error('Failed to delete variant:', error);
      throw error;
    }
  }

  // ============================================
  // Assignment Operations
  // ============================================

  /**
   * Assign user to experiment variant
   */
  async assignUserToExperiment(
    experimentId: string,
    userId: string,
    context?: Record<string, unknown>
  ): Promise<{
    success: boolean;
    variant: ExperimentVariant | null;
    assignmentId?: string;
    alreadyAssigned?: boolean;
    error?: string;
  }> {
    const { data: result, error } = await this.adminClient.rpc('assign_user_to_experiment', {
      p_experiment_id: experimentId,
      p_user_id: userId,
      p_context: context || {},
    });

    if (error) {
      log.error('Failed to assign user to experiment:', error);
      throw error;
    }

    const mapped = result as {
      success: boolean;
      variant?: {
        id: string;
        name: string;
        config: Record<string, unknown>;
        is_control: boolean;
      };
      assignment_id?: string;
      already_assigned?: boolean;
      error?: string;
    };

    if (!mapped.success || !mapped.variant) {
      return {
        success: mapped.success,
        variant: null,
        error: mapped.error,
      };
    }

    // Fetch full variant details
    const variant = await this.getVariantById(mapped.variant.id);

    return {
      success: true,
      variant,
      assignmentId: mapped.assignment_id,
      alreadyAssigned: mapped.already_assigned,
    };
  }

  /**
   * Get user's assignment for an experiment
   */
  async getUserAssignment(
    experimentId: string,
    userId: string
  ): Promise<ExperimentAssignment | null> {
    const { data, error } = await this.anonClient
      .from('experiment_assignments')
      .select('*')
      .eq('experiment_id', experimentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      log.error('Failed to get user assignment:', error);
      throw error;
    }

    return data ? this.mapAssignmentRow(data) : null;
  }

  /**
   * Get user's active experiments
   */
  async getUserActiveExperiments(userId: string): Promise<Array<{
    experiment: Experiment;
    variant: ExperimentVariant;
    assignment: ExperimentAssignment;
  }>> {
    const { data, error } = await this.anonClient.rpc('get_user_active_experiments', {
      p_user_id: userId,
    });

    if (error) {
      log.error('Failed to get user active experiments:', error);
      throw error;
    }

    const results = data as Array<{
      experiment_id: string;
      experiment_name: string;
      experiment_type: string;
      variant: {
        id: string;
        name: string;
        config: Record<string, unknown>;
        is_control: boolean;
      };
      assignment_id: string;
      assigned_at: string;
      converted: boolean;
    }>;

    const enriched = await Promise.all(
      results.map(async (r) => {
        const experiment = await this.getExperimentById(r.experiment_id);
        const variant = await this.getVariantById(r.variant.id);

        return {
          experiment: experiment!,
          variant: variant!,
          assignment: {
            id: r.assignment_id,
            experimentId: r.experiment_id,
            variantId: r.variant.id,
            userId,
            assignedAt: new Date(r.assigned_at),
            assignmentReason: 'random' as const,
            context: {},
            converted: r.converted,
            convertedAt: null,
            conversionValue: null,
            createdAt: new Date(r.assigned_at),
          },
        };
      })
    );

    return enriched.filter((e) => e.experiment && e.variant);
  }

  // ============================================
  // Event & Conversion Tracking
  // ============================================

  /**
   * Track conversion event
   */
  async trackConversion(
    experimentId: string,
    userId: string,
    eventName?: string,
    eventData?: Record<string, unknown>,
    conversionValue?: number
  ): Promise<{
    success: boolean;
    alreadyConverted?: boolean;
    error?: string;
  }> {
    const { data: result, error } = await this.adminClient.rpc('track_experiment_conversion', {
      p_experiment_id: experimentId,
      p_user_id: userId,
      p_event_name: eventName || 'conversion',
      p_event_data: eventData || {},
      p_conversion_value: conversionValue || null,
    });

    if (error) {
      log.error('Failed to track conversion:', error);
      throw error;
    }

    return result as {
      success: boolean;
      already_converted?: boolean;
      error?: string;
    };
  }

  /**
   * Track experiment event
   */
  async trackEvent(data: {
    experimentId: string;
    variantId?: string;
    userId: string;
    assignmentId?: string;
    eventType: string;
    eventName?: string;
    eventData?: Record<string, unknown>;
    sessionId?: string;
    deviceType?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ExperimentEvent> {
    const { data: event, error } = await this.adminClient
      .from('experiment_events')
      .insert({
        experiment_id: data.experimentId,
        variant_id: data.variantId || null,
        user_id: data.userId,
        assignment_id: data.assignmentId || null,
        event_type: data.eventType,
        event_name: data.eventName || null,
        event_data: data.eventData || {},
        session_id: data.sessionId || null,
        device_type: data.deviceType || null,
        ip_address: data.ipAddress || null,
        user_agent: data.userAgent || null,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to track event:', error);
      throw error;
    }

    return this.mapEventRow(event);
  }

  /**
   * Get events for an experiment
   */
  async getExperimentEvents(
    experimentId: string,
    options?: {
      eventType?: string;
      eventName?: string;
      userId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ events: ExperimentEvent[]; total: number }> {
    let query = this.anonClient
      .from('experiment_events')
      .select('*', { count: 'exact' })
      .eq('experiment_id', experimentId);

    if (options?.eventType) {
      query = query.eq('event_type', options.eventType);
    }

    if (options?.eventName) {
      query = query.eq('event_name', options.eventName);
    }

    if (options?.userId) {
      query = query.eq('user_id', options.userId);
    }

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      log.error('Failed to get experiment events:', error);
      throw error;
    }

    return {
      events: (data || []).map(this.mapEventRow),
      total: count || 0,
    };
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * Calculate experiment statistics
   */
  async calculateStatistics(experimentId: string): Promise<ExperimentStats> {
    const { data, error } = await this.anonClient.rpc('calculate_experiment_statistics', {
      p_experiment_id: experimentId,
    });

    if (error) {
      log.error('Failed to calculate statistics:', error);
      throw error;
    }

    return data as ExperimentStats;
  }

  // ============================================
  // Helper Methods
  // ============================================

  private mapExperimentRow(row: Record<string, unknown>): Experiment {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | null,
      experimentType: row.experiment_type as ExperimentType,
      targetAudience: (row.target_audience as Record<string, unknown>) || {},
      status: row.status as ExperimentStatus,
      startDate: row.start_date ? new Date(row.start_date as string) : null,
      endDate: row.end_date ? new Date(row.end_date as string) : null,
      trafficAllocation: row.traffic_allocation as number,
      significanceLevel: row.significance_level as number,
      minimumSampleSize: row.minimum_sample_size as number,
      winningVariantId: row.winning_variant_id as string | null,
      results: (row.results as Record<string, unknown>) || {},
      createdBy: row.created_by as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapVariantRow(row: Record<string, unknown>): ExperimentVariant {
    return {
      id: row.id as string,
      experimentId: row.experiment_id as string,
      name: row.name as string,
      description: row.description as string | null,
      config: (row.config as Record<string, unknown>) || {},
      trafficPercentage: row.traffic_percentage as number,
      isControl: row.is_control as boolean,
      participants: row.participants as number,
      conversions: row.conversions as number,
      conversionRate: row.conversion_rate as number,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapAssignmentRow(row: Record<string, unknown>): ExperimentAssignment {
    return {
      id: row.id as string,
      experimentId: row.experiment_id as string,
      variantId: row.variant_id as string,
      userId: row.user_id as string,
      assignedAt: new Date(row.assigned_at as string),
      assignmentReason: row.assignment_reason as ExperimentAssignment['assignmentReason'],
      context: (row.context as Record<string, unknown>) || {},
      converted: row.converted as boolean,
      convertedAt: row.converted_at ? new Date(row.converted_at as string) : null,
      conversionValue: row.conversion_value as number | null,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapEventRow(row: Record<string, unknown>): ExperimentEvent {
    return {
      id: row.id as string,
      experimentId: row.experiment_id as string,
      variantId: row.variant_id as string | null,
      userId: row.user_id as string,
      assignmentId: row.assignment_id as string | null,
      eventType: row.event_type as string,
      eventName: row.event_name as string | null,
      eventData: (row.event_data as Record<string, unknown>) || {},
      sessionId: row.session_id as string | null,
      deviceType: row.device_type as string | null,
      ipAddress: row.ip_address as string | null,
      userAgent: row.user_agent as string | null,
      createdAt: new Date(row.created_at as string),
    };
  }
}

// Export singleton instance
let experimentDAO: ExperimentDAO | null = null;

export function getExperimentDAO(): ExperimentDAO {
  if (!experimentDAO) {
    experimentDAO = new ExperimentDAO(getSupabaseClient(), getSupabaseAdminClient());
  }
  return experimentDAO;
}

export default ExperimentDAO;