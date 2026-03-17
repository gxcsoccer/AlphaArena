import { Router, Request, Response } from 'express';
import { TradeJournalDAO } from '../database/trade-journal.dao';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('TradeJournalRoutes');

// Helper to get single string from query param
function getQueryParam(value: any): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

export function createTradeJournalRouter(): Router {
  const router = Router();
  const tradeJournalDAO = new TradeJournalDAO();

  // All routes require authentication
  router.use(authMiddleware);

  /**
   * POST /api/trade-journal
   * Create a new trade journal entry
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { symbol, type, entryPrice, entryQuantity, entryReason, entryDate, notes, tags, emotion, screenshots, strategyId, strategyName } = req.body;

      // Validate required fields
      if (!symbol || !type || entryPrice === undefined || entryQuantity === undefined || !emotion) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: symbol, type, entryPrice, entryQuantity, emotion',
        });
      }

      // Validate type
      if (type !== 'long' && type !== 'short') {
        return res.status(400).json({
          success: false,
          error: 'Type must be either "long" or "short"',
        });
      }

      // Validate emotion
      const validEmotions = ['confident', 'hesitant', 'fearful', 'greedy', 'regretful', 'hopeful', 'anxious', 'calm'];
      if (!validEmotions.includes(emotion)) {
        return res.status(400).json({
          success: false,
          error: `Emotion must be one of: ${validEmotions.join(', ')}`,
        });
      }

      const entry = await tradeJournalDAO.create({
        userId,
        symbol,
        type,
        entryPrice: parseFloat(entryPrice),
        entryQuantity: parseFloat(entryQuantity),
        entryReason,
        entryDate: entryDate ? new Date(entryDate) : undefined,
        notes,
        tags: tags || [],
        emotion,
        screenshots: screenshots || [],
        strategyId,
        strategyName,
      });

      log.info(`Created trade journal entry ${entry.id} for user ${userId}`);

      res.status(201).json({
        success: true,
        data: entry,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error creating trade journal entry:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/trade-journal
   * Get all trade journal entries for the authenticated user
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const symbol = getQueryParam(req.query.symbol);
      const type = getQueryParam(req.query.type) as 'long' | 'short' | undefined;
      const status = getQueryParam(req.query.status) as 'open' | 'closed' | 'cancelled' | undefined;
      const emotion = getQueryParam(req.query.emotion) as any;
      const strategyId = getQueryParam(req.query.strategyId);
      const startDate = getQueryParam(req.query.startDate);
      const endDate = getQueryParam(req.query.endDate);
      const limitStr = getQueryParam(req.query.limit);
      const offsetStr = getQueryParam(req.query.offset);

      const entries = await tradeJournalDAO.getMany({
        userId,
        symbol,
        type,
        status,
        emotion,
        strategyId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: limitStr ? parseInt(limitStr) : 100,
        offset: offsetStr ? parseInt(offsetStr) : undefined,
      });

      res.json({
        success: true,
        data: entries,
        count: entries.length,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error fetching trade journal entries:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/trade-journal/stats
   * Get trade journal statistics for the authenticated user
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const symbol = getQueryParam(req.query.symbol);
      const strategyId = getQueryParam(req.query.strategyId);
      const startDate = getQueryParam(req.query.startDate);
      const endDate = getQueryParam(req.query.endDate);

      const stats = await tradeJournalDAO.getStats(userId, {
        symbol,
        strategyId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      res.json({
        success: true,
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error fetching trade journal stats:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/trade-journal/:id
   * Get a single trade journal entry
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const entry = await tradeJournalDAO.getById(id, userId);

      if (!entry) {
        return res.status(404).json({
          success: false,
          error: 'Trade journal entry not found',
        });
      }

      res.json({
        success: true,
        data: entry,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error fetching trade journal entry:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * PUT /api/trade-journal/:id
   * Update a trade journal entry
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updateData = req.body;

      // Check if entry exists and belongs to user
      const existing = await tradeJournalDAO.getById(id, userId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Trade journal entry not found',
        });
      }

      const updated = await tradeJournalDAO.update(id, userId, updateData);

      log.info(`Updated trade journal entry ${id} for user ${userId}`);

      res.json({
        success: true,
        data: updated,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error updating trade journal entry:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/trade-journal/:id/close
   * Close a trade with exit details
   */
  router.post('/:id/close', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { exitPrice, exitQuantity, exitReason, exitDate, fees } = req.body;

      if (exitPrice === undefined) {
        return res.status(400).json({
          success: false,
          error: 'exitPrice is required',
        });
      }

      const closed = await tradeJournalDAO.closeTrade(id, userId, {
        exitPrice: parseFloat(exitPrice),
        exitQuantity: exitQuantity ? parseFloat(exitQuantity) : undefined,
        exitReason,
        exitDate: exitDate ? new Date(exitDate) : undefined,
        fees: fees ? parseFloat(fees) : undefined,
      });

      log.info(`Closed trade journal entry ${id} for user ${userId}`);

      res.json({
        success: true,
        data: closed,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error closing trade journal entry:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * DELETE /api/trade-journal/:id
   * Delete a trade journal entry
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      // Check if entry exists and belongs to user
      const existing = await tradeJournalDAO.getById(id, userId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Trade journal entry not found',
        });
      }

      await tradeJournalDAO.delete(id, userId);

      log.info(`Deleted trade journal entry ${id} for user ${userId}`);

      res.json({
        success: true,
        message: 'Trade journal entry deleted successfully',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error deleting trade journal entry:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/trade-journal/export/csv
   * Export trade journal to CSV
   */
  router.get('/export/csv', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const symbol = getQueryParam(req.query.symbol);
      const strategyId = getQueryParam(req.query.strategyId);
      const startDate = getQueryParam(req.query.startDate);
      const endDate = getQueryParam(req.query.endDate);

      const csv = await tradeJournalDAO.exportToCSV(userId, {
        symbol,
        strategyId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="trade-journal.csv"');
      res.send(csv);
    } catch (error: any) {
      log.error('Error exporting trade journal to CSV:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/trade-journal/import
   * Import trade journal entries from JSON
   */
  router.post('/import', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { entries } = req.body;

      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'entries must be a non-empty array',
        });
      }

      const result = await tradeJournalDAO.importFromJSON(userId, entries);

      log.info(`Imported ${result.success} trade journal entries for user ${userId}`);

      res.json({
        success: true,
        data: result,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error importing trade journal entries:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
}
