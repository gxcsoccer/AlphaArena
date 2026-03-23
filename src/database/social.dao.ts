import { getSupabaseClient } from './client';

/**
 * User - 用户信息
 */
export interface User {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  websiteUrl?: string;
  twitterHandle?: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  followersCount: number;
  followingCount: number;
}

/**
 * User Follow - 用户关注
 */
export interface UserFollow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

/**
 * User Block - 用户屏蔽
 */
export interface UserBlock {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: Date;
}

/**
 * User Activity - 用户活动
 */
export interface UserActivity {
  id: string;
  userId: string;
  activityType: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  entityData: Record<string, any>;
  isPublic: boolean;
  createdAt: Date;
  // Joined fields
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}

/**
 * Strategy Comment - 策略评论
 */
export interface StrategyComment {
  id: string;
  strategyId: string;
  userId: string;
  parentId?: string;
  content: string;
  likesCount: number;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  replies?: StrategyComment[];
}

/**
 * User Badge - 用户徽章
 */
export interface UserBadge {
  id: string;
  userId: string;
  badgeType: string;
  badgeName: string;
  badgeDescription?: string;
  badgeIcon?: string;
  earnedAt: Date;
  metadata: Record<string, any>;
}

/**
 * Strategy Stats - 策略统计
 */
export interface StrategyStats {
  id: string;
  strategyId: string;
  likesCount: number;
  commentsCount: number;
  followersCount: number;
  sharesCount: number;
  viewsCount: number;
  periodStats: Record<string, any>;
  updatedAt: Date;
}

/**
 * Create user input
 */
export interface CreateUserInput {
  id?: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  websiteUrl?: string;
  twitterHandle?: string;
  isPublic?: boolean;
}

/**
 * Social DAO - 社交功能数据访问层
 */
export class SocialDAO {
  // ============ User Methods ============

  /**
   * Create or update user
   */
  async upsertUser(input: CreateUserInput): Promise<User> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .upsert([{
        id: input.id,
        username: input.username,
        display_name: input.displayName,
        avatar_url: input.avatarUrl,
        bio: input.bio,
        website_url: input.websiteUrl,
        twitter_handle: input.twitterHandle,
        is_public: input.isPublic ?? true,
      }])
      .select()
      .single();

    if (error) throw error;
    return this.mapToUser(data);
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToUser(data);
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToUser(data);
  }

  /**
   * Update user profile
   */
  async updateUser(id: string, updates: Partial<Omit<CreateUserInput, 'id'>>): Promise<User> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, any> = {};
    if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
    if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl;
    if (updates.bio !== undefined) updateData.bio = updates.bio;
    if (updates.websiteUrl !== undefined) updateData.website_url = updates.websiteUrl;
    if (updates.twitterHandle !== undefined) updateData.twitter_handle = updates.twitterHandle;
    if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToUser(data);
  }

  // ============ Follow Methods ============

  /**
   * Follow a user
   */
  async followUser(followerId: string, followingId: string): Promise<UserFollow> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_follows')
      .insert([{
        follower_id: followerId,
        following_id: followingId,
      }])
      .select()
      .single();

    if (error) throw error;
    return this.mapToFollow(data);
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) throw error;
  }

  /**
   * Check if user is following another user
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  }

  /**
   * Get user's followers
   */
  async getFollowers(userId: string, limit = 50, offset = 0): Promise<User[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_follows')
      .select(`
        follower_id,
        users!user_follows_follower_id_fkey (*)
      `)
      .eq('following_id', userId)
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return data.map((row: any) => this.mapToUser(row.users));
  }

  /**
   * Get users that a user is following
   */
  async getFollowing(userId: string, limit = 50, offset = 0): Promise<User[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_follows')
      .select(`
        following_id,
        users!user_follows_following_id_fkey (*)
      `)
      .eq('follower_id', userId)
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return data.map((row: any) => this.mapToUser(row.users));
  }

  // ============ Block Methods ============

  /**
   * Block a user
   */
  async blockUser(blockerId: string, blockedId: string): Promise<UserBlock> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_blocks')
      .insert([{
        blocker_id: blockerId,
        blocked_id: blockedId,
      }])
      .select()
      .single();

    if (error) throw error;

    // Also unfollow if following
    await this.unfollowUser(blockerId, blockedId);
    await this.unfollowUser(blockedId, blockerId);

    return this.mapToBlock(data);
  }

  /**
   * Unblock a user
   */
  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);

    if (error) throw error;
  }

  /**
   * Check if user has blocked another user
   */
  async hasBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  }

  /**
   * Get list of blocked users
   */
  async getBlockedUsers(userId: string, limit = 50, offset = 0): Promise<User[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_blocks')
      .select(`
        blocked_id,
        users!user_blocks_blocked_id_fkey (*)
      `)
      .eq('blocker_id', userId)
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return data.map((row: any) => this.mapToUser(row.users));
  }

  /**
   * Check if viewer can view target user's profile
   */
  async canViewProfile(viewerId: string | null, targetId: string): Promise<boolean> {
    // Can always view own profile
    if (viewerId === targetId) {
      return true;
    }

    const supabase = getSupabaseClient();

    // Check if blocked by target
    if (viewerId) {
      const { data: blockData } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', targetId)
        .eq('blocked_id', viewerId)
        .single();

      if (blockData) {
        return false;
      }
    }

    // Check if target profile is public
    const { data: targetUser } = await supabase
      .from('users')
      .select('is_public')
      .eq('id', targetId)
      .single();

    if (targetUser?.is_public) {
      return true;
    }

    // Check if viewer follows target (followers can see private profiles)
    if (viewerId) {
      const { data: followData } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', viewerId)
        .eq('following_id', targetId)
        .single();

      if (followData) {
        return true;
      }
    }

    return false;
  }

  // ============ Activity Methods ============

  /**
   * Log user activity
   */
  async logActivity(
    userId: string,
    activityType: string,
    entityType?: string,
    entityId?: string,
    entityName?: string,
    entityData?: Record<string, any>,
    isPublic: boolean = true
  ): Promise<UserActivity> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_activities')
      .insert([{
        user_id: userId,
        activity_type: activityType,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        entity_data: entityData || {},
        is_public: isPublic,
      }])
      .select()
      .single();

    if (error) throw error;
    return this.mapToActivity(data);
  }

  /**
   * Get activity feed for a user (activities from followed users)
   */
  async getActivityFeed(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<UserActivity[]> {
    const supabase = getSupabaseClient();

    // Get list of users being followed
    const { data: followingData } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId);

    const followingIds = followingData?.map((row: any) => row.following_id) || [];

    if (followingIds.length === 0) {
      return [];
    }

    // Get activities from followed users
    const { data, error } = await supabase
      .from('user_activities')
      .select(`
        *,
        users (username, display_name, avatar_url)
      `)
      .in('user_id', followingIds)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return data.map((row: any) => ({
      ...this.mapToActivity(row),
      username: row.users?.username,
      displayName: row.users?.display_name,
      avatarUrl: row.users?.avatar_url,
    }));
  }

  /**
   * Get user's own activities
   */
  async getUserActivities(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<UserActivity[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_activities')
      .select(`
        *,
        users (username, display_name, avatar_url)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return data.map((row: any) => ({
      ...this.mapToActivity(row),
      username: row.users?.username,
      displayName: row.users?.display_name,
      avatarUrl: row.users?.avatar_url,
    }));
  }

  // ============ Comment Methods ============

  /**
   * Create a comment
   */
  async createComment(
    strategyId: string,
    userId: string,
    content: string,
    parentId?: string
  ): Promise<StrategyComment> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_comments')
      .insert([{
        strategy_id: strategyId,
        user_id: userId,
        parent_id: parentId,
        content,
      }])
      .select()
      .single();

    if (error) throw error;

    // Update strategy stats
    await this.incrementCommentCount(strategyId);

    return this.mapToComment(data);
  }

  /**
   * Get comments for a strategy
   */
  async getComments(
    strategyId: string,
    limit = 50,
    offset = 0
  ): Promise<StrategyComment[]> {
    const supabase = getSupabaseClient();

    // Get top-level comments
    const { data, error } = await supabase
      .from('strategy_comments')
      .select(`
        *,
        users (username, display_name, avatar_url)
      `)
      .eq('strategy_id', strategyId)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const comments = data.map((row: any) => ({
      ...this.mapToComment(row),
      username: row.users?.username,
      displayName: row.users?.display_name,
      avatarUrl: row.users?.avatar_url,
    }));

    // Get replies for each comment
    for (const comment of comments) {
      const { data: replies } = await supabase
        .from('strategy_comments')
        .select(`
          *,
          users (username, display_name, avatar_url)
        `)
        .eq('parent_id', comment.id)
        .order('created_at', { ascending: true });

      if (replies) {
        comment.replies = replies.map((row: any) => ({
          ...this.mapToComment(row),
          username: row.users?.username,
          displayName: row.users?.display_name,
          avatarUrl: row.users?.avatar_url,
        }));
      }
    }

    return comments;
  }

  /**
   * Update a comment
   */
  async updateComment(commentId: string, content: string): Promise<StrategyComment> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_comments')
      .update({ content })
      .eq('id', commentId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToComment(data);
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string): Promise<void> {
    const supabase = getSupabaseClient();

    // Get comment to update stats
    const { data: comment } = await supabase
      .from('strategy_comments')
      .select('strategy_id')
      .eq('id', commentId)
      .single();

    const { error } = await supabase
      .from('strategy_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;

    // Update strategy stats
    if (comment) {
      await this.decrementCommentCount(comment.strategy_id);
    }
  }

  /**
   * Like a comment
   */
  async likeComment(commentId: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('comment_likes')
      .insert([{
        comment_id: commentId,
        user_id: userId,
      }]);

    if (error) throw error;
  }

  /**
   * Unlike a comment
   */
  async unlikeComment(commentId: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  // ============ Like Methods ============

  /**
   * Like a strategy
   */
  async likeStrategy(strategyId: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('strategy_likes')
      .insert([{
        strategy_id: strategyId,
        user_id: userId,
      }]);

    if (error) throw error;

    // Update strategy stats
    await this.incrementLikeCount(strategyId);
  }

  /**
   * Unlike a strategy
   */
  async unlikeStrategy(strategyId: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('strategy_likes')
      .delete()
      .eq('strategy_id', strategyId)
      .eq('user_id', userId);

    if (error) throw error;

    // Update strategy stats
    await this.decrementLikeCount(strategyId);
  }

  /**
   * Check if user liked a strategy
   */
  async hasLikedStrategy(strategyId: string, userId: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_likes')
      .select('id')
      .eq('strategy_id', strategyId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  }

  // ============ Badge Methods ============

  /**
   * Award a badge to a user
   */
  async awardBadge(
    userId: string,
    badgeType: string,
    badgeName: string,
    badgeDescription?: string,
    badgeIcon?: string,
    metadata?: Record<string, any>
  ): Promise<UserBadge> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_badges')
      .upsert([{
        user_id: userId,
        badge_type: badgeType,
        badge_name: badgeName,
        badge_description: badgeDescription,
        badge_icon: badgeIcon,
        metadata: metadata || {},
      }])
      .select()
      .single();

    if (error) throw error;
    return this.mapToBadge(data);
  }

  /**
   * Get user's badges
   */
  async getUserBadges(userId: string): Promise<UserBadge[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_badges')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) throw error;
    return data.map(this.mapToBadge);
  }

  /**
   * Check if user has a badge
   */
  async hasBadge(userId: string, badgeType: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_badges')
      .select('id')
      .eq('user_id', userId)
      .eq('badge_type', badgeType)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  }

  // ============ Strategy Stats Methods ============

  /**
   * Get strategy stats
   */
  async getStrategyStats(strategyId: string): Promise<StrategyStats | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_stats')
      .select('*')
      .eq('strategy_id', strategyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToStats(data);
  }

  /**
   * Initialize strategy stats
   */
  async initStrategyStats(strategyId: string): Promise<StrategyStats> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_stats')
      .insert([{
        strategy_id: strategyId,
      }])
      .select()
      .single();

    if (error) throw error;
    return this.mapToStats(data);
  }

  /**
   * Increment like count
   */
  private async incrementLikeCount(strategyId: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    // Try to update existing stats
    const { error: updateError } = await supabase.rpc('increment_strategy_likes', {
      p_strategy_id: strategyId,
    });

    // If RPC doesn't exist, use direct update
    if (updateError) {
      const stats = await this.getStrategyStats(strategyId);
      if (stats) {
        await supabase
          .from('strategy_stats')
          .update({ likes_count: stats.likesCount + 1 })
          .eq('strategy_id', strategyId);
      } else {
        await this.initStrategyStats(strategyId);
        await supabase
          .from('strategy_stats')
          .update({ likes_count: 1 })
          .eq('strategy_id', strategyId);
      }
    }
  }

  /**
   * Decrement like count
   */
  private async decrementLikeCount(strategyId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const stats = await this.getStrategyStats(strategyId);
    
    if (stats && stats.likesCount > 0) {
      await supabase
        .from('strategy_stats')
        .update({ likes_count: stats.likesCount - 1 })
        .eq('strategy_id', strategyId);
    }
  }

  /**
   * Increment comment count
   */
  private async incrementCommentCount(strategyId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const stats = await this.getStrategyStats(strategyId);
    
    if (stats) {
      await supabase
        .from('strategy_stats')
        .update({ comments_count: stats.commentsCount + 1 })
        .eq('strategy_id', strategyId);
    } else {
      await this.initStrategyStats(strategyId);
      await supabase
        .from('strategy_stats')
        .update({ comments_count: 1 })
        .eq('strategy_id', strategyId);
    }
  }

  /**
   * Decrement comment count
   */
  private async decrementCommentCount(strategyId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const stats = await this.getStrategyStats(strategyId);
    
    if (stats && stats.commentsCount > 0) {
      await supabase
        .from('strategy_stats')
        .update({ comments_count: stats.commentsCount - 1 })
        .eq('strategy_id', strategyId);
    }
  }

  // ============ Mappers ============

  private mapToUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      websiteUrl: row.website_url,
      twitterHandle: row.twitter_handle,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isPublic: row.is_public,
      followersCount: row.followers_count || 0,
      followingCount: row.following_count || 0,
    };
  }

  private mapToFollow(row: any): UserFollow {
    return {
      id: row.id,
      followerId: row.follower_id,
      followingId: row.following_id,
      createdAt: new Date(row.created_at),
    };
  }

  private mapToBlock(row: any): UserBlock {
    return {
      id: row.id,
      blockerId: row.blocker_id,
      blockedId: row.blocked_id,
      createdAt: new Date(row.created_at),
    };
  }

  private mapToActivity(row: any): UserActivity {
    return {
      id: row.id,
      userId: row.user_id,
      activityType: row.activity_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityName: row.entity_name,
      entityData: row.entity_data || {},
      isPublic: row.is_public,
      createdAt: new Date(row.created_at),
    };
  }

  private mapToComment(row: any): StrategyComment {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      userId: row.user_id,
      parentId: row.parent_id,
      content: row.content,
      likesCount: row.likes_count || 0,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapToBadge(row: any): UserBadge {
    return {
      id: row.id,
      userId: row.user_id,
      badgeType: row.badge_type,
      badgeName: row.badge_name,
      badgeDescription: row.badge_description,
      badgeIcon: row.badge_icon,
      earnedAt: new Date(row.earned_at),
      metadata: row.metadata || {},
    };
  }

  private mapToStats(row: any): StrategyStats {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      likesCount: row.likes_count || 0,
      commentsCount: row.comments_count || 0,
      followersCount: row.followers_count || 0,
      sharesCount: row.shares_count || 0,
      viewsCount: row.views_count || 0,
      periodStats: row.period_stats || {},
      updatedAt: new Date(row.updated_at),
    };
  }
}

export default SocialDAO;
