/**
 * WebhookStorage Tests
 */

import { WebhookStorage } from '../../src/webhook/WebhookStorage';
import { WebhookEventType } from '../../src/webhook/types';

// Helper to create a chainable mock
function createChainableMock(finalResult: any) {
  const chainable: any = {
    select: jest.fn(() => chainable),
    insert: jest.fn(() => chainable),
    update: jest.fn(() => chainable),
    delete: jest.fn(() => chainable),
    eq: jest.fn(() => chainable),
    neq: jest.fn(() => chainable),
    lt: jest.fn(() => chainable),
    lte: jest.fn(() => chainable),
    gt: jest.fn(() => chainable),
    gte: jest.fn(() => chainable),
    contains: jest.fn(() => chainable),
    order: jest.fn(() => chainable),
    limit: jest.fn(() => chainable),
    single: jest.fn(() => Promise.resolve(finalResult)),
    then: (resolve: (value: any) => any) => Promise.resolve(finalResult).then(resolve),
  };
  return chainable;
}

// The database/client is mocked via jest.config.js moduleNameMapper
// We use the global mock from tests/__mocks__/supabase.ts

describe('WebhookStorage', () => {
  let storage: WebhookStorage;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new WebhookStorage();
    
    // Get the global mock and set up the from method
    const { getSupabaseClient } = require('../../tests/__mocks__/supabase');
    mockSupabase = getSupabaseClient();
    mockSupabase.from = jest.fn();
  });

  describe('createWebhook', () => {
    it('should create a webhook with provided secret', async () => {
      const chainable = createChainableMock({
        data: {
          id: 'webhook-1',
          name: 'Test Webhook',
          url: 'https://example.com/webhook',
          secret: 'my-custom-secret-12345678',
          events: ['trade.executed'],
          enabled: true,
          retry_count: 3,
          retry_delay_ms: 1000,
          timeout_ms: 5000,
          ip_whitelist: null,
          headers: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      });
      mockSupabase.from.mockReturnValue(chainable);
      
      const webhook = await storage.createWebhook({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        secret: 'my-custom-secret-12345678',
        events: ['trade.executed'] as WebhookEventType[],
      });
      
      expect(webhook).toBeDefined();
      expect(webhook.name).toBe('Test Webhook');
    });

    it('should generate a secret if not provided', async () => {
      const chainable = createChainableMock({
        data: {
          id: 'webhook-1',
          name: 'Test Webhook',
          url: 'https://example.com/webhook',
          secret: 'generated-secret-12345678',
          events: ['trade.executed'],
          enabled: true,
          retry_count: 3,
          retry_delay_ms: 1000,
          timeout_ms: 5000,
          ip_whitelist: null,
          headers: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      });
      mockSupabase.from.mockReturnValue(chainable);
      
      const webhook = await storage.createWebhook({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['trade.executed'] as WebhookEventType[],
      });
      
      expect(webhook).toBeDefined();
    });
  });

  describe('getWebhookById', () => {
    it('should get a webhook by ID', async () => {
      const chainable = createChainableMock({
        data: {
          id: 'webhook-1',
          name: 'Test Webhook',
          url: 'https://example.com/webhook',
          secret: 'test-secret-12345678',
          events: ['trade.executed'],
          enabled: true,
          retry_count: 3,
          retry_delay_ms: 1000,
          timeout_ms: 5000,
          ip_whitelist: null,
          headers: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      });
      mockSupabase.from.mockReturnValue(chainable);
      
      const webhook = await storage.getWebhookById('webhook-1');
      
      expect(webhook).toBeDefined();
      expect(webhook?.id).toBe('webhook-1');
    });

    it('should return null for non-existent webhook', async () => {
      const chainable = createChainableMock({
        data: null,
        error: { code: 'PGRST116' },
      });
      mockSupabase.from.mockReturnValue(chainable);
      
      const webhook = await storage.getWebhookById('non-existent');
      
      expect(webhook).toBeNull();
    });
  });

  describe('getAllWebhooks', () => {
    it('should get all webhooks', async () => {
      const chainable = {
        select: jest.fn(() => chainable),
        eq: jest.fn(() => chainable),
        then: (resolve: (value: any) => any) => resolve({
          data: [
            {
              id: 'webhook-1',
              name: 'Webhook 1',
              url: 'https://example1.com/webhook',
              secret: 'secret1',
              events: ['trade.executed'],
              enabled: true,
              retry_count: 3,
              retry_delay_ms: 1000,
              timeout_ms: 5000,
              ip_whitelist: null,
              headers: null,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
            {
              id: 'webhook-2',
              name: 'Webhook 2',
              url: 'https://example2.com/webhook',
              secret: 'secret2',
              events: ['signal.generated'],
              enabled: false,
              retry_count: 3,
              retry_delay_ms: 1000,
              timeout_ms: 5000,
              ip_whitelist: null,
              headers: null,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(chainable);
      
      const webhooks = await storage.getAllWebhooks();
      
      expect(Array.isArray(webhooks)).toBe(true);
      expect(webhooks.length).toBe(2);
    });

    it('should filter for enabled only when requested', async () => {
      const chainable = {
        select: jest.fn(() => chainable),
        eq: jest.fn(() => chainable),
        then: (resolve: (value: any) => any) => resolve({
          data: [
            {
              id: 'webhook-1',
              name: 'Enabled Webhook',
              url: 'https://example.com/webhook',
              secret: 'secret1',
              events: ['trade.executed'],
              enabled: true,
              retry_count: 3,
              retry_delay_ms: 1000,
              timeout_ms: 5000,
              ip_whitelist: null,
              headers: null,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(chainable);
      
      const webhooks = await storage.getAllWebhooks(true);
      
      expect(Array.isArray(webhooks)).toBe(true);
      expect(webhooks.length).toBe(1);
      expect(webhooks[0].enabled).toBe(true);
    });
  });

  describe('updateWebhook', () => {
    it('should update a webhook', async () => {
      const chainable = createChainableMock({
        data: {
          id: 'webhook-1',
          name: 'Updated Webhook',
          url: 'https://example.com/webhook',
          secret: 'test-secret-12345678',
          events: ['trade.executed', 'signal.generated'],
          enabled: true,
          retry_count: 3,
          retry_delay_ms: 1000,
          timeout_ms: 5000,
          ip_whitelist: null,
          headers: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
        error: null,
      });
      mockSupabase.from.mockReturnValue(chainable);
      
      const webhook = await storage.updateWebhook('webhook-1', {
        name: 'Updated Webhook',
        events: ['trade.executed', 'signal.generated'] as WebhookEventType[],
      });
      
      expect(webhook).toBeDefined();
      expect(webhook.name).toBe('Updated Webhook');
    });
  });

  describe('deleteWebhook', () => {
    it('should delete a webhook', async () => {
      const chainable = {
        delete: jest.fn(() => chainable),
        eq: jest.fn(() => Promise.resolve({ error: null })),
      };
      mockSupabase.from.mockReturnValue(chainable);
      
      await expect(storage.deleteWebhook('webhook-1')).resolves.not.toThrow();
    });
  });

  describe('getWebhooksForEvent', () => {
    it('should get webhooks for a specific event', async () => {
      const chainable = {
        select: jest.fn(() => chainable),
        eq: jest.fn(() => chainable),
        contains: jest.fn(() => chainable),
        then: (resolve: (value: any) => any) => resolve({
          data: [
            {
              id: 'webhook-1',
              name: 'Webhook 1',
              url: 'https://example.com/webhook',
              secret: 'secret1',
              events: ['trade.executed'],
              enabled: true,
              retry_count: 3,
              retry_delay_ms: 1000,
              timeout_ms: 5000,
              ip_whitelist: null,
              headers: null,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(chainable);
      
      const webhooks = await storage.getWebhooksForEvent('trade.executed');
      
      expect(Array.isArray(webhooks)).toBe(true);
      expect(webhooks.length).toBe(1);
    });
  });

  describe('delivery operations', () => {
    it('should create a delivery record', async () => {
      const chainable = createChainableMock({
        data: {
          id: 'delivery-1',
          webhook_id: 'webhook-1',
          event_id: 'event-1',
          event_type: 'trade.executed',
          payload: {},
          status: 'pending',
          attempt_count: 0,
          created_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      });
      mockSupabase.from.mockReturnValue(chainable);
      
      const delivery = await storage.createDelivery({
        id: '',
        webhookId: 'webhook-1',
        eventId: 'event-1',
        eventType: 'trade.executed',
        payload: {} as any,
        status: 'pending',
        attemptCount: 0,
        createdAt: new Date(),
      });
      
      expect(delivery).toBeDefined();
      expect(delivery.id).toBe('delivery-1');
    });

    it('should update a delivery record', async () => {
      const chainable = createChainableMock({
        data: {
          id: 'delivery-1',
          status: 'success',
          attempt_count: 1,
        },
        error: null,
      });
      mockSupabase.from.mockReturnValue(chainable);
      
      await expect(storage.updateDelivery('delivery-1', { status: 'success' })).resolves.not.toThrow();
    });

    it('should get pending retries', async () => {
      const chainable = {
        select: jest.fn(() => chainable),
        eq: jest.fn(() => chainable),
        lte: jest.fn(() => chainable),
        order: jest.fn(() => chainable),
        limit: jest.fn(() => chainable),
        then: (resolve: (value: any) => any) => resolve({
          data: [],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(chainable);
      
      const deliveries = await storage.getPendingRetries();
      
      expect(Array.isArray(deliveries)).toBe(true);
    });

    it('should delete old deliveries', async () => {
      const chainable = {
        delete: jest.fn(() => chainable),
        lt: jest.fn(() => chainable),
        select: jest.fn(() => chainable),
        then: (resolve: (value: any) => any) => resolve({
          data: [{ id: 'del-1' }, { id: 'del-2' }],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(chainable);
      
      const count = await storage.deleteOldDeliveries(30);
      
      expect(typeof count).toBe('number');
    });
  });

  describe('webhook stats', () => {
    it('should get webhook statistics', async () => {
      const chainable = {
        select: jest.fn(() => chainable),
        eq: jest.fn(() => chainable),
        then: (resolve: (value: any) => any) => resolve({
          data: [],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(chainable);
      
      const stats = await storage.getWebhookStats('webhook-1');
      
      expect(stats).toBeDefined();
    });
  });
});
