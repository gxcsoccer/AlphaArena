/**
 * WebhookManager Tests
 */

import { WebhookManager } from '../../src/webhook/WebhookManager';
import { WebhookConfig, WebhookEventType } from '../../src/webhook/types';

// Mock WebhookStorage
jest.mock('../../src/webhook/WebhookStorage', () => {
  return {
    WebhookStorage: jest.fn().mockImplementation(() => ({
      createWebhook: jest.fn().mockResolvedValue({
        id: 'webhook-1',
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        secret: 'test-secret-12345678',
        events: ['trade.executed'],
        enabled: true,
        retryCount: 3,
        retryDelayMs: 1000,
        timeoutMs: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getWebhookById: jest.fn().mockResolvedValue({
        id: 'webhook-1',
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        secret: 'test-secret-12345678',
        events: ['trade.executed'],
        enabled: true,
        retryCount: 3,
        retryDelayMs: 1000,
        timeoutMs: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getAllWebhooks: jest.fn().mockResolvedValue([]),
      getWebhooksForEvent: jest.fn().mockResolvedValue([]),
      updateWebhook: jest.fn().mockResolvedValue({
        id: 'webhook-1',
        name: 'Updated Webhook',
        url: 'https://example.com/webhook',
        secret: 'test-secret-12345678',
        events: ['trade.executed'],
        enabled: true,
        retryCount: 3,
        retryDelayMs: 1000,
        timeoutMs: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      deleteWebhook: jest.fn().mockResolvedValue(undefined),
      createDelivery: jest.fn().mockResolvedValue({
        id: 'delivery-1',
        webhookId: 'webhook-1',
        eventId: 'event-1',
        eventType: 'trade.executed',
        payload: {},
        status: 'pending',
        attemptCount: 0,
        createdAt: new Date(),
      }),
      updateDelivery: jest.fn().mockResolvedValue(undefined),
      getPendingRetries: jest.fn().mockResolvedValue([]),
      getDeliveries: jest.fn().mockResolvedValue([]),
      getWebhookStats: jest.fn().mockResolvedValue({
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        pendingDeliveries: 0,
        successRate: 0,
        averageResponseTime: 0,
      }),
      deleteOldDeliveries: jest.fn().mockResolvedValue(0),
    })),
  };
});

// Mock WebhookSender
jest.mock('../../src/webhook/WebhookSender', () => {
import EventEmitter from 'events';
  return {
    WebhookSender: jest.fn().mockImplementation(() => {
      const emitter = new EventEmitter();
      return Object.assign(emitter, {
        send: jest.fn().mockResolvedValue({ success: true, statusCode: 200 }),
        sendWithRetry: jest.fn().mockResolvedValue(undefined),
        test: jest.fn().mockResolvedValue({ success: true, statusCode: 200, responseTime: 100 }),
      });
    }),
  };
});

describe('WebhookManager', () => {
  let manager: WebhookManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new WebhookManager();
  });

  afterEach(async () => {
    if (manager) {
      await manager.stop();
    }
  });

  describe('start and stop', () => {
    it('should start the webhook manager', async () => {
      await manager.start();
      
      expect(manager.getIsRunning()).toBe(true);
    });

    it('should not start twice', async () => {
      await manager.start();
      await manager.start(); // Should be idempotent
      
      expect(manager.getIsRunning()).toBe(true);
    });

    it('should stop the webhook manager', async () => {
      await manager.start();
      expect(manager.getIsRunning()).toBe(true);
      
      await manager.stop();
      expect(manager.getIsRunning()).toBe(false);
    });

    it('should emit started event', async () => {
      const startedHandler = jest.fn();
      manager.on('started', startedHandler);
      
      await manager.start();
      
      expect(startedHandler).toHaveBeenCalled();
    });

    it('should emit stopped event', async () => {
      const stoppedHandler = jest.fn();
      manager.on('stopped', stoppedHandler);
      
      await manager.start();
      await manager.stop();
      
      expect(stoppedHandler).toHaveBeenCalled();
    });
  });

  describe('webhook configuration', () => {
    it('should create a webhook', async () => {
      const webhook = await manager.createWebhook({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['trade.executed'] as WebhookEventType[],
      });
      
      expect(webhook).toBeDefined();
      expect(webhook.name).toBe('Test Webhook');
    });

    it('should reject invalid URL', async () => {
      await expect(manager.createWebhook({
        name: 'Invalid Webhook',
        url: 'not-a-url',
        events: ['trade.executed'] as WebhookEventType[],
      })).rejects.toThrow('Invalid webhook URL');
    });

    it('should reject empty events', async () => {
      await expect(manager.createWebhook({
        name: 'No Events',
        url: 'https://example.com/webhook',
        events: [],
      })).rejects.toThrow('At least one event type must be specified');
    });

    it('should get a webhook by ID', async () => {
      const webhook = await manager.getWebhook('webhook-1');
      
      expect(webhook).toBeDefined();
    });

    it('should get all webhooks', async () => {
      const webhooks = await manager.getAllWebhooks();
      
      expect(Array.isArray(webhooks)).toBe(true);
    });

    it('should update a webhook', async () => {
      const webhook = await manager.updateWebhook('webhook-1', {
        name: 'Updated Webhook',
      });
      
      expect(webhook).toBeDefined();
    });

    it('should delete a webhook', async () => {
      await expect(manager.deleteWebhook('webhook-1')).resolves.not.toThrow();
    });

    it('should test a webhook', async () => {
      const result = await manager.testWebhook('webhook-1');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('triggerEvent', () => {
    it('should handle triggerEvent gracefully when no webhooks subscribed', async () => {
      await manager.start();
      
      // Should not throw when no webhooks are subscribed
      await expect(manager.triggerEvent('trade.executed', {
        type: 'trade',
        symbol: 'BTC/USDT',
        side: 'buy',
        price: 50000,
        quantity: 0.1,
        total: 5000,
      })).resolves.not.toThrow();
    });
  });

  describe('delivery management', () => {
    it('should get deliveries', async () => {
      const deliveries = await manager.getDeliveries();
      
      expect(Array.isArray(deliveries)).toBe(true);
    });

    it('should get webhook stats', async () => {
      const stats = await manager.getWebhookStats('webhook-1');
      
      expect(stats).toBeDefined();
      expect(stats.totalDeliveries).toBe(0);
    });
  });

  describe('generateSecret', () => {
    it('should generate a secret', () => {
      const secret = WebhookManager.generateSecret();
      
      expect(secret).toBeDefined();
      expect(secret.length).toBe(64); // 32 bytes = 64 hex chars
    });
  });

  describe('options', () => {
    it('should accept custom retry interval', () => {
      const customManager = new WebhookManager({
        retryIntervalMs: 60000,
      });
      
      expect(customManager).toBeDefined();
    });

    it('should accept custom cleanup options', () => {
      const customManager = new WebhookManager({
        cleanupIntervalMs: 3600000,
        cleanupOlderThanDays: 7,
      });
      
      expect(customManager).toBeDefined();
    });
  });
});
