/**
 * Experiment System Routes
 * Handles A/B testing experiment management and tracking
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getExperimentDAO } from '../database/experiment.dao';
import { getExperimentService } from '../services/experiment/ExperimentService';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('ExperimentRoutes');

const router = Router();

// Admin middleware - check if user is admin
const adminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
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

// ============================================
// Public Endpoints (for client-side experiment participation)
// ============================================

/**
 * GET /api/experiments/variant/:experimentName
 * Get the variant for the current user in an experiment
 */
router.get('/variant/:experimentName', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const experimentName = String(req.params.experimentName);
    const experimentService = getExperimentService();

    const { variant, experiment, isNewAssignment } = await experimentService.getVariant({
      experimentName,
      userId: req.user.id,
      context: {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      },
    });

    res.json({
      success: true,
      data: {
        inExperiment: variant !== null,
        variant: variant ? {
          name: variant.name,
          config: variant.config,
          isControl: variant.isControl,
        } : null,
        experiment: experiment ? {
          name: experiment.name,
          type: experiment.experimentType,
        } : null,
        isNewAssignment,
      },
    });
  } catch (error) {
    log.error('Failed to get variant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get experiment variant',
    });
  }
});

/**
 * POST /api/experiments/convert/:experimentName
 * Track a conversion event for an experiment
 */
router.post('/convert/:experimentName', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const experimentName = String(req.params.experimentName);
    const { eventName, eventData, conversionValue } = req.body;

    const experimentService = getExperimentService();

    const result = await experimentService.trackConversion({
      experimentName,
      userId: req.user.id,
      eventName,
      eventData,
      conversionValue,
    });

    res.json({
      success: result.success,
      data: {
        alreadyConverted: result.alreadyConverted,
      },
    });
  } catch (error) {
    log.error('Failed to track conversion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track conversion',
    });
  }
});

/**
 * GET /api/experiments/active
 * Get all active experiments for the current user
 */
router.get('/active', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const experimentService = getExperimentService();

    const experiments = await experimentService.getUserActiveExperiments(req.user.id);

    res.json({
      success: true,
      data: {
        experiments: experiments.map(e => ({
          experimentName: e.experimentName,
          variantName: e.variantName,
          config: e.config,
          isControl: e.isControl,
        })),
      },
    });
  } catch (error) {
    log.error('Failed to get active experiments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active experiments',
    });
  }
});

// ============================================
// Admin Endpoints (for managing experiments)
// ============================================

/**
 * POST /api/experiments/admin
 * Create a new experiment
 */
router.post('/admin', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const {
      name,
      description,
      experimentType,
      targetAudience,
      trafficAllocation,
      significanceLevel,
      minimumSampleSize,
      variants,
    } = req.body;

    if (!name || !variants || !Array.isArray(variants)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, variants',
      });
    }

    const experimentService = getExperimentService();

    const result = await experimentService.createExperiment({
      name,
      description,
      experimentType,
      targetAudience,
      trafficAllocation,
      significanceLevel,
      minimumSampleSize,
      variants,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: {
        experiment: {
          id: result.experiment.id,
          name: result.experiment.name,
          description: result.experiment.description,
          type: result.experiment.experimentType,
          status: result.experiment.status,
          createdAt: result.experiment.createdAt,
        },
        variants: result.variants.map(v => ({
          id: v.id,
          name: v.name,
          config: v.config,
          trafficPercentage: v.trafficPercentage,
          isControl: v.isControl,
        })),
      },
    });
  } catch (error) {
    log.error('Failed to create experiment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create experiment',
    });
  }
});

/**
 * GET /api/experiments/admin
 * List all experiments
 */
router.get('/admin', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const status = typeof req.query.status === 'string' ? req.query.status as any : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type as any : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
    const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;

    const experimentService = getExperimentService();

    const result = await experimentService.listExperiments({
      status,
      type,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        experiments: result.experiments.map(e => ({
          experiment: {
            id: e.experiment.id,
            name: e.experiment.name,
            description: e.experiment.description,
            type: e.experiment.experimentType,
            status: e.experiment.status,
            startDate: e.experiment.startDate,
            endDate: e.experiment.endDate,
            trafficAllocation: e.experiment.trafficAllocation,
            createdAt: e.experiment.createdAt,
          },
          variants: e.variants.map(v => ({
            id: v.id,
            name: v.name,
            participants: v.participants,
            conversions: v.conversions,
            conversionRate: v.conversionRate,
            isControl: v.isControl,
          })),
        })),
        total: result.total,
      },
    });
  } catch (error) {
    log.error('Failed to list experiments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list experiments',
    });
  }
});

/**
 * GET /api/experiments/admin/:experimentId
 * Get experiment details
 */
router.get('/admin/:experimentId', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const experimentId = String(req.params.experimentId);
    const experimentService = getExperimentService();

    const result = await experimentService.getExperimentResults(experimentId);

    res.json({
      success: true,
      data: {
        experiment: {
          id: result.experiment.id,
          name: result.experiment.name,
          description: result.experiment.description,
          type: result.experiment.experimentType,
          status: result.experiment.status,
          startDate: result.experiment.startDate,
          endDate: result.experiment.endDate,
          trafficAllocation: result.experiment.trafficAllocation,
          significanceLevel: result.experiment.significanceLevel,
          minimumSampleSize: result.experiment.minimumSampleSize,
          winningVariantId: result.experiment.winningVariantId,
          createdAt: result.experiment.createdAt,
        },
        variants: result.variants.map(v => ({
          id: v.id,
          name: v.name,
          description: v.description,
          config: v.config,
          trafficPercentage: v.trafficPercentage,
          participants: v.participants,
          conversions: v.conversions,
          conversionRate: v.conversionRate,
          isControl: v.isControl,
        })),
        statistics: result.statistics,
      },
    });
  } catch (error) {
    log.error('Failed to get experiment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get experiment',
    });
  }
});

/**
 * POST /api/experiments/admin/:experimentId/start
 * Start an experiment
 */
router.post('/admin/:experimentId/start', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const experimentId = String(req.params.experimentId);
    const experimentService = getExperimentService();

    const experiment = await experimentService.startExperiment(experimentId);

    res.json({
      success: true,
      data: {
        id: experiment.id,
        name: experiment.name,
        status: experiment.status,
        startDate: experiment.startDate,
      },
    });
  } catch (error) {
    log.error('Failed to start experiment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start experiment',
    });
  }
});

/**
 * POST /api/experiments/admin/:experimentId/pause
 * Pause an experiment
 */
router.post('/admin/:experimentId/pause', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const experimentId = String(req.params.experimentId);
    const experimentService = getExperimentService();

    const experiment = await experimentService.pauseExperiment(experimentId);

    res.json({
      success: true,
      data: {
        id: experiment.id,
        name: experiment.name,
        status: experiment.status,
      },
    });
  } catch (error) {
    log.error('Failed to pause experiment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause experiment',
    });
  }
});

/**
 * POST /api/experiments/admin/:experimentId/complete
 * Complete an experiment
 */
router.post('/admin/:experimentId/complete', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const experimentId = String(req.params.experimentId);
    const { winningVariantId } = req.body;

    const experimentService = getExperimentService();

    const experiment = await experimentService.completeExperiment(experimentId, winningVariantId);

    res.json({
      success: true,
      data: {
        id: experiment.id,
        name: experiment.name,
        status: experiment.status,
        endDate: experiment.endDate,
        winningVariantId: experiment.winningVariantId,
      },
    });
  } catch (error) {
    log.error('Failed to complete experiment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete experiment',
    });
  }
});

/**
 * PUT /api/experiments/admin/:experimentId
 * Update experiment configuration
 */
router.put('/admin/:experimentId', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const experimentId = String(req.params.experimentId);
    const { name, description, trafficAllocation } = req.body;

    const experimentService = getExperimentService();

    const experiment = await experimentService.updateExperiment(experimentId, {
      name,
      description,
      trafficAllocation,
    });

    res.json({
      success: true,
      data: {
        id: experiment.id,
        name: experiment.name,
        description: experiment.description,
        trafficAllocation: experiment.trafficAllocation,
      },
    });
  } catch (error) {
    log.error('Failed to update experiment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update experiment',
    });
  }
});

/**
 * PUT /api/experiments/admin/variants/:variantId
 * Update variant configuration
 */
router.put('/admin/variants/:variantId', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const variantId = String(req.params.variantId);
    const { name, description, config, trafficPercentage } = req.body;

    const experimentService = getExperimentService();

    const variant = await experimentService.updateVariant(variantId, {
      name,
      description,
      config,
      trafficPercentage,
    });

    res.json({
      success: true,
      data: {
        id: variant.id,
        name: variant.name,
        description: variant.description,
        config: variant.config,
        trafficPercentage: variant.trafficPercentage,
      },
    });
  } catch (error) {
    log.error('Failed to update variant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update variant',
    });
  }
});

/**
 * DELETE /api/experiments/admin/:experimentId
 * Delete an experiment (draft only)
 */
router.delete('/admin/:experimentId', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const experimentId = String(req.params.experimentId);
    const experimentService = getExperimentService();

    await experimentService.deleteExperiment(experimentId);

    res.json({
      success: true,
      data: {
        message: 'Experiment deleted',
      },
    });
  } catch (error) {
    log.error('Failed to delete experiment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete experiment',
    });
  }
});

/**
 * GET /api/experiments/admin/:experimentId/events
 * Get events for an experiment
 */
router.get('/admin/:experimentId/events', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const experimentId = String(req.params.experimentId);
    const eventType = typeof req.query.eventType === 'string' ? req.query.eventType : undefined;
    const eventName = typeof req.query.eventName === 'string' ? req.query.eventName : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 100;
    const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;

    const experimentDAO = getExperimentDAO();

    const result = await experimentDAO.getExperimentEvents(experimentId, {
      eventType,
      eventName,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        events: result.events.map(e => ({
          id: e.id,
          eventType: e.eventType,
          eventName: e.eventName,
          eventData: e.eventData,
          createdAt: e.createdAt,
        })),
        total: result.total,
      },
    });
  } catch (error) {
    log.error('Failed to get experiment events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get experiment events',
    });
  }
});

export default router;