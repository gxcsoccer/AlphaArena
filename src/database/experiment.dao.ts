/**
 * Experiment DAO
 *
 * Data access layer for A/B testing experiment management
 *
 * @module database/experiment.dao
 */

import { getSupabaseAdminClient } from './client';
import { createLogger } from '../utils/logger';

const log = createLogger('ExperimentDAO');

// ============================================================
// Types and Enums
// ============================================================

export enum ExperimentStatus {
  DRAFT = 'draft',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export enum EventType {
  IMPRESSION = 'impression',
  CLICK = 'click',
  CONVERSION = 'conversion',
  CUSTOM = 'custom',
}

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  status: ExperimentStatus;
  targetPage: string;
  targetSelector?: string;
  trafficAllocation: number;
  startAt?: Date;
  endAt?: Date;
  createdBy?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentVariant {
  id: string;
  experimentId: string;
  name: string;
  key: string;
  description?: string;
  trafficWeight: number;
  isControl: boolean;
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentAssignment {
  id: string;
  experimentId: string;
  variantId: string;
  userId?: string;
  sessionId: string;
  deviceId?: string;
  assignedAt: Date;
}

export interface ExperimentEvent {
  id: string;
  experimentId: string;
  variantId: string;
  userId?: string;
  sessionId: string;
  eventType: EventType;
  eventName?: string;
  eventValue?: number;
  properties: Record<string, any>;
  occurredAt: Date;
}

export interface ExperimentStatistics {
  id: string;
  experimentId: string;
  variantId: string;
  date: Date;
  impressions: number;
  clicks: number;
  conversions: number;
  uniqueVisitors: number;
  conversionRate: number;
  clickRate: number;
  avgSessionDuration?: number;
  bounceRate?: number;
  chiSquare?: number;
  pValue?: number;
  confidenceIntervalLower?: number;
  confidenceIntervalUpper?: number;
  isSignificant: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VariantResult {
  variantId: string;
  variantKey: string;
  variantName: string;
  isControl: boolean;
  totalVisitors: number;
  totalConversions: number;
  conversionRate: number;
  improvement: number;
  pValue?: number;
  confidenceLower?: number;
  confidenceUpper?: number;
  isSignificant: boolean;
  recommendation: string;
}

// ============================================================
// Input Types
// ============================================================

export interface CreateExperimentInput {
  name: string;
  description?: string;
  targetPage: string;
  targetSelector?: string;
  trafficAllocation?: number;
  startAt?: Date;
  endAt?: Date;
  createdBy?: string;
  metadata?: Record<string, any>;
}

export interface UpdateExperimentInput {
  name?: string;
  description?: string;
  status?: ExperimentStatus;
  targetPage?: string;
  targetSelector?: string;
  trafficAllocation?: number;
  startAt?: Date;
  endAt?: Date;
  metadata?: Record<string, any>;
}

export interface CreateVariantInput {
  experimentId: string;
  name: string;
  key: string;
  description?: string;
  trafficWeight?: number;
  isControl?: boolean;
  config?: Record<string, any>;
}

export interface UpdateVariantInput {
  name?: string;
  description?: string;
  trafficWeight?: number;
  config?: Record<string, any>;
}

export interface TrackEventInput {
  experimentId: string;
  variantId: string;
  sessionId: string;
  eventType: EventType;
  eventName?: string;
  eventValue?: number;
  properties?: Record<string, any>;
  userId?: string;
}

// ============================================================
// Query Options
// ============================================================

export interface ExperimentQueryOptions {
  status?: ExperimentStatus;
  targetPage?: string;
  createdBy?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================
// Experiment DAO Class
// ============================================================

class ExperimentDAO {
  // ============================================================
  // Experiment CRUD
  // ============================================================

  /**
   * Create a new experiment
   */
  async createExperiment(input: CreateExperimentInput): Promise<Experiment> {
    const supabase = getSupabaseAdminClient();

    const id = crypto.randomUUID();

    const { data, error } = await supabase
      .from('experiments')
      .insert({
        id,
        name: input.name,
        description: input.description || null,
        status: ExperimentStatus.DRAFT,
        target_page: input.targetPage,
        target_selector: input.targetSelector || null,
        traffic_allocation: input.trafficAllocation ?? 100,
        start_at: input.startAt?.toISOString() || null,
        end_at: input.endAt?.toISOString() || null,
        created_by: input.createdBy || null,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create experiment:', error);
      throw new Error(`Failed to create experiment: ${error.message}`);
    }

    return this.mapExperimentFromDb(data);
  }

  /**
   * Get experiment by ID
   */
  async getExperimentById(id: string): Promise<Experiment | null> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Failed to get experiment:', error);
      throw new Error(`Failed to get experiment: ${error.message}`);
    }

    return data ? this.mapExperimentFromDb(data) : null;
  }

  /**
   * Get experiments with filters
   */
  async getExperiments(options: ExperimentQueryOptions = {}): Promise<Experiment[]> {
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('experiments')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.targetPage) {
      query = query.eq('target_page', options.targetPage);
    }

    if (options.createdBy) {
      query = query.eq('created_by', options.createdBy);
    }

    if (options.search) {
      query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`);
    }

    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    const limit = options.limit || 50;
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      log.error('Failed to get experiments:', error);
      throw new Error(`Failed to get experiments: ${error.message}`);
    }

    return (data || []).map(this.mapExperimentFromDb);
  }

  /**
   * Update experiment
   */
  async updateExperiment(id: string, input: UpdateExperimentInput): Promise<Experiment> {
    const supabase = getSupabaseAdminClient();

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.targetPage !== undefined) updateData.target_page = input.targetPage;
    if (input.targetSelector !== undefined) updateData.target_selector = input.targetSelector;
    if (input.trafficAllocation !== undefined) updateData.traffic_allocation = input.trafficAllocation;
    if (input.startAt !== undefined) updateData.start_at = input.startAt?.toISOString() || null;
    if (input.endAt !== undefined) updateData.end_at = input.endAt?.toISOString() || null;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    const { data, error } = await supabase
      .from('experiments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      log.error('Failed to update experiment:', error);
      throw new Error(`Failed to update experiment: ${error.message}`);
    }

    return this.mapExperimentFromDb(data);
  }

  /**
   * Delete experiment
   */
  async deleteExperiment(id: string): Promise<void> {
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase.from('experiments').delete().eq('id', id);

    if (error) {
      log.error('Failed to delete experiment:', error);
      throw new Error(`Failed to delete experiment: ${error.message}`);
    }
  }

  // ============================================================
  // Variant CRUD
  // ============================================================

  /**
   * Create a variant
   */
  async createVariant(input: CreateVariantInput): Promise<ExperimentVariant> {
    const supabase = getSupabaseAdminClient();

    const id = crypto.randomUUID();

    const { data, error } = await supabase
      .from('experiment_variants')
      .insert({
        id,
        experiment_id: input.experimentId,
        name: input.name,
        key: input.key,
        description: input.description || null,
        traffic_weight: input.trafficWeight ?? 50,
        is_control: input.isControl ?? false,
        config: input.config || {},
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create variant:', error);
      throw new Error(`Failed to create variant: ${error.message}`);
    }

    return this.mapVariantFromDb(data);
  }

  /**
   * Get variant by ID
   */
  async getVariantById(id: string): Promise<ExperimentVariant | null> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('experiment_variants')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Failed to get variant:', error);
      throw new Error(`Failed to get variant: ${error.message}`);
    }

    return data ? this.mapVariantFromDb(data) : null;
  }

  /**
   * Get variants for an experiment
   */
  async getVariantsByExperimentId(experimentId: string): Promise<ExperimentVariant[]> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('experiment_variants')
      .select('*')
      .eq('experiment_id', experimentId)
      .order('key');

    if (error) {
      log.error('Failed to get variants:', error);
      throw new Error(`Failed to get variants: ${error.message}`);
    }

    return (data || []).map(this.mapVariantFromDb);
  }

  /**
   * Update variant
   */
  async updateVariant(id: string, input: UpdateVariantInput): Promise<ExperimentVariant> {
    const supabase = getSupabaseAdminClient();

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.trafficWeight !== undefined) updateData.traffic_weight = input.trafficWeight;
    if (input.config !== undefined) updateData.config = input.config;

    const { data, error } = await supabase
      .from('experiment_variants')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      log.error('Failed to update variant:', error);
      throw new Error(`Failed to update variant: ${error.message}`);
    }

    return this.mapVariantFromDb(data);
  }

  /**
   * Delete variant
   */
  async deleteVariant(id: string): Promise<void> {
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase.from('experiment_variants').delete().eq('id', id);

    if (error) {
      log.error('Failed to delete variant:', error);
      throw new Error(`Failed to delete variant: ${error.message}`);
    }
  }

  // ============================================================
  // Assignment Management
  // ============================================================

  /**
   * Assign a user/session to a variant
   */
  async assignVariant(
    experimentId: string,
    sessionId: string,
    userId?: string,
    deviceId?: string
  ): Promise<ExperimentVariant | null> {
    const supabase = getSupabaseAdminClient();

    // Call the database function to get or create assignment
    const { data, error } = await supabase.rpc('assign_experiment_variant', {
      p_experiment_id: experimentId,
      p_session_id: sessionId,
      p_user_id: userId || null,
      p_device_id: deviceId || null,
    });

    if (error) {
      log.error('Failed to assign variant:', error);
      throw new Error(`Failed to assign variant: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    // Get the variant details
    return this.getVariantById(data);
  }

  /**
   * Get assignment for a user/session
   */
  async getAssignment(
    experimentId: string,
    sessionId: string,
    userId?: string
  ): Promise<ExperimentAssignment | null> {
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('experiment_assignments')
      .select('*')
      .eq('experiment_id', experimentId);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Failed to get assignment:', error);
      throw new Error(`Failed to get assignment: ${error.message}`);
    }

    return data ? this.mapAssignmentFromDb(data) : null;
  }

  // ============================================================
  // Event Tracking
  // ============================================================

  /**
   * Track an event
   */
  async trackEvent(input: TrackEventInput): Promise<ExperimentEvent> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase.rpc('track_experiment_event', {
      p_experiment_id: input.experimentId,
      p_variant_id: input.variantId,
      p_session_id: input.sessionId,
      p_event_type: input.eventType,
      p_event_name: input.eventName || null,
      p_event_value: input.eventValue || null,
      p_properties: input.properties || {},
      p_user_id: input.userId || null,
    });

    if (error) {
      log.error('Failed to track event:', error);
      throw new Error(`Failed to track event: ${error.message}`);
    }

    // Get the created event
    const { data: eventData, error: fetchError } = await supabase
      .from('experiment_events')
      .select('*')
      .eq('id', data)
      .single();

    if (fetchError) {
      log.error('Failed to fetch tracked event:', fetchError);
      // Return minimal event data
      return {
        id: data,
        experimentId: input.experimentId,
        variantId: input.variantId,
        sessionId: input.sessionId,
        eventType: input.eventType,
        eventName: input.eventName,
        eventValue: input.eventValue,
        properties: input.properties || {},
        occurredAt: new Date(),
        userId: input.userId,
      };
    }

    return this.mapEventFromDb(eventData);
  }

  /**
   * Get events for an experiment
   */
  async getEvents(
    experimentId: string,
    options: {
      variantId?: string;
      eventType?: EventType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ExperimentEvent[]> {
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('experiment_events')
      .select('*')
      .eq('experiment_id', experimentId)
      .order('occurred_at', { ascending: false });

    if (options.variantId) {
      query = query.eq('variant_id', options.variantId);
    }

    if (options.eventType) {
      query = query.eq('event_type', options.eventType);
    }

    if (options.startDate) {
      query = query.gte('occurred_at', options.startDate.toISOString());
    }

    if (options.endDate) {
      query = query.lte('occurred_at', options.endDate.toISOString());
    }

    const limit = options.limit || 100;
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      log.error('Failed to get events:', error);
      throw new Error(`Failed to get events: ${error.message}`);
    }

    return (data || []).map(this.mapEventFromDb);
  }

  // ============================================================
  // Statistics and Analysis
  // ============================================================

  /**
   * Get experiment results with statistical analysis
   */
  async getExperimentResults(experimentId: string): Promise<VariantResult[]> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase.rpc('get_experiment_results', {
      p_experiment_id: experimentId,
    });

    if (error) {
      log.error('Failed to get experiment results:', error);
      throw new Error(`Failed to get experiment results: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      variantId: item.variant_id,
      variantKey: item.variant_key,
      variantName: item.variant_name,
      isControl: item.is_control,
      totalVisitors: item.total_visitors,
      totalConversions: item.total_conversions,
      conversionRate: item.conversion_rate,
      improvement: item.improvement,
      pValue: item.p_value,
      confidenceLower: item.confidence_lower,
      confidenceUpper: item.confidence_upper,
      isSignificant: item.is_significant,
      recommendation: item.recommendation,
    }));
  }

  /**
   * Calculate and store daily statistics
   */
  async calculateStatistics(experimentId: string, date?: Date): Promise<void> {
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase.rpc('calculate_experiment_stats', {
      p_experiment_id: experimentId,
      p_date: date ? date.toISOString().split('T')[0] : undefined,
    });

    if (error) {
      log.error('Failed to calculate statistics:', error);
      throw new Error(`Failed to calculate statistics: ${error.message}`);
    }
  }

  /**
   * Get statistics for an experiment
   */
  async getStatistics(
    experimentId: string,
    options: { startDate?: Date; endDate?: Date } = {}
  ): Promise<ExperimentStatistics[]> {
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('experiment_statistics')
      .select('*')
      .eq('experiment_id', experimentId)
      .order('date', { ascending: false });

    if (options.startDate) {
      query = query.gte('date', options.startDate.toISOString().split('T')[0]);
    }

    if (options.endDate) {
      query = query.lte('date', options.endDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) {
      log.error('Failed to get statistics:', error);
      throw new Error(`Failed to get statistics: ${error.message}`);
    }

    return (data || []).map(this.mapStatisticsFromDb);
  }

  // ============================================================
  // Mapping Functions
  // ============================================================

  private mapExperimentFromDb(data: any): Experiment {
    if (!data) {
      throw new Error('Cannot map null or undefined data to Experiment');
    }
    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      status: data.status as ExperimentStatus,
      targetPage: data.target_page,
      targetSelector: data.target_selector || undefined,
      trafficAllocation: data.traffic_allocation,
      startAt: data.start_at ? new Date(data.start_at) : undefined,
      endAt: data.end_at ? new Date(data.end_at) : undefined,
      createdBy: data.created_by || undefined,
      metadata: data.metadata || {},
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapVariantFromDb(data: any): ExperimentVariant {
    if (!data) {
      throw new Error('Cannot map null or undefined data to ExperimentVariant');
    }
    return {
      id: data.id,
      experimentId: data.experiment_id,
      name: data.name,
      key: data.key,
      description: data.description || undefined,
      trafficWeight: data.traffic_weight,
      isControl: data.is_control,
      config: data.config || {},
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapAssignmentFromDb(data: any): ExperimentAssignment {
    return {
      id: data.id,
      experimentId: data.experiment_id,
      variantId: data.variant_id,
      userId: data.user_id || undefined,
      sessionId: data.session_id,
      deviceId: data.device_id || undefined,
      assignedAt: new Date(data.assigned_at),
    };
  }

  private mapEventFromDb(data: any): ExperimentEvent {
    return {
      id: data.id,
      experimentId: data.experiment_id,
      variantId: data.variant_id,
      userId: data.user_id || undefined,
      sessionId: data.session_id,
      eventType: data.event_type as EventType,
      eventName: data.event_name || undefined,
      eventValue: data.event_value || undefined,
      properties: data.properties || {},
      occurredAt: new Date(data.occurred_at),
    };
  }

  private mapStatisticsFromDb(data: any): ExperimentStatistics {
    return {
      id: data.id,
      experimentId: data.experiment_id,
      variantId: data.variant_id,
      date: new Date(data.date),
      impressions: data.impressions,
      clicks: data.clicks,
      conversions: data.conversions,
      uniqueVisitors: data.unique_visitors,
      conversionRate: data.conversion_rate,
      clickRate: data.click_rate,
      avgSessionDuration: data.avg_session_duration_seconds || undefined,
      bounceRate: data.bounce_rate || undefined,
      chiSquare: data.chi_square || undefined,
      pValue: data.p_value || undefined,
      confidenceIntervalLower: data.confidence_interval_lower || undefined,
      confidenceIntervalUpper: data.confidence_interval_upper || undefined,
      isSignificant: data.is_significant || false,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

// Singleton instance
export const experimentDAO = new ExperimentDAO();
export default experimentDAO;