import { Router, Request, Response } from 'express';
import { 
  FollowersDAO, 
  CopyTradesDAO, 
  FollowerStatsDAO,
  CreateFollowerInput
} from '../database';
import { createLogger } from '../utils/logger';

const log = createLogger('CopyTradingRoutes');

// Helper to get single string from query param
function getQueryParam(value: any): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

export function createCopyTradingRouter(): Router {
  const router = Router();
  const followersDAO = new FollowersDAO();
  const copyTradesDAO = new CopyTradesDAO();
  const followerStatsDAO = new FollowerStatsDAO();

  router.post('/follow', async (req: Request, res: Response) => {
    try {
      const { followerUserId, leaderUserId, settings } = req.body;

      if (!followerUserId || !leaderUserId) {
        return res.status(400).json({
          success: false,
          error: 'followerUserId and leaderUserId are required',
        });
      }

      if (followerUserId === leaderUserId) {
        return res.status(400).json({
          success: false,
          error: 'Cannot follow yourself',
        });
      }

      const isFollowing = await followersDAO.isFollowing(followerUserId, leaderUserId);
      if (isFollowing) {
        return res.status(400).json({
          success: false,
          error: 'Already following this trader',
        });
      }

      const input: CreateFollowerInput = {
        followerUserId,
        leaderUserId,
        settings,
      };

      const follower = await followersDAO.create(input);

      log.info(`User ${followerUserId} started following ${leaderUserId}`);

      res.json({
        success: true,
        data: follower,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /follow:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/follow/:followerId', async (req: Request, res: Response) => {
    try {
      const followerId = req.params.followerId as string;

      const follower = await followersDAO.getById(followerId);
      if (!follower) {
        return res.status(404).json({
          success: false,
          error: 'Follower relationship not found',
        });
      }

      await followersDAO.cancel(followerId);

      log.info(`User ${follower.followerUserId} unfollowed ${follower.leaderUserId}`);

      res.json({
        success: true,
        message: 'Successfully unfollowed',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in DELETE /follow/:followerId:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/follow/:followerId', async (req: Request, res: Response) => {
    try {
      const followerId = req.params.followerId as string;
      const { status, settings } = req.body;

      const follower = await followersDAO.getById(followerId);
      if (!follower) {
        return res.status(404).json({
          success: false,
          error: 'Follower relationship not found',
        });
      }

      const updated = await followersDAO.update(followerId, { status, settings });

      res.json({
        success: true,
        data: updated,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in PATCH /follow/:followerId:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/follow/:followerId/pause', async (req: Request, res: Response) => {
    try {
      const followerId = req.params.followerId as string;

      const follower = await followersDAO.pause(followerId);

      res.json({
        success: true,
        data: follower,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /pause:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/follow/:followerId/resume', async (req: Request, res: Response) => {
    try {
      const followerId = req.params.followerId as string;

      const follower = await followersDAO.resume(followerId);

      res.json({
        success: true,
        data: follower,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /resume:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/leader/:leaderUserId/followers', async (req: Request, res: Response) => {
    try {
      const leaderUserId = req.params.leaderUserId as string;
      const status = getQueryParam(req.query.status);

      const followers = await followersDAO.getMany({
        leaderUserId,
        status: status as any,
      });

      res.json({
        success: true,
        data: followers,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /leader/:leaderUserId/followers:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/follower/:followerUserId/following', async (req: Request, res: Response) => {
    try {
      const followerUserId = req.params.followerUserId as string;
      const status = getQueryParam(req.query.status);

      const following = await followersDAO.getMany({
        followerUserId,
        status: status as any,
      });

      res.json({
        success: true,
        data: following,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /follower/:followerUserId/following:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/leader/:leaderUserId/stats', async (req: Request, res: Response) => {
    try {
      const leaderUserId = req.params.leaderUserId as string;

      const stats = await followersDAO.getStats(leaderUserId);

      res.json({
        success: true,
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /leader/:leaderUserId/stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/trades', async (req: Request, res: Response) => {
    try {
      const followerUserId = getQueryParam(req.query.followerUserId);
      const leaderUserId = getQueryParam(req.query.leaderUserId);
      const symbol = getQueryParam(req.query.symbol);
      const status = getQueryParam(req.query.status);
      const limitStr = getQueryParam(req.query.limit);
      const offsetStr = getQueryParam(req.query.offset);

      const trades = await copyTradesDAO.getMany({
        followerUserId,
        leaderUserId,
        symbol,
        status: status as any,
        limit: limitStr ? parseInt(limitStr) : 100,
        offset: offsetStr ? parseInt(offsetStr) : undefined,
      });

      res.json({
        success: true,
        data: trades,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /trades:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/trades/:tradeId', async (req: Request, res: Response) => {
    try {
      const tradeId = req.params.tradeId as string;

      const trade = await copyTradesDAO.getById(tradeId);

      if (!trade) {
        return res.status(404).json({
          success: false,
          error: 'Copy trade not found',
        });
      }

      res.json({
        success: true,
        data: trade,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /trades/:tradeId:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/trades/stats', async (req: Request, res: Response) => {
    try {
      const followerUserId = getQueryParam(req.query.followerUserId);
      const leaderUserId = getQueryParam(req.query.leaderUserId);

      const stats = await copyTradesDAO.getStats(followerUserId, leaderUserId);

      res.json({
        success: true,
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /trades/stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/follower/:followerId/performance', async (req: Request, res: Response) => {
    try {
      const followerId = req.params.followerId as string;
      const periodType = getQueryParam(req.query.periodType);

      const [follower, allTimeStats, recentStats] = await Promise.all([
        followersDAO.getById(followerId),
        followerStatsDAO.getAllTimeStats(followerId),
        periodType 
          ? followerStatsDAO.getLatest(followerId, periodType as any)
          : followerStatsDAO.getLatest(followerId, 'daily'),
      ]);

      if (!follower) {
        return res.status(404).json({
          success: false,
          error: 'Follower not found',
        });
      }

      res.json({
        success: true,
        data: {
          follower,
          allTimeStats,
          recentStats,
        },
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /follower/:followerId/performance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/follower/:followerId/performance/daily', async (req: Request, res: Response) => {
    try {
      const followerId = req.params.followerId as string;
      const limitStr = getQueryParam(req.query.limit);

      const stats = await followerStatsDAO.getDailyStats(
        followerId,
        limitStr ? parseInt(limitStr) : 30
      );

      res.json({
        success: true,
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /performance/daily:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/leaderboard', async (req: Request, res: Response) => {
    try {
      const periodType = getQueryParam(req.query.periodType) || 'monthly';
      const limitStr = getQueryParam(req.query.limit);

      const leaderboard = await followerStatsDAO.getLeaderboard(
        periodType as any,
        limitStr ? parseInt(limitStr) : 10
      );

      res.json({
        success: true,
        data: leaderboard,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /leaderboard:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
