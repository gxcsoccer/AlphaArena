/**
 * Enhanced Leaderboard API Routes
 * Endpoints for multi-dimensional rankings, time periods, social features, and competitions
 */

import { Router, Request, Response } from 'express';
import { EnhancedLeaderboardService, TimePeriod, SortCriterion, RankingFilter } from '../strategy/EnhancedLeaderboardService';
import { CompetitionsDAO, CreateCompetitionInput } from '../database/competitions.dao';
import { SocialDAO, CreateUserInput } from '../database/social.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('LeaderboardRoutes');

/**
 * Create leaderboard router
 */
export function createLeaderboardRouter(): Router {
  const router = Router();
  const leaderboardService = new EnhancedLeaderboardService();
  const competitionsDAO = new CompetitionsDAO();
  const socialDAO = new SocialDAO();

  // ============ Leaderboard Endpoints ============

  /**
   * GET /api/leaderboard/enhanced
   * Get enhanced leaderboard with multi-dimensional rankings and time periods
   */
  router.get('/enhanced', async (req: Request, res: Response) => {
    try {
      const sortBy = (req.query.sortBy as SortCriterion) || 'comprehensiveScore';
      const period = (req.query.period as TimePeriod) || 'all_time';
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const userId = req.query.userId as string;

      const filter: RankingFilter = {
        sortBy,
        period,
        limit,
        offset,
        userId,
      };

      const entries = await leaderboardService.calculateLeaderboard(filter);
      
      res.json({
        success: true,
        data: entries,
        meta: {
          sortBy,
          period,
          limit,
          offset,
          total: entries.length,
        },
      });
    } catch (error) {
      log.error('Failed to get enhanced leaderboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get leaderboard',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/leaderboard/rank-history/:strategyId
   * Get rank history for a strategy
   */
  router.get('/rank-history/:strategyId', async (req: Request, res: Response) => {
    try {
      const strategyId = req.params.strategyId as string;
      const period = (req.query.period as TimePeriod) || 'all_time';
      const limit = parseInt(req.query.limit as string) || 30;

      const history = await leaderboardService.getRankHistory(strategyId, period, limit);
      
      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      log.error('Failed to get rank history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get rank history',
      });
    }
  });

  /**
   * GET /api/leaderboard/percentile/:strategyId
   * Get percentile rank for a strategy
   */
  router.get('/percentile/:strategyId', async (req: Request, res: Response) => {
    try {
      const strategyId = req.params.strategyId as string;
      const sortBy = (req.query.sortBy as SortCriterion) || 'comprehensiveScore';
      const period = (req.query.period as TimePeriod) || 'all_time';

      const percentile = await leaderboardService.getPercentileRank(strategyId, sortBy, period);
      
      res.json({
        success: true,
        data: {
          strategyId,
          percentile,
          sortBy,
          period,
        },
      });
    } catch (error) {
      log.error('Failed to get percentile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get percentile rank',
      });
    }
  });

  /**
   * POST /api/leaderboard/check-badges/:strategyId
   * Check and award badges for a strategy
   */
  router.post('/check-badges/:strategyId', async (req: Request, res: Response) => {
    try {
      const strategyId = req.params.strategyId as string;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required',
        });
      }

      const newBadges = await leaderboardService.checkAndAwardBadges(strategyId, userId);
      
      res.json({
        success: true,
        data: {
          newBadges,
          count: newBadges.length,
        },
      });
    } catch (error) {
      log.error('Failed to check badges:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check badges',
      });
    }
  });

  // ============ Competition Endpoints ============

  /**
   * GET /api/competitions
   * List competitions
   */
  router.get('/competitions', async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string;
      const upcoming = req.query.upcoming === 'true';
      const active = req.query.active === 'true';
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const competitions = await competitionsDAO.list({
        status,
        upcoming,
        active,
        limit,
        offset,
      });
      
      res.json({
        success: true,
        data: competitions,
      });
    } catch (error) {
      log.error('Failed to list competitions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list competitions',
      });
    }
  });

  /**
   * GET /api/competitions/:id
   * Get competition by ID
   */
  router.get('/competitions/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const userId = req.query.userId as string;

      const competition = await competitionsDAO.getWithStats(id, userId);
      
      if (!competition) {
        return res.status(404).json({
          success: false,
          error: 'Competition not found',
        });
      }
      
      res.json({
        success: true,
        data: competition,
      });
    } catch (error) {
      log.error('Failed to get competition:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get competition',
      });
    }
  });

  /**
   * POST /api/competitions
   * Create a new competition
   */
  router.post('/competitions', async (req: Request, res: Response) => {
    try {
      const input: CreateCompetitionInput = req.body;

      if (!input.name || !input.startTime || !input.endTime) {
        return res.status(400).json({
          success: false,
          error: 'name, startTime, and endTime are required',
        });
      }

      const competition = await competitionsDAO.create(input);
      
      res.status(201).json({
        success: true,
        data: competition,
      });
    } catch (error) {
      log.error('Failed to create competition:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create competition',
      });
    }
  });

  /**
   * POST /api/competitions/:id/join
   * Join a competition
   */
  router.post('/competitions/:id/join', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { userId, initialCapital, strategyId } = req.body;

      if (!userId || !initialCapital) {
        return res.status(400).json({
          success: false,
          error: 'userId and initialCapital are required',
        });
      }

      const participant = await competitionsDAO.joinCompetition(
        id,
        userId,
        initialCapital,
        strategyId
      );
      
      res.status(201).json({
        success: true,
        data: participant,
      });
    } catch (error) {
      log.error('Failed to join competition:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to join competition',
      });
    }
  });

  /**
   * POST /api/competitions/:id/leave
   * Leave a competition
   */
  router.post('/competitions/:id/leave', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required',
        });
      }

      await competitionsDAO.leaveCompetition(id, userId);
      
      res.json({
        success: true,
        message: 'Left competition successfully',
      });
    } catch (error) {
      log.error('Failed to leave competition:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to leave competition',
      });
    }
  });

  /**
   * GET /api/competitions/:id/leaderboard
   * Get competition leaderboard
   */
  router.get('/competitions/:id/leaderboard', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const _limit = parseInt(req.query.limit as string) || 50;

      const leaderboard = await leaderboardService.getCompetitionLeaderboard(id);
      
      res.json({
        success: true,
        data: leaderboard,
      });
    } catch (error) {
      log.error('Failed to get competition leaderboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get competition leaderboard',
      });
    }
  });

  /**
   * POST /api/competitions/:id/finalize
   * Finalize competition and assign ranks/prizes
   */
  router.post('/competitions/:id/finalize', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      await competitionsDAO.finalizeCompetition(id);
      
      res.json({
        success: true,
        message: 'Competition finalized successfully',
      });
    } catch (error) {
      log.error('Failed to finalize competition:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to finalize competition',
      });
    }
  });

  // ============ Social Endpoints ============

  /**
   * GET /api/users/:id
   * Get user profile
   */
  router.get('/users/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      const user = await socialDAO.getUserById(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }
      
      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      log.error('Failed to get user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user',
      });
    }
  });

  /**
   * POST /api/users
   * Create or update user
   */
  router.post('/users', async (req: Request, res: Response) => {
    try {
      const input: CreateUserInput = req.body;

      if (!input.username) {
        return res.status(400).json({
          success: false,
          error: 'username is required',
        });
      }

      const user = await socialDAO.upsertUser(input);
      
      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      log.error('Failed to create/update user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create/update user',
      });
    }
  });

  /**
   * POST /api/follow
   * Follow a user
   */
  router.post('/follow', async (req: Request, res: Response) => {
    try {
      const { followerId, followingId } = req.body;

      if (!followerId || !followingId) {
        return res.status(400).json({
          success: false,
          error: 'followerId and followingId are required',
        });
      }

      const follow = await socialDAO.followUser(followerId, followingId);
      
      res.status(201).json({
        success: true,
        data: follow,
      });
    } catch (error) {
      log.error('Failed to follow user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to follow user',
      });
    }
  });

  /**
   * DELETE /api/follow
   * Unfollow a user
   */
  router.delete('/follow', async (req: Request, res: Response) => {
    try {
      const { followerId, followingId } = req.body;

      if (!followerId || !followingId) {
        return res.status(400).json({
          success: false,
          error: 'followerId and followingId are required',
        });
      }

      await socialDAO.unfollowUser(followerId, followingId);
      
      res.json({
        success: true,
        message: 'Unfollowed successfully',
      });
    } catch (error) {
      log.error('Failed to unfollow user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unfollow user',
      });
    }
  });

  /**
   * GET /api/users/:id/followers
   * Get user's followers
   */
  router.get('/users/:id/followers', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const followers = await socialDAO.getFollowers(id, limit, offset);
      
      res.json({
        success: true,
        data: followers,
      });
    } catch (error) {
      log.error('Failed to get followers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get followers',
      });
    }
  });

  /**
   * GET /api/users/:id/following
   * Get users that a user is following
   */
  router.get('/users/:id/following', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const following = await socialDAO.getFollowing(id, limit, offset);
      
      res.json({
        success: true,
        data: following,
      });
    } catch (error) {
      log.error('Failed to get following:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get following',
      });
    }
  });

  /**
   * POST /api/strategies/:id/like
   * Like a strategy
   */
  router.post('/strategies/:id/like', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required',
        });
      }

      await socialDAO.likeStrategy(id, userId);
      
      res.json({
        success: true,
        message: 'Strategy liked successfully',
      });
    } catch (error) {
      log.error('Failed to like strategy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to like strategy',
      });
    }
  });

  /**
   * DELETE /api/strategies/:id/like
   * Unlike a strategy
   */
  router.delete('/strategies/:id/like', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required',
        });
      }

      await socialDAO.unlikeStrategy(id, userId);
      
      res.json({
        success: true,
        message: 'Strategy unliked successfully',
      });
    } catch (error) {
      log.error('Failed to unlike strategy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unlike strategy',
      });
    }
  });

  /**
   * GET /api/strategies/:id/comments
   * Get comments for a strategy
   */
  router.get('/strategies/:id/comments', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const comments = await socialDAO.getComments(id, limit, offset);
      
      res.json({
        success: true,
        data: comments,
      });
    } catch (error) {
      log.error('Failed to get comments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get comments',
      });
    }
  });

  /**
   * POST /api/strategies/:id/comments
   * Create a comment on a strategy
   */
  router.post('/strategies/:id/comments', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { userId, content, parentId } = req.body;

      if (!userId || !content) {
        return res.status(400).json({
          success: false,
          error: 'userId and content are required',
        });
      }

      const comment = await socialDAO.createComment(id, userId, content, parentId);
      
      res.status(201).json({
        success: true,
        data: comment,
      });
    } catch (error) {
      log.error('Failed to create comment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create comment',
      });
    }
  });

  /**
   * DELETE /api/comments/:id
   * Delete a comment
   */
  router.delete('/comments/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      await socialDAO.deleteComment(id);
      
      res.json({
        success: true,
        message: 'Comment deleted successfully',
      });
    } catch (error) {
      log.error('Failed to delete comment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete comment',
      });
    }
  });

  /**
   * GET /api/users/:id/badges
   * Get user's badges
   */
  router.get('/users/:id/badges', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      const badges = await socialDAO.getUserBadges(id);
      
      res.json({
        success: true,
        data: badges,
      });
    } catch (error) {
      log.error('Failed to get badges:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get badges',
      });
    }
  });

  return router;
}

export default createLeaderboardRouter;
