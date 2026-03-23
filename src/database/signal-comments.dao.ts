/**
 * Signal Comment DAO - Trading Signal Comments Data Access Layer
 * Handles database operations for signal comments, likes, and reports
 */

import { getSupabaseClient } from './client';
import { marked } from 'marked';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Initialize DOMPurify with a virtual DOM for server-side use
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window as any);

/**
 * SignalComment - 信号评论
 */
export interface SignalComment {
  id: string;
  signalId: string;
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
  replies?: SignalComment[];
  // Current user's like status
  isLikedByUser?: boolean;
}

/**
 * CommentLike - 评论点赞
 */
export interface SignalCommentLike {
  id: string;
  commentId: string;
  userId: string;
  createdAt: Date;
}

/**
 * CommentReport - 评论举报
 */
export interface SignalCommentReport {
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
export interface CreateSignalCommentInput {
  signalId: string;
  userId: string;
  parentId?: string;
  content: string;
}

/**
 * Update comment input
 */
export interface UpdateSignalCommentInput {
  content: string;
}

/**
 * Comment list options
 */
export interface SignalCommentListOptions {
  signalId: string;
  parentId?: string | null;
  sortBy?: 'newest' | 'oldest' | 'likes';
  limit?: number;
  offset?: number;
  currentUserId?: string;
  includeDeleted?: boolean;
}

/**
 * Signal Comments DAO - 信号评论数据访问层
 */
export class SignalCommentsDAO {
  /**
   * Create a new comment
   */
  async createComment(input: CreateSignalCommentInput): Promise<SignalComment> {
    const supabase = getSupabaseClient();
    const contentHtml = this.markdownToHtml(input.content);

    const { data, error } = await supabase
      .from('signal_comments')
      .insert([{
        signal_id: input.signalId,
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
  async getCommentById(id: string, currentUserId?: string): Promise<SignalComment | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('signal_comments')
      .select(`
        *,
        user:app_users!signal_comments_user_id_fkey(username, display_name, avatar_url)
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
   * Get comments for a signal
   */
  async getComments(options: SignalCommentListOptions): Promise<{ comments: SignalComment[]; total: number }> {
    const supabase = getSupabaseClient();
    const {
      signalId,
      parentId,
      sortBy = 'newest',
      limit = 20,
      offset = 0,
      currentUserId,
      includeDeleted = false,
    } = options;

    let query = supabase
      .from('signal_comments')
      .select(`
        *,
        user:app_users!signal_comments_user_id_fkey(username, display_name, avatar_url)
      `, { count: 'exact' })
      .eq('is_hidden', false);

    // Only filter by signalId if it's provided and non-empty
    if (signalId && signalId.trim() !== '') {
      query = query.eq('signal_id', signalId);
    }

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
        .from('signal_comment_likes')
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
   * Uses the parent comment's signalId for the query
   */
  async getReplies(
    commentId: string,
    options: { limit?: number; offset?: number; currentUserId?: string } = {}
  ): Promise<{ replies: SignalComment[]; total: number }> {
    const supabase = getSupabaseClient();

    // First get the parent comment to find its signalId
    const { data: parentComment, error: parentError } = await supabase
      .from('signal_comments')
      .select('signal_id')
      .eq('id', commentId)
      .single();

    if (parentError || !parentComment) {
      // Parent comment doesn't exist, return empty
      return { replies: [], total: 0 };
    }

    const signalId = parentComment.signal_id;

    const { comments, total } = await this.getComments({
      signalId,
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
   * Returns different errors for 404 (not found) vs 403 (not authorized)
   */
  async updateComment(id: string, userId: string, input: UpdateSignalCommentInput): Promise<SignalComment> {
    const supabase = getSupabaseClient();
    const contentHtml = this.markdownToHtml(input.content);

    // First check if comment exists
    const { data: existingComment, error: fetchError } = await supabase
      .from('signal_comments')
      .select('id, user_id, is_deleted')
      .eq('id', id)
      .single();

    if (fetchError || !existingComment) {
      throw new Error('Comment not found');
    }

    if (existingComment.is_deleted) {
      throw new Error('Comment not found');
    }

    if (existingComment.user_id !== userId) {
      throw new Error('Not authorized to update this comment');
    }

    const { data, error } = await supabase
      .from('signal_comments')
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
    if (!data) throw new Error('Comment not found');

    return this.mapToComment(data);
  }

  /**
   * Soft delete a comment
   * Returns different errors for 404 (not found) vs 403 (not authorized)
   */
  async deleteComment(id: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();

    // First check if comment exists
    const { data: existingComment, error: fetchError } = await supabase
      .from('signal_comments')
      .select('id, user_id, is_deleted')
      .eq('id', id)
      .single();

    if (fetchError || !existingComment) {
      throw new Error('Comment not found');
    }

    if (existingComment.is_deleted) {
      throw new Error('Comment not found');
    }

    if (existingComment.user_id !== userId) {
      throw new Error('Not authorized to delete this comment');
    }

    const { error } = await supabase
      .from('signal_comments')
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
      .from('signal_comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      throw new Error('Already liked this comment');
    }

    const { error } = await supabase
      .from('signal_comment_likes')
      .insert([{ comment_id: commentId, user_id: userId }]);

    if (error) throw error;
  }

  /**
   * Unlike a comment
   */
  async unlikeComment(commentId: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('signal_comment_likes')
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
      .from('signal_comment_likes')
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
      .from('signal_comment_likes')
      .select(`
        user_id,
        created_at,
        user:app_users!signal_comment_likes_user_id_fkey(id, username, display_name, avatar_url)
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
    reason: SignalCommentReport['reason'],
    description?: string
  ): Promise<SignalCommentReport> {
    const supabase = getSupabaseClient();

    const { data: existing } = await supabase
      .from('signal_comment_reports')
      .select('id')
      .eq('comment_id', commentId)
      .eq('reporter_id', reporterId)
      .single();

    if (existing) {
      throw new Error('Already reported this comment');
    }

    const { data, error } = await supabase
      .from('signal_comment_reports')
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
    status?: SignalCommentReport['status'],
    limit: number = 50,
    offset: number = 0
  ): Promise<{ reports: SignalCommentReport[]; total: number }> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('signal_comment_reports')
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
  ): Promise<SignalComment> {
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
      .from('signal_comments')
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
   * Get comment count for a signal
   */
  async getCommentCount(signalId: string): Promise<number> {
    const supabase = getSupabaseClient();

    const { count, error } = await supabase
      .from('signal_comments')
      .select('*', { count: 'exact', head: true })
      .eq('signal_id', signalId)
      .eq('is_deleted', false)
      .eq('is_hidden', false);

    if (error) throw error;
    return count || 0;
  }

  // ============ Private Helpers ============

  private mapToComment(row: any): SignalComment {
    return {
      id: row.id,
      signalId: row.signal_id,
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

  private mapToReport(row: any): SignalCommentReport {
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

  /**
   * Convert Markdown to sanitized HTML using marked + DOMPurify
   * This provides robust XSS protection compared to hand-rolled parsers
   */
  private markdownToHtml(markdown: string): string {
    if (!markdown) return '';

    try {
      // Configure marked for safe parsing
      marked.setOptions({
        breaks: true,        // Convert line breaks to <br>
        gfm: true,           // GitHub Flavored Markdown
      });

      // Parse markdown to HTML
      const rawHtml = marked.parse(markdown) as string;

      // Sanitize with DOMPurify to remove any XSS vectors
      // Allow a safe subset of HTML tags
      const cleanHtml = DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'b', 'em', 'i', 'u',
          'code', 'pre', 'blockquote',
          'ul', 'ol', 'li',
          'a', 'hr',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
        ],
        ALLOWED_ATTR: ['href', 'title', 'rel', 'target'],
        // Force all links to open in new tab and not have referrer
        ADD_ATTR: ['target', 'rel'],
      });

      // Ensure all links have safe attributes
      return cleanHtml.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
    } catch (_error) {
      // If parsing fails, return escaped plain text
      return markdown
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }
}

export const signalCommentsDAO = new SignalCommentsDAO();