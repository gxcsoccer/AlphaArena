/**
 * WebhookStorage - Database operations for webhook configuration and delivery logs
 *
 * Uses Supabase for persistence
 */

import { getSupabaseClient } from '../database/client';
import {
  WebhookConfig,
  WebhookDelivery,
  WebhookDeliveryFilters,
  WebhookStats,
  CreateWebhookRequest,
  UpdateWebhookRequest,
} from './types';
import { WebhookSigner } from './WebhookSigner';

/**
 * WebhookStorage class for database operations
 */
export class WebhookStorage {
  /**
   * Create a new webhook configuration
   */
  async createWebhook(request: CreateWebhookRequest): Promise<WebhookConfig> {
    const supabase = getSupabaseClient();
    
    const secret = request.secret || WebhookSigner.generateSecret();
    
    const { data, error } = await supabase
      .from('webhooks')
      .insert([
        {
          name: request.name,
          url: request.url,
          secret,
          events: request.events,
          enabled: request.enabled ?? true,
          retry_count: request.retryCount ?? 3,
          retry_delay_ms: request.retryDelayMs ?? 1000,
          timeout_ms: request.timeoutMs ?? 5000,
          ip_whitelist: request.ipWhitelist || null,
          headers: request.headers || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToWebhookConfig(data);
  }

  /**
   * Get a webhook by ID
   */
  async getWebhookById(id: string): Promise<WebhookConfig | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToWebhookConfig(data);
  }

  /**
   * Get all webhooks
   */
  async getAllWebhooks(enabledOnly: boolean = false): Promise<WebhookConfig[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('webhooks').select('*');

    if (enabledOnly) {
      query = query.eq('enabled', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map(this.mapToWebhookConfig);
  }

  /**
   * Get webhooks that subscribe to a specific event
   */
  async getWebhooksForEvent(eventType: string): Promise<WebhookConfig[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('enabled', true)
      .contains('events', [eventType]);

    if (error) throw error;

    return data.map(this.mapToWebhookConfig);
  }

  /**
   * Update a webhook configuration
   */
  async updateWebhook(id: string, request: UpdateWebhookRequest): Promise<WebhookConfig> {
    const supabase = getSupabaseClient();

    const updateData: any = {};
    
    if (request.name !== undefined) updateData.name = request.name;
    if (request.url !== undefined) updateData.url = request.url;
    if (request.secret !== undefined) updateData.secret = request.secret;
    if (request.events !== undefined) updateData.events = request.events;
    if (request.enabled !== undefined) updateData.enabled = request.enabled;
    if (request.retryCount !== undefined) updateData.retry_count = request.retryCount;
    if (request.retryDelayMs !== undefined) updateData.retry_delay_ms = request.retryDelayMs;
    if (request.timeoutMs !== undefined) updateData.timeout_ms = request.timeoutMs;
    if (request.ipWhitelist !== undefined) updateData.ip_whitelist = request.ipWhitelist;
    if (request.headers !== undefined) updateData.headers = request.headers;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('webhooks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToWebhookConfig(data);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Create a delivery log entry
   */
  async createDelivery(delivery: Omit<WebhookDelivery, 'id' | 'createdAt'>): Promise<WebhookDelivery> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('webhook_deliveries')
      .insert([
        {
          webhook_id: delivery.webhookId,
          event_id: delivery.eventId,
          event_type: delivery.eventType,
          payload: delivery.payload,
          status: delivery.status,
          attempt_count: delivery.attemptCount,
          last_attempt_at: delivery.lastAttemptAt?.toISOString() || null,
          next_retry_at: delivery.nextRetryAt?.toISOString() || null,
          response_code: delivery.responseCode || null,
          response_time: delivery.responseTime || null,
          error_message: delivery.errorMessage || null,
          delivered_at: delivery.deliveredAt?.toISOString() || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToWebhookDelivery(data);
  }

  /**
   * Update a delivery log entry
   */
  async updateDelivery(id: string, updates: Partial<WebhookDelivery>): Promise<WebhookDelivery> {
    const supabase = getSupabaseClient();

    const updateData: any = {};
    
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.attemptCount !== undefined) updateData.attempt_count = updates.attemptCount;
    if (updates.lastAttemptAt !== undefined) updateData.last_attempt_at = updates.lastAttemptAt?.toISOString() || null;
    if (updates.nextRetryAt !== undefined) updateData.next_retry_at = updates.nextRetryAt?.toISOString() || null;
    if (updates.responseCode !== undefined) updateData.response_code = updates.responseCode;
    if (updates.responseTime !== undefined) updateData.response_time = updates.responseTime;
    if (updates.errorMessage !== undefined) updateData.error_message = updates.errorMessage;
    if (updates.deliveredAt !== undefined) updateData.delivered_at = updates.deliveredAt?.toISOString() || null;

    const { data, error } = await supabase
      .from('webhook_deliveries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToWebhookDelivery(data);
  }

  /**
   * Get delivery logs with filters
   */
  async getDeliveries(filters: WebhookDeliveryFilters = {}): Promise<WebhookDelivery[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('webhook_deliveries').select('*');

    if (filters.webhookId) {
      query = query.eq('webhook_id', filters.webhookId);
    }
    if (filters.eventType) {
      query = query.eq('event_type', filters.eventType);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    query = query.order('created_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map(this.mapToWebhookDelivery);
  }

  /**
   * Get pending deliveries for retry
   */
  async getPendingRetries(): Promise<WebhookDelivery[]> {
    const supabase = getSupabaseClient();

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('status', 'retrying')
      .lte('next_retry_at', now);

    if (error) throw error;

    return data.map(this.mapToWebhookDelivery);
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(webhookId: string): Promise<WebhookStats> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('webhook_deliveries')
      .select('status, response_time, delivered_at')
      .eq('webhook_id', webhookId);

    if (error) throw error;

    const totalDeliveries = data.length;
    const successfulDeliveries = data.filter((d: any) => d.status === 'sent').length;
    const failedDeliveries = data.filter((d: any) => d.status === 'failed').length;
    const pendingDeliveries = data.filter((d: any) => d.status === 'pending' || d.status === 'retrying').length;
    
    const responseTimes = data
      .filter((d: any) => d.response_time !== null)
      .map((d: any) => d.response_time);
    
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum: number, t: number) => sum + t, 0) / responseTimes.length
      : 0;

    const deliveredDates = data
      .filter((d: any) => d.delivered_at !== null)
      .map((d: any) => new Date(d.delivered_at));

    const lastDeliveryAt = deliveredDates.length > 0
      ? new Date(Math.max(...deliveredDates.map((d: Date) => d.getTime())))
      : undefined;

    return {
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      pendingDeliveries,
      averageResponseTime,
      lastDeliveryAt,
    };
  }

  /**
   * Delete old delivery logs (cleanup)
   */
  async deleteOldDeliveries(olderThanDays: number = 30): Promise<number> {
    const supabase = getSupabaseClient();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await supabase
      .from('webhook_deliveries')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) throw error;

    return data?.length || 0;
  }

  /**
   * Map database row to WebhookConfig
   */
  private mapToWebhookConfig(row: any): WebhookConfig {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      secret: row.secret,
      events: row.events,
      enabled: row.enabled,
      retryCount: row.retry_count,
      retryDelayMs: row.retry_delay_ms,
      timeoutMs: row.timeout_ms,
      ipWhitelist: row.ip_whitelist || undefined,
      headers: row.headers || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map database row to WebhookDelivery
   */
  private mapToWebhookDelivery(row: any): WebhookDelivery {
    return {
      id: row.id,
      webhookId: row.webhook_id,
      eventId: row.event_id,
      eventType: row.event_type,
      payload: row.payload,
      status: row.status,
      attemptCount: row.attempt_count,
      lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at) : undefined,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : undefined,
      responseCode: row.response_code || undefined,
      responseTime: row.response_time || undefined,
      errorMessage: row.error_message || undefined,
      deliveredAt: row.delivered_at ? new Date(row.delivered_at) : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}

export default WebhookStorage;
