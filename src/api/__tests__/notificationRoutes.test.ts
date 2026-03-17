/**
 * Tests for Notification API Routes
 */

import request from 'supertest';
import express from 'express';
import notificationRoutes from '../notificationRoutes.js';
import { NotificationService } from '../../notification/NotificationService.js';
import { getSupabaseClient } from '../../database/client.js';

// Mock dependencies
jest.mock('../../notification/NotificationService.js');
jest.mock('../../database/client.js');

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
};

// Mock getSupabaseClient to return our mock
(getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

// Create test app
const app = express();
app.use(express.json());
app.use('/api/notifications', notificationRoutes);

describe('Notification Routes', () => {
  const mockUserId = 'user-123';
  const mockToken = 'valid-token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    it('should return notifications for authenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      (NotificationService.getUserNotifications as jest.Mock).mockResolvedValue({
        notifications: [
          { id: 'notif-1', title: 'Test Notification' },
        ],
        total: 1,
      });

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get('/api/notifications');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread count', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      (NotificationService.getUserUnreadCount as jest.Mock).mockResolvedValue(5);

      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(5);
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      (NotificationService.readNotification as jest.Mock).mockResolvedValue({
        id: 'notif-1',
        is_read: true,
      });

      const response = await request(app)
        .put('/api/notifications/notif-1/read')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent notification', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      (NotificationService.readNotification as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/notifications/non-existent/read')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      (NotificationService.readAllNotifications as jest.Mock).mockResolvedValue(10);

      const response = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.marked_count).toBe(10);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    it('should delete notification', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      (NotificationService.removeNotification as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/notifications/notif-1')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/notifications/preferences', () => {
    it('should return user preferences', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      (NotificationService.getUserPreferences as jest.Mock).mockResolvedValue({
        id: 'pref-1',
        user_id: mockUserId,
        in_app_enabled: true,
        email_enabled: false,
      });

      const response = await request(app)
        .get('/api/notifications/preferences')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.in_app_enabled).toBe(true);
    });
  });

  describe('PUT /api/notifications/preferences', () => {
    it('should update user preferences', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      (NotificationService.updateUserPreferences as jest.Mock).mockResolvedValue({
        id: 'pref-1',
        user_id: mockUserId,
        email_enabled: true,
      });

      const response = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ email_enabled: true });

      expect(response.status).toBe(200);
      expect(response.body.data.email_enabled).toBe(true);
    });

    it('should reject invalid fields', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      const response = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ invalid_field: 'value' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/notifications/test', () => {
    it('should create test notification', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      (NotificationService.createSystemNotification as jest.Mock).mockResolvedValue({
        id: 'test-notif',
        title: 'Test Notification',
      });

      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ title: 'Test', message: 'Test message' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
