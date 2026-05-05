/**
 * Share Routes
 * API endpoints for social sharing and share statistics
 */

import { Router, Request, Response } from 'express';
import { getShareStatsDAO, SharePlatform, ShareContentType } from '../database/share-stats.dao';
import { getReferralDAO } from '../database/referral.dao';
import { authMiddleware, optionalAuthMiddleware, requireAdmin } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('ShareRoutes');

const router = Router();

/**
 * POST /api/share/record
 * Record a share event
 */
router.post('/record', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { platform, contentType, contentId, referralCode, utmSource, utmMedium, utmCampaign, shareUrl, metadata } = req.body;

    // Validate platform
    const validPlatforms: SharePlatform[] = [
      'wechat', 'wechat_moments', 'weibo', 'twitter', 
      'linkedin', 'facebook', 'clipboard', 'native'
    ];
    if (!platform || !validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid platform',
      });
    }

    // Validate content type
    const validContentTypes: ShareContentType[] = [
      'profile', 'trade_result', 'strategy_performance', 
      'referral_link', 'leaderboard', 'custom'
    ];
    if (!contentType || !validContentTypes.includes(contentType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid content type',
      });
    }

    const shareStatsDAO = getShareStatsDAO();
    const event = await shareStatsDAO.recordShareEvent({
      userId: req.user?.id,
      platform,
      contentType,
      contentId,
      referralCode,
      utmSource: utmSource || 'web',
      utmMedium: utmMedium || 'social',
      utmCampaign: utmCampaign || 'share',
      shareUrl,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: {
        id: event.id,
        recordedAt: event.createdAt,
      },
    });
  } catch (error) {
    log.error('Failed to record share event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record share event',
    });
  }
});

/**
 * POST /api/share/referral
 * Create and track a referral share
 */
router.post('/referral', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { platform } = req.body;

    // Get user's referral code
    const referralDAO = getReferralDAO();
    const referralCode = await referralDAO.getOrCreateReferralCode(req.user.id);

    // Generate share URL with referral code
    // Get base URL from environment - no hardcoded fallbacks
    const baseUrl = process.env.BASE_URL || process.env.FRONTEND_URL || '';
    if (!baseUrl) {
      return res.status(500).json({ error: 'BASE_URL or FRONTEND_URL not configured' });
    }
    const shareUrl = `${baseUrl}/register?ref=${referralCode.code}&utm_source=${platform}&utm_medium=referral&utm_campaign=share`;

    // Record the share event
    const shareStatsDAO = getShareStatsDAO();
    await shareStatsDAO.recordShareEvent({
      userId: req.user.id,
      platform: platform || 'clipboard',
      contentType: 'referral_link',
      referralCode: referralCode.code,
      utmSource: platform || 'web',
      utmMedium: 'referral',
      utmCampaign: 'share',
      shareUrl,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      data: {
        referralCode: referralCode.code,
        shareUrl,
        referralLink: `${baseUrl}/register?ref=${referralCode.code}`,
      },
    });
  } catch (error) {
    log.error('Failed to create referral share:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create referral share',
    });
  }
});

/**
 * GET /api/share/stats
 * Get global share statistics (admin only)
 */
router.get('/stats', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const shareStatsDAO = getShareStatsDAO();
    const stats = await shareStatsDAO.getGlobalStats(startDate, endDate);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    log.error('Failed to get share stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get share statistics',
    });
  }
});

/**
 * GET /api/share/stats/me
 * Get current user's share statistics
 */
router.get('/stats/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const shareStatsDAO = getShareStatsDAO();
    const stats = await shareStatsDAO.getUserStats(req.user.id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    log.error('Failed to get user share stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get share statistics',
    });
  }
});

/**
 * GET /api/share/platform-distribution
 * Get platform distribution for shares
 */
router.get('/platform-distribution', authMiddleware, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const shareStatsDAO = getShareStatsDAO();
    const distribution = await shareStatsDAO.getPlatformDistribution(
      req.user?.id,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    log.error('Failed to get platform distribution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get platform distribution',
    });
  }
});

/**
 * GET /api/share/conversion-rate
 * Get share-to-signup conversion rate (admin only)
 */
router.get('/conversion-rate', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const shareStatsDAO = getShareStatsDAO();
    const conversionRate = await shareStatsDAO.getConversionRate(startDate, endDate);

    res.json({
      success: true,
      data: conversionRate,
    });
  } catch (error) {
    log.error('Failed to get conversion rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversion rate',
    });
  }
});

/**
 * GET /api/share/content/:type
 * Get share count for specific content type
 */
router.get('/content/:type', async (req: Request, res: Response) => {
  try {
    const contentType = req.params.type as ShareContentType;

    const shareStatsDAO = getShareStatsDAO();
    const count = await shareStatsDAO.getShareCountByContent(contentType);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    log.error('Failed to get share count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get share count',
    });
  }
});

/**
 * GET /api/share/content/:type/:id
 * Get share count for specific content by ID
 */
router.get('/content/:type/:id', async (req: Request, res: Response) => {
  try {
    const contentType = req.params.type as ShareContentType;
    const contentIdParam = req.params.id;
    const contentId = Array.isArray(contentIdParam) ? contentIdParam[0] : contentIdParam;

    const shareStatsDAO = getShareStatsDAO();
    const count = await shareStatsDAO.getShareCountByContent(contentType, contentId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    log.error('Failed to get share count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get share count',
    });
  }
});

/**
 * POST /api/share/generate-image
 * Generate a shareable image (returns canvas data URL)
 * This endpoint provides configuration for client-side image generation
 */
router.post('/generate-image', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;

    // Return configuration for client-side image generation
    // The actual image generation happens on the client using Canvas
    const config = {
      type,
      template: getShareImageTemplate(type, data),
      data,
    };

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    log.error('Failed to generate share image config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate share image configuration',
    });
  }
});

/**
 * Helper function to get share image template configuration
 */
function getShareImageTemplate(type: string, data: Record<string, unknown>): Record<string, unknown> {
  const baseTemplate = {
    width: 1200,
    height: 630,
    backgroundColor: '#1a1a2e',
    primaryColor: '#4a9eff',
    textColor: '#ffffff',
    logo: '/logo-white.png',
    branding: 'AlphaArena',
  };

  switch (type) {
    case 'trade_result':
      return {
        ...baseTemplate,
        title: '交易结果',
        layout: 'trade',
        fields: ['pair', 'side', 'profit', 'percentage'],
      };
    case 'strategy_performance':
      return {
        ...baseTemplate,
        title: '策略表现',
        layout: 'strategy',
        fields: ['name', 'return', 'winRate', 'trades'],
      };
    case 'referral':
      return {
        ...baseTemplate,
        title: '邀请好友',
        layout: 'referral',
        fields: ['referralCode', 'reward'],
      };
    case 'profile':
      return {
        ...baseTemplate,
        title: '我的主页',
        layout: 'profile',
        fields: ['username', 'rank', 'performance'],
      };
    case 'leaderboard':
      return {
        ...baseTemplate,
        title: '排行榜',
        layout: 'leaderboard',
        fields: ['rank', 'performance', 'period'],
      };
    default:
      return baseTemplate;
  }
}

export default router;