/**
 * Notification Service Unit Tests
 */

import { PriceAlertNotification } from '../notificationService';

// Mock window.Notification
const mockNotification = jest.fn();
mockNotification.permission = 'default';
mockNotification.requestPermission = jest.fn().mockResolvedValue('granted');

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'Notification', { value: mockNotification });

// Mock Audio
class MockAudio {
  src: string = '';
  volume: number = 1;
  preload: string = '';
  currentTime: number = 0;
  play = jest.fn().mockResolvedValue(undefined);
  pause = jest.fn();
}
Object.defineProperty(global, 'Audio', { value: MockAudio });

// We need to reset the singleton between tests
// Since we can't easily access the private instance, we'll use dynamic imports
describe('NotificationService', () => {
  let service: any;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    
    // Re-import the module to get a fresh instance
    jest.resetModules();
    
    // Re-mock globals after reset
    Object.defineProperty(global, 'localStorage', { value: localStorageMock });
    Object.defineProperty(global, 'Notification', { value: mockNotification });
    Object.defineProperty(global, 'Audio', { value: MockAudio });
    
    // Now import fresh
    const { getNotificationService } = require('../notificationService');
    service = getNotificationService();
  });

  describe('Permission Management', () => {
    it('should return current permission status', () => {
      const status = service.getPermissionStatus();
      expect(['default', 'granted', 'denied']).toContain(status);
    });

    it('should request permission when calling requestPermission', async () => {
      const status = await service.requestPermission();
      expect(mockNotification.requestPermission).toHaveBeenCalled();
      expect(status).toBe('granted');
    });

    it('should return true for isSupported when Notification exists', () => {
      expect(service.isSupported()).toBe(true);
    });
  });

  describe('Sound Management', () => {
    it('should enable/disable sound', () => {
      service.setSoundEnabled(false);
      expect(service.isSoundEnabled()).toBe(false);
      
      service.setSoundEnabled(true);
      expect(service.isSoundEnabled()).toBe(true);
    });

    it('should persist sound preference in localStorage', () => {
      service.setSoundEnabled(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'price-alert-sound-enabled',
        'false'
      );
    });
  });

  describe('Notifications Toggle', () => {
    it('should enable/disable notifications', () => {
      service.setNotificationsEnabled(false);
      expect(service.isNotificationsEnabled()).toBe(false);
      
      service.setNotificationsEnabled(true);
      expect(service.isNotificationsEnabled()).toBe(true);
    });

    it('should persist notifications preference in localStorage', () => {
      service.setNotificationsEnabled(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'price-alert-notifications-enabled',
        'false'
      );
    });
  });

  describe('Notification History', () => {
    it('should start with empty history', () => {
      const history = service.getHistory();
      expect(history).toEqual([]);
    });

    it('should add notification to history when showAlertTriggered is called', async () => {
      await service.showAlertTriggered({
        id: 'test-alert-1',
        symbol: 'BTC/USDT',
        conditionType: 'above',
        targetPrice: 50000,
        triggeredPrice: 51000,
      });

      const history = service.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].symbol).toBe('BTC/USDT');
      expect(history[0].type).toBe('triggered');
      expect(history[0].read).toBe(false);
    });

    it('should track unread count', async () => {
      await service.showAlertTriggered({
        id: 'test-alert-1',
        symbol: 'BTC/USDT',
        conditionType: 'above',
        targetPrice: 50000,
      });

      expect(service.getUnreadCount()).toBe(1);
    });

    it('should mark notification as read', async () => {
      await service.showAlertTriggered({
        id: 'test-alert-1',
        symbol: 'BTC/USDT',
        conditionType: 'above',
        targetPrice: 50000,
      });

      const history = service.getHistory();
      const notificationId = history[0].id;
      
      service.markAsRead(notificationId);
      expect(service.getUnreadCount()).toBe(0);
    });

    it('should mark all notifications as read', async () => {
      await service.showAlertTriggered({
        id: 'test-alert-1',
        symbol: 'BTC/USDT',
        conditionType: 'above',
        targetPrice: 50000,
      });

      await service.showAlertTriggered({
        id: 'test-alert-2',
        symbol: 'ETH/USDT',
        conditionType: 'below',
        targetPrice: 3000,
      });

      expect(service.getUnreadCount()).toBe(2);
      service.markAllAsRead();
      expect(service.getUnreadCount()).toBe(0);
    });

    it('should clear all notifications', async () => {
      await service.showAlertTriggered({
        id: 'test-alert-1',
        symbol: 'BTC/USDT',
        conditionType: 'above',
        targetPrice: 50000,
      });

      service.clearAll();
      expect(service.getHistory()).toEqual([]);
      expect(service.getUnreadCount()).toBe(0);
    });
  });

  describe('Subscriptions', () => {
    it('should notify listeners when notifications change', async () => {
      const listener = jest.fn();
      service.subscribe(listener);

      await service.showAlertTriggered({
        id: 'test-alert-1',
        symbol: 'BTC/USDT',
        conditionType: 'above',
        targetPrice: 50000,
      });

      expect(listener).toHaveBeenCalled();
    });

    it('should return unsubscribe function', async () => {
      const listener = jest.fn();
      const unsubscribe = service.subscribe(listener);
      
      unsubscribe();
      
      // After unsubscribe, listener should not be called
      await service.showAlertTriggered({
        id: 'test-alert-2',
        symbol: 'BTC/USDT',
        conditionType: 'above',
        targetPrice: 50000,
      });
      
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
