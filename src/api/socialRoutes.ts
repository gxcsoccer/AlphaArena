/**
 * Social Routes - User Profile and Follow System
 * Provides endpoints for user public profiles and follow functionality
 */

import { Router, Request, Response } from 'express';
import { SocialDAO, User, UserBadge } from '../database/social.dao';
import { StrategyTemplatesDAO, StrategyTemplate } from '../database/strategyTemplates.dao';
import { authMiddleware, optionalAuthMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('SocialRoutes');

const router = Router();
const socialDAO = new SocialDAO();
const templatesDAO = new StrategyTemplatesDAO();

// ============ ME ROUTES (MUST BE BEFORE /:username routes) ============

/**
 * PATCH /api/users/me/profile
 * Update current user's profile
 */
router.patch('/me/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { displayName, avatarUrl, bio, websiteUrl, twitterHandle, isPublic } = req.body;

    const updates: Partial<{
      displayName: string;
      avatarUrl: string;
      bio: string;
      websiteUrl: string;
      twitterHandle: string;
      isPublic: boolean;
    }> = {};

    if (displayName !== undefined) updates.displayName = displayName;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (bio !== undefined) updates.bio = bio;
    if (websiteUrl !== undefined) updates.websiteUrl = websiteUrl;
    if (twitterHandle !== undefined) updates.twitterHandle = twitterHandle;
    if (isPublic !== undefined) updates.isPublic = isPublic;

    const updatedUser = await socialDAO.updateUser(userId, updates);

    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        avatarUrl: updatedUser.avatarUrl,
        bio: updatedUser.bio,
        websiteUrl: updatedUser.websiteUrl,
        twitterHandle: updatedUser.twitterHandle,
        isPublic: updatedUser.isPublic,
        followersCount: updatedUser.followersCount,
        followingCount: updatedUser.followingCount,
      },
    });
  } catch (error: any) {
    log.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user profile',
    });
  }
});

/**
 * GET /api/users/me/following/feed
 * Get activity feed from followed users
 * TODO: Implement when activity logging is ready
 */
router.get('/me/following/feed', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Get list of users being followed
    const following = await socialDAO.getFollowing(userId, 100, 0);

    // TODO: Implement activity feed when user_activities table is ready
    // For now, return empty feed
    res.json({
      success: true,
      data: {
        activities: [],
        followingCount: following.length,
        message: 'Activity feed coming soon',
      },
    });
  } catch (error: any) {
    log.error('Error fetching activity feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity feed',
    });
  }
});

/**
 * GET /api/users/search
 * Search users by username or display name
 */
router.get('/search/users', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { q, limit: _limit = 20 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
    }

    // TODO: Implement proper full-text search
    // For now, we'll do a basic username search via DAO
    // This would need a new method in SocialDAO for searching

    res.json({
      success: true,
      data: [],
      message: 'User search coming soon',
    });
  } catch (error: any) {
    log.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search users',
    });
  }
});

// ============ DYNAMIC USERNAME ROUTES ============

/**
 * GET /api/users/:username
 * Get user public profile by username
 */
router.get('/:username', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const username = req.params.username as string;
    const currentUser = req.user?.id;

    const user = await socialDAO.getUserByUsername(username);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Check if current user is following this user
    let isFollowing = false;
    if (currentUser) {
      isFollowing = await socialDAO.isFollowing(currentUser, user.id);
    }

    // Build public profile response
    const publicProfile = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      websiteUrl: user.websiteUrl,
      twitterHandle: user.twitterHandle,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      isFollowing,
      isPublic: user.isPublic,
      createdAt: user.createdAt,
    };

    res.json({
      success: true,
      data: publicProfile,
    });
  } catch (error: any) {
    log.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
    });
  }
});

/**
 * GET /api/users/:username/stats
 * Get user public statistics
 */
router.get('/:username/stats', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const username = req.params.username as string;

    const user = await socialDAO.getUserByUsername(username);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Return public stats
    const stats = {
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      // TODO: Add trading stats when available
      // totalTrades, winRate, totalPnL, etc.
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    log.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user stats',
    });
  }
});

/**
 * GET /api/users/:username/badges
 * Get user badges
 */
router.get('/:username/badges', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const username = req.params.username as string;

    const user = await socialDAO.getUserByUsername(username);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const badges = await socialDAO.getUserBadges(user.id);

    res.json({
      success: true,
      data: badges.map((badge: UserBadge) => ({
        id: badge.id,
        badgeType: badge.badgeType,
        badgeName: badge.badgeName,
        badgeDescription: badge.badgeDescription,
        badgeIcon: badge.badgeIcon,
        earnedAt: badge.earnedAt,
      })),
    });
  } catch (error: any) {
    log.error('Error fetching user badges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user badges',
    });
  }
});

/**
 * GET /api/users/:username/strategies
 * Get user's public strategies (strategy templates)
 */
router.get('/:username/strategies', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const username = req.params.username as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const user = await socialDAO.getUserByUsername(username);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Fetch strategy templates created by this user
    const templates = await templatesDAO.getByAuthor(user.id);

    // Filter to only public templates and apply pagination
    const publicTemplates = templates.filter((t: StrategyTemplate) => t.isPublic);
    const paginatedTemplates = publicTemplates.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginatedTemplates.map((t: StrategyTemplate) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        strategyType: t.strategyType,
        category: t.category,
        symbol: t.symbol,
        tags: t.tags,
        performanceMetrics: t.performanceMetrics,
        useCount: t.useCount,
        ratingAvg: t.ratingAvg,
        ratingCount: t.ratingCount,
        createdAt: t.createdAt,
      })),
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < publicTemplates.length,
      },
    });
  } catch (error: any) {
    log.error('Error fetching user strategies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user strategies',
    });
  }
});

/**
 * GET /api/users/:username/activities
 * Get user's activity log
 */
router.get('/:username/activities', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const username = req.params.username as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const user = await socialDAO.getUserByUsername(username);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // TODO: Implement when user_activities table is created
    // For now, return empty activities with a note
    res.json({
      success: true,
      data: [],
      pagination: {
        limit,
        offset,
        hasMore: false,
      },
      message: 'Activity logging coming soon',
    });
  } catch (error: any) {
    log.error('Error fetching user activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user activities',
    });
  }
});

/**
 * POST /api/users/:userId/follow
 * Follow a user
 */
router.post('/:userId/follow', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const targetUserId = req.params.userId as string;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot follow yourself',
      });
    }

    // Check if already following
    const alreadyFollowing = await socialDAO.isFollowing(currentUserId, targetUserId);
    if (alreadyFollowing) {
      return res.status(400).json({
        success: false,
        error: 'Already following this user',
      });
    }

    // Check if target user exists
    const targetUser = await socialDAO.getUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    await socialDAO.followUser(currentUserId, targetUserId);

    res.json({
      success: true,
      message: 'Successfully followed user',
      data: {
        followingId: targetUserId,
      },
    });
  } catch (error: any) {
    log.error('Error following user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to follow user',
    });
  }
});

/**
 * DELETE /api/users/:userId/follow
 * Unfollow a user
 */
router.delete('/:userId/follow', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const targetUserId = req.params.userId as string;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Check if following
    const isFollowing = await socialDAO.isFollowing(currentUserId, targetUserId);
    if (!isFollowing) {
      return res.status(400).json({
        success: false,
        error: 'Not following this user',
      });
    }

    await socialDAO.unfollowUser(currentUserId, targetUserId);

    res.json({
      success: true,
      message: 'Successfully unfollowed user',
      data: {
        unfollowedId: targetUserId,
      },
    });
  } catch (error: any) {
    log.error('Error unfollowing user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unfollow user',
    });
  }
});

/**
 * GET /api/users/:userId/followers
 * Get user's followers list
 */
router.get('/:userId/followers', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const currentUserId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const user = await socialDAO.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const followers = await socialDAO.getFollowers(userId, limit, offset);

    // Check follow status for each follower if current user is logged in
    const followersWithStatus = await Promise.all(
      followers.map(async (follower: User) => {
        let isFollowingBack = false;
        if (currentUserId) {
          isFollowingBack = await socialDAO.isFollowing(currentUserId, follower.id);
        }
        return {
          id: follower.id,
          username: follower.username,
          displayName: follower.displayName,
          avatarUrl: follower.avatarUrl,
          bio: follower.bio,
          followersCount: follower.followersCount,
          followingCount: follower.followingCount,
          isFollowing: isFollowingBack,
        };
      })
    );

    res.json({
      success: true,
      data: followersWithStatus,
      pagination: {
        limit,
        offset,
        hasMore: followers.length === limit,
      },
    });
  } catch (error: any) {
    log.error('Error fetching followers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch followers',
    });
  }
});

/**
 * GET /api/users/:userId/following
 * Get users that a user is following
 */
router.get('/:userId/following', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const currentUserId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const user = await socialDAO.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const following = await socialDAO.getFollowing(userId, limit, offset);

    // All users in following list are followed (by definition)
    // But we need to check if current user also follows them
    const followingWithStatus = await Promise.all(
      following.map(async (followedUser: User) => {
        let currentUserFollows = false;
        if (currentUserId) {
          currentUserFollows = await socialDAO.isFollowing(currentUserId, followedUser.id);
        }
        return {
          id: followedUser.id,
          username: followedUser.username,
          displayName: followedUser.displayName,
          avatarUrl: followedUser.avatarUrl,
          bio: followedUser.bio,
          followersCount: followedUser.followersCount,
          followingCount: followedUser.followingCount,
          isFollowing: currentUserFollows,
        };
      })
    );

    res.json({
      success: true,
      data: followingWithStatus,
      pagination: {
        limit,
        offset,
        hasMore: following.length === limit,
      },
    });
  } catch (error: any) {
    log.error('Error fetching following:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch following',
    });
  }
});

export default router;
