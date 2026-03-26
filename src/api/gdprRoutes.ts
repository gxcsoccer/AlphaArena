/**
 * GDPR Routes
 *
 * @module api/gdprRoutes
 * @description API routes for GDPR-compliant data export and deletion
 */

import { Router, Request, Response } from 'express';
import { GDPRDAO } from '../database/gdpr.dao';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';
import { getEmailService } from '../notification/EmailService';

const log = createLogger('GDPRRoutes');
const router = Router();

/**
 * All GDPR routes require authentication
 */
router.use(authMiddleware);

/**
 * POST /api/gdpr/export
 * Request user data export
 * 
 * @description Initiates an async data export job for GDPR compliance
 * @returns Export request ID and status
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const userId = req.user.id;
    const format = (req.body.format as 'json' | 'csv') || 'json';

    log.info('Data export requested', { userId, format });

    // Create export request
    const exportRequest = await GDPRDAO.createExportRequest(userId, format);

    // For immediate export (in production, this would be async with a job queue)
    try {
      const exportData = await GDPRDAO.exportUserData(userId);
      
      // Update request as completed
      await GDPRDAO.updateExportRequest(exportRequest.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      log.info('Data export completed', { userId, exportId: exportData.exportId });

      // Return the export data directly
      res.json({
        success: true,
        data: {
          exportId: exportData.exportId,
          status: 'completed',
          exportedAt: exportData.exportedAt,
          downloadUrl: `/api/gdpr/export/${exportRequest.id}/download`,
          metadata: exportData.metadata,
        },
      });
    } catch (exportError) {
      // Update request as failed
      await GDPRDAO.updateExportRequest(exportRequest.id, {
        status: 'failed',
        error_message: exportError instanceof Error ? exportError.message : 'Unknown error',
      });

      throw exportError;
    }
  } catch (error) {
    log.error('Failed to export user data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export user data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/gdpr/export/:requestId
 * Get export request status
 */
router.get('/export/:requestId', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { requestId } = req.params as { requestId: string };
    const exportRequest = await GDPRDAO.getExportRequest(requestId);

    if (!exportRequest) {
      return res.status(404).json({
        success: false,
        error: 'Export request not found',
      });
    }

    // Verify ownership
    if (exportRequest.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: exportRequest,
    });
  } catch (error) {
    log.error('Failed to get export request', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get export request',
    });
  }
});

/**
 * GET /api/gdpr/export/:requestId/download
 * Download exported data
 */
router.get('/export/:requestId/download', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { requestId } = req.params as { requestId: string };
    const exportRequest = await GDPRDAO.getExportRequest(requestId);

    if (!exportRequest) {
      return res.status(404).json({
        success: false,
        error: 'Export request not found',
      });
    }

    // Verify ownership
    if (exportRequest.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    if (exportRequest.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Export not ready',
      });
    }

    // Generate the export data
    const exportData = await GDPRDAO.exportUserData(req.user.id);

    // Set response headers for file download
    const filename = `alphaarena-data-export-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(exportData);
  } catch (error) {
    log.error('Failed to download export', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download export',
    });
  }
});

/**
 * GET /api/gdpr/export/history
 * Get user's export request history
 */
router.get('/export/history', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const requests = await GDPRDAO.getUserExportRequests(req.user.id);

    res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    log.error('Failed to get export history', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get export history',
    });
  }
});

/**
 * POST /api/gdpr/delete-request
 * Request account deletion
 * 
 * @description Creates a deletion request and sends confirmation email
 * @returns Deletion request ID
 */
router.post('/delete-request', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const userId = req.user.id;
    const userEmail = req.user.email;

    // Check for existing active deletion request
    const existingRequest = await GDPRDAO.getActiveDeletionRequest(userId);
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        error: 'An active deletion request already exists',
        data: {
          requestId: existingRequest.id,
          status: existingRequest.status,
          requestedAt: existingRequest.requested_at,
        },
      });
    }

    // Create deletion request
    const deletionRequest = await GDPRDAO.createDeletionRequest(userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    log.info('Data deletion requested', { userId, requestId: deletionRequest.id });

    // Send confirmation email
    try {
      const emailService = getEmailService();
      await emailService.sendFromTemplate('verification', userEmail!, {
        code: deletionRequest.confirmation_code,
        expiryMinutes: 60,
        action: 'confirm account deletion',
      });
      log.info('Deletion confirmation email sent', { userId });
    } catch (emailError) {
      log.warn('Failed to send confirmation email', { error: emailError });
      // Continue anyway - user can still confirm via API
    }

    res.json({
      success: true,
      data: {
        requestId: deletionRequest.id,
        status: deletionRequest.status,
        requestedAt: deletionRequest.requested_at,
        message: 'A confirmation code has been sent to your email. Please confirm the deletion request within 60 minutes.',
      },
    });
  } catch (error) {
    log.error('Failed to create deletion request', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create deletion request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/gdpr/delete-confirm
 * Confirm deletion request with code
 */
router.post('/delete-confirm', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { requestId, confirmationCode } = req.body;

    if (!requestId || !confirmationCode) {
      return res.status(400).json({
        success: false,
        error: 'Missing requestId or confirmationCode',
      });
    }

    const result = await GDPRDAO.confirmDeletionRequest(requestId, confirmationCode);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
      });
    }

    log.info('Data deletion confirmed', { userId: req.user.id, requestId });

    res.json({
      success: true,
      data: {
        requestId,
        status: 'confirmed',
        message: result.message,
      },
    });
  } catch (error) {
    log.error('Failed to confirm deletion', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm deletion',
    });
  }
});

/**
 * POST /api/gdpr/delete-cancel
 * Cancel a deletion request
 */
router.post('/delete-cancel', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: 'Missing requestId',
      });
    }

    const result = await GDPRDAO.cancelDeletionRequest(requestId, req.user.id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
      });
    }

    log.info('Data deletion cancelled', { userId: req.user.id, requestId });

    res.json({
      success: true,
      data: {
        requestId,
        status: 'cancelled',
        message: result.message,
      },
    });
  } catch (error) {
    log.error('Failed to cancel deletion', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel deletion',
    });
  }
});

/**
 * GET /api/gdpr/delete-status
 * Get current deletion request status
 */
router.get('/delete-status', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const activeRequest = await GDPRDAO.getActiveDeletionRequest(req.user.id);

    res.json({
      success: true,
      data: activeRequest || null,
    });
  } catch (error) {
    log.error('Failed to get deletion status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get deletion status',
    });
  }
});

/**
 * GET /api/gdpr/data-summary
 * Get a summary of stored user data
 */
router.get('/data-summary', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const exportData = await GDPRDAO.exportUserData(req.user.id);

    const summary = {
      profile: !!exportData.data.profile,
      sessions: exportData.data.sessions.length,
      strategies: exportData.data.strategies.length,
      trades: exportData.data.trades.length,
      portfolios: exportData.data.portfolios.length,
      subscriptions: exportData.data.subscriptions.length,
      payments: exportData.data.payments.length,
      notifications: exportData.data.notifications.length,
      preferences: !!exportData.data.preferences,
      referrals: exportData.data.referrals.length,
      feedback: exportData.data.feedback.length,
      exchangeAccounts: exportData.data.exchangeAccounts.length,
      apiKeys: exportData.data.apiKeys.length,
      auditLogs: exportData.data.auditLogs.length,
      totalRecords: exportData.metadata.totalRecords,
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    log.error('Failed to get data summary', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get data summary',
    });
  }
});

export default router;