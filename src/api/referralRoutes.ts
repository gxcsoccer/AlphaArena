/**
 * Referral System Routes
 * Handles referral codes, invites, and rewards
 */

import { Router, Request, Response } from 'express';
import { getReferralDAO } from '../database/referral.dao';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('ReferralRoutes');

const router = Router();

/**
 * GET /api/referral/code
 * Get or create the current user's referral code
 */
router.get('/code', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const referralDAO = getReferralDAO();
    const referralCode = await referralDAO.getOrCreateReferralCode(req.user.id);

    res.json({
      success: true,
      data: {
        code: referralCode.code,
        referralLink: `/register?ref=${referralCode.code}`,
        stats: {
          totalReferrals: referralCode.totalReferrals,
          successfulReferrals: referralCode.successfulReferrals,
          pendingRewards: referralCode.pendingRewards,
          totalRewardsEarned: referralCode.totalRewardsEarned,
        },
      },
    });
  } catch (error) {
    log.error('Failed to get referral code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get referral code',
    });
  }
});

/**
 * GET /api/referral/stats
 * Get comprehensive referral statistics for the current user
 */
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const referralDAO = getReferralDAO();
    const stats = await referralDAO.getReferralStats(req.user.id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    log.error('Failed to get referral stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get referral statistics',
    });
  }
});

/**
 * POST /api/referral/invite
 * Create a new referral invite (for sharing)
 */
router.post('/invite', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { inviteEmail } = req.body;

    const referralDAO = getReferralDAO();
    const result = await referralDAO.createReferralInvite({
      referrerUserId: req.user.id,
      inviteEmail,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to create invite',
      });
    }

    res.status(201).json({
      success: true,
      data: {
        referralId: result.referralId,
        inviteToken: result.inviteToken,
        referralLink: result.referralLink,
      },
    });
  } catch (error) {
    log.error('Failed to create referral invite:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create referral invite',
    });
  }
});

/**
 * GET /api/referral/referrals
 * Get the current user's referrals list
 */
router.get('/referrals', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
    const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;

    const referralDAO = getReferralDAO();
    const result = await referralDAO.getReferralsByReferrerUserId(req.user.id, {
      status,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        referrals: result.referrals.map(r => ({
          id: r.id,
          status: r.status,
          inviteEmail: r.inviteEmail,
          invitedAt: r.invitedAt,
          registeredAt: r.registeredAt,
          activatedAt: r.activatedAt,
        })),
        total: result.total,
      },
    });
  } catch (error) {
    log.error('Failed to get referrals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get referrals',
    });
  }
});

/**
 * GET /api/referral/rewards
 * Get the current user's rewards history
 */
router.get('/rewards', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
    const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;

    const referralDAO = getReferralDAO();
    const result = await referralDAO.getRewardsByUserId(req.user.id, {
      status,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        rewards: result.rewards.map(r => ({
          id: r.id,
          type: r.rewardType,
          amount: r.amount,
          currency: r.currency,
          status: r.status,
          description: r.description,
          scheduledAt: r.scheduledAt,
          processedAt: r.processedAt,
          createdAt: r.createdAt,
        })),
        total: result.total,
      },
    });
  } catch (error) {
    log.error('Failed to get rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rewards',
    });
  }
});

/**
 * GET /api/referral/validate/:token
 * Validate a referral invite token (public endpoint for registration flow)
 */
router.get('/validate/:token', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token);

    const referralDAO = getReferralDAO();
    
    // Try to parse as UUID (invite token) first
    let referral = null;
    try {
      referral = await referralDAO.getReferralByInviteToken(token);
    } catch {
      // Not a valid UUID, might be a referral code
    }

    // If not found by invite token, check if it's a referral code
    if (!referral) {
      const referralCode = await referralDAO.getReferralCodeByCode(token);
      if (referralCode) {
        return res.json({
          success: true,
          data: {
            valid: true,
            type: 'code',
            referrerUserId: referralCode.userId,
            message: 'Valid referral code',
          },
        });
      }
    }

    if (!referral) {
      return res.status(404).json({
        success: false,
        error: 'Invalid referral link',
      });
    }

    // Check if the referral is still valid
    if (referral.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'This referral link has been cancelled',
      });
    }

    if (referral.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'This referral link has already been used',
      });
    }

    // Check if expired (30 days)
    const invitedAt = new Date(referral.invitedAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (invitedAt < thirtyDaysAgo) {
      return res.status(400).json({
        success: false,
        error: 'This referral link has expired',
      });
    }

    res.json({
      success: true,
      data: {
        valid: true,
        type: 'invite',
        inviteToken: referral.inviteToken,
        referrerUserId: referral.referrerUserId,
        inviteEmail: referral.inviteEmail,
        message: 'Valid referral link',
      },
    });
  } catch (error) {
    log.error('Failed to validate referral token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate referral link',
    });
  }
});

/**
 * POST /api/referral/activate
 * Activate a referral (called when invitee meets activation criteria)
 * This is typically called internally when a user completes certain actions
 */
router.post('/activate', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const referralDAO = getReferralDAO();
    
    // Check if the user has a registered referral
    const referral = await referralDAO.getReferralByInviteeUserId(req.user.id);
    
    if (!referral) {
      return res.status(404).json({
        success: false,
        error: 'No referral found for this user',
      });
    }

    if (referral.status !== 'registered') {
      return res.status(400).json({
        success: false,
        error: `Referral is already ${referral.status}`,
      });
    }

    // Activate the referral
    const result = await referralDAO.activateReferral(req.user.id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to activate referral',
      });
    }

    res.json({
      success: true,
      data: {
        referralId: result.referralId,
        rewardAmount: result.rewardAmount,
        rewardScheduledAt: result.rewardScheduledAt,
        message: 'Referral activated successfully',
      },
    });
  } catch (error) {
    log.error('Failed to activate referral:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate referral',
    });
  }
});

/**
 * Admin endpoint: Process pending rewards
 * This should be called by a cron job
 */
router.post('/process-rewards', async (req: Request, res: Response) => {
  try {
    // Simple auth check - in production, use proper admin auth
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const referralDAO = getReferralDAO();
    const processedCount = await referralDAO.processPendingRewards();

    res.json({
      success: true,
      data: {
        processedCount,
        message: `Processed ${processedCount} pending rewards`,
      },
    });
  } catch (error) {
    log.error('Failed to process pending rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process pending rewards',
    });
  }
});

export default router;