/**
 * Webhook API Routes
 *
 * REST endpoints for webhook management
 */

import { Router, Request, Response } from 'express';
import { WebhookManager, CreateWebhookRequest, UpdateWebhookRequest } from '../webhook';
import { createLogger } from '../utils/logger';

const log = createLogger('WebhookRoutes');

/**
 * Helper to get string param from req.params or req.query
 */
function getStringParam(value: any): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;
  return undefined;
}

/**
 * Create webhook router
 */
export function createWebhookRouter(webhookManager: WebhookManager): Router {
  const router = Router();

  /**
   * GET /api/webhooks
   * List all webhooks
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const enabledOnly = req.query.enabledOnly === 'true';
      const webhooks = await webhookManager.getAllWebhooks(enabledOnly);
      
      // Mask secrets in response
      const sanitizedWebhooks = webhooks.map(w => ({
        ...w,
        secret: w.secret ? '***' : undefined,
      }));
      
      res.json({ success: true, data: sanitizedWebhooks });
    } catch (error: any) {
      log.error('Failed to get webhooks', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/webhooks/:id
   * Get a webhook by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing webhook ID' });
      }
      
      const webhook = await webhookManager.getWebhook(id);
      
      if (!webhook) {
        return res.status(404).json({ success: false, error: 'Webhook not found' });
      }
      
      // Mask secret in response
      const sanitizedWebhook = {
        ...webhook,
        secret: webhook.secret ? '***' : undefined,
      };
      
      res.json({ success: true, data: sanitizedWebhook });
    } catch (error: any) {
      log.error('Failed to get webhook', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/webhooks
   * Create a new webhook
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const request: CreateWebhookRequest = {
        name: req.body.name,
        url: req.body.url,
        secret: req.body.secret,
        events: req.body.events,
        enabled: req.body.enabled,
        retryCount: req.body.retryCount,
        retryDelayMs: req.body.retryDelayMs,
        timeoutMs: req.body.timeoutMs,
        ipWhitelist: req.body.ipWhitelist,
        headers: req.body.headers,
      };

      const webhook = await webhookManager.createWebhook(request);
      
      log.info('Webhook created', { id: webhook.id, name: webhook.name, url: webhook.url });
      
      // Return with secret for initial save (show only once)
      res.status(201).json({ 
        success: true, 
        data: webhook,
        warning: 'Store the secret securely. It will not be shown again.',
      });
    } catch (error: any) {
      log.error('Failed to create webhook', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/webhooks/:id
   * Update a webhook
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing webhook ID' });
      }
      
      const request: UpdateWebhookRequest = {
        name: req.body.name,
        url: req.body.url,
        secret: req.body.secret,
        events: req.body.events,
        enabled: req.body.enabled,
        retryCount: req.body.retryCount,
        retryDelayMs: req.body.retryDelayMs,
        timeoutMs: req.body.timeoutMs,
        ipWhitelist: req.body.ipWhitelist,
        headers: req.body.headers,
      };

      const webhook = await webhookManager.updateWebhook(id, request);
      
      log.info('Webhook updated', { id: webhook.id, name: webhook.name });
      
      // Mask secret in response
      const sanitizedWebhook = {
        ...webhook,
        secret: webhook.secret ? '***' : undefined,
      };
      
      res.json({ success: true, data: sanitizedWebhook });
    } catch (error: any) {
      log.error('Failed to update webhook', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/webhooks/:id
   * Delete a webhook
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing webhook ID' });
      }
      
      await webhookManager.deleteWebhook(id);
      
      log.info('Webhook deleted', { id });
      
      res.json({ success: true, message: 'Webhook deleted' });
    } catch (error: any) {
      log.error('Failed to delete webhook', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/webhooks/:id/test
   * Test a webhook
   */
  router.post('/:id/test', async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing webhook ID' });
      }
      
      const result = await webhookManager.testWebhook(id);
      
      log.info('Webhook tested', { 
        id, 
        success: result.success,
        responseCode: result.responseCode,
      });
      
      res.json({ success: true, data: result });
    } catch (error: any) {
      log.error('Failed to test webhook', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/webhooks/:id/deliveries
   * Get delivery logs for a webhook
   */
  router.get('/:id/deliveries', async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing webhook ID' });
      }
      
      const limit = req.query.limit ? parseInt(getStringParam(req.query.limit) || '50') : 50;
      const offset = req.query.offset ? parseInt(getStringParam(req.query.offset) || '0') : 0;
      const status = getStringParam(req.query.status) as any;
      
      const deliveries = await webhookManager.getDeliveries({
        webhookId: id,
        status,
        limit,
        offset,
      });
      
      res.json({ success: true, data: deliveries });
    } catch (error: any) {
      log.error('Failed to get deliveries', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/webhooks/:id/stats
   * Get webhook statistics
   */
  router.get('/:id/stats', async (req: Request, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing webhook ID' });
      }
      
      const stats = await webhookManager.getWebhookStats(id);
      
      res.json({ success: true, data: stats });
    } catch (error: any) {
      log.error('Failed to get webhook stats', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export default createWebhookRouter;
