/**
 * Tests for Webhook Event DAO
 */

import { WebhookEventDAO } from '../webhookEvent.dao';

const mockAdminClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

describe('WebhookEventDAO', () => {
  let dao: WebhookEventDAO;

  beforeEach(() => {
    jest.clearAllMocks();
    dao = new WebhookEventDAO(mockAdminClient as any);
  });

  describe('isEventProcessed', () => {
    it('should return true when event was already processed', async () => {
      // RPC returns { data, error } structure
      mockAdminClient.rpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await dao.isEventProcessed('evt_test_123');

      expect(mockAdminClient.rpc).toHaveBeenCalledWith(
        'is_webhook_event_processed',
        { p_stripe_event_id: 'evt_test_123' }
      );
      expect(result).toBe(true);
    });

    it('should return false when event was not processed', async () => {
      mockAdminClient.rpc.mockResolvedValueOnce({ data: false, error: null });

      const result = await dao.isEventProcessed('evt_test_456');

      expect(result).toBe(false);
    });

    it('should return false on database error (allow retry)', async () => {
      mockAdminClient.rpc.mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      const result = await dao.isEventProcessed('evt_test_789');

      // On error, return false to allow processing (idempotency will be handled on write)
      expect(result).toBe(false);
    });
  });

  describe('markEventProcessed', () => {
    it('should mark event as processed successfully', async () => {
      mockAdminClient.rpc.mockResolvedValueOnce({ data: null, error: null });

      await dao.markEventProcessed('evt_test_123', 'checkout.session.completed');

      expect(mockAdminClient.rpc).toHaveBeenCalledWith(
        'mark_webhook_event_processed',
        expect.objectContaining({
          p_stripe_event_id: 'evt_test_123',
          p_event_type: 'checkout.session.completed',
          p_status: 'processed',
          p_error_message: null,
          p_metadata: {},
        })
      );
    });

    it('should mark event as failed with error message', async () => {
      mockAdminClient.rpc.mockResolvedValueOnce({ data: null, error: null });

      await dao.markEventProcessed(
        'evt_test_456',
        'invoice.payment_failed',
        'failed',
        'Payment declined'
      );

      expect(mockAdminClient.rpc).toHaveBeenCalledWith(
        'mark_webhook_event_processed',
        expect.objectContaining({
          p_stripe_event_id: 'evt_test_456',
          p_event_type: 'invoice.payment_failed',
          p_status: 'failed',
          p_error_message: 'Payment declined',
        })
      );
    });

    it('should include metadata when provided', async () => {
      mockAdminClient.rpc.mockResolvedValueOnce({ data: null, error: null });

      const metadata = { attempt: 1, userId: 'user-123' };
      await dao.markEventProcessed(
        'evt_test_789',
        'customer.subscription.updated',
        'processed',
        undefined,
        metadata
      );

      expect(mockAdminClient.rpc).toHaveBeenCalledWith(
        'mark_webhook_event_processed',
        expect.objectContaining({
          p_metadata: metadata,
        })
      );
    });

    it('should throw error when database fails', async () => {
      const dbError = new Error('Database error');
      mockAdminClient.rpc.mockResolvedValueOnce({ 
        data: null, 
        error: dbError
      });

      await expect(
        dao.markEventProcessed('evt_test_123', 'checkout.session.completed')
      ).rejects.toThrow('Database error');
    });
  });
});
