/**
 * Webhook Event Data Access Object
 * Handles idempotency for Stripe webhook events
 */

import { getSupabaseAdminClient } from './client';
import { createLogger } from '../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';

const log = createLogger('WebhookEventDAO');

export interface WebhookEventRecord {
  id: string;
  stripeEventId: string;
  eventType: string;
  processedAt: Date;
  status: 'processed' | 'failed';
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}

export class WebhookEventDAO {
  private adminClient: SupabaseClient;

  constructor(adminClient: SupabaseClient) {
    this.adminClient = adminClient;
  }

  /**
   * Check if a webhook event has already been processed
   */
  async isEventProcessed(stripeEventId: string): Promise<boolean> {
    const { data, error } = await this.adminClient.rpc('is_webhook_event_processed', {
      p_stripe_event_id: stripeEventId,
    });

    if (error) {
      log.error('Failed to check webhook event status:', error);
      // On error, assume not processed to allow retry
      return false;
    }

    return data === true;
  }

  /**
   * Mark a webhook event as processed
   */
  async markEventProcessed(
    stripeEventId: string,
    eventType: string,
    status: 'processed' | 'failed' = 'processed',
    errorMessage?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.adminClient.rpc('mark_webhook_event_processed', {
      p_stripe_event_id: stripeEventId,
      p_event_type: eventType,
      p_status: status,
      p_error_message: errorMessage || null,
      p_metadata: metadata || {},
    });

    if (error) {
      log.error('Failed to mark webhook event as processed:', error);
      throw error;
    }

    log.info('Marked webhook event as processed', { 
      stripeEventId, 
      eventType, 
      status 
    });
  }
}

// Singleton instance
let webhookEventDAO: WebhookEventDAO | null = null;

export function getWebhookEventDAO(): WebhookEventDAO {
  if (!webhookEventDAO) {
    webhookEventDAO = new WebhookEventDAO(getSupabaseAdminClient());
  }
  return webhookEventDAO;
}
