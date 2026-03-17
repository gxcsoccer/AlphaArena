/**
 * Risk Monitor API Routes
 * 
 * Provides endpoints for:
 * - Risk alerts CRUD operations
 * - Risk summary and history
 * - Position risk analysis
 * - Correlation matrix
 */

import { Router, Request, Response, NextFunction } from 'express';
import { 
  riskMonitorDAO,
  type RiskMetric,
  type AlertOperator,
  type AlertChannel,
  type RiskPeriodType,
  type CreateRiskAlertInput,
  type UpdateRiskAlertInput,
  type CreateRiskHistoryInput,
  type CreatePositionRiskInput,
  type CreateCorrelationInput,
} from '../database/risk-monitor.dao';
import { authMiddleware, optionalAuthMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('RiskMonitorRoutes');

// Helper to get string from params
function getParamId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

// Helper to safely parse query params
function getQueryParam(value: unknown, defaultValue: string = '0'): string {
  if (typeof value === 'string') return value || defaultValue;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0] || defaultValue;
  return defaultValue;
}

const router = Router();

// ============= Types =============

interface CreateAlertRequest {
  metric: RiskMetric;
  threshold: number;
  operator: AlertOperator;
  channels?: AlertChannel[];
  enabled?: boolean;
}

interface UpdateAlertRequest {
  metric?: RiskMetric;
  threshold?: number;
  operator?: AlertOperator;
  channels?: AlertChannel[];
  enabled?: boolean;
}

interface CreateRiskSnapshotRequest {
  periodType?: RiskPeriodType;
  var95?: number;
  var99?: number;
  maxDrawdown?: number;
  currentDrawdown?: number;
  sharpeRatio?: number;
  volatility?: number;
  beta?: number;
  concentrationRisk?: number;
  liquidityRisk?: number;
  sortinoRatio?: number;
  expectedShortfall95?: number;
  expectedShortfall99?: number;
  calmarRatio?: number;
  treynorRatio?: number;
  informationRatio?: number;
  trackingError?: number;
  portfolioValue?: number;
  positionCount?: number;
  positions?: Array<{
    symbol: string;
    weight: number;
    contributionToRisk: number;
    varContribution: number;
    betaToPortfolio?: number;
    liquidityScore?: number;
    concentrationRisk?: number;
  }>;
  correlations?: Array<{
    symbol1: string;
    symbol2: string;
    correlation: number;
    periodDays?: number;
  }>;
}

// ============= Risk Summary =============

/**
 * GET /api/risk/summary
 * Get current risk summary for the authenticated user
 */
router.get('/summary', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get latest risk snapshot
    const latestSnapshot = await riskMonitorDAO.getLatestRiskSnapshot(user.id);
    
    // Get latest position risks
    const positionRisks = await riskMonitorDAO.getLatestPositionRisks(user.id);
    
    // Get active alerts
    const alerts = await riskMonitorDAO.listAlerts({ 
      userId: user.id, 
      enabled: true 
    });

    // Calculate overall risk score (0-100, higher = more risk)
    let riskScore = 0;
    if (latestSnapshot) {
      // Weight different factors
      const varScore = Math.min(latestSnapshot.var95 || 0 / 100, 30);
      const drawdownScore = Math.min((latestSnapshot.maxDrawdown || 0) * 3, 30);
      const volatilityScore = Math.min((latestSnapshot.volatility || 0) * 2, 20);
      const concentrationScore = Math.min((latestSnapshot.concentrationRisk || 0) * 100, 20);
      
      riskScore = Math.round(varScore + drawdownScore + volatilityScore + concentrationScore);
    }

    res.json({
      success: true,
      data: {
        metrics: latestSnapshot,
        positionRisks,
        activeAlerts: alerts,
        riskScore,
        riskLevel: riskScore < 30 ? 'low' : riskScore < 50 ? 'medium' : riskScore < 70 ? 'high' : 'critical',
      },
    });
  } catch (error) {
    log.error('Failed to get risk summary:', error);
    next(error);
  }
});

/**
 * GET /api/risk/positions
 * Get position risk analysis for the authenticated user
 */
router.get('/positions', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const positionRisks = await riskMonitorDAO.getLatestPositionRisks(user.id);

    // Calculate total risk contribution
    const totalRiskContribution = positionRisks.reduce(
      (sum, p) => sum + p.contributionToRisk, 
      0
    );

    // Format for pie chart
    const chartData = positionRisks.map(p => ({
      symbol: p.symbol,
      weight: p.weight,
      contributionToRisk: p.contributionToRisk,
      contributionPercent: totalRiskContribution > 0 
        ? (p.contributionToRisk / totalRiskContribution) * 100 
        : 0,
      varContribution: p.varContribution,
      betaToPortfolio: p.betaToPortfolio,
      liquidityScore: p.liquidityScore,
      concentrationRisk: p.concentrationRisk,
    }));

    res.json({
      success: true,
      data: {
        positions: chartData,
        totalPositions: positionRisks.length,
        totalRiskContribution,
      },
    });
  } catch (error) {
    log.error('Failed to get position risks:', error);
    next(error);
  }
});

/**
 * GET /api/risk/history
 * Get historical risk data for trend analysis
 */
router.get('/history', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { startDate, endDate, periodType, limit = 30, offset } = req.query;

    const filters = {
      userId: user.id,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      periodType: periodType as RiskPeriodType | undefined,
      limit: parseInt(getQueryParam(limit, "30")),
      offset: offset ? parseInt(getQueryParam(offset)) : undefined,
    };

    const history = await riskMonitorDAO.getRiskHistory(filters);

    // Format for charts
    const chartData = history.map(h => ({
      date: h.recordedAt.toISOString().split('T')[0],
      timestamp: h.recordedAt.getTime(),
      var95: h.var95,
      var99: h.var99,
      maxDrawdown: h.maxDrawdown,
      currentDrawdown: h.currentDrawdown,
      sharpeRatio: h.sharpeRatio,
      volatility: h.volatility,
      beta: h.beta,
      concentrationRisk: h.concentrationRisk,
      liquidityRisk: h.liquidityRisk,
      portfolioValue: h.portfolioValue,
    }));

    res.json({
      success: true,
      data: {
        history: chartData,
        count: history.length,
      },
    });
  } catch (error) {
    log.error('Failed to get risk history:', error);
    next(error);
  }
});

/**
 * POST /api/risk/snapshot
 * Create a new risk snapshot (called by risk calculation service)
 */
router.post('/snapshot', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = req.body as CreateRiskSnapshotRequest;

    // Create risk history entry
    const historyEntry = await riskMonitorDAO.createRiskHistory({
      userId: user.id,
      periodType: data.periodType,
      var95: data.var95,
      var99: data.var99,
      maxDrawdown: data.maxDrawdown,
      currentDrawdown: data.currentDrawdown,
      sharpeRatio: data.sharpeRatio,
      volatility: data.volatility,
      beta: data.beta,
      concentrationRisk: data.concentrationRisk,
      liquidityRisk: data.liquidityRisk,
      sortinoRatio: data.sortinoRatio,
      expectedShortfall95: data.expectedShortfall95,
      expectedShortfall99: data.expectedShortfall99,
      calmarRatio: data.calmarRatio,
      treynorRatio: data.treynorRatio,
      informationRatio: data.informationRatio,
      trackingError: data.trackingError,
      portfolioValue: data.portfolioValue,
      positionCount: data.positionCount,
    });

    // Create position risks if provided
    if (data.positions && data.positions.length > 0) {
      await riskMonitorDAO.batchCreatePositionRisks(
        data.positions.map(p => ({
          userId: user.id,
          riskHistoryId: historyEntry.id,
          ...p,
        }))
      );
    }

    // Create correlations if provided
    if (data.correlations && data.correlations.length > 0) {
      await riskMonitorDAO.batchUpsertCorrelations(
        data.correlations.map(c => ({
          userId: user.id,
          ...c,
        }))
      );
    }

    // Check alerts and trigger notifications
    const alerts = await riskMonitorDAO.listAlerts({ userId: user.id, enabled: true });
    for (const alert of alerts) {
      const metricValue = historyEntry[alert.metric as keyof typeof historyEntry] as number | undefined;
      if (metricValue !== undefined) {
        const shouldTrigger = checkAlertCondition(metricValue, alert.threshold, alert.operator);
        if (shouldTrigger) {
          await riskMonitorDAO.recordAlertTrigger(alert.id, user.id, metricValue);
          // TODO: Send notification via NotificationService
          log.info(`Alert ${alert.id} triggered for metric ${alert.metric}`);
        }
      }
    }

    res.json({
      success: true,
      data: historyEntry,
    });
  } catch (error) {
    log.error('Failed to create risk snapshot:', error);
    next(error);
  }
});

/**
 * GET /api/risk/correlations
 * Get correlation matrix for the authenticated user
 */
router.get('/correlations', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { periodDays = 30 } = req.query;

    const correlations = await riskMonitorDAO.getCorrelationMatrix(
      user.id, 
      parseInt(getQueryParam(periodDays, "30"))
    );

    // Transform into matrix format for heatmap
    const symbols = [...new Set([
      ...correlations.map(c => c.symbol1),
      ...correlations.map(c => c.symbol2),
    ])];

    const matrix: Record<string, Record<string, number>> = {};
    symbols.forEach(s1 => {
      matrix[s1] = {};
      symbols.forEach(s2 => {
        if (s1 === s2) {
          matrix[s1][s2] = 1;
        } else {
          const entry = correlations.find(
            c => (c.symbol1 === s1 && c.symbol2 === s2) || 
                 (c.symbol1 === s2 && c.symbol2 === s1)
          );
          matrix[s1][s2] = entry?.correlation || 0;
        }
      });
    });

    res.json({
      success: true,
      data: {
        symbols,
        matrix,
        correlations,
      },
    });
  } catch (error) {
    log.error('Failed to get correlations:', error);
    next(error);
  }
});

// ============= Risk Alerts =============

/**
 * GET /api/risk/alerts
 * List all risk alerts for the authenticated user
 */
router.get('/alerts', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { enabled, metric, limit = 50, offset } = req.query;

    const alerts = await riskMonitorDAO.listAlerts({
      userId: user.id,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      metric: metric as RiskMetric | undefined,
      limit: parseInt(getQueryParam(limit, "50")),
      offset: offset ? parseInt(getQueryParam(offset)) : undefined,
    });

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    log.error('Failed to list alerts:', error);
    next(error);
  }
});

/**
 * POST /api/risk/alerts
 * Create a new risk alert
 */
router.post('/alerts', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = req.body as CreateAlertRequest;

    // Validate metric
    const validMetrics: RiskMetric[] = [
      'var95', 'var99', 'maxDrawdown', 'sharpeRatio',
      'volatility', 'beta', 'concentrationRisk', 'liquidityRisk',
    ];
    if (!validMetrics.includes(data.metric)) {
      return res.status(400).json({ 
        error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}` 
      });
    }

    // Validate operator
    const validOperators: AlertOperator[] = ['gt', 'lt', 'gte', 'lte'];
    if (!validOperators.includes(data.operator)) {
      return res.status(400).json({ 
        error: `Invalid operator. Must be one of: ${validOperators.join(', ')}` 
      });
    }

    const alert = await riskMonitorDAO.createAlert({
      userId: user.id,
      metric: data.metric,
      threshold: data.threshold,
      operator: data.operator,
      channels: data.channels || ['ui'],
      enabled: data.enabled ?? true,
    });

    res.status(201).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    log.error('Failed to create alert:', error);
    next(error);
  }
});

/**
 * PUT /api/risk/alerts/:id
 * Update a risk alert
 */
router.put('/alerts/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = getParamId(req.params.id);
    const data = req.body as UpdateAlertRequest;

    const alert = await riskMonitorDAO.updateAlert(id, user.id, data);

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    log.error('Failed to update alert:', error);
    next(error);
  }
});

/**
 * DELETE /api/risk/alerts/:id
 * Delete a risk alert
 */
router.delete('/alerts/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = getParamId(req.params.id);

    await riskMonitorDAO.deleteAlert(id, user.id);

    res.json({
      success: true,
      message: 'Alert deleted successfully',
    });
  } catch (error) {
    log.error('Failed to delete alert:', error);
    next(error);
  }
});

/**
 * GET /api/risk/alerts/history
 * Get alert trigger history for the authenticated user
 */
router.get('/alerts/history', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { alertId, limit = 50, offset } = req.query;

    const history = await riskMonitorDAO.getAlertHistory(user.id, {
      alertId: alertId as string | undefined,
      limit: parseInt(getQueryParam(limit, "50")),
      offset: offset ? parseInt(getQueryParam(offset)) : undefined,
    });

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    log.error('Failed to get alert history:', error);
    next(error);
  }
});

// ============= Helper Functions =============

function checkAlertCondition(value: number, threshold: number, operator: AlertOperator): boolean {
  switch (operator) {
    case 'gt': return value > threshold;
    case 'lt': return value < threshold;
    case 'gte': return value >= threshold;
    case 'lte': return value <= threshold;
    default: return false;
  }
}

export function createRiskMonitorRouter(): Router {
  return router;
}

export default router;
