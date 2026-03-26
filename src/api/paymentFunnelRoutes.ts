/**
 * Payment Funnel API Routes
 * Issue #662: 支付转化漏斗优化
 * 
 * REST endpoints for payment funnel tracking and analysis
 */

import { Router, Request, Response } from 'express';
import { authMiddleware as authenticate } from './authMiddleware';
import {
  getPaymentFunnelService,
  FunnelStage,
  DropOffReason,
  FunnelEvent,
} from '../services/paymentFunnelService';
import { createLogger } from '../utils/logger';

const log = createLogger('PaymentFunnelRoutes');

const router = Router();

// ==================== Public Routes (Client-side tracking) ====================

/**
 * POST /api/payment-funnel/track
 * Track a funnel event (public, uses session ID)
 */
router.post('/track', async (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      stage,
      userId,
      planId,
      billingPeriod,
      priceAmount,
      stripeSessionId,
      dropOffReason,
      dropOffDetails,
      experimentId,
      variantId,
      timeOnPageSeconds,
      pageUrl,
      referrer,
      userAgent,
      deviceType,
      country,
    } = req.body;

    // Validate required fields
    if (!sessionId || !stage) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId and stage',
      });
    }

    // Validate stage
    const validStages: FunnelStage[] = [
      'subscription_page_view',
      'plan_selected',
      'checkout_initiated',
      'checkout_loaded',
      'payment_method_entered',
      'payment_submitted',
      'payment_succeeded',
      'payment_failed',
      'checkout_canceled',
    ];

    if (!validStages.includes(stage)) {
      return res.status(400).json({
        error: `Invalid stage. Must be one of: ${validStages.join(', ')}`,
      });
    }

    const service = getPaymentFunnelService();
    const result = await service.trackEvent({
      sessionId,
      stage,
      userId,
      planId,
      billingPeriod,
      priceAmount,
      stripeSessionId,
      dropOffReason,
      dropOffDetails,
      experimentId,
      variantId,
      timeOnPageSeconds,
      pageUrl,
      referrer,
      userAgent,
      deviceType,
      country,
    });

    res.json({
      success: true,
      eventId: result.eventId,
    });
  } catch (error) {
    log.error('Failed to track funnel event:', error);
    res.status(500).json({ error: 'Failed to track funnel event' });
  }
});

/**
 * POST /api/payment-funnel/track-batch
 * Track multiple funnel events in batch
 */
router.post('/track-batch', async (req: Request, res: Response) => {
  try {
    const { events } = req.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid events array',
      });
    }

    const service = getPaymentFunnelService();
    await service.trackEvents(events);

    res.json({
      success: true,
      count: events.length,
    });
  } catch (error) {
    log.error('Failed to track batch events:', error);
    res.status(500).json({ error: 'Failed to track batch events' });
  }
});

// ==================== Authenticated Routes ====================

/**
 * GET /api/payment-funnel/analysis
 * Get funnel analysis for a period
 */
router.get('/analysis', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const experimentId = req.query.experimentId as string | undefined;

    const service = getPaymentFunnelService();
    const analysis = await service.getFunnelAnalysis(startDate, endDate, experimentId);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    log.error('Failed to get funnel analysis:', error);
    res.status(500).json({ error: 'Failed to get funnel analysis' });
  }
});

/**
 * GET /api/payment-funnel/dropoff-analysis
 * Get drop-off analysis
 */
router.get('/dropoff-analysis', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const limit = parseInt(req.query.limit as string) || 10;

    const service = getPaymentFunnelService();
    const analysis = await service.getDropOffAnalysis(startDate, endDate, limit);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    log.error('Failed to get drop-off analysis:', error);
    res.status(500).json({ error: 'Failed to get drop-off analysis' });
  }
});

/**
 * GET /api/payment-funnel/conversion-by-plan
 * Get conversion rate by plan
 */
router.get('/conversion-by-plan', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const service = getPaymentFunnelService();
    const data = await service.getConversionByPlan(startDate, endDate);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    log.error('Failed to get conversion by plan:', error);
    res.status(500).json({ error: 'Failed to get conversion by plan' });
  }
});

/**
 * GET /api/payment-funnel/conversion-by-device
 * Get conversion rate by device type
 */
router.get('/conversion-by-device', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const service = getPaymentFunnelService();
    const data = await service.getConversionByDevice(startDate, endDate);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    log.error('Failed to get conversion by device:', error);
    res.status(500).json({ error: 'Failed to get conversion by device' });
  }
});

/**
 * GET /api/payment-funnel/optimization-suggestions
 * Get AI-powered optimization suggestions
 */
router.get('/optimization-suggestions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const service = getPaymentFunnelService();
    const suggestions = await service.generateOptimizationSuggestions(startDate, endDate);

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    log.error('Failed to get optimization suggestions:', error);
    res.status(500).json({ error: 'Failed to get optimization suggestions' });
  }
});

/**
 * GET /api/payment-funnel/ab-test/:experimentId
 * Get A/B test results for a payment experiment
 */
router.get('/ab-test/:experimentId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { experimentId } = req.params;
    const experimentIdStr = Array.isArray(experimentId) ? experimentId[0] : experimentId;

    const service = getPaymentFunnelService();
    const results = await service.getABTestResults(experimentIdStr);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    log.error('Failed to get A/B test results:', error);
    res.status(500).json({ error: 'Failed to get A/B test results' });
  }
});

/**
 * GET /api/payment-funnel/session/:sessionId
 * Get session details
 */
router.get('/session/:sessionId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.params;
    const sessionIdStr = Array.isArray(sessionId) ? sessionId[0] : sessionId;

    const service = getPaymentFunnelService();
    const session = await service.getSession(sessionIdStr);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    log.error('Failed to get session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * POST /api/payment-funnel/calculate-stats
 * Trigger daily statistics calculation
 */
router.post('/calculate-stats', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { date } = req.body;
    const targetDate = date ? new Date(date) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const service = getPaymentFunnelService();
    await service.calculateDailyStats(targetDate);

    res.json({
      success: true,
      message: `Statistics calculated for ${targetDate.toISOString().split('T')[0]}`,
    });
  } catch (error) {
    log.error('Failed to calculate stats:', error);
    res.status(500).json({ error: 'Failed to calculate stats' });
  }
});

/**
 * GET /api/payment-funnel/dashboard
 * Get all dashboard data in one request
 */
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const service = getPaymentFunnelService();

    // Fetch all data in parallel
    const [
      analysis,
      dropOffAnalysis,
      conversionByPlan,
      conversionByDevice,
      suggestions,
    ] = await Promise.all([
      service.getFunnelAnalysis(startDate, endDate),
      service.getDropOffAnalysis(startDate, endDate, 5),
      service.getConversionByPlan(startDate, endDate),
      service.getConversionByDevice(startDate, endDate),
      service.generateOptimizationSuggestions(startDate, endDate),
    ]);

    res.json({
      success: true,
      data: {
        analysis,
        dropOffAnalysis,
        conversionByPlan,
        conversionByDevice,
        suggestions,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    log.error('Failed to get dashboard data:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

export default router;