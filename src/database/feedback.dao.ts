/**
 * Feedback DAO
 *
 * Data access layer for user feedback management
 *
 * @module database/feedback.dao
 */

import { getSupabaseAdminClient } from './client';
import { createLogger } from '../utils/logger';

const log = createLogger('FeedbackDAO');

// Feedback types
export enum FeedbackType {
  BUG = 'bug',
  SUGGESTION = 'suggestion',
  OTHER = 'other',
}

// Feedback status
export enum FeedbackStatus {
  NEW = 'new',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

// Feedback priority
export enum FeedbackPriority {
  P0 = 'p0', // Critical/Urgent
  P1 = 'p1', // High
  P2 = 'p2', // Medium
  P3 = 'p3', // Low
}

// Feedback interface
export interface Feedback {
  id: string;
  userId?: string;
  type: FeedbackType;
  description: string;
  screenshot?: string;
  screenshotName?: string;
  contactInfo?: string;
  environment: {
    url: string;
    userAgent: string;
    screenSize: string;
    timestamp: string;
    locale: string;
    referrer: string;
  };
  status: FeedbackStatus;
  priority?: FeedbackPriority;
  tags?: string[];
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Create feedback input
export interface CreateFeedbackInput {
  userId?: string;
  type: FeedbackType;
  description: string;
  screenshot?: string;
  screenshotName?: string;
  contactInfo?: string;
  environment: Feedback['environment'];
}

// Update feedback input
export interface UpdateFeedbackInput {
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
  tags?: string[];
  adminNotes?: string;
}

// Query options
export interface FeedbackQueryOptions {
  status?: FeedbackStatus;
  type?: FeedbackType;
  priority?: FeedbackPriority;
  userId?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Feedback Data Access Object
 */
class FeedbackDAO {
  /**
   * Create a new feedback
   */
  async createFeedback(input: CreateFeedbackInput): Promise<Feedback> {
    const supabase = getSupabaseAdminClient();
    
    // Generate unique ID
    const id = `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data, error } = await supabase
      .from('feedbacks')
      .insert({
        id,
        user_id: input.userId,
        type: input.type,
        description: input.description,
        screenshot: input.screenshot,
        screenshot_name: input.screenshotName,
        contact_info: input.contactInfo,
        environment: input.environment,
        status: FeedbackStatus.NEW,
      })
      .select()
      .single();
    
    if (error) {
      log.error('Failed to create feedback:', error);
      throw new Error(`Failed to create feedback: ${error.message}`);
    }
    
    return this.mapFeedbackFromDb(data);
  }

  /**
   * Get feedback by ID
   */
  async getFeedbackById(id: string): Promise<Feedback | null> {
    const supabase = getSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('feedbacks')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Failed to get feedback:', error);
      throw new Error(`Failed to get feedback: ${error.message}`);
    }
    
    return data ? this.mapFeedbackFromDb(data) : null;
  }

  /**
   * Get feedbacks with filters
   */
  async getFeedbacks(options: FeedbackQueryOptions = {}): Promise<Feedback[]> {
    const supabase = getSupabaseAdminClient();
    
    let query = supabase
      .from('feedbacks')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
    
    if (options.status) {
      query = query.eq('status', options.status);
    }
    
    if (options.type) {
      query = query.eq('type', options.type);
    }

    if (options.priority) {
      query = query.eq('priority', options.priority);
    }
    
    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }

    if (options.search) {
      query = query.or(`description.ilike.%${options.search}%,contact_info.ilike.%${options.search}%`);
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
      log.error('Failed to get feedbacks:', error);
      throw new Error(`Failed to get feedbacks: ${error.message}`);
    }
    
    return (data || []).map(this.mapFeedbackFromDb);
  }

  /**
   * Update feedback
   */
  async updateFeedback(id: string, input: UpdateFeedbackInput): Promise<Feedback> {
    const supabase = getSupabaseAdminClient();
    
    const updateData: any = {};
    if (input.status !== undefined) updateData.status = input.status;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.adminNotes !== undefined) updateData.admin_notes = input.adminNotes;
    
    const { data, error } = await supabase
      .from('feedbacks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      log.error('Failed to update feedback:', error);
      throw new Error(`Failed to update feedback: ${error.message}`);
    }
    
    return this.mapFeedbackFromDb(data);
  }

  /**
   * Delete feedback
   */
  async deleteFeedback(id: string): Promise<void> {
    const supabase = getSupabaseAdminClient();
    
    const { error } = await supabase
      .from('feedbacks')
      .delete()
      .eq('id', id);
    
    if (error) {
      log.error('Failed to delete feedback:', error);
      throw new Error(`Failed to delete feedback: ${error.message}`);
    }
  }

  /**
   * Get feedback statistics
   */
  async getFeedbackStats(): Promise<{
    total: number;
    byType: Record<FeedbackType, number>;
    byStatus: Record<FeedbackStatus, number>;
    byPriority: Record<FeedbackPriority, number>;
  }> {
    const supabase = getSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('feedbacks')
      .select('type, status, priority');
    
    if (error) {
      log.error('Failed to get feedback stats:', error);
      throw new Error(`Failed to get feedback stats: ${error.message}`);
    }
    
    const stats = {
      total: data?.length || 0,
      byType: {
        [FeedbackType.BUG]: 0,
        [FeedbackType.SUGGESTION]: 0,
        [FeedbackType.OTHER]: 0,
      },
      byStatus: {
        [FeedbackStatus.NEW]: 0,
        [FeedbackStatus.CONFIRMED]: 0,
        [FeedbackStatus.IN_PROGRESS]: 0,
        [FeedbackStatus.RESOLVED]: 0,
        [FeedbackStatus.CLOSED]: 0,
      },
      byPriority: {
        [FeedbackPriority.P0]: 0,
        [FeedbackPriority.P1]: 0,
        [FeedbackPriority.P2]: 0,
        [FeedbackPriority.P3]: 0,
      },
    };
    
    data?.forEach((item: any) => {
      if (item.type && stats.byType[item.type as FeedbackType] !== undefined) {
        stats.byType[item.type as FeedbackType]++;
      }
      if (item.status && stats.byStatus[item.status as FeedbackStatus] !== undefined) {
        stats.byStatus[item.status as FeedbackStatus]++;
      }
      if (item.priority && stats.byPriority[item.priority as FeedbackPriority] !== undefined) {
        stats.byPriority[item.priority as FeedbackPriority]++;
      }
    });
    
    return stats;
  }

  /**
   * Map database record to Feedback object
   */
  private mapFeedbackFromDb(data: any): Feedback {
    if (!data) {
      throw new Error('Cannot map null or undefined data to Feedback');
    }
    return {
      id: data.id,
      userId: data.user_id || undefined,
      type: data.type as FeedbackType,
      description: data.description,
      screenshot: data.screenshot || undefined,
      screenshotName: data.screenshot_name || undefined,
      contactInfo: data.contact_info || undefined,
      environment: data.environment || {},
      status: data.status as FeedbackStatus,
      priority: data.priority as FeedbackPriority || undefined,
      tags: data.tags || [],
      adminNotes: data.admin_notes || undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

// Singleton instance
export const feedbackDAO = new FeedbackDAO();
export default feedbackDAO;