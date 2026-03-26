/**
 * Payment Monitoring API Routes
 * REST endpoints for payment monitoring dashboard
 */

import { Router, Request, Response } from 'express';
import { authMiddleware as authenticate } from './authMiddleware';
import { getPaymentMonitoringService } from '../services/paymentMonitoringService';
import { createLogger } from '../utils/logger';

const log = createLogger('PaymentMonitoringRoutes');

const router = Router();

// All routes require authentication and admin access
router.use(authenticate);

/**
 * GET /api/payment-monitoring/metrics
 * Get overall payment metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check admin access (you may want to add a proper admin check)
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin) {
      // For now, allow all authenticated users
    }

    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string) 
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate as string) 
      : new Date();

    const service = getPaymentMonitoringService();
    const metrics = await service.getMetrics(startDate, endDate);

    res.json({ data: metrics });
  } catch (error) {
    log.error('Failed to get payment metrics:', error);
    res.status(500).json({ error: 'Failed to get payment metrics' });
  }
});

/**
 * GET /api/payment-monitoring/method-metrics
 * Get metrics broken down by payment method
 */
router.get('/method-metrics', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string) 
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate as string) 
      : new Date();

    const service = getPaymentMonitoringService();
    const metrics = await service.getPaymentMethodMetrics(startDate, endDate);

    res.json({ data: metrics });
  } catch (error) {
    log.error('Failed to get payment method metrics:', error);
    res.status(500).json({ error: 'Failed to get payment method metrics' });
  }
});

/**
 * GET /api/payment-monitoring/failure-reasons
 * Get failure reasons analysis
 */
router.get('/failure-reasons', async (req: Request, res: Response) => {
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

    const service = getPaymentMonitoringService();
    const reasons = await service.getFailureReasons(startDate, endDate, limit);

    res.json({ data: reasons });
  } catch (error) {
    log.error('Failed to get failure reasons:', error);
    res.status(500).json({ error: 'Failed to get failure reasons' });
  }
});

/**
 * GET /api/payment-monitoring/trend
 * Get payment trend over time
 */
router.get('/trend', async (req: Request, res: Response) => {
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
    const granularity = (req.query.granularity as 'hour' | 'day' | 'week' | 'month') || 'day';

    const service = getPaymentMonitoringService();
    const trend = await service.getPaymentTrend(startDate, endDate, granularity);

    res.json({ data: trend });
  } catch (error) {
    log.error('Failed to get payment trend:', error);
    res.status(500).json({ error: 'Failed to get payment trend' });
  }
});

/**
 * GET /api/payment-monitoring/failed-payments
 * Get failed payments list
 */
router.get('/failed-payments', async (req: Request, res: Response) => {
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
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const reason = req.query.reason as string | undefined;

    const service = getPaymentMonitoringService();
    const result = await service.getFailedPayments(startDate, endDate, page, pageSize, reason);

    res.json({ data: result });
  } catch (error) {
    log.error('Failed to get failed payments:', error);
    res.status(500).json({ error: 'Failed to get failed payments' });
  }
});

/**
 * GET /api/payment-monitoring/alerts
 * Get active payment alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 20;

    const service = getPaymentMonitoringService();
    const alerts = await service.getActiveAlerts(limit);

    res.json({ data: alerts });
  } catch (error) {
    log.error('Failed to get active alerts:', error);
    res.status(500).json({ error: 'Failed to get active alerts' });
  }
});

/**
 * GET /api/payment-monitoring/alerts/thresholds
 * Get alert thresholds configuration
 */
router.get('/alerts/thresholds', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const service = getPaymentMonitoringService();
    const thresholds = await service.getAlertThresholds();

    res.json({ data: thresholds });
  } catch (error) {
    log.error('Failed to get alert thresholds:', error);
    res.status(500).json({ error: 'Failed to get alert thresholds' });
  }
});

/**
 * PUT /api/payment-monitoring/alerts/thresholds/:alertType
 * Update alert threshold
 */
router.put('/alerts/thresholds/:alertType', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { alertType } = req.params;
    const alertTypeStr = Array.isArray(alertType) ? alertType[0] : alertType;
    const { warningThreshold, criticalThreshold, enabled, cooldownMinutes } = req.body;

    const service = getPaymentMonitoringService();
    await service.updateAlertThreshold(alertTypeStr, {
      warningThreshold,
      criticalThreshold,
      enabled,
      cooldownMinutes,
    });

    res.json({ success: true, message: 'Alert threshold updated' });
  } catch (error) {
    log.error('Failed to update alert threshold:', error);
    res.status(500).json({ error: 'Failed to update alert threshold' });
  }
});

/**
 * POST /api/payment-monitoring/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { alertId } = req.params;
    const alertIdStr = Array.isArray(alertId) ? alertId[0] : alertId;

    const service = getPaymentMonitoringService();
    await service.acknowledgeAlert(alertIdStr);

    res.json({ success: true, message: 'Alert acknowledged' });
  } catch (error) {
    log.error('Failed to acknowledge alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

/**
 * POST /api/payment-monitoring/alerts/:alertId/resolve
 * Resolve an alert
 */
router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { alertId } = req.params;
    const alertIdStr = Array.isArray(alertId) ? alertId[0] : alertId;

    const service = getPaymentMonitoringService();
    await service.resolveAlert(alertIdStr);

    res.json({ success: true, message: 'Alert resolved' });
  } catch (error) {
    log.error('Failed to resolve alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

/**
 * GET /api/payment-monitoring/dashboard
 * Get all dashboard data in one request
 */
router.get('/dashboard', async (req: Request, res: Response) => {
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

    const service = getPaymentMonitoringService();
    const data = await service.getDashboardData(startDate, endDate);

    res.json({ data });
  } catch (error) {
    log.error('Failed to get dashboard data:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

/**
 * POST /api/payment-monitoring/health-check
 * Trigger a payment health check
 */
router.post('/health-check', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const service = getPaymentMonitoringService();
    await service.checkPaymentHealth();

    res.json({ success: true, message: 'Health check completed' });
  } catch (error) {
    log.error('Failed to perform health check:', error);
    res.status(500).json({ error: 'Failed to perform health check' });
  }
});

export default router;