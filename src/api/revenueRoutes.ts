/**
 * Revenue Analytics Routes
 * Admin-only endpoints for revenue analytics and reporting
 */

import { Router, Request, Response } from 'express';
import { 
  getRevenueDAO,
  RevenueMetrics,
  RevenueTrend,
  SubscriptionDistribution,
  ConversionFunnel,
  ChurnData,
} from '../database/revenue.dao';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('RevenueRoutes');

const router = Router();

/**
 * Admin middleware - checks if user has admin role
 */
const adminMiddleware = async (req: Request, res: Response, next: Function) => {
  const user = req.user;
  
  // Check if user has admin role
  // This can be customized based on your auth system
  const isAdmin = (user as any)?.role === 'admin' || 
                  (user as any)?.user_metadata?.role === 'admin' ||
                  process.env.ADMIN_EMAILS?.split(',').includes((user as any)?.email);
  
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }
  
  next();
};

/**
 * GET /api/revenue/metrics
 * Get overall revenue metrics (MRR, ARR, ARPU, etc.)
 */
router.get('/metrics', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const dao = getRevenueDAO();
    const metrics = await dao.getRevenueMetrics();
    
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    log.error('Failed to get revenue metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve revenue metrics',
    });
  }
});

/**
 * GET /api/revenue/trend
 * Get revenue trend data over time
 * Query params:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - granularity: 'day' | 'week' | 'month' (default: 'day')
 */
router.get('/trend', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, granularity = 'day' } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)',
      });
    }
    
    const dao = getRevenueDAO();
    const trend = await dao.getRevenueTrend(
      { startDate: start, endDate: end },
      granularity as 'day' | 'week' | 'month'
    );
    
    res.json({
      success: true,
      data: trend,
    });
  } catch (error) {
    log.error('Failed to get revenue trend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve revenue trend',
    });
  }
});

/**
 * GET /api/revenue/distribution
 * Get subscription distribution by plan
 */
router.get('/distribution', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const dao = getRevenueDAO();
    const distribution = await dao.getSubscriptionDistribution();
    
    res.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    log.error('Failed to get subscription distribution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription distribution',
    });
  }
});

/**
 * GET /api/revenue/funnel
 * Get conversion funnel data
 */
router.get('/funnel', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const dao = getRevenueDAO();
    const funnel = await dao.getConversionFunnel();
    
    res.json({
      success: true,
      data: funnel,
    });
  } catch (error) {
    log.error('Failed to get conversion funnel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversion funnel',
    });
  }
});

/**
 * GET /api/revenue/churn
 * Get churn analysis data
 * Query params:
 * - months: number of months to analyze (default: 12)
 */
router.get('/churn', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { months = 12 } = req.query;
    const monthsNum = parseInt(months as string, 10);
    
    if (isNaN(monthsNum) || monthsNum < 1 || monthsNum > 24) {
      return res.status(400).json({
        success: false,
        error: 'months must be a number between 1 and 24',
      });
    }
    
    const dao = getRevenueDAO();
    const churn = await dao.getChurnAnalysis(monthsNum);
    
    res.json({
      success: true,
      data: churn,
    });
  } catch (error) {
    log.error('Failed to get churn analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve churn analysis',
    });
  }
});

/**
 * GET /api/revenue/export/payments
 * Export revenue data as CSV
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 */
router.get('/export/payments', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
      });
    }
    
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)',
      });
    }
    
    const dao = getRevenueDAO();
    const data = await dao.exportRevenueData({ startDate: start, endDate: end });
    
    // Convert to CSV
    const headers = ['Date', 'User ID', 'User Name', 'User Email', 'Plan', 'Amount', 'Currency', 'Status', 'Payment Method'];
    const csvRows = [headers.join(',')];
    
    data.forEach(row => {
      csvRows.push([
        row.date,
        row.userId,
        `"${row.userName.replace(/"/g, '""')}"`,
        row.userEmail,
        row.planName,
        row.amount,
        row.currency,
        row.status,
        row.paymentMethod,
      ].join(','));
    });
    
    const csv = csvRows.join('\n');
    const filename = `revenue-report-${start.toISOString().slice(0, 10)}-${end.toISOString().slice(0, 10)}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Add BOM for Excel UTF-8 compatibility
    res.send('\ufeff' + csv);
  } catch (error) {
    log.error('Failed to export revenue data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export revenue data',
    });
  }
});

/**
 * GET /api/revenue/export/subscribers
 * Export subscriber list as CSV
 */
router.get('/export/subscribers', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const dao = getRevenueDAO();
    const data = await dao.exportSubscriberList();
    
    // Convert to CSV
    const headers = ['User ID', 'User Name', 'User Email', 'Plan', 'Status', 'Period Start', 'Period End', 'Stripe Customer ID', 'Total Payments', 'Total Revenue'];
    const csvRows = [headers.join(',')];
    
    data.forEach(row => {
      csvRows.push([
        row.userId,
        `"${row.userName.replace(/"/g, '""')}"`,
        row.userEmail,
        row.planName,
        row.status,
        row.currentPeriodStart,
        row.currentPeriodEnd,
        row.stripeCustomerId,
        row.totalPayments,
        row.totalRevenue,
      ].join(','));
    });
    
    const csv = csvRows.join('\n');
    const filename = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\ufeff' + csv);
  } catch (error) {
    log.error('Failed to export subscriber list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export subscriber list',
    });
  }
});

/**
 * GET /api/revenue/summary
 * Get a summary dashboard of all metrics
 */
router.get('/summary', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const dao = getRevenueDAO();
    
    // Fetch all data in parallel
    const [metrics, distribution, funnel, churn] = await Promise.all([
      dao.getRevenueMetrics(),
      dao.getSubscriptionDistribution(),
      dao.getConversionFunnel(),
      dao.getChurnAnalysis(6), // Last 6 months
    ]);
    
    // Get trend for last 30 days
    const trend = await dao.getRevenueTrend({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    }, 'day');
    
    res.json({
      success: true,
      data: {
        metrics,
        distribution,
        funnel,
        churn,
        trend,
      },
    });
  } catch (error) {
    log.error('Failed to get revenue summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve revenue summary',
    });
  }
});

export function createRevenueRouter(): Router {
  return router;
}

export default router;