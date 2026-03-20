import { Router, Request, Response } from 'express';
import {
  StrategyTemplatesDAO,
  CreateTemplateInput,
  TemplateFilter,
} from '../database/strategyTemplates.dao';
import { StrategiesDAO } from '../database/strategies.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('TemplateRoutes');

// Helper to get single string from query param
function getQueryParam(value: any): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

// Helper to safely parse int
function safeParseInt(value: any, defaultValue: number): number {
  const str = getQueryParam(value);
  if (!str) return defaultValue;
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Helper to safely parse float
function safeParseFloat(value: any, defaultValue: number | undefined): number | undefined {
  const str = getQueryParam(value);
  if (!str) return defaultValue;
  const parsed = parseFloat(str);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function createTemplateRouter(): Router {
  const router = Router();
  const templatesDAO = new StrategyTemplatesDAO();
  const strategiesDAO = new StrategiesDAO();

  /**
   * GET /api/templates
   * Get list of templates with optional filters
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const filter: TemplateFilter = {
        strategyType: getQueryParam(req.query.strategyType),
        category: getQueryParam(req.query.category),
        authorUserId: getQueryParam(req.query.authorUserId),
        isFeatured: req.query.isFeatured === 'true' ? true : undefined,
        isBuiltin: req.query.isBuiltin === 'true' ? true : undefined,
        search: getQueryParam(req.query.search),
        minRating: safeParseFloat(req.query.minRating, undefined),
        sortBy: getQueryParam(req.query.sortBy) as TemplateFilter['sortBy'],
        sortOrder: getQueryParam(req.query.sortOrder) as TemplateFilter['sortOrder'],
        limit: safeParseInt(req.query.limit, 20),
        offset: safeParseInt(req.query.offset, 0),
      };

      // Handle tags array
      if (req.query.tags) {
        const tagsParam = req.query.tags;
        if (Array.isArray(tagsParam)) {
          filter.tags = tagsParam.filter((t): t is string => typeof t === 'string');
        } else if (typeof tagsParam === 'string') {
          filter.tags = [tagsParam];
        }
      }

      const result = await templatesDAO.getTemplates(filter);

      res.json({
        success: true,
        data: result.templates,
        total: result.total,
        limit: filter.limit,
        offset: filter.offset,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /api/templates:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/templates/featured
   * Get featured templates
   */
  router.get('/featured', async (req: Request, res: Response) => {
    try {
      const limit = safeParseInt(req.query.limit, 10);
      const templates = await templatesDAO.getFeatured(limit);

      res.json({
        success: true,
        data: templates,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /api/templates/featured:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/templates/popular
   * Get popular templates by use count
   */
  router.get('/popular', async (req: Request, res: Response) => {
    try {
      const limit = safeParseInt(req.query.limit, 10);
      const templates = await templatesDAO.getPopular(limit);

      res.json({
        success: true,
        data: templates,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /api/templates/popular:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/templates/top-rated
   * Get top-rated templates
   */
  router.get('/top-rated', async (req: Request, res: Response) => {
    try {
      const limit = safeParseInt(req.query.limit, 10);
      const templates = await templatesDAO.getTopRated(limit);

      res.json({
        success: true,
        data: templates,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /api/templates/top-rated:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/templates/tags
   * Get all available tags
   */
  router.get('/tags', async (req: Request, res: Response) => {
    try {
      const tags = await templatesDAO.getAllTags();

      res.json({
        success: true,
        data: tags,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /api/templates/tags:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/templates/categories
   * Get all available categories
   */
  router.get('/categories', async (req: Request, res: Response) => {
    try {
      const categories = await templatesDAO.getCategories();

      res.json({
        success: true,
        data: categories,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /api/templates/categories:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/templates/:id
   * Get template by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const templateId = String(req.params.id);
      const template = await templatesDAO.getById(templateId);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      // Get user's rating if userId is provided
      let userRating = null;
      const userId = getQueryParam(req.query.userId);
      if (userId) {
        userRating = await templatesDAO.getUserRating(templateId, userId);
      }

      res.json({
        success: true,
        data: template,
        userRating,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /api/templates/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/templates
   * Create a new template
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const {
        name,
        description,
        authorUserId,
        authorName,
        strategyType,
        category,
        symbol,
        config,
        riskParams,
        tags,
        isPublic,
        performanceMetrics,
        backtestPeriod,
      } = req.body;

      if (!name || !strategyType || !config) {
        return res.status(400).json({
          success: false,
          error: 'name, strategyType, and config are required',
        });
      }

      const input: CreateTemplateInput = {
        name,
        description,
        authorUserId,
        authorName,
        strategyType,
        category,
        symbol,
        config,
        riskParams,
        tags,
        isPublic,
        performanceMetrics,
        backtestPeriod,
      };

      const template = await templatesDAO.create(input);

      log.info(`Created template: ${template.id} - ${template.name}`);

      res.status(201).json({
        success: true,
        data: template,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /api/templates:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/templates/:id/use
   * Use a template to create a new strategy
   */
  router.post('/:id/use', async (req: Request, res: Response) => {
    try {
      const templateId = String(req.params.id);
      const { userId, strategyName, customConfig } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required',
        });
      }

      // Get template
      const template = await templatesDAO.getById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      // Merge template config with custom config
      const finalConfig = {
        ...template.config,
        ...(customConfig || {}),
      };

      // Create strategy from template
      const strategy = await strategiesDAO.create(
        strategyName || `${template.name} (Copy)`,
        template.symbol,
        `Created from template: ${template.name}`,
        finalConfig
      );

      // Record usage
      await templatesDAO.recordUsage(templateId, userId, strategy.id);

      log.info(`User ${userId} used template ${templateId} to create strategy ${strategy.id}`);

      res.status(201).json({
        success: true,
        data: {
          strategy,
          templateSnapshot: {
            id: template.id,
            name: template.name,
            strategyType: template.strategyType,
          },
        },
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /api/templates/:id/use:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/templates/:id/rate
   * Rate a template
   */
  router.post('/:id/rate', async (req: Request, res: Response) => {
    try {
      const templateId = String(req.params.id);
      const { userId, rating, comment } = req.body;

      if (!userId || !rating) {
        return res.status(400).json({
          success: false,
          error: 'userId and rating are required',
        });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: 'rating must be between 1 and 5',
        });
      }

      // Check if template exists
      const template = await templatesDAO.getById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      const templateRating = await templatesDAO.rateTemplate(templateId, userId, rating, comment);

      log.info(`User ${userId} rated template ${templateId}: ${rating}/5`);

      res.status(201).json({
        success: true,
        data: templateRating,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /api/templates/:id/rate:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/templates/:id/ratings
   * Get ratings for a template
   */
  router.get('/:id/ratings', async (req: Request, res: Response) => {
    try {
      const templateId = String(req.params.id);
      const limit = safeParseInt(req.query.limit, 20);

      const ratings = await templatesDAO.getTemplateRatings(templateId, limit);

      res.json({
        success: true,
        data: ratings,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /api/templates/:id/ratings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/templates/:id
   * Update a template
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const templateId = String(req.params.id);
      const updates = req.body;

      // Check if template exists
      const existingTemplate = await templatesDAO.getById(templateId);
      if (!existingTemplate) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      const template = await templatesDAO.update(templateId, updates);

      log.info(`Updated template: ${templateId}`);

      res.json({
        success: true,
        data: template,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in PUT /api/templates/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/templates/:id
   * Delete a template
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const templateId = String(req.params.id);

      // Check if template exists
      const template = await templatesDAO.getById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      await templatesDAO.delete(templateId);

      log.info(`Deleted template: ${templateId}`);

      res.json({
        success: true,
        message: 'Template deleted successfully',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in DELETE /api/templates/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/templates/user/:userId
   * Get templates by author
   */
  router.get('/user/:userId', async (req: Request, res: Response) => {
    try {
      const userId = String(req.params.userId);
      const templates = await templatesDAO.getByAuthor(userId);

      res.json({
        success: true,
        data: templates,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /api/templates/user/:userId:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
