/**
 * Promo Code Routes
 * Handles promo code management, validation, and usage
 */

import { Router, Request, Response } from 'express';
import { getPromoCodeDAO } from '../database/promo-code.dao';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';
import {
  stripe,
  createCoupon,
  createPromotionCode,
  createCheckoutSession,
  getPriceId,
} from '../services/stripeService';
import { getSubscriptionDAO } from '../database/subscription.dao';

const log = createLogger('PromoCodeRoutes');

const router = Router();

// Admin middleware - check if user is admin
const adminMiddleware = async (req: Request, res: Response, next: Function) => {
  const userRole = (req.user as any)?.role;
  const userEmail = req.user?.email;
  
  // Check if user is admin by role or by email domain
  const isAdmin = userRole === 'admin' || 
    userEmail?.endsWith('@alphaarena.io') ||
    userEmail === process.env.ADMIN_EMAIL;
  
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }
  
  next();
};

// ==================== Public Endpoints ====================

/**
 * POST /api/promo-codes/validate
 * Validate a promo code
 */
router.post('/validate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { code, planId, amount } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Promo code is required',
      });
    }

    const dao = getPromoCodeDAO();
    const result = await dao.validatePromoCode(code, userId, planId, amount);

    res.json({
      success: result.valid,
      data: result,
    });
  } catch (error) {
    log.error('Failed to validate promo code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate promo code',
    });
  }
});

/**
 * GET /api/promo-codes/usage
 * Get current user's promo code usage history
 */
router.get('/usage', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const dao = getPromoCodeDAO();
    const usage = await dao.getUserPromoCodeUsage(userId);

    res.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    log.error('Failed to get promo code usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve promo code usage',
    });
  }
});

// ==================== Admin Endpoints ====================

/**
 * GET /api/promo-codes
 * List all promo codes (admin only)
 */
router.get('/', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { isActive, limit, offset } = req.query;

    const dao = getPromoCodeDAO();
    const promoCodes = await dao.listPromoCodes({
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: promoCodes,
    });
  } catch (error) {
    log.error('Failed to list promo codes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve promo codes',
    });
  }
});

/**
 * POST /api/promo-codes
 * Create a new promo code (admin only)
 */
router.post('/', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      currency,
      validFrom,
      validUntil,
      maxUses,
      maxUsesPerUser,
      applicablePlans,
      minPurchaseAmount,
      firstTimeUsersOnly,
      createStripeCoupon,
    } = req.body;

    if (!code || !discountType || discountValue === undefined) {
      return res.status(400).json({
        success: false,
        error: 'code, discountType, and discountValue are required',
      });
    }

    const dao = getPromoCodeDAO();
    let stripeCouponId: string | undefined;
    let stripePromotionCodeId: string | undefined;

    // Optionally create Stripe coupon and promotion code
    if (createStripeCoupon && stripe) {
      // Create coupon
      stripeCouponId = await createCoupon({
        percentOff: discountType === 'percentage' ? discountValue : undefined,
        amountOff: discountType === 'fixed' ? discountValue : undefined,
        currency: currency || 'cny',
        duration: 'once',
        name: description || `Promo: ${code}`,
      });

      // Create promotion code
      stripePromotionCodeId = await createPromotionCode({
        couponId: stripeCouponId,
        code: code.toUpperCase(),
        active: true,
        maxRedemptions: maxUses || undefined,
        expiresAt: validUntil ? new Date(validUntil) : undefined,
        firstTimeTransaction: firstTimeUsersOnly || false,
        restrictions: minPurchaseAmount ? {
          minimumAmount: minPurchaseAmount,
          currency: currency || 'cny',
        } : undefined,
      });
    }

    const promoCode = await dao.createPromoCode({
      code,
      description,
      discountType,
      discountValue,
      currency: currency || 'CNY',
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validUntil: validUntil ? new Date(validUntil) : null,
      maxUses: maxUses || null,
      maxUsesPerUser: maxUsesPerUser || 1,
      stripeCouponId,
      stripePromotionCodeId,
      applicablePlans: applicablePlans || null,
      minPurchaseAmount: minPurchaseAmount || null,
      firstTimeUsersOnly: firstTimeUsersOnly || false,
      createdBy: req.user?.id,
    });

    res.status(201).json({
      success: true,
      data: promoCode,
      message: 'Promo code created successfully',
    });
  } catch (error) {
    log.error('Failed to create promo code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create promo code',
    });
  }
});

/**
 * GET /api/promo-codes/:id
 * Get promo code by ID (admin only)
 */
router.get('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const dao = getPromoCodeDAO();
    const promoCode = await dao.getPromoCodeById(id);

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        error: 'Promo code not found',
      });
    }

    res.json({
      success: true,
      data: promoCode,
    });
  } catch (error) {
    log.error('Failed to get promo code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve promo code',
    });
  }
});

/**
 * PUT /api/promo-codes/:id
 * Update promo code (admin only)
 */
router.put('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updateData = req.body;

    const dao = getPromoCodeDAO();
    const promoCode = await dao.updatePromoCode(id, updateData);

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        error: 'Promo code not found',
      });
    }

    res.json({
      success: true,
      data: promoCode,
      message: 'Promo code updated successfully',
    });
  } catch (error) {
    log.error('Failed to update promo code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update promo code',
    });
  }
});

/**
 * DELETE /api/promo-codes/:id
 * Deactivate promo code (admin only)
 */
router.delete('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const dao = getPromoCodeDAO();
    await dao.deactivatePromoCode(id);

    res.json({
      success: true,
      message: 'Promo code deactivated successfully',
    });
  } catch (error) {
    log.error('Failed to deactivate promo code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate promo code',
    });
  }
});

// ==================== Trial Endpoints ====================

/**
 * GET /api/promo-codes/trial/status
 * Get current user's trial status
 */
router.get('/trial/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const dao = getPromoCodeDAO();
    const trial = await dao.getUserTrial(userId);

    res.json({
      success: true,
      data: trial,
    });
  } catch (error) {
    log.error('Failed to get trial status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve trial status',
    });
  }
});

/**
 * POST /api/promo-codes/trial/start
 * Start a trial for the current user
 */
router.post('/trial/start', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { trialDays, planId } = req.body;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const dao = getPromoCodeDAO();
    const result = await dao.startTrial(
      userId,
      trialDays || 14,
      planId || 'pro'
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        message: result.message,
        data: result.trial,
      });
    }

    res.json({
      success: true,
      data: result.trial,
      message: 'Trial started successfully',
    });
  } catch (error) {
    log.error('Failed to start trial:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start trial',
    });
  }
});

/**
 * POST /api/promo-codes/trial/cancel
 * Cancel current user's trial
 */
router.post('/trial/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const dao = getPromoCodeDAO();
    const trial = await dao.cancelTrial(userId);

    if (!trial) {
      return res.status(404).json({
        success: false,
        error: 'No active trial found',
      });
    }

    res.json({
      success: true,
      data: trial,
      message: 'Trial canceled successfully',
    });
  } catch (error) {
    log.error('Failed to cancel trial:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel trial',
    });
  }
});

/**
 * POST /api/promo-codes/checkout-with-promo
 * Create checkout session with promo code
 */
router.post('/checkout-with-promo', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const _userName = (req.user as any)?.name || (req.user as any)?.user_metadata?.name;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { planId, promoCode, successUrl, cancelUrl, billingPeriod = 'monthly' } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: 'planId is required',
      });
    }

    const subDao = getSubscriptionDAO();
    const plan = await subDao.getPlanById(planId);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found',
      });
    }

    // Validate promo code if provided
    let validatedPromo = null;
    const promoDao = getPromoCodeDAO();
    
    if (promoCode) {
      validatedPromo = await promoDao.validatePromoCode(
        promoCode,
        userId,
        planId,
        plan.price
      );

      if (!validatedPromo.valid) {
        return res.status(400).json({
          success: false,
          error: validatedPromo.message || 'Invalid promo code',
        });
      }
    }

    const priceId = plan.stripePriceId || getPriceId(planId, billingPeriod);
    
    // Create checkout session
    const checkoutUrl = await createCheckoutSession({
      userId,
      email: userEmail,
      priceId,
      successUrl: successUrl || process.env.FRONTEND_URL + '/subscription/success',
      cancelUrl: cancelUrl || process.env.FRONTEND_URL + '/subscription/cancel',
    });

    // If promo code is valid, we need to apply it differently
    // For now, store the promo code ID for later use
    if (validatedPromo?.valid && validatedPromo.promoCodeId) {
      // The promo code will be applied during webhook processing
      log.info('Promo code validated for checkout', {
        userId,
        promoCodeId: validatedPromo.promoCodeId,
        planId,
      });
    }

    res.json({
      success: true,
      data: {
        checkoutUrl,
        planId,
        promoCode: validatedPromo?.valid ? {
          code: validatedPromo.code,
          discountType: validatedPromo.discountType,
          discountValue: validatedPromo.discountValue,
        } : null,
      },
    });
  } catch (error) {
    log.error('Failed to create checkout session with promo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session',
    });
  }
});

export function createPromoCodeRouter(): Router {
  return router;
}

export default router;
