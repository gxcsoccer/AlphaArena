/**
 * Payment Data Access Object
 * Handles database operations for payment history and Stripe customers
 */

import { getSupabaseClient, getSupabaseAdminClient } from './client';
import { createLogger } from '../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';

const log = createLogger('PaymentDAO');

export interface StripeCustomer {
  id: string;
  userId: string;
  stripeCustomerId: string;
  email: string | null;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeInvoiceId: string | null;
  stripePaymentIntentId: string | null;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending' | 'refunded';
  planId: string | null;
  billingPeriod: string | null;
  description: string | null;
  invoiceUrl: string | null;
  receiptUrl: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PaymentDAO {
  private anonClient: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor(anonClient: SupabaseClient, adminClient: SupabaseClient) {
    this.anonClient = anonClient;
    this.adminClient = adminClient;
  }

  /**
   * Get or create a Stripe customer record
   */
  async getOrCreateStripeCustomer(
    userId: string,
    stripeCustomerId: string,
    email?: string,
    name?: string
  ): Promise<StripeCustomer> {
    // Use admin client for write
    const { data, error } = await this.adminClient
      .rpc('get_or_create_stripe_customer', {
        p_user_id: userId,
        p_stripe_customer_id: stripeCustomerId,
        p_email: email || null,
        p_name: name || null,
      });

    if (error) {
      log.error('Failed to get or create stripe customer:', error);
      throw error;
    }

    return this.getStripeCustomerById(data);
  }

  /**
   * Get Stripe customer by user ID
   */
  async getStripeCustomerByUserId(userId: string): Promise<StripeCustomer | null> {
    const { data, error } = await this.anonClient
      .from('stripe_customers')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      log.error('Failed to get stripe customer:', error);
      throw error;
    }

    return data ? this.mapStripeCustomerRow(data) : null;
  }

  /**
   * Get Stripe customer by ID
   */
  private async getStripeCustomerById(id: string): Promise<StripeCustomer> {
    const { data, error } = await this.adminClient
      .from('stripe_customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    return this.mapStripeCustomerRow(data);
  }

  /**
   * Record a payment
   */
  async recordPayment(data: {
    userId: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripeInvoiceId?: string;
    stripePaymentIntentId?: string;
    amount: number;
    currency?: string;
    status: 'succeeded' | 'failed' | 'pending' | 'refunded';
    planId?: string;
    billingPeriod?: string;
    description?: string;
    invoiceUrl?: string;
    receiptUrl?: string;
    paidAt?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentRecord> {
    const { data: result, error } = await this.adminClient
      .rpc('record_payment', {
        p_user_id: data.userId,
        p_stripe_customer_id: data.stripeCustomerId || null,
        p_stripe_subscription_id: data.stripeSubscriptionId || null,
        p_stripe_invoice_id: data.stripeInvoiceId || null,
        p_stripe_payment_intent_id: data.stripePaymentIntentId || null,
        p_amount: data.amount,
        p_currency: data.currency || 'CNY',
        p_status: data.status,
        p_plan_id: data.planId || null,
        p_billing_period: data.billingPeriod || null,
        p_description: data.description || null,
        p_invoice_url: data.invoiceUrl || null,
        p_receipt_url: data.receiptUrl || null,
        p_paid_at: data.paidAt || null,
        p_metadata: data.metadata || {},
      });

    if (error) {
      log.error('Failed to record payment:', error);
      throw error;
    }

    return this.getPaymentById(result);
  }

  /**
   * Get payment by ID
   */
  private async getPaymentById(id: string): Promise<PaymentRecord> {
    const { data, error } = await this.adminClient
      .from('payment_history')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    return this.mapPaymentRecordRow(data);
  }

  /**
   * Get user's payment history
   */
  async getPaymentHistory(userId: string, limit: number = 20): Promise<PaymentRecord[]> {
    const { data, error } = await this.adminClient
      .rpc('get_user_payment_history', {
        p_user_id: userId,
        p_limit: limit,
      });

    if (error) {
      log.error('Failed to get payment history:', error);
      throw error;
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      userId,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripeInvoiceId: null,
      stripePaymentIntentId: null,
      amount: row.amount as number,
      currency: row.currency as string,
      status: row.status as 'succeeded' | 'failed' | 'pending' | 'refunded',
      planId: row.plan_id as string | null,
      billingPeriod: row.billing_period as string | null,
      description: row.description as string | null,
      invoiceUrl: row.invoice_url as string | null,
      receiptUrl: row.receipt_url as string | null,
      paidAt: row.paid_at ? new Date(row.paid_at as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.created_at as string),
    }));
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    status: 'succeeded' | 'failed' | 'pending' | 'refunded',
    paidAt?: Date
  ): Promise<PaymentRecord | null> {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date(),
    };

    if (paidAt) {
      updateData.paid_at = paidAt;
    }

    const { data, error } = await this.adminClient
      .from('payment_history')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      log.error('Failed to update payment status:', error);
      throw error;
    }

    return data ? this.mapPaymentRecordRow(data) : null;
  }

  /**
   * Get payment by Stripe invoice ID
   */
  async getPaymentByStripeInvoiceId(stripeInvoiceId: string): Promise<PaymentRecord | null> {
    const { data, error } = await this.adminClient
      .from('payment_history')
      .select('*')
      .eq('stripe_invoice_id', stripeInvoiceId)
      .maybeSingle();

    if (error) {
      log.error('Failed to get payment by invoice ID:', error);
      throw error;
    }

    return data ? this.mapPaymentRecordRow(data) : null;
  }

  // Mappers
  private mapStripeCustomerRow(row: Record<string, unknown>): StripeCustomer {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      stripeCustomerId: row.stripe_customer_id as string,
      email: row.email as string | null,
      name: row.name as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapPaymentRecordRow(row: Record<string, unknown>): PaymentRecord {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      stripeCustomerId: row.stripe_customer_id as string | null,
      stripeSubscriptionId: row.stripe_subscription_id as string | null,
      stripeInvoiceId: row.stripe_invoice_id as string | null,
      stripePaymentIntentId: row.stripe_payment_intent_id as string | null,
      amount: typeof row.amount === 'string' ? parseFloat(row.amount) : (row.amount as number),
      currency: row.currency as string,
      status: row.status as 'succeeded' | 'failed' | 'pending' | 'refunded',
      planId: row.plan_id as string | null,
      billingPeriod: row.billing_period as string | null,
      description: row.description as string | null,
      invoiceUrl: row.invoice_url as string | null,
      receiptUrl: row.receipt_url as string | null,
      paidAt: row.paid_at ? new Date(row.paid_at as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Singleton instance
let paymentDAO: PaymentDAO | null = null;

export function getPaymentDAO(): PaymentDAO {
  if (!paymentDAO) {
    paymentDAO = new PaymentDAO(getSupabaseClient(), getSupabaseAdminClient());
  }
  return paymentDAO;
}
