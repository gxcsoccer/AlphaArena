/**
 * Experiment Routes
 *
 * REST endpoints for A/B testing experiment management
 */

import { Router, Request, Response } from 'express';
import {
  experimentDAO,
  ExperimentStatus,
  EventType,
  CreateExperimentInput,
  UpdateExperimentInput,
  CreateVariantInput,
  UpdateVariantInput,
  TrackEventInput,
} from '../database/experiment.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('ExperimentRoutes');

// Helper function to safely get query parameter as string
function getQueryParam(value: any): string | undefined {
  if (Array.isArray(value)) {
    return value[0] as string;
  }
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

// Helper function to safely get route param as string
function getParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Create experiment router
 */
export function createExperimentRouter(): Router {
  const router = Router();

  // ============================================================
  // Experiment CRUD
  // ============================================================

  /**
   * POST /api/experiments
   * Create a new experiment
   *
   * @body { name, description?, targetPage, targetSelector?, trafficAllocation?, startAt?, endAt?, metadata? }
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, description, targetPage, targetSelector, trafficAllocation, startAt, endAt, metadata } =
        req.body;

      // Validation
      if (!name || typeof name !== 'string' || name.trim().length < 3) {
        return res.status(400).json({
          success: false,
          error: 'Name is required and must be at least 3 characters',
        });
      }

      if (!targetPage || typeof targetPage !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Target page is required',
        });
      }

      const userId = req.user?.id;

      const input: CreateExperimentInput = {
        name: name.trim(),
        description: description?.trim(),
        targetPage: targetPage.trim(),
        targetSelector: targetSelector?.trim(),
        trafficAllocation: trafficAllocation ?? 100,
        startAt: startAt ? new Date(startAt) : undefined,
        endAt: endAt ? new Date(endAt) : undefined,
        createdBy: userId,
        metadata: metadata || {},
      };

      const experiment = await experimentDAO.createExperiment(input);

      log.info(`Created experiment: ${experiment.id} (${experiment.name})`);

      res.status(201).json({
        success: true,
        data: experiment,
      });
    } catch (error: any) {
      log.error('Failed to create experiment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create experiment',
      });
    }
  });

  /**
   * GET /api/experiments
   * List all experiments
   *
   * @query status - Filter by status
   * @query targetPage - Filter by target page
   * @query search - Search by name/description
   * @query limit - Number of results (default: 50)
   * @query offset - Pagination offset (default: 0)
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const status = getQueryParam(req.query.status) as ExperimentStatus | undefined;
      const targetPage = getQueryParam(req.query.targetPage);
      const createdBy = getQueryParam(req.query.createdBy);
      const search = getQueryParam(req.query.search);
      const startDateStr = getQueryParam(req.query.startDate);
      const endDateStr = getQueryParam(req.query.endDate);
      const startDate = startDateStr ? new Date(startDateStr) : undefined;
      const endDate = endDateStr ? new Date(endDateStr) : undefined;
      const limit = parseInt(getQueryParam(req.query.limit) || '50', 10);
      const offset = parseInt(getQueryParam(req.query.offset) || '0', 10);

      const experiments = await experimentDAO.getExperiments({
        status,
        targetPage,
        createdBy,
        search,
        startDate,
        endDate,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: experiments,
        limit,
        offset,
      });
    } catch (error: any) {
      log.error('Failed to list experiments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list experiments',
      });
    }
  });

  /**
   * GET /api/experiments/:id
   * Get a specific experiment
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);

      const experiment = await experimentDAO.getExperimentById(id);
      if (!experiment) {
        return res.status(404).json({
          success: false,
          error: 'Experiment not found',
        });
      }

      // Also get variants
      const variants = await experimentDAO.getVariantsByExperimentId(id);

      res.json({
        success: true,
        data: {
          ...experiment,
          variants,
        },
      });
    } catch (error: any) {
      log.error('Failed to get experiment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get experiment',
      });
    }
  });

  /**
   * PATCH /api/experiments/:id
   * Update an experiment
   */
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);
      const { name, description, status, targetPage, targetSelector, trafficAllocation, startAt, endAt, metadata } =
        req.body;

      // Validate status if provided
      const validStatuses = ['draft', 'running', 'paused', 'completed', 'archived'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
      }

      const input: UpdateExperimentInput = {
        name: name?.trim(),
        description: description?.trim(),
        status,
        targetPage: targetPage?.trim(),
        targetSelector: targetSelector?.trim(),
        trafficAllocation,
        startAt: startAt ? new Date(startAt) : undefined,
        endAt: endAt ? new Date(endAt) : undefined,
        metadata,
      };

      // Filter out undefined values
      Object.keys(input).forEach((key) => {
        if (input[key as keyof UpdateExperimentInput] === undefined) {
          delete input[key as keyof UpdateExperimentInput];
        }
      });

      const experiment = await experimentDAO.updateExperiment(id, input);

      log.info(`Updated experiment: ${id} (status: ${experiment.status})`);

      res.json({
        success: true,
        data: experiment,
      });
    } catch (error: any) {
      log.error('Failed to update experiment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update experiment',
      });
    }
  });

  /**
   * POST /api/experiments/:id/start
   * Start an experiment
   */
  router.post('/:id/start', async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);

      const experiment = await experimentDAO.getExperimentById(id);
      if (!experiment) {
        return res.status(404).json({
          success: false,
          error: 'Experiment not found',
        });
      }

      if (experiment.status !== 'draft' && experiment.status !== 'paused') {
        return res.status(400).json({
          success: false,
          error: `Cannot start experiment with status: ${experiment.status}`,
        });
      }

      // Check if variants exist
      const variants = await experimentDAO.getVariantsByExperimentId(id);
      if (variants.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Experiment must have at least 2 variants to start',
        });
      }

      const updated = await experimentDAO.updateExperiment(id, {
        status: ExperimentStatus.RUNNING,
        startAt: experiment.startAt || new Date(),
      });

      log.info(`Started experiment: ${id}`);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      log.error('Failed to start experiment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start experiment',
      });
    }
  });

  /**
   * POST /api/experiments/:id/stop
   * Stop an experiment
   */
  router.post('/:id/stop', async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);

      const experiment = await experimentDAO.getExperimentById(id);
      if (!experiment) {
        return res.status(404).json({
          success: false,
          error: 'Experiment not found',
        });
      }

      if (experiment.status !== 'running') {
        return res.status(400).json({
          success: false,
          error: `Cannot stop experiment with status: ${experiment.status}`,
        });
      }

      const updated = await experimentDAO.updateExperiment(id, {
        status: ExperimentStatus.COMPLETED,
        endAt: new Date(),
      });

      // Calculate final statistics
      await experimentDAO.calculateStatistics(id);

      log.info(`Stopped experiment: ${id}`);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      log.error('Failed to stop experiment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop experiment',
      });
    }
  });

  /**
   * DELETE /api/experiments/:id
   * Delete an experiment
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);

      await experimentDAO.deleteExperiment(id);

      log.info(`Deleted experiment: ${id}`);

      res.json({
        success: true,
        message: 'Experiment deleted successfully',
      });
    } catch (error: any) {
      log.error('Failed to delete experiment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete experiment',
      });
    }
  });

  // ============================================================
  // Variant CRUD
  // ============================================================

  /**
   * POST /api/experiments/:id/variants
   * Create a variant for an experiment
   */
  router.post('/:id/variants', async (req: Request, res: Response) => {
    try {
      const experimentId = getParam(req.params.id);
      const { name, key, description, trafficWeight, isControl, config } = req.body;

      // Validation
      if (!name || typeof name !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Variant name is required',
        });
      }

      if (!key || typeof key !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Variant key is required',
        });
      }

      // Check experiment exists
      const experiment = await experimentDAO.getExperimentById(experimentId);
      if (!experiment) {
        return res.status(404).json({
          success: false,
          error: 'Experiment not found',
        });
      }

      // Cannot add variants to running experiment
      if (experiment.status === 'running') {
        return res.status(400).json({
          success: false,
          error: 'Cannot add variants to a running experiment',
        });
      }

      const input: CreateVariantInput = {
        experimentId,
        name: name.trim(),
        key: key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        description: description?.trim(),
        trafficWeight: trafficWeight ?? 50,
        isControl: isControl ?? false,
        config: config || {},
      };

      const variant = await experimentDAO.createVariant(input);

      log.info(`Created variant: ${variant.id} for experiment: ${experimentId}`);

      res.status(201).json({
        success: true,
        data: variant,
      });
    } catch (error: any) {
      log.error('Failed to create variant:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create variant',
      });
    }
  });

  /**
   * GET /api/experiments/:id/variants
   * Get all variants for an experiment
   */
  router.get('/:id/variants', async (req: Request, res: Response) => {
    try {
      const experimentId = getParam(req.params.id);

      const variants = await experimentDAO.getVariantsByExperimentId(experimentId);

      res.json({
        success: true,
        data: variants,
      });
    } catch (error: any) {
      log.error('Failed to get variants:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get variants',
      });
    }
  });

  /**
   * PATCH /api/experiments/:id/variants/:variantId
   * Update a variant
   */
  router.patch('/:id/variants/:variantId', async (req: Request, res: Response) => {
    try {
      const experimentId = getParam(req.params.id);
      const variantId = getParam(req.params.variantId);
      const { name, description, trafficWeight, config } = req.body;

      const input: UpdateVariantInput = {
        name: name?.trim(),
        description: description?.trim(),
        trafficWeight,
        config,
      };

      const variant = await experimentDAO.updateVariant(variantId, input);

      log.info(`Updated variant: ${variantId}`);

      res.json({
        success: true,
        data: variant,
      });
    } catch (error: any) {
      log.error('Failed to update variant:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update variant',
      });
    }
  });

  /**
   * DELETE /api/experiments/:id/variants/:variantId
   * Delete a variant
   */
  router.delete('/:id/variants/:variantId', async (req: Request, res: Response) => {
    try {
      const experimentId = getParam(req.params.id);
      const variantId = getParam(req.params.variantId);

      // Check experiment exists and is not running
      const experiment = await experimentDAO.getExperimentById(experimentId);
      if (!experiment) {
        return res.status(404).json({
          success: false,
          error: 'Experiment not found',
        });
      }

      if (experiment.status === 'running') {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete variants from a running experiment',
        });
      }

      await experimentDAO.deleteVariant(variantId);

      log.info(`Deleted variant: ${variantId}`);

      res.json({
        success: true,
        message: 'Variant deleted successfully',
      });
    } catch (error: any) {
      log.error('Failed to delete variant:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete variant',
      });
    }
  });

  // ============================================================
  // Client API (for frontend SDK)
  // ============================================================

  /**
   * POST /api/experiments/assign
   * Assign a user/session to variants for active experiments
   *
   * @body { experiments: string[], sessionId, userId?, deviceId? }
   */
  router.post('/assign', async (req: Request, res: Response) => {
    try {
      const { experiments, sessionId, userId, deviceId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required',
        });
      }

      if (!Array.isArray(experiments) || experiments.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Experiments array is required',
        });
      }

      const assignments: Record<string, any> = {};

      for (const experimentId of experiments) {
        try {
          const variant = await experimentDAO.assignVariant(experimentId, sessionId, userId, deviceId);
          if (variant) {
            assignments[experimentId] = {
              variantId: variant.id,
              variantKey: variant.key,
              config: variant.config,
            };
          }
        } catch (e) {
          // Log but continue with other experiments
          log.warn(`Failed to assign experiment ${experimentId}:`, e);
        }
      }

      res.json({
        success: true,
        data: assignments,
      });
    } catch (error: any) {
      log.error('Failed to assign variants:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to assign variants',
      });
    }
  });

  /**
   * POST /api/experiments/track
   * Track an event for an experiment
   *
   * @body { experimentId, variantId, sessionId, eventType, eventName?, eventValue?, properties?, userId? }
   */
  router.post('/track', async (req: Request, res: Response) => {
    try {
      const { experimentId, variantId, sessionId, eventType, eventName, eventValue, properties, userId } = req.body;

      // Validation
      if (!experimentId || !variantId || !sessionId || !eventType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: experimentId, variantId, sessionId, eventType',
        });
      }

      const validEventTypes = ['impression', 'click', 'conversion', 'custom'];
      if (!validEventTypes.includes(eventType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid event type. Must be one of: ${validEventTypes.join(', ')}`,
        });
      }

      const input: TrackEventInput = {
        experimentId,
        variantId,
        sessionId,
        eventType: eventType as EventType,
        eventName,
        eventValue,
        properties,
        userId,
      };

      const event = await experimentDAO.trackEvent(input);

      res.json({
        success: true,
        data: { eventId: event.id },
      });
    } catch (error: any) {
      log.error('Failed to track event:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track event',
      });
    }
  });

  // ============================================================
  // Statistics and Results
  // ============================================================

  /**
   * GET /api/experiments/:id/results
   * Get experiment results with statistical analysis
   */
  router.get('/:id/results', async (req: Request, res: Response) => {
    try {
      const experimentId = getParam(req.params.id);

      const experiment = await experimentDAO.getExperimentById(experimentId);
      if (!experiment) {
        return res.status(404).json({
          success: false,
          error: 'Experiment not found',
        });
      }

      // Calculate latest statistics
      await experimentDAO.calculateStatistics(experimentId);

      const results = await experimentDAO.getExperimentResults(experimentId);

      res.json({
        success: true,
        data: {
          experiment,
          results,
        },
      });
    } catch (error: any) {
      log.error('Failed to get experiment results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get experiment results',
      });
    }
  });

  /**
   * GET /api/experiments/:id/statistics
   * Get detailed statistics for an experiment
   */
  router.get('/:id/statistics', async (req: Request, res: Response) => {
    try {
      const experimentId = getParam(req.params.id);
      const startDateStr = getQueryParam(req.query.startDate);
      const endDateStr = getQueryParam(req.query.endDate);
      const startDate = startDateStr ? new Date(startDateStr) : undefined;
      const endDate = endDateStr ? new Date(endDateStr) : undefined;

      const statistics = await experimentDAO.getStatistics(experimentId, { startDate, endDate });

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error: any) {
      log.error('Failed to get experiment statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get experiment statistics',
      });
    }
  });

  /**
   * GET /api/experiments/:id/events
   * Get events for an experiment
   */
  router.get('/:id/events', async (req: Request, res: Response) => {
    try {
      const experimentId = getParam(req.params.id);
      const variantId = getQueryParam(req.query.variantId);
      const eventType = getQueryParam(req.query.eventType) as EventType | undefined;
      const startDateStr = getQueryParam(req.query.startDate);
      const endDateStr = getQueryParam(req.query.endDate);
      const startDate = startDateStr ? new Date(startDateStr) : undefined;
      const endDate = endDateStr ? new Date(endDateStr) : undefined;
      const limit = parseInt(getQueryParam(req.query.limit) || '100', 10);
      const offset = parseInt(getQueryParam(req.query.offset) || '0', 10);

      const events = await experimentDAO.getEvents(experimentId, {
        variantId,
        eventType,
        startDate,
        endDate,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: events,
        limit,
        offset,
      });
    } catch (error: any) {
      log.error('Failed to get experiment events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get experiment events',
      });
    }
  });

  return router;
}

// Export enums for external use
export { ExperimentStatus, EventType };

export default createExperimentRouter;