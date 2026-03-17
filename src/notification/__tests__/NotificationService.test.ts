/**
 * Tests for NotificationService
 */

import { NotificationService } from '../NotificationService.js';
import * as notificationsDao from '../../database/notifications.dao.js';

// Mock the DAO
jest.mock('../../database/notifications.dao.js');

describe('NotificationService', () => {
  const mockUserId = 'user-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSignalNotification', () => {
    it('should create signal notification when user should receive it', async () => {
      (notificationsDao.shouldReceiveNotification as jest.Mock).mockResolvedValue(true);
      (notificationsDao.createNotification as jest.Mock).mockResolvedValue({
        id: 'notif-1',
        user_id: mockUserId,
        type: 'SIGNAL',
        title: 'Test Signal',
        message: 'Test message',
      });

      const result = await NotificationService.createSignalNotification(
        mockUserId,
        'Test Signal',
        'Test message',
        { symbol: 'BTC/USDT', side: 'buy' }
      );

      expect(notificationsDao.shouldReceiveNotification).toHaveBeenCalledWith(
        mockUserId,
        'SIGNAL',
        'MEDIUM'
      );
      expect(notificationsDao.createNotification).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });

    it('should not create notification when user opted out', async () => {
      (notificationsDao.shouldReceiveNotification as jest.Mock).mockResolvedValue(false);

      const result = await NotificationService.createSignalNotification(
        mockUserId,
        'Test Signal',
        'Test message',
        { symbol: 'BTC/USDT', side: 'buy' }
      );

      expect(result).toBeNull();
      expect(notificationsDao.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('createRiskNotification', () => {
    it('should create risk notification with high priority by default', async () => {
      (notificationsDao.shouldReceiveNotification as jest.Mock).mockResolvedValue(true);
      (notificationsDao.createNotification as jest.Mock).mockResolvedValue({
        id: 'notif-2',
        user_id: mockUserId,
        type: 'RISK',
        priority: 'HIGH',
      });

      await NotificationService.createRiskNotification(
        mockUserId,
        'Risk Alert',
        'Position limit exceeded',
        { risk_type: 'position_limit', current_value: 100, threshold_value: 80 }
      );

      expect(notificationsDao.shouldReceiveNotification).toHaveBeenCalledWith(
        mockUserId,
        'RISK',
        'HIGH'
      );
    });
  });

  describe('getUserNotifications', () => {
    it('should return notifications and total count', async () => {
      const mockNotifications = [
        { id: 'notif-1', title: 'Test 1' },
        { id: 'notif-2', title: 'Test 2' },
      ];
      
      (notificationsDao.listNotifications as jest.Mock).mockResolvedValue({
        notifications: mockNotifications,
        total: 2,
      });

      const result = await NotificationService.getUserNotifications(mockUserId, {
        limit: 10,
      });

      expect(result.notifications).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('readNotification', () => {
    it('should mark notification as read', async () => {
      (notificationsDao.markAsRead as jest.Mock).mockResolvedValue({
        id: 'notif-1',
        is_read: true,
      });

      const result = await NotificationService.readNotification('notif-1', mockUserId);

      expect(notificationsDao.markAsRead).toHaveBeenCalledWith('notif-1', mockUserId);
      expect(result?.is_read).toBe(true);
    });
  });

  describe('readAllNotifications', () => {
    it('should mark all notifications as read', async () => {
      (notificationsDao.markAllAsRead as jest.Mock).mockResolvedValue(5);

      const count = await NotificationService.readAllNotifications(mockUserId);

      expect(count).toBe(5);
      expect(notificationsDao.markAllAsRead).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('broadcastNotification', () => {
    it('should create notifications for multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      
      (notificationsDao.shouldReceiveNotification as jest.Mock).mockResolvedValue(true);
      (notificationsDao.createNotifications as jest.Mock).mockResolvedValue([
        { id: 'notif-1', user_id: 'user-1' },
        { id: 'notif-2', user_id: 'user-2' },
        { id: 'notif-3', user_id: 'user-3' },
      ]);

      const results = await NotificationService.broadcastNotification(
        userIds,
        'SYSTEM',
        'System Update',
        'New feature available'
      );

      expect(results).toHaveLength(3);
    });

    it('should filter out users who opted out', async () => {
      const userIds = ['user-1', 'user-2'];
      
      (notificationsDao.shouldReceiveNotification as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (notificationsDao.createNotifications as jest.Mock).mockResolvedValue([
        { id: 'notif-1', user_id: 'user-1' },
      ]);

      const results = await NotificationService.broadcastNotification(
        userIds,
        'SYSTEM',
        'System Update',
        'New feature available'
      );

      expect(results).toHaveLength(1);
    });
  });
});
