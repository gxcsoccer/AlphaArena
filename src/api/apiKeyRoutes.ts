/**
 * API Key Management Routes
 *
 * REST endpoints for API key management
 */

import { Router, Request, Response } from 'express';
import * as ApiKeyDao from './apiKeyDao';
import { CreateApiKeyRequest, ApiKeyPermission } from './apiKeyTypes';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('ApiKeyRoutes');

/**
 * Helper to get string param from req.params or req.query
 */
function getStringParam(value: any): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;
  return undefined;
}

/**
 * Create API key router
 */
export function createApiKeyRouter(): Router {
  const router = Router();

  // All endpoints require JWT auth (not API key auth)
  // API keys cannot manage other API keys - only users can

  /**
   * GET /api/keys
   * List all API keys for the authenticated user
   */
  router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const keys = await ApiKeyDao.getApiKeysByUser(userId);
      
      // Mask key hashes in response
      const sanitizedKeys = keys.map(k => ({
        ...k,
        keyHash: undefined,
      }));

      res.json({
        success: true,
        data: sanitizedKeys,
        count: sanitizedKeys.length,
      });
    } catch (error: any) {
      log.error('Failed to list API keys', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/keys
   * Create a new API key
   */
  router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const request: CreateApiKeyRequest = {
        name: req.body.name,
        userId,
        permission: req.body.permission as ApiKeyPermission || 'read',
        rateLimitPerMinute: req.body.rateLimitPerMinute,
        rateLimitPerDay: req.body.rateLimitPerDay,
        ipWhitelist: req.body.ipWhitelist,
        allowedEndpoints: req.body.allowedEndpoints,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
        description: req.body.description,
      };

      // Validation
      if (!request.name) {
        return res.status(400).json({
          success: false,
          error: 'API key name is required',
        });
      }

      if (!['read', 'trade', 'admin'].includes(request.permission)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid permission level. Must be: read, trade, or admin',
        });
      }

      // Only admins can create admin keys
      if (request.permission === 'admin' && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Only admins can create API keys with admin permission',
        });
      }

      const apiKey = await ApiKeyDao.createApiKey(request);

      log.info('API key created', { 
        id: apiKey.id, 
        name: apiKey.name, 
        userId, 
        permission: apiKey.permission 
      });

      // Return with secret (only time it's shown!)
      res.status(201).json({
        success: true,
        data: apiKey,
        warning: 'Store the secret key securely. It will not be shown again.',
      });
    } catch (error: any) {
      log.error('Failed to create API key', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/keys/:id
   * Get API key details
   */
  router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing API key ID' });
      }

      const key = await ApiKeyDao.getApiKey(id);
      
      if (!key) {
        return res.status(404).json({
          success: false,
          error: 'API key not found',
          code: 'API_KEY_NOT_FOUND',
        });
      }

      // Check ownership
      if (key.userId !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You can only view your own API keys',
        });
      }

      // Mask key hash
      const sanitizedKey = {
        ...key,
        keyHash: undefined,
      };

      res.json({
        success: true,
        data: sanitizedKey,
      });
    } catch (error: any) {
      log.error('Failed to get API key', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/keys/:id
   * Update API key
   */
  router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing API key ID' });
      }

      const key = await ApiKeyDao.getApiKey(id);
      if (!key) {
        return res.status(404).json({
          success: false,
          error: 'API key not found',
          code: 'API_KEY_NOT_FOUND',
        });
      }

      // Check ownership
      if (key.userId !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You can only update your own API keys',
        });
      }

      const updates = {
        name: req.body.name,
        status: req.body.status,
        rateLimitPerMinute: req.body.rateLimitPerMinute,
        rateLimitPerDay: req.body.rateLimitPerDay,
        ipWhitelist: req.body.ipWhitelist,
        allowedEndpoints: req.body.allowedEndpoints,
        description: req.body.description,
      };

      // Remove undefined fields
      Object.keys(updates).forEach(k => {
        if ((updates as any)[k] === undefined) delete (updates as any)[k];
      });

      const updatedKey = await ApiKeyDao.updateApiKey(id, updates);

      log.info('API key updated', { id, updates: Object.keys(updates) });

      res.json({
        success: true,
        data: {
          ...updatedKey,
          keyHash: undefined,
        },
      });
    } catch (error: any) {
      log.error('Failed to update API key', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/keys/:id
   * Delete API key
   */
  router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing API key ID' });
      }

      const key = await ApiKeyDao.getApiKey(id);
      if (!key) {
        return res.status(404).json({
          success: false,
          error: 'API key not found',
          code: 'API_KEY_NOT_FOUND',
        });
      }

      // Check ownership
      if (key.userId !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You can only delete your own API keys',
        });
      }

      await ApiKeyDao.deleteApiKey(id);

      log.info('API key deleted', { id, userId });

      res.json({
        success: true,
        message: 'API key deleted successfully',
      });
    } catch (error: any) {
      log.error('Failed to delete API key', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/keys/:id/revoke
   * Revoke API key (soft delete - marks as revoked)
   */
  router.post('/:id/revoke', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing API key ID' });
      }

      const key = await ApiKeyDao.getApiKey(id);
      if (!key) {
        return res.status(404).json({
          success: false,
          error: 'API key not found',
          code: 'API_KEY_NOT_FOUND',
        });
      }

      // Check ownership
      if (key.userId !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You can only revoke your own API keys',
        });
      }

      await ApiKeyDao.revokeApiKey(id);

      log.info('API key revoked', { id, userId });

      res.json({
        success: true,
        message: 'API key revoked successfully',
      });
    } catch (error: any) {
      log.error('Failed to revoke API key', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/keys/:id/stats
   * Get API key usage statistics
   */
  router.get('/:id/stats', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing API key ID' });
      }

      const key = await ApiKeyDao.getApiKey(id);
      if (!key) {
        return res.status(404).json({
          success: false,
          error: 'API key not found',
          code: 'API_KEY_NOT_FOUND',
        });
      }

      // Check ownership
      if (key.userId !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You can only view stats for your own API keys',
        });
      }

      const stats = await ApiKeyDao.getApiKeyStats(id);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      log.error('Failed to get API key stats', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export default createApiKeyRouter;
