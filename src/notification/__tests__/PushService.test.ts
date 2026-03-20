/**
 * Tests for PushService and PushProviders
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PushService,
  getPushService,
  resetPushService,
} from '../PushService.js';
import {
  MockPushProvider,
  FCMProvider,
  OneSignalProvider,
  ExpoPushProvider,
  WebPushProvider,
  createPushProvider,
} from '../PushProviders.js';
import type { PushMessage, PushDeviceToken } from '../PushProviders.js';

describe('PushProviders', () => {
  describe('MockPushProvider', () => {
    it('should be configured and ready', () => {
      const provider = new MockPushProvider();
      expect(provider.name).toBe('mock');
      expect(provider.isConfigured).toBe(true);
    });

    it('should log and return success for push notifications', async () => {
      const provider = new MockPushProvider();
      const message: PushMessage = {
        tokens: [
          { token: 'device-token-1', platform: 'ios' },
          { token: 'device-token-2', platform: 'android' },
        ],
        title: 'Test Notification',
        body: 'This is a test notification',
        options: {
          badge: 1,
          sound: 'default',
          data: { type: 'test' },
        },
      };

      const result = await provider.send(message);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('mock');
      expect(result.totalSent).toBe(2);
      expect(result.totalFailed).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results?.[0].success).toBe(true);
      expect(result.results?.[1].success).toBe(true);
    });
  });

  describe('FCMProvider', () => {
    it('should not be configured without credentials', () => {
      const provider = new FCMProvider();
      expect(provider.name).toBe('fcm');
      expect(provider.isConfigured).toBe(false);
    });

    it('should return error when not configured', async () => {
      const provider = new FCMProvider();
      const message: PushMessage = {
        tokens: [{ token: 'test-token', platform: 'ios' }],
        title: 'Test',
        body: 'Body',
      };

      const result = await provider.send(message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Firebase credentials not configured');
      expect(result.totalFailed).toBe(1);
    });
  });

  describe('OneSignalProvider', () => {
    it('should not be configured without credentials', () => {
      const provider = new OneSignalProvider();
      expect(provider.name).toBe('onesignal');
      expect(provider.isConfigured).toBe(false);
    });

    it('should be configured with credentials', () => {
      const provider = new OneSignalProvider({
        appId: 'test-app-id',
        apiKey: 'test-api-key',
      });
      expect(provider.isConfigured).toBe(true);
    });
  });

  describe('ExpoPushProvider', () => {
    it('should always be configured', () => {
      const provider = new ExpoPushProvider();
      expect(provider.name).toBe('expo');
      expect(provider.isConfigured).toBe(true);
    });
  });

  describe('WebPushProvider', () => {
    it('should not be configured without VAPID keys', () => {
      const provider = new WebPushProvider();
      expect(provider.name).toBe('webpush');
      expect(provider.isConfigured).toBe(false);
    });

    it('should be configured with VAPID keys', () => {
      const provider = new WebPushProvider({
        vapidPublicKey: 'test-public-key',
        vapidPrivateKey: 'test-private-key',
      });
      expect(provider.isConfigured).toBe(true);
    });
  });

  describe('createPushProvider', () => {
    it('should create mock provider by default', () => {
      const provider = createPushProvider('mock');
      expect(provider).toBeInstanceOf(MockPushProvider);
    });

    it('should create FCM provider', () => {
      const provider = createPushProvider('fcm');
      expect(provider).toBeInstanceOf(FCMProvider);
    });

    it('should create OneSignal provider', () => {
      const provider = createPushProvider('onesignal');
      expect(provider).toBeInstanceOf(OneSignalProvider);
    });

    it('should create Expo provider', () => {
      const provider = createPushProvider('expo');
      expect(provider).toBeInstanceOf(ExpoPushProvider);
    });

    it('should create WebPush provider', () => {
      const provider = createPushProvider('webpush');
      expect(provider).toBeInstanceOf(WebPushProvider);
    });
  });
});

describe('PushService', () => {
  beforeEach(() => {
    resetPushService();
  });

  describe('constructor', () => {
    it('should create service with mock provider in development mode', () => {
      const service = new PushService({ developmentMode: true });
      expect(service.providerName).toBe('mock');
      expect(service.isDevelopmentMode).toBe(true);
    });

    it('should create service with specified provider when not in development mode', () => {
      // Reset and create with explicit settings to bypass development mode
      const service = new PushService({ provider: 'fcm', developmentMode: false });
      expect(service.providerName).toBe('fcm');
    });
  });

  describe('send', () => {
    it('should validate required tokens', async () => {
      const service = new PushService({ developmentMode: true });
      const result = await service.send({
        tokens: [],
        title: 'Test',
        body: 'Body',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('token is required');
    });

    it('should validate required title', async () => {
      const service = new PushService({ developmentMode: true });
      const result = await service.send({
        tokens: [{ token: 'test', platform: 'ios' }],
        title: '',
        body: 'Body',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Title is required');
    });

    it('should validate required body', async () => {
      const service = new PushService({ developmentMode: true });
      const result = await service.send({
        tokens: [{ token: 'test', platform: 'ios' }],
        title: 'Test',
        body: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Body is required');
    });

    it('should send notification successfully with mock provider', async () => {
      const service = new PushService({ developmentMode: true });
      const result = await service.send({
        tokens: [
          { token: 'device-1', platform: 'ios' },
          { token: 'device-2', platform: 'android' },
        ],
        title: 'Test Notification',
        body: 'This is a test',
        options: {
          badge: 1,
          sound: 'default',
        },
      });

      expect(result.success).toBe(true);
      expect(result.totalSent).toBe(2);
      expect(result.totalFailed).toBe(0);
    });
  });

  describe('sendToDevice', () => {
    it('should send to a single device token string', async () => {
      const service = new PushService({ developmentMode: true });
      const result = await service.sendToDevice(
        'device-token',
        'Test Title',
        'Test Body'
      );

      expect(result.success).toBe(true);
      expect(result.totalSent).toBe(1);
    });

    it('should send to a single device token object', async () => {
      const service = new PushService({ developmentMode: true });
      const result = await service.sendToDevice(
        { token: 'device-token', platform: 'ios' },
        'Test Title',
        'Test Body',
        { badge: 5 }
      );

      expect(result.success).toBe(true);
      expect(result.totalSent).toBe(1);
    });
  });

  describe('sendToDevices', () => {
    it('should send to multiple devices', async () => {
      const service = new PushService({ developmentMode: true });
      const result = await service.sendToDevices(
        ['token-1', { token: 'token-2', platform: 'web' }],
        'Test Title',
        'Test Body'
      );

      expect(result.success).toBe(true);
      expect(result.totalSent).toBe(2);
    });
  });

  describe('templates', () => {
    it('should register and use custom templates', async () => {
      const service = new PushService({ developmentMode: true });
      
      service.registerTemplate('custom', {
        title: 'Custom Title',
        body: (data) => `Hello ${data.name}`,
      });

      const result = await service.sendFromTemplate('custom', ['token-1'], { name: 'World' });

      expect(result.success).toBe(true);
    });

    it('should return error for missing template', async () => {
      const service = new PushService({ developmentMode: true });
      
      const result = await service.sendFromTemplate('nonexistent', ['token-1'], {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should use built-in templates', async () => {
      const service = new PushService({ developmentMode: true });
      
      const result = await service.sendFromTemplate('signal', ['token-1'], {
        symbol: 'BTC/USDT',
        side: 'buy',
        price: 50000,
        confidence: 0.85,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getPushService', () => {
    it('should return a singleton instance', () => {
      const service1 = getPushService({ developmentMode: true });
      const service2 = getPushService();

      expect(service1).toBe(service2);
    });

    it('should reset and create new instance', () => {
      const service1 = getPushService({ developmentMode: true });
      resetPushService();
      const service2 = getPushService({ developmentMode: true });

      expect(service1).not.toBe(service2);
    });
  });
});