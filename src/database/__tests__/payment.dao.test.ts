/**
 * Tests for Payment DAO
 */

import { PaymentDAO } from '../payment.dao';

// Mock Supabase client chain methods
const createMockChain = () => {
  const chain: any = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.single = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(() => chain);
  chain.insert = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  return chain;
};

// Mock clients (anon for reads, admin for writes)
const mockAnonClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

const mockAdminClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

describe('PaymentDAO', () => {
  let dao: PaymentDAO;

  beforeEach(() => {
    jest.clearAllMocks();
    dao = new PaymentDAO(mockAnonClient as any, mockAdminClient as any);
  });

  describe('getOrCreateStripeCustomer', () => {
    it('should create or get a Stripe customer record', async () => {
      const mockCustomer = {
        id: 'cust-uuid-123',
        user_id: 'user-123',
        stripe_customer_id: 'cus_stripe_123',
        email: 'test@example.com',
        name: 'Test User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock RPC call returns the ID directly (not {data, error} structure for RPCs that return scalars)
      mockAdminClient.rpc.mockResolvedValueOnce('cust-uuid-123');

      // Mock getStripeCustomerById
      const chain = createMockChain();
      chain.single.mockResolvedValue({ data: mockCustomer, error: null });
      mockAdminClient.from.mockReturnValue(chain);

      const result = await dao.getOrCreateStripeCustomer(
        'user-123',
        'cus_stripe_123',
        'test@example.com',
        'Test User'
      );

      expect(mockAdminClient.rpc).toHaveBeenCalledWith(
        'get_or_create_stripe_customer',
        expect.objectContaining({
          p_user_id: 'user-123',
          p_stripe_customer_id: 'cus_stripe_123',
          p_email: 'test@example.com',
          p_name: 'Test User',
        })
      );
      expect(result.stripeCustomerId).toBe('cus_stripe_123');
    });

    it('should handle errors when creating customer', async () => {
      mockAdminClient.rpc.mockRejectedValue(new Error('Database error'));

      await expect(
        dao.getOrCreateStripeCustomer('user-123', 'cus_stripe_123')
      ).rejects.toThrow('Database error');
    });
  });

  describe('getStripeCustomerByUserId', () => {
    it('should return customer by user ID', async () => {
      const mockCustomer = {
        id: 'cust-uuid-123',
        user_id: 'user-123',
        stripe_customer_id: 'cus_stripe_123',
        email: 'test@example.com',
        name: 'Test User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const chain = createMockChain();
      chain.maybeSingle.mockResolvedValue({ data: mockCustomer, error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const result = await dao.getStripeCustomerByUserId('user-123');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-123');
      expect(result?.stripeCustomerId).toBe('cus_stripe_123');
    });

    it('should return null when customer not found', async () => {
      const chain = createMockChain();
      chain.maybeSingle.mockResolvedValue({ data: null, error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const result = await dao.getStripeCustomerByUserId('nonexistent-user');

      expect(result).toBeNull();
    });
  });

  describe('recordPayment', () => {
    it('should record a successful payment', async () => {
      const mockPayment = {
        id: 'payment-uuid-123',
        user_id: 'user-123',
        stripe_customer_id: 'cus_stripe_123',
        stripe_subscription_id: 'sub_stripe_123',
        stripe_invoice_id: 'inv_stripe_123',
        stripe_payment_intent_id: null,
        amount: 99.00,
        currency: 'CNY',
        status: 'succeeded',
        plan_id: 'pro',
        billing_period: 'monthly',
        description: null,
        invoice_url: 'https://invoice.url',
        receipt_url: null,
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // RPC returns ID directly
      mockAdminClient.rpc.mockResolvedValueOnce('payment-uuid-123');

      // Mock getPaymentById
      const chain = createMockChain();
      chain.single.mockResolvedValue({ data: mockPayment, error: null });
      mockAdminClient.from.mockReturnValue(chain);

      const result = await dao.recordPayment({
        userId: 'user-123',
        stripeCustomerId: 'cus_stripe_123',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeInvoiceId: 'inv_stripe_123',
        amount: 99.00,
        currency: 'CNY',
        status: 'succeeded',
        planId: 'pro',
        billingPeriod: 'monthly',
        invoiceUrl: 'https://invoice.url',
        paidAt: new Date(),
      });

      expect(mockAdminClient.rpc).toHaveBeenCalledWith(
        'record_payment',
        expect.objectContaining({
          p_user_id: 'user-123',
          p_amount: 99.00,
          p_currency: 'CNY',
          p_status: 'succeeded',
        })
      );
      expect(result.status).toBe('succeeded');
    });

    it('should record a failed payment', async () => {
      const mockPayment = {
        id: 'payment-uuid-123',
        user_id: 'user-123',
        stripe_customer_id: 'cus_stripe_123',
        stripe_subscription_id: 'sub_stripe_123',
        stripe_invoice_id: 'inv_stripe_123',
        stripe_payment_intent_id: null,
        amount: 99.00,
        currency: 'CNY',
        status: 'failed',
        plan_id: 'pro',
        billing_period: 'monthly',
        description: null,
        invoice_url: null,
        receipt_url: null,
        paid_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAdminClient.rpc.mockResolvedValueOnce('payment-uuid-123');

      const chain = createMockChain();
      chain.single.mockResolvedValue({ data: mockPayment, error: null });
      mockAdminClient.from.mockReturnValue(chain);

      const result = await dao.recordPayment({
        userId: 'user-123',
        stripeCustomerId: 'cus_stripe_123',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeInvoiceId: 'inv_stripe_123',
        amount: 99.00,
        currency: 'CNY',
        status: 'failed',
        planId: 'pro',
      });

      expect(result.status).toBe('failed');
      expect(result.paidAt).toBeNull();
    });

    it('should handle errors when recording payment', async () => {
      mockAdminClient.rpc.mockRejectedValue(new Error('Database error'));

      await expect(
        dao.recordPayment({
          userId: 'user-123',
          amount: 99.00,
          status: 'succeeded',
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment history for a user', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          amount: 99.00,
          currency: 'CNY',
          status: 'succeeded',
          plan_id: 'pro',
          billing_period: 'monthly',
          description: null,
          invoice_url: 'https://invoice.url',
          receipt_url: null,
          paid_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        {
          id: 'payment-2',
          amount: 999.00,
          currency: 'CNY',
          status: 'succeeded',
          plan_id: 'pro',
          billing_period: 'yearly',
          description: null,
          invoice_url: 'https://invoice.url',
          receipt_url: null,
          paid_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      // RPC returns { data, error } structure for queries
      mockAdminClient.rpc.mockResolvedValueOnce({ data: mockPayments, error: null });

      const result = await dao.getPaymentHistory('user-123');

      expect(mockAdminClient.rpc).toHaveBeenCalledWith(
        'get_user_payment_history',
        expect.objectContaining({
          p_user_id: 'user-123',
          p_limit: 20,
        })
      );
      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(99.00);
      expect(result[1].amount).toBe(999.00);
    });

    it('should return empty array when no payments exist', async () => {
      mockAdminClient.rpc.mockResolvedValueOnce({ data: [], error: null });

      const result = await dao.getPaymentHistory('user-without-payments');

      expect(result).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      mockAdminClient.rpc.mockResolvedValueOnce({ data: [], error: null });

      await dao.getPaymentHistory('user-123', 5);

      expect(mockAdminClient.rpc).toHaveBeenCalledWith(
        'get_user_payment_history',
        expect.objectContaining({
          p_limit: 5,
        })
      );
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status', async () => {
      const mockPayment = {
        id: 'payment-uuid-123',
        user_id: 'user-123',
        stripe_customer_id: 'cus_stripe_123',
        stripe_subscription_id: 'sub_stripe_123',
        stripe_invoice_id: 'inv_stripe_123',
        stripe_payment_intent_id: null,
        amount: 99.00,
        currency: 'CNY',
        status: 'refunded',
        plan_id: 'pro',
        billing_period: 'monthly',
        description: null,
        invoice_url: null,
        receipt_url: null,
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const chain = createMockChain();
      chain.single.mockResolvedValue({ data: mockPayment, error: null });
      mockAdminClient.from.mockReturnValue(chain);

      const result = await dao.updatePaymentStatus('payment-uuid-123', 'refunded');

      expect(result).not.toBeNull();
      expect(result?.status).toBe('refunded');
    });

    it('should return null when payment not found (no rows updated)', async () => {
      const chain = createMockChain();
      // Simulate no rows found - Supabase returns null data with no error for no match
      chain.single.mockResolvedValue({ data: null, error: null });
      mockAdminClient.from.mockReturnValue(chain);

      const result = await dao.updatePaymentStatus('nonexistent-payment', 'refunded');

      // When no rows match, the DAO returns null (data is null but no error)
      expect(result).toBeNull();
    });
  });

  describe('getPaymentByStripeInvoiceId', () => {
    it('should return payment by Stripe invoice ID', async () => {
      const mockPayment = {
        id: 'payment-uuid-123',
        user_id: 'user-123',
        stripe_customer_id: 'cus_stripe_123',
        stripe_subscription_id: 'sub_stripe_123',
        stripe_invoice_id: 'inv_stripe_123',
        stripe_payment_intent_id: null,
        amount: 99.00,
        currency: 'CNY',
        status: 'succeeded',
        plan_id: 'pro',
        billing_period: 'monthly',
        description: null,
        invoice_url: null,
        receipt_url: null,
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const chain = createMockChain();
      chain.maybeSingle.mockResolvedValue({ data: mockPayment, error: null });
      mockAdminClient.from.mockReturnValue(chain);

      const result = await dao.getPaymentByStripeInvoiceId('inv_stripe_123');

      expect(result).not.toBeNull();
      expect(result?.stripeInvoiceId).toBe('inv_stripe_123');
    });

    it('should return null when invoice not found', async () => {
      const chain = createMockChain();
      chain.maybeSingle.mockResolvedValue({ data: null, error: null });
      mockAdminClient.from.mockReturnValue(chain);

      const result = await dao.getPaymentByStripeInvoiceId('nonexistent-invoice');

      expect(result).toBeNull();
    });
  });
});
