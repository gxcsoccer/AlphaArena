/**
 * Alert Routes
 * API endpoints for alert management
 */

import { Router, Request, Response } from 'express';
import { getAlertService } from '../alerting';
import { alertRulesDao, CreateAlertRuleInput, AlertRuleType, AlertSeverity, EntityType } from '../database/alert-rules.dao';
import { alertHistoryDao, AlertHistoryFilters, NotificationStatus } from '../database/alert-history.dao';
import { alertConfigurationsDao } from '../database/alert-configurations.dao';

const router = Router();
const alertService = getAlertService();

// Simple auth middleware inline
const requireAuth = (req: Request, res: Response, next: () => void) => {
  // In a real app, this would verify the session/token
  // For now, we check for a user_id header (development only)
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = { id: userId };
  next();
};

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/alerts/rules
 * List alert rules for the current user
 */
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { rule_type, entity_type, entity_id, is_enabled, severity, limit, offset } = req.query;

    const result = await alertRulesDao.listAlertRules({
      user_id: userId,
      rule_type: rule_type as AlertRuleType | undefined,
      entity_type: entity_type as EntityType | undefined,
      entity_id: entity_id as string | undefined,
      is_enabled: is_enabled === 'true' ? true : is_enabled === 'false' ? false : undefined,
      severity: severity as AlertSeverity | undefined,
      limit: limit ? parseInt(String(limit), 10) : 20,
      offset: offset ? parseInt(String(offset), 10) : 0,
    });

    res.json(result);
  } catch (error) {
    console.error('Error listing alert rules:', error);
    res.status(500).json({ error: 'Failed to list alert rules' });
  }
});

/**
 * POST /api/alerts/rules
 * Create a new alert rule
 */
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description, rule_type, severity, conditions, entity_type, entity_id, channels, webhook_url, is_enabled, cooldown_minutes } = req.body;

    if (!name || !rule_type || !conditions) {
      return res.status(400).json({ error: 'Missing required fields: name, rule_type, conditions' });
    }

    const input: CreateAlertRuleInput = {
      user_id: userId,
      name,
      description,
      rule_type,
      severity: severity ?? 'medium',
      conditions,
      entity_type,
      entity_id,
      channels,
      webhook_url,
      is_enabled: is_enabled ?? true,
      cooldown_minutes: cooldown_minutes ?? 30,
    };

    const rule = await alertService.createRule(input);
    if (!rule) {
      return res.status(500).json({ error: 'Failed to create alert rule' });
    }

    res.status(201).json(rule);
  } catch (error) {
    console.error('Error creating alert rule:', error);
    res.status(500).json({ error: 'Failed to create alert rule' });
  }
});

/**
 * GET /api/alerts/rules/:id
 * Get a specific alert rule
 */
router.get('/rules/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = String(req.params.id);
    const rule = await alertRulesDao.getAlertRuleById(id);

    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    if (rule.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(rule);
  } catch (error) {
    console.error('Error getting alert rule:', error);
    res.status(500).json({ error: 'Failed to get alert rule' });
  }
});

/**
 * PUT /api/alerts/rules/:id
 * Update an alert rule
 */
router.put('/rules/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = String(req.params.id);
    const existingRule = await alertRulesDao.getAlertRuleById(id);

    if (!existingRule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    if (existingRule.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const rule = await alertService.updateRule(id, req.body);
    res.json(rule);
  } catch (error) {
    console.error('Error updating alert rule:', error);
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

/**
 * DELETE /api/alerts/rules/:id
 * Delete an alert rule
 */
router.delete('/rules/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = String(req.params.id);
    const existingRule = await alertRulesDao.getAlertRuleById(id);

    if (!existingRule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    if (existingRule.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const success = await alertService.deleteRule(id);
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete alert rule' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting alert rule:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
});

/**
 * GET /api/alerts/history
 * List alert history for the current user
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { rule_type, severity, notification_status, is_acknowledged, is_resolved, start_date, end_date, limit, offset } = req.query;

    const filters: Partial<AlertHistoryFilters> = {
      user_id: userId,
      rule_type: rule_type as AlertRuleType | undefined,
      severity: severity as AlertSeverity | undefined,
      notification_status: notification_status as NotificationStatus | undefined,
      is_acknowledged: is_acknowledged === 'true' ? true : is_acknowledged === 'false' ? false : undefined,
      is_resolved: is_resolved === 'true' ? true : is_resolved === 'false' ? false : undefined,
      start_date: start_date ? new Date(String(start_date)) : undefined,
      end_date: end_date ? new Date(String(end_date)) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 20,
      offset: offset ? parseInt(String(offset), 10) : 0,
    };

    const result = await alertHistoryDao.listAlertHistory(filters);

    res.json(result);
  } catch (error) {
    console.error('Error listing alert history:', error);
    res.status(500).json({ error: 'Failed to list alert history' });
  }
});

/**
 * GET /api/alerts/history/:id
 * Get a specific alert history entry
 */
router.get('/history/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = String(req.params.id);
    const alert = await alertHistoryDao.getAlertHistoryById(id);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (alert.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(alert);
  } catch (error) {
    console.error('Error getting alert history:', error);
    res.status(500).json({ error: 'Failed to get alert history' });
  }
});

/**
 * POST /api/alerts/history/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/history/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = String(req.params.id);
    const alert = await alertService.acknowledgeAlert(id, userId);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

/**
 * POST /api/alerts/history/:id/resolve
 * Resolve an alert
 */
router.post('/history/:id/resolve', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = String(req.params.id);
    const { resolution_note } = req.body;

    const alert = await alertService.resolveAlert(id, userId, resolution_note);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

/**
 * GET /api/alerts/stats
 * Get alert statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { start_date, end_date } = req.query;

    const stats = await alertService.getAlertStats(
      userId,
      start_date ? new Date(String(start_date)) : undefined,
      end_date ? new Date(String(end_date)) : undefined
    );

    res.json(stats);
  } catch (error) {
    console.error('Error getting alert stats:', error);
    res.status(500).json({ error: 'Failed to get alert statistics' });
  }
});

/**
 * GET /api/alerts/unacknowledged
 * Get unacknowledged alerts
 */
router.get('/unacknowledged', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const alerts = await alertService.getUnacknowledgedAlerts(userId);
    res.json(alerts);
  } catch (error) {
    console.error('Error getting unacknowledged alerts:', error);
    res.status(500).json({ error: 'Failed to get unacknowledged alerts' });
  }
});

/**
 * GET /api/alerts/configuration
 * Get user's alert configuration
 */
router.get('/configuration', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const config = await alertConfigurationsDao.getAlertConfiguration(userId);
    res.json(config);
  } catch (error) {
    console.error('Error getting alert configuration:', error);
    res.status(500).json({ error: 'Failed to get alert configuration' });
  }
});

/**
 * PUT /api/alerts/configuration
 * Update user's alert configuration
 */
router.put('/configuration', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const config = await alertService.updateConfiguration(userId, req.body);
    res.json(config);
  } catch (error) {
    console.error('Error updating alert configuration:', error);
    res.status(500).json({ error: 'Failed to update alert configuration' });
  }
});

export default router;
