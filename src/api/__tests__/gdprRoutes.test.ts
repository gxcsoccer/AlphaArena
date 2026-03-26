/**
 * GDPR Routes Tests
 */

import request from 'supertest';
import express from 'express';
import gdprRoutes from '../gdprRoutes';
import { GDPRDAO } from '../../database/gdpr.dao';

// Mock the auth middleware
jest.mock('../authMiddleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com', role: 'user' };
    next();
  },
}));

// Mock the GDPR DAO
jest.mock('../../database/gdpr.dao', () => ({
  GDPRDAO: {
    exportUserData: jest.fn(),
    createExportRequest: jest.fn(),
    getExportRequest: jest.fn(),
    getUserExportRequests: jest.fn(),
    updateExportRequest: jest.fn(),
    createDeletionRequest: jest.fn(),
    getDeletionRequest: jest.fn(),
    getActiveDeletionRequest: jest.fn(),
    confirmDeletionRequest: jest.fn(),
    cancelDeletionRequest: jest.fn(),
  },
}));

// Mock email service
jest.mock('../../notification/EmailService', () => ({
  getEmailService: () => ({
    sendFromTemplate: jest.fn().mockResolvedValue({ success: true }),
  }),
}));

const app = express();
app.use(express.json());
app.use('/api/gdpr', gdprRoutes);

describe('GDPR Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/gdpr/export', () => {
    it('should initiate data export', async () => {
      const mockExportRequest = {
        id: 'export-123',
        user_id: 'test-user-id',
        status: 'pending',
        format: 'json',
        requested_at: new Date().toISOString(),
      };

      const mockExportData = {
        exportId: 'export_123',
        userId: 'test-user-id',
        exportedAt: new Date().toISOString(),
        data: {
          profile: null,
          sessions: [],
          strategies: [],
          trades: [],
          portfolios: [],
          subscriptions: [],
          payments: [],
          notifications: [],
          preferences: null,
          referrals: [],
          feedback: [],
          exchangeAccounts: [],
          apiKeys: [],
          auditLogs: [],
        },
        metadata: {
          totalRecords: 0,
          exportFormat: 'json',
          version: '1.0.0',
        },
      };

      (GDPRDAO.createExportRequest as jest.Mock).mockResolvedValue(mockExportRequest);
      (GDPRDAO.exportUserData as jest.Mock).mockResolvedValue(mockExportData);
      (GDPRDAO.updateExportRequest as jest.Mock).mockResolvedValue(undefined);

      const res = await request(app).post('/api/gdpr/export').send({ format: 'json' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
      expect(GDPRDAO.exportUserData).toHaveBeenCalledWith('test-user-id');
    });

    it('should handle export errors', async () => {
      (GDPRDAO.createExportRequest as jest.Mock).mockResolvedValue({
        id: 'export-123',
        status: 'pending',
      });
      (GDPRDAO.exportUserData as jest.Mock).mockRejectedValue(new Error('Export failed'));
      (GDPRDAO.updateExportRequest as jest.Mock).mockResolvedValue(undefined);

      const res = await request(app).post('/api/gdpr/export').send({ format: 'json' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/gdpr/export/:requestId', () => {
    it('should return export request status', async () => {
      const mockRequest = {
        id: 'export-123',
        user_id: 'test-user-id',
        status: 'completed',
        format: 'json',
        requested_at: new Date().toISOString(),
      };

      (GDPRDAO.getExportRequest as jest.Mock).mockResolvedValue(mockRequest);

      const res = await request(app).get('/api/gdpr/export/export-123');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
    });

    it('should return 404 for non-existent request', async () => {
      (GDPRDAO.getExportRequest as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/gdpr/export/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should deny access to other users requests', async () => {
      const mockRequest = {
        id: 'export-123',
        user_id: 'other-user-id',
        status: 'completed',
      };

      (GDPRDAO.getExportRequest as jest.Mock).mockResolvedValue(mockRequest);

      const res = await request(app).get('/api/gdpr/export/export-123');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/gdpr/data-summary', () => {
    it('should return data summary', async () => {
      const mockExportData = {
        exportId: 'export_123',
        userId: 'test-user-id',
        exportedAt: new Date().toISOString(),
        data: {
          profile: { id: 'test-user-id', email: 'test@example.com' },
          sessions: [{ id: '1' }],
          strategies: [],
          trades: [{ id: '1' }, { id: '2' }],
          portfolios: [],
          subscriptions: [],
          payments: [],
          notifications: [],
          preferences: null,
          referrals: [],
          feedback: [],
          exchangeAccounts: [],
          apiKeys: [],
          auditLogs: [],
        },
        metadata: {
          totalRecords: 3,
          exportFormat: 'json',
          version: '1.0.0',
        },
      };

      (GDPRDAO.exportUserData as jest.Mock).mockResolvedValue(mockExportData);

      const res = await request(app).get('/api/gdpr/data-summary');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile).toBe(true);
      expect(res.body.data.sessions).toBe(1);
      expect(res.body.data.trades).toBe(2);
      expect(res.body.data.totalRecords).toBe(3);
    });
  });

  describe('POST /api/gdpr/delete-request', () => {
    it('should create deletion request', async () => {
      const mockRequest = {
        id: 'delete-123',
        user_id: 'test-user-id',
        status: 'pending',
        confirmation_code: '123456',
        requested_at: new Date().toISOString(),
      };

      (GDPRDAO.getActiveDeletionRequest as jest.Mock).mockResolvedValue(null);
      (GDPRDAO.createDeletionRequest as jest.Mock).mockResolvedValue(mockRequest);

      const res = await request(app).post('/api/gdpr/delete-request');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
    });

    it('should reject if active deletion exists', async () => {
      const existingRequest = {
        id: 'delete-123',
        user_id: 'test-user-id',
        status: 'pending',
        requested_at: new Date().toISOString(),
      };

      (GDPRDAO.getActiveDeletionRequest as jest.Mock).mockResolvedValue(existingRequest);

      const res = await request(app).post('/api/gdpr/delete-request');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already exists');
    });
  });

  describe('POST /api/gdpr/delete-confirm', () => {
    it('should confirm deletion with valid code', async () => {
      (GDPRDAO.confirmDeletionRequest as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Account deletion confirmed.',
      });

      const res = await request(app)
        .post('/api/gdpr/delete-confirm')
        .send({ requestId: 'delete-123', confirmationCode: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('confirmed');
    });

    it('should reject invalid confirmation code', async () => {
      (GDPRDAO.confirmDeletionRequest as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Invalid confirmation code',
      });

      const res = await request(app)
        .post('/api/gdpr/delete-confirm')
        .send({ requestId: 'delete-123', confirmationCode: 'wrong' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/gdpr/delete-cancel', () => {
    it('should cancel deletion request', async () => {
      (GDPRDAO.cancelDeletionRequest as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Cancelled',
      });

      const res = await request(app)
        .post('/api/gdpr/delete-cancel')
        .send({ requestId: 'delete-123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/gdpr/delete-status', () => {
    it('should return active deletion request', async () => {
      const mockRequest = {
        id: 'delete-123',
        user_id: 'test-user-id',
        status: 'confirmed',
        requested_at: new Date().toISOString(),
        scheduled_deletion_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      (GDPRDAO.getActiveDeletionRequest as jest.Mock).mockResolvedValue(mockRequest);

      const res = await request(app).get('/api/gdpr/delete-status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('confirmed');
    });

    it('should return null if no active request', async () => {
      (GDPRDAO.getActiveDeletionRequest as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/gdpr/delete-status');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });
  });
});