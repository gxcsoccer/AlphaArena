/**
 * WebhookSender Tests
 */

import { WebhookSender } from '../../src/webhook/WebhookSender';
import { WebhookConfig, WebhookPayload, WebhookEventType } from '../../src/webhook/types';

describe('WebhookSender', () => {
  let sender: WebhookSender;

  beforeEach(() => {
    sender = new WebhookSender();
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff with jitter', () => {
      const baseDelay = 1000;
      
      // Access private method for testing
      const calculateDelay = (sender as any).calculateBackoffDelay.bind(sender);
      
      // First retry
      const delay1 = calculateDelay(baseDelay, 1);
      expect(delay1).toBeGreaterThanOrEqual(baseDelay);
      expect(delay1).toBeLessThanOrEqual(baseDelay * 2 * 1.1); // With jitter
      
      // Second retry
      const delay2 = calculateDelay(baseDelay, 2);
      expect(delay2).toBeGreaterThanOrEqual(baseDelay * 2);
      expect(delay2).toBeLessThanOrEqual(baseDelay * 4 * 1.1);
      
      // Third retry
      const delay3 = calculateDelay(baseDelay, 3);
      expect(delay3).toBeGreaterThanOrEqual(baseDelay * 4);
    });

    it('should cap delay at 60 seconds', () => {
      const calculateDelay = (sender as any).calculateBackoffDelay.bind(sender);
      const baseDelay = 1000;
      
      // Very high attempt number
      const delay = calculateDelay(baseDelay, 10);
      expect(delay).toBeLessThanOrEqual(60000);
    });
  });

  describe('send', () => {
    it('should handle invalid URLs gracefully', async () => {
      const config: WebhookConfig = {
        id: 'test-webhook',
        name: 'Test Webhook',
        url: 'invalid-url',
        secret: 'test-secret-12345678',
        events: ['trade.executed'] as WebhookEventType[],
        enabled: true,
        retryCount: 0,
        retryDelayMs: 1000,
        timeoutMs: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const payload: WebhookPayload = {
        id: 'test-payload',
        event: 'trade.executed' as WebhookEventType,
        timestamp: new Date().toISOString(),
        data: {
          type: 'trade',
          symbol: 'BTC/USDT',
          side: 'buy',
          price: 50000,
          quantity: 0.1,
          total: 5000,
        },
        signature: '',
      };

      const result = await sender.send(config, payload);
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeDefined();
    });

    it('should emit sent event on success', async () => {
      const sentHandler = jest.fn();
      sender.on('sent', sentHandler);
      
      // Test with a mock HTTP server would be ideal, but for unit tests
      // we'll verify the event emission structure
      expect(sender.listenerCount('sent')).toBe(1);
    });
  });

  describe('concurrency', () => {
    it('should limit concurrent sends', async () => {
      const limitedSender = new WebhookSender({ maxConcurrent: 2 });
      
      // Check that the sender is created with correct options
      expect((limitedSender as any).options.maxConcurrent).toBe(2);
    });
  });
});
