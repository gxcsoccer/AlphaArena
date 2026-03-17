/**
 * Comment DAO - Strategy Comments Data Access Layer
 * Handles database operations for strategy comments, likes, and reports
 */

import { getSupabaseClient } from './client';

/**
 * StrategyComment - 策略评论
 */
export interface StrategyComment {
  id: string;
  strategyId: string;
  userId: string;
  parentId?: string;
  content: string;
  contentHtml?: string;
  likesCount: number;
  repliesCount: number;
  isEdited: boolean;
  isDeleted: boolean;
  isPinned: boolean;
  isHidden: boolean;
  reportedCount: number;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields from users
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  // Nested replies
  replies?: StrategyComment[];
  // Current user's like status
  isLikedByUser?: boolean;
}

/**
 * CommentLike - 评论点赞
 */
export interface CommentLike {
  id: string;
  commentId: string;
  userId: string;
  createdAt: Date;
}

/**
 * CommentReport - 评论举报
 */
export interface CommentReport {
  id: string;
  commentId: string;
  reporterId: string;
  reason: 'spam' | 'abuse' | 'inappropriate' | 'other';
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: Date;
}

/**
 * Create comment input
 */
export interface CreateCommentInput {
  strategyId: string;
  userId: string;
  parentId?: string;
  content: string;
}

/**
 * Update comment input
 */
export interface UpdateCommentInput {
  content: string;
}

/**
 * Comment list options
 */
export interface CommentListOptions {
  strategyId: string;
  parentId?: string | null;
  sortBy?: 'newest' | 'oldest' | 'likes';
  limit?: number;
  offset?: number;
  currentUserId?: string;
  includeDeleted?: boolean;
}

/**
 * Comments DAO - 评论数据访问层
 */
export class CommentsDAO {
  /**
   * Create a new comment
   */
  async createComment(input: CreateCommentInput): Promise<StrategyComment> {
    const supabase = getSupabaseClient();
    const contentHtml = this.markdownToHtml(input.content);

    const { data, error } = await supabase
      .from('strategy_comments')
      .insert([{
        strategy_id: input.strategyId,
        user_id: input.userId,
        parent_id: input.parentId || null,
        content: input.content,
        content_html: contentHtml,
      }])
      .select()
      .single();

    if (error) throw error;
    return this.mapToComment(data);
  }

  /**
   * Get comment by ID
   */
  async getCommentById(id: string, currentUserId?: string): Promise<StrategyComment | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_comments')
      .select(`
        *,
        user:app_users!strategy_comments_user_id_fkey(username, display_name, avatar_url)
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    const comment = this.mapToComment(data);
    
    if (currentUserId) {
      comment.isLikedByUser = await this.isUserLikedComment(id, currentUserId);
    }

    return comment;
  }

  /**
   * Get comments for a strategy
   */
  async getComments(options: CommentListOptions): Promise<{ comments: StrategyComment[]; total: number }> {
    const supabase = getSupabaseClient();
    const {
      strategyId,
      parentId,
      sortBy = 'newest',
      limit = 20,
      offset = 0,
      currentUserId,
      includeDeleted = false,
    } = options;

    let query = supabase
      .from('strategy_comments')
      .select(`
        *,
        user:app_users!strategy_comments_user_id_fkey(username, display_name, avatar_url)
      `, { count: 'exact' })
      .eq('strategy_id', strategyId)
      .eq('is_hidden', false);

    if (parentId === null || parentId === undefined) {
      query = query.is('parent_id', null);
    } else {
      query = query.eq('parent_id', parentId);
    }

    if (!includeDeleted) {
      query = query.eq('is_deleted', false);
    }

    switch (sortBy) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'likes':
        query = query.order('likes_count', { ascending: false });
        query = query.order('created_at', { ascending: false });
        break;
      default:
        query = query.order('is_pinned', { ascending: false });
        query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const comments = data.map((row: any) => this.mapToComment(row));

    if (currentUserId && comments.length > 0) {
      const commentIds = comments.map((c) => c.id);
      const { data: likes } = await supabase
        .from('strategy_comment_likes')
        .select('comment_id')
        .eq('user_id', currentUserId)
        .in('comment_id', commentIds);

      const likedCommentIds = new Set(likes?.map((l: any) => l.comment_id) || []);
      comments.forEach((c) => {
        c.isLikedByUser = likedCommentIds.has(c.id);
      });
    }

    return { comments, total: count || 0 };
  }

  /**
   * Get replies for a comment
   */
  async getReplies(
    commentId: string,
    options: { limit?: number; offset?: number; currentUserId?: string } = {}
  ): Promise<{ replies: StrategyComment[]; total: number }> {
    const { comments, total } = await this.getComments({
      strategyId: '',
      parentId: commentId,
      sortBy: 'oldest',
      limit: options.limit || 10,
      offset: options.offset || 0,
      currentUserId: options.currentUserId,
    });

    return { replies: comments, total };
  }

  /**
   * Update a comment
   */
  async updateComment(id: string, userId: string, input: UpdateCommentInput): Promise<StrategyComment> {
    const supabase = getSupabaseClient();
    const contentHtml = this.markdownToHtml(input.content);

    const { data, error } = await supabase
      .from('strategy_comments')
      .update({
        content: input.content,
        content_html: contentHtml,
        is_edited: true,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Comment not found or not authorized');

    return this.mapToComment(data);
  }

  /**
   * Soft delete a comment
   */
  async deleteComment(id: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('strategy_comments')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Like a comment
   */
  async likeComment(commentId: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { data: existing } = await supabase
      .from('strategy_comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      throw new Error('Already liked this comment');
    }

    const { error } = await supabase
      .from('strategy_comment_likes')
      .insert([{ comment_id: commentId, user_id: userId }]);

    if (error) throw error;
  }

  /**
   * Unlike a comment
   */
  async unlikeComment(commentId: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('strategy_comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Check if user liked a comment
   */
  async isUserLikedComment(commentId: string, userId: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    const { data } = await supabase
      .from('strategy_comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .single();

    return !!data;
  }

  /**
   * Toggle like on a comment
   */
  async toggleLike(commentId: string, userId: string): Promise<{ liked: boolean }> {
    const isLiked = await this.isUserLikedComment(commentId, userId);

    if (isLiked) {
      await this.unlikeComment(commentId, userId);
      return { liked: false };
    } else {
      await this.likeComment(commentId, userId);
      return { liked: true };
    }
  }

  /**
   * Get users who liked a comment
   */
  async getCommentLikes(
    commentId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ users: Array<{ id: string; username: string; displayName?: string; avatarUrl?: string }>; total: number }> {
    const supabase = getSupabaseClient();

    const { data, error, count } = await supabase
      .from('strategy_comment_likes')
      .select(`
        user_id,
        created_at,
        user:app_users!strategy_comment_likes_user_id_fkey(id, username, display_name, avatar_url)
      `, { count: 'exact' })
      .eq('comment_id', commentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const users = (data || []).map((row: any) => ({
      id: row.user_id,
      username: row.user?.username || 'unknown',
      displayName: row.user?.display_name,
      avatarUrl: row.user?.avatar_url,
    }));

    return { users, total: count || 0 };
  }

  /**
   * Report a comment
   */
  async reportComment(
    commentId: string,
    reporterId: string,
    reason: CommentReport['reason'],
    description?: string
  ): Promise<CommentReport> {
    const supabase = getSupabaseClient();

    const { data: existing } = await supabase
      .from('strategy_comment_reports')
      .select('id')
      .eq('comment_id', commentId)
      .eq('reporter_id', reporterId)
      .single();

    if (existing) {
      throw new Error('Already reported this comment');
    }

    const { data, error } = await supabase
      .from('strategy_comment_reports')
      .insert([{
        comment_id: commentId,
        reporter_id: reporterId,
        reason,
        description,
      }])
      .select()
      .single();

    if (error) throw error;
    return this.mapToReport(data);
  }

  /**
   * Get reports (for moderators)
   */
  async getReports(
    status?: CommentReport['status'],
    limit: number = 50,
    offset: number = 0
  ): Promise<{ reports: CommentReport[]; total: number }> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('strategy_comment_reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      reports: (data || []).map((row: any) => this.mapToReport(row)),
      total: count || 0,
    };
  }

  /**
   * Moderate a comment
   */
  async moderateComment(
    commentId: string,
    action: 'hide' | 'show' | 'pin' | 'unpin',
    moderatorId: string
  ): Promise<StrategyComment> {
    const supabase = getSupabaseClient();

    const updates: Record<string, boolean> = {};
    switch (action) {
      case 'hide':
        updates.is_hidden = true;
        break;
      case 'show':
        updates.is_hidden = false;
        break;
      case 'pin':
        updates.is_pinned = true;
        break;
      case 'unpin':
        updates.is_pinned = false;
        break;
    }

    const { data, error } = await supabase
      .from('strategy_comments')
      .update({
        ...updates,
        moderated_at: new Date().toISOString(),
        moderated_by: moderatorId,
      })
      .eq('id', commentId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToComment(data);
  }

  /**
   * Get comment count for a strategy
   */
  async getCommentCount(strategyId: string): Promise<number> {
    const supabase = getSupabaseClient();

    const { count, error } = await supabase
      .from('strategy_comments')
      .select('*', { count: 'exact', head: true })
      .eq('strategy_id', strategyId)
      .eq('is_deleted', false)
      .eq('is_hidden', false);

    if (error) throw error;
    return count || 0;
  }

  // ============ Private Helpers ============

  private mapToComment(row: any): StrategyComment {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      userId: row.user_id,
      parentId: row.parent_id || undefined,
      content: row.content,
      contentHtml: row.content_html,
      likesCount: row.likes_count || 0,
      repliesCount: row.replies_count || 0,
      isEdited: row.is_edited || false,
      isDeleted: row.is_deleted || false,
      isPinned: row.is_pinned || false,
      isHidden: row.is_hidden || false,
      reportedCount: row.reported_count || 0,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      username: row.user?.username,
      displayName: row.user?.display_name,
      avatarUrl: row.user?.avatar_url,
    };
  }

  private mapToReport(row: any): CommentReport {
    return {
      id: row.id,
      commentId: row.comment_id,
      reporterId: row.reporter_id,
      reason: row.reason,
      description: row.description,
      status: row.status,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
      reviewedBy: row.reviewed_by || undefined,
      reviewNote: row.review_note || undefined,
      createdAt: new Date(row.created_at),
    };
  }

  private markdownToHtml(markdown: string): string {
    if (!markdown) return '';

    let html = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    html = '<p>' + html + '</p>';

    return html;
  }
}

export const commentsDAO = new CommentsDAO();
