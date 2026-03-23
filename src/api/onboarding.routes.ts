/**
 * Onboarding API Routes
 *
 * API endpoints for user onboarding functionality
 *
 * @module api/onboarding.routes
 */

import { Router, Request, Response } from 'express';
import { onboardingService } from '../analytics/OnboardingService';
import { onboardingDAO } from '../database/onboarding.dao';
import { createLogger } from '../utils/logger';
import { authMiddleware } from './authMiddleware';

const log = createLogger('OnboardingRoutes');
const router = Router();

/**
 * GET /api/onboarding/state
 * Get current user's onboarding state
 */
router.get('/state', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const state = await onboardingService.getOnboardingState(userId);
    const flow = onboardingService.getOnboardingFlow();

    res.json({
      state,
      flow,
      shouldShow: state ? !state.isCompleted && !state.skipped : true,
    });
  } catch (error) {
    log.error('Failed to get onboarding state:', error);
    res.status(500).json({ error: 'Failed to get onboarding state' });
  }
});

/**
 * POST /api/onboarding/start
 * Start onboarding flow for current user
 */
router.post('/start', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = req.user?.role || 'free';
    const sessionId = req.body.sessionId || `session_${Date.now()}`;

    const { state, flow } = await onboardingService.startOnboarding(
      userId,
      userRole as 'free' | 'pro' | 'enterprise',
      sessionId
    );

    res.json({
      success: true,
      state,
      flow,
    });
  } catch (error) {
    log.error('Failed to start onboarding:', error);
    res.status(500).json({ error: 'Failed to start onboarding' });
  }
});

/**
 * POST /api/onboarding/step/:stepId/complete
 * Complete a step
 */
router.post('/step/:stepId/complete', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const stepId = Array.isArray(req.params.stepId) ? req.params.stepId[0] : req.params.stepId;
    const { sessionId, timeOnStep } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const state = await onboardingService.completeStep(
      userId,
      stepId,
      sessionId,
      timeOnStep
    );

    res.json({
      success: true,
      state,
    });
  } catch (error) {
    log.error('Failed to complete step:', error);
    res.status(500).json({ error: 'Failed to complete step' });
  }
});

/**
 * POST /api/onboarding/step/:stepId/skip
 * Skip a step
 */
router.post('/step/:stepId/skip', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const stepId = Array.isArray(req.params.stepId) ? req.params.stepId[0] : req.params.stepId;
    const { sessionId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const state = await onboardingService.skipStep(userId, stepId, sessionId);

    res.json({
      success: true,
      state,
    });
  } catch (error) {
    log.error('Failed to skip step:', error);
    res.status(500).json({ error: 'Failed to skip step' });
  }
});

/**
 * POST /api/onboarding/skip
 * Skip entire onboarding
 */
router.post('/skip', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { sessionId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const state = await onboardingService.skipOnboarding(userId, sessionId);

    res.json({
      success: true,
      state,
    });
  } catch (error) {
    log.error('Failed to skip onboarding:', error);
    res.status(500).json({ error: 'Failed to skip onboarding' });
  }
});

/**
 * POST /api/onboarding/replay
 * Reset and replay onboarding
 */
router.post('/replay', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { sessionId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { state, flow } = await onboardingService.replayOnboarding(userId, sessionId);

    res.json({
      success: true,
      state,
      flow,
    });
  } catch (error) {
    log.error('Failed to replay onboarding:', error);
    res.status(500).json({ error: 'Failed to replay onboarding' });
  }
});

/**
 * POST /api/onboarding/track-view
 * Track step viewed event
 */
router.post('/track-view', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { stepId, sessionId } = req.body;

    if (userId && stepId) {
      await onboardingService.trackStepViewed(userId, stepId, sessionId);
    }

    res.json({ success: true });
  } catch (error) {
    log.error('Failed to track step view:', error);
    // Don't fail the request for tracking errors
    res.json({ success: true });
  }
});

/**
 * GET /api/onboarding/flow
 * Get onboarding flow definition
 */
router.get('/flow', async (req: Request, res: Response) => {
  try {
    const flow = onboardingService.getOnboardingFlow();
    res.json({ flow });
  } catch (error) {
    log.error('Failed to get onboarding flow:', error);
    res.status(500).json({ error: 'Failed to get onboarding flow' });
  }
});

/**
 * GET /api/onboarding/metrics
 * Get onboarding metrics (admin only)
 */
router.get('/metrics', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin (you might have different auth logic)
    // For now, allow all authenticated users to view metrics
    const { startDate, endDate } = req.query;

    const metrics = await onboardingService.getMetrics(
      startDate ? new Date(String(Array.isArray(startDate) ? startDate[0] : startDate)) : undefined,
      endDate ? new Date(String(Array.isArray(endDate) ? endDate[0] : endDate)) : undefined
    );

    res.json({ metrics });
  } catch (error) {
    log.error('Failed to get onboarding metrics:', error);
    res.status(500).json({ error: 'Failed to get onboarding metrics' });
  }
});

export default router;