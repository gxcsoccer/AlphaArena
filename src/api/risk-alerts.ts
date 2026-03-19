/**
 * Risk Alert API Routes
 * 
 * HTTP endpoints for risk monitoring and alert management
 */

import { Router, Request, Response } from 'express';
import { getRiskAlertService } from '../risk-alerting/RiskAlertService';
import { RiskType } from '../risk-alerting/types';
import { createLogger } from '../utils/logger';

const log = createLogger('RiskAlertAPI');

const router = Router();

/**
 * GET /api/risk-alerts/metrics
 * 
 * Get current risk metrics for the user's portfolio
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get portfolio data from request body or use default
    const portfolioData = req.body?.portfolio;
    
    if (!portfolioData) {
      return res.status(400).json({ error: 'Portfolio data required' });
    }

    const service = getRiskAlertService();
    const metrics = service.getRiskMetrics(portfolioData);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    log.error('Error getting risk metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/risk-alerts/monitor
 * 
 * Monitor portfolio and trigger alerts if thresholds exceeded
 */
router.post('/monitor', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { portfolio } = req.body;
    
    if (!portfolio) {
      return res.status(400).json({ error: 'Portfolio data required' });
    }

    const service = getRiskAlertService();
    const results = await service.monitorPortfolio(userId, portfolio);

    res.json({
      success: true,
      data: {
        alerts: results,
        alertCount: results.length,
        hasAlerts: results.length > 0,
      },
    });
  } catch (error) {
    log.error('Error monitoring portfolio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/risk-alerts/check
 * 
 * Check a specific risk type
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { portfolio, riskType, threshold } = req.body;
    
    if (!portfolio || !riskType) {
      return res.status(400).json({ error: 'Portfolio and riskType required' });
    }

    const service = getRiskAlertService();
    const result = await service.checkRisk(
      userId,
      portfolio,
      riskType as RiskType,
      threshold
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('Error checking risk:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/risk-alerts/config
 * 
 * Get user's risk alert configuration
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const service = getRiskAlertService();
    const config = await service.getUserConfig(userId);

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    log.error('Error getting config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/risk-alerts/config
 * 
 * Update user's risk alert configuration
 */
router.put('/config', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updates = req.body;
    
    const service = getRiskAlertService();
    const config = await service.updateUserConfig(userId, updates);

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    log.error('Error updating config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/risk-alerts/rules
 * 
 * Get user's alert rules
 */
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const service = getRiskAlertService();
    const rules = await service.getUserRules(userId);

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    log.error('Error getting rules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/risk-alerts/concentration
 * 
 * Get top concentrated positions
 */
router.post('/concentration', async (req: Request, res: Response) => {
  try {
    const { portfolio, limit } = req.body;
    
    if (!portfolio) {
      return res.status(400).json({ error: 'Portfolio data required' });
    }

    const service = getRiskAlertService();
    const positions = service.getTopConcentratedPositions(portfolio, limit ?? 5);

    res.json({
      success: true,
      data: positions,
    });
  } catch (error) {
    log.error('Error getting concentration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;