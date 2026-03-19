/**
 * User Dashboard API Routes
 * Provides endpoints for user-specific dashboard data
 */

import { Router, Request, Response } from 'express';
import { UserDashboardDAO, DashboardFilters } from '../database/user-dashboard.dao';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('UserDashboardRoutes');

const router = Router();

/**
 * GET /api/user/dashboard/overview
 * Get user overview statistics
 */
router.get('/overview', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const overview = await UserDashboardDAO.getUserOverview(userId);

    res.json({
      success: true,
      data: overview,
    });
  } catch (error: any) {
    log.error('Error fetching user overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user overview',
    });
  }
});

/**
 * GET /api/user/dashboard/strategies
 * Get user's strategies with optional filters
 */
router.get('/strategies', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const filters: DashboardFilters = {
      status: req.query.status as DashboardFilters['status'],
      type: req.query.type as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const strategies = await UserDashboardDAO.getUserStrategies(userId, filters);

    res.json({
      success: true,
      data: strategies,
    });
  } catch (error: any) {
    log.error('Error fetching user strategies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user strategies',
    });
  }
});

/**
 * GET /api/user/dashboard/trades
 * Get user's trade history with filters and pagination
 */
router.get('/trades', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const filters: DashboardFilters = {
      symbol: req.query.symbol as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await UserDashboardDAO.getUserTrades(userId, filters);

    res.json({
      success: true,
      data: result.trades,
      pagination: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: (filters.offset || 0) + (filters.limit || 20) < result.total,
      },
    });
  } catch (error: any) {
    log.error('Error fetching user trades:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user trades',
    });
  }
});

/**
 * GET /api/user/dashboard/performance
 * Get user performance metrics
 */
router.get('/performance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const performance = await UserDashboardDAO.getUserPerformance(userId);

    res.json({
      success: true,
      data: performance,
    });
  } catch (error: any) {
    log.error('Error fetching user performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user performance',
    });
  }
});

/**
 * GET /api/user/dashboard/trades/export
 * Export user trades to CSV
 */
router.get('/trades/export', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const filters: DashboardFilters = {
      symbol: req.query.symbol as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const { trades } = await UserDashboardDAO.getUserTrades(userId, { ...filters, limit: 10000 });

    // Generate CSV
    const headers = ['ID', 'Strategy', 'Symbol', 'Side', 'Price', 'Quantity', 'Total', 'PnL', 'Fee', 'Executed At'];
    const rows = trades.map(t => [
      t.id,
      t.strategyName || '',
      t.symbol,
      t.side,
      t.price.toFixed(2),
      t.quantity.toFixed(8),
      t.total.toFixed(2),
      t.pnl.toFixed(2),
      t.fee.toFixed(2),
      t.executedAt,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=user-trades.csv');
    res.send(csv);
  } catch (error: any) {
    log.error('Error exporting user trades:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export user trades',
    });
  }
});

export default router;
