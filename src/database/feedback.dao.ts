/**
 * Feedback DAO - User Feedback Data Access Layer
 * Handles database operations for user feedback, status tracking, and analytics
 */

import { getSupabaseClient } from './client';

/**
 * FeedbackType - 反馈类型
 */
export type FeedbackType = 'feature_request' | 'bug_report' | 'other';

/**
 * FeedbackStatus - 反馈状态
 */
export type FeedbackStatus = 'pending' | 'in_progress' | 'resolved' | 'closed';

/**
 * SentimentType - 情感类型
 */
export type SentimentType = 'positive' | 'neutral' | 'negative';

/**
 * UserFeedback - 用户反馈
 */
export interface UserFeedback {
  id: string;
  userId: string;
  type: FeedbackType;
  status: FeedbackStatus;
  title: string;
  content: string;
  images: string[];
  sentiment?: SentimentType;
  sentimentScore?: number;
  tags: string[];
  adminReply?: string;
  adminReplyBy?: string;
  adminReplyAt?: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  isReadByAdmin: boolean;
  // Joined fields from users
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  adminUsername?: string;
  adminDisplayName?: string;
}

/**
 * FeedbackStatusHistory - 状态变更历史
 */
export interface FeedbackStatusHistory {
  id: string;
  feedbackId: string;
  oldStatus?: FeedbackStatus;
  newStatus: FeedbackStatus;
  changedBy?: string;
  changedAt: Date;
  note?: string;
}

/**
 * FeedbackStatistics - 反馈统计
 */
export interface FeedbackStatistics {
  totalFeedback: number;
  pendingCount: number;
  inProgressCount: number;
  resolvedCount: number;
  closedCount: number;
  featureRequestCount: number;
  bugReportCount: number;
  otherCount: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  avgSentimentScore?: number;
}

/**
 * HotTopic - 热门话题
 */
export interface HotTopic {
  tag: string;
  occurrenceCount: number;
  recentCount: number;
}

/**
 * Create feedback input
 */
export interface CreateFeedbackInput {
  userId: string;
  type: FeedbackType;
  title: string;
  content: string;
  images?: string[];
}

/**
 * Update feedback input (for users)
 */
export interface UpdateFeedbackInput {
  title?: string;
  content?: string;
  images?: string[];
}

/**
 * Admin update feedback input
 */
export interface AdminUpdateFeedbackInput {
  status?: FeedbackStatus;
  adminReply?: string;
  sentiment?: SentimentType;
  sentimentScore?: number;
  tags?: string[];
  isReadByAdmin?: boolean;
}

/**
 * Feedback list options
 */
export interface FeedbackListOptions {
  userId?: string;
  type?: FeedbackType;
  status?: FeedbackStatus;
  sentiment?: SentimentType;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'newest' | 'oldest' | 'status' | 'sentiment';
  isAdmin?: boolean;
}

/**
 * Feedback DAO - 反馈数据访问层
 */
export class FeedbackDAO {
  /**
   * Create a new feedback
   */
  async createFeedback(input: CreateFeedbackInput): Promise<UserFeedback> {
    const supabase = getSupabaseClient();
    
    // Perform simple sentiment analysis
    const { sentiment, sentimentScore } = this.analyzeSentiment(input.content + ' ' + input.title);
    
    // Extract tags from content
    const tags = this.extractTags(input.content + ' ' + input.title);

    const { data, error } = await supabase
      .from('user_feedback')
      .insert([{
        user_id: input.userId,
        type: input.type,
        title: input.title,
        content: input.content,
        images: input.images || [],
        sentiment,
        sentiment_score: sentimentScore,
        tags,
      }])
      .select(`
        *,
        user:app_users!user_feedback_user_id_fkey(username, display_name, avatar_url)
      `)
      .single();

    if (error) throw error;
    return this.mapToFeedback(data);
  }

  /**
   * Get feedback by ID
   */
  async getFeedbackById(id: string, userId?: string, isAdmin: boolean = false): Promise<UserFeedback | null> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('user_feedback')
      .select(`
        *,
        user:app_users!user_feedback_user_id_fkey(username, display_name, avatar_url),
        admin:app_users!user_feedback_admin_reply_by_fkey(username, display_name)
      `)
      .eq('id', id);

    // If not admin, only allow viewing own feedback
    if (!isAdmin && userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToFeedback(data);
  }

  /**
   * Get feedback list
   */
  async getFeedbacks(options: FeedbackListOptions): Promise<{ feedbacks: UserFeedback[]; total: number }> {
    const supabase = getSupabaseClient();
    const {
      userId,
      type,
      status,
      sentiment,
      search,
      limit = 20,
      offset = 0,
      sortBy = 'newest',
      isAdmin = false,
    } = options;

    let query = supabase
      .from('user_feedback')
      .select(`
        *,
        user:app_users!user_feedback_user_id_fkey(username, display_name, avatar_url),
        admin:app_users!user_feedback_admin_reply_by_fkey(username, display_name)
      `, { count: 'exact' });

    // Non-admin users can only see their own feedback
    if (!isAdmin && userId) {
      query = query.eq('user_id', userId);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (sentiment) {
      query = query.eq('sentiment', sentiment);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    switch (sortBy) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'status':
        query = query.order('status', { ascending: true });
        query = query.order('created_at', { ascending: false });
        break;
      case 'sentiment':
        query = query.order('sentiment_score', { ascending: true });
        query = query.order('created_at', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      feedbacks: (data || []).map((row: any) => this.mapToFeedback(row)),
      total: count || 0,
    };
  }

  /**
   * Update feedback (user can only update title/content before admin reply)
   */
  async updateFeedback(id: string, userId: string, input: UpdateFeedbackInput): Promise<UserFeedback> {
    const supabase = getSupabaseClient();

    // Check if feedback exists and belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from('user_feedback')
      .select('id, user_id, admin_reply')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new Error('Feedback not found');
    }

    if (existing.user_id !== userId) {
      throw new Error('Not authorized to update this feedback');
    }

    if (existing.admin_reply) {
      throw new Error('Cannot update feedback after admin reply');
    }

    // Re-analyze sentiment if content changed
    const updates: Record<string, any> = {};
    if (input.title !== undefined) {
      updates.title = input.title;
    }
    if (input.content !== undefined) {
      updates.content = input.content;
      const { sentiment, sentimentScore } = this.analyzeSentiment(
        (input.title || '') + ' ' + input.content
      );
      updates.sentiment = sentiment;
      updates.sentiment_score = sentimentScore;
      updates.tags = this.extractTags(input.content);
    }
    if (input.images !== undefined) {
      updates.images = input.images;
    }

    const { data, error } = await supabase
      .from('user_feedback')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        *,
        user:app_users!user_feedback_user_id_fkey(username, display_name, avatar_url)
      `)
      .single();

    if (error) throw error;
    return this.mapToFeedback(data);
  }

  /**
   * Admin update feedback (status, reply, etc.)
   */
  async adminUpdateFeedback(
    id: string,
    adminId: string,
    input: AdminUpdateFeedbackInput
  ): Promise<UserFeedback> {
    const supabase = getSupabaseClient();

    const updates: Record<string, any> = {};

    if (input.status !== undefined) {
      updates.status = input.status;
      if (input.status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = adminId;
      }
    }

    if (input.adminReply !== undefined) {
      updates.admin_reply = input.adminReply;
      updates.admin_reply_by = adminId;
      updates.admin_reply_at = new Date().toISOString();
    }

    if (input.sentiment !== undefined) {
      updates.sentiment = input.sentiment;
    }

    if (input.sentimentScore !== undefined) {
      updates.sentiment_score = input.sentimentScore;
    }

    if (input.tags !== undefined) {
      updates.tags = input.tags;
    }

    if (input.isReadByAdmin !== undefined) {
      updates.is_read_by_admin = input.isReadByAdmin;
    }

    const { data, error } = await supabase
      .from('user_feedback')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        user:app_users!user_feedback_user_id_fkey(username, display_name, avatar_url),
        admin:app_users!user_feedback_admin_reply_by_fkey(username, display_name)
      `)
      .single();

    if (error) throw error;
    return this.mapToFeedback(data);
  }

  /**
   * Delete feedback (user can only delete pending feedback)
   */
  async deleteFeedback(id: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { data: existing, error: fetchError } = await supabase
      .from('user_feedback')
      .select('id, user_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new Error('Feedback not found');
    }

    if (existing.user_id !== userId) {
      throw new Error('Not authorized to delete this feedback');
    }

    if (existing.status !== 'pending') {
      throw new Error('Cannot delete feedback that is already being processed');
    }

    const { error } = await supabase
      .from('user_feedback')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Get status history for a feedback
   */
  async getStatusHistory(feedbackId: string): Promise<FeedbackStatusHistory[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('feedback_status_history')
      .select('*')
      .eq('feedback_id', feedbackId)
      .order('changed_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row: any) => this.mapToStatusHistory(row));
  }

  /**
   * Get feedback statistics
   */
  async getStatistics(): Promise<FeedbackStatistics> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('feedback_statistics')
      .select('*')
      .limit(1)
      .single();

    if (error) throw error;
    
    return {
      totalFeedback: data.total_feedback || 0,
      pendingCount: data.pending_count || 0,
      inProgressCount: data.in_progress_count || 0,
      resolvedCount: data.resolved_count || 0,
      closedCount: data.closed_count || 0,
      featureRequestCount: data.feature_request_count || 0,
      bugReportCount: data.bug_report_count || 0,
      otherCount: data.other_count || 0,
      positiveCount: data.positive_count || 0,
      neutralCount: data.neutral_count || 0,
      negativeCount: data.negative_count || 0,
      avgSentimentScore: data.avg_sentiment_score,
    };
  }

  /**
   * Get hot topics
   */
  async getHotTopics(): Promise<HotTopic[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('feedback_hot_topics')
      .select('*')
      .limit(20);

    if (error) throw error;
    
    return (data || []).map((row: any) => ({
      tag: row.tag,
      occurrenceCount: row.occurrence_count || 0,
      recentCount: row.recent_count || 0,
    }));
  }

  /**
   * Mark feedback as read by admin
   */
  async markAsReadByAdmin(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('user_feedback')
      .update({ is_read_by_admin: true })
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Get unread count for admin
   */
  async getUnreadCountForAdmin(): Promise<number> {
    const supabase = getSupabaseClient();

    const { count, error } = await supabase
      .from('user_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('is_read_by_admin', false);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Get feedback count by type for a user
   */
  async getUserFeedbackCount(userId: string): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
    closed: number;
  }> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_feedback')
      .select('status')
      .eq('user_id', userId);

    if (error) throw error;

    const result = {
      total: data?.length || 0,
      pending: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0,
    };

    data?.forEach((row: any) => {
      if (row.status === 'pending') result.pending++;
      else if (row.status === 'in_progress') result.inProgress++;
      else if (row.status === 'resolved') result.resolved++;
      else if (row.status === 'closed') result.closed++;
    });

    return result;
  }

  // ============ Private Helpers ============

  private mapToFeedback(row: any): UserFeedback {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      status: row.status,
      title: row.title,
      content: row.content,
      images: row.images || [],
      sentiment: row.sentiment,
      sentimentScore: row.sentiment_score,
      tags: row.tags || [],
      adminReply: row.admin_reply || undefined,
      adminReplyBy: row.admin_reply_by || undefined,
      adminReplyAt: row.admin_reply_at ? new Date(row.admin_reply_at) : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      resolvedBy: row.resolved_by || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isReadByAdmin: row.is_read_by_admin || false,
      username: row.user?.username,
      displayName: row.user?.display_name,
      avatarUrl: row.user?.avatar_url,
      adminUsername: row.admin?.username,
      adminDisplayName: row.admin?.display_name,
    };
  }

  private mapToStatusHistory(row: any): FeedbackStatusHistory {
    return {
      id: row.id,
      feedbackId: row.feedback_id,
      oldStatus: row.old_status,
      newStatus: row.new_status,
      changedBy: row.changed_by || undefined,
      changedAt: new Date(row.changed_at),
      note: row.note || undefined,
    };
  }

  /**
   * Simple sentiment analysis based on keywords
   * In production, this could be replaced with ML-based analysis
   */
  private analyzeSentiment(text: string): { sentiment: SentimentType; sentimentScore: number } {
    const positiveWords = [
      'great', 'good', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'awesome',
      'helpful', 'useful', 'nice', 'perfect', 'best', 'thank', 'thanks', 'appreciate',
      '好', '很好', '优秀', '棒', '喜欢', '感谢', '谢谢', '满意', '推荐', '方便', '好用'
    ];
    
    const negativeWords = [
      'bad', 'terrible', 'awful', 'horrible', 'hate', 'disappointing', 'frustrating',
      'broken', 'bug', 'issue', 'problem', 'error', 'fail', 'crash', 'slow', 'difficult',
      '差', '坏', '问题', '错误', '崩溃', '慢', '难用', '失望', '垃圾', '糟糕', '讨厌'
    ];

    const lowerText = text.toLowerCase();
    let score = 0;

    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score += 1;
    });

    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score -= 1;
    });

    // Normalize score to -1 to 1 range
    const normalizedScore = Math.max(-1, Math.min(1, score / 3));

    let sentiment: SentimentType;
    if (normalizedScore > 0.2) {
      sentiment = 'positive';
    } else if (normalizedScore < -0.2) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }

    return { sentiment, sentimentScore: normalizedScore };
  }

  /**
   * Extract tags from text based on common patterns
   */
  private extractTags(text: string): string[] {
    const tags: string[] = [];
    const lowerText = text.toLowerCase();

    // UI/UX related
    if (lowerText.includes('ui') || lowerText.includes('界面') || lowerText.includes('显示')) {
      tags.push('ui');
    }
    if (lowerText.includes('ux') || lowerText.includes('体验') || lowerText.includes('易用')) {
      tags.push('ux');
    }

    // Feature related
    if (lowerText.includes('feature') || lowerText.includes('功能') || lowerText.includes('新功能')) {
      tags.push('feature');
    }
    if (lowerText.includes('improve') || lowerText.includes('改进') || lowerText.includes('优化')) {
      tags.push('improvement');
    }

    // Performance related
    if (lowerText.includes('slow') || lowerText.includes('性能') || lowerText.includes('速度') || lowerText.includes('卡顿')) {
      tags.push('performance');
    }

    // Bug related
    if (lowerText.includes('bug') || lowerText.includes('error') || lowerText.includes('错误') || lowerText.includes('崩溃')) {
      tags.push('bug');
    }

    // Mobile/Desktop
    if (lowerText.includes('mobile') || lowerText.includes('手机') || lowerText.includes('移动')) {
      tags.push('mobile');
    }
    if (lowerText.includes('desktop') || lowerText.includes('桌面') || lowerText.includes('电脑')) {
      tags.push('desktop');
    }

    // Trading related
    if (lowerText.includes('trade') || lowerText.includes('trading') || lowerText.includes('交易') || lowerText.includes('订单')) {
      tags.push('trading');
    }
    if (lowerText.includes('strategy') || lowerText.includes('策略')) {
      tags.push('strategy');
    }
    if (lowerText.includes('chart') || lowerText.includes('图表') || lowerText.includes('k线')) {
      tags.push('chart');
    }

    // Account related
    if (lowerText.includes('account') || lowerText.includes('账户') || lowerText.includes('登录')) {
      tags.push('account');
    }
    if (lowerText.includes('notification') || lowerText.includes('通知') || lowerText.includes('提醒')) {
      tags.push('notification');
    }

    return [...new Set(tags)]; // Remove duplicates
  }
}

export const feedbackDAO = new FeedbackDAO();