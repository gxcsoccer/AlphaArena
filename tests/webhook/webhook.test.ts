/**
 * Webhook Module Tests
 */

import { WebhookSigner } from '../../src/webhook/WebhookSigner';
import { WebhookEventType, WebhookPayload } from '../../src/webhook/types';

describe('WebhookSigner', () => {
  let signer: WebhookSigner;
  const secret = 'test-secret-key-12345678';

  beforeEach(() => {
    signer = new WebhookSigner(secret);
  });

  describe('sign and verify', () => {
    it('should sign a payload correctly', () => {
      const payload: WebhookPayload = {
        id: 'test-123',
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

      const signature = signer.sign(payload);
      
      expect(signature).toMatch(/^sha256=[a-fA-F0-9]+$/);
    });

    it('should verify a valid signature', () => {
      const payload: WebhookPayload = {
        id: 'test-123',
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

      const signature = signer.sign(payload);
      expect(signer.verify(payload, signature)).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const payload: WebhookPayload = {
        id: 'test-123',
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

      expect(signer.verify(payload, 'sha256=invalid')).toBe(false);
    });

    it('should generate different signatures for different payloads', () => {
      const payload1: WebhookPayload = {
        id: 'test-1',
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

      const payload2: WebhookPayload = {
        ...payload1,
        id: 'test-2',
      };

      const signature1 = signer.sign(payload1);
      const signature2 = signer.sign(payload2);

      expect(signature1).not.toBe(signature2);
    });
  });

  describe('generateSecret', () => {
    it('should generate a random secret', () => {
      const secret1 = WebhookSigner.generateSecret();
      const secret2 = WebhookSigner.generateSecret();

      expect(secret1).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(secret1).not.toBe(secret2);
    });

    it('should generate secret of specified length', () => {
      const secret = WebhookSigner.generateSecret(16);
      expect(secret).toHaveLength(32); // 16 bytes = 32 hex chars
    });
  });

  describe('constructor validation', () => {
    it('should reject short secrets', () => {
      expect(() => new WebhookSigner('short')).toThrow();
    });

    it('should reject empty secrets', () => {
      expect(() => new WebhookSigner('')).toThrow();
    });
  });
});

describe('Webhook Types', () => {
  it('should define all event types', () => {
    const eventTypes: WebhookEventType[] = [
      'trade.executed',
      'signal.generated',
      'stop_loss.triggered',
      'take_profit.triggered',
      'bot.started',
      'bot.stopped',
      'bot.paused',
      'system.alert',
    ];

    expect(eventTypes).toHaveLength(8);
  });
});
