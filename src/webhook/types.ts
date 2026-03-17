/**
 * Webhook Types - Type definitions for webhook notification system
 *
 * Supports external system notifications for trading events
 */

/**
 * Webhook event types that can trigger notifications
 */
export type WebhookEventType =
  | 'trade.executed'      // Trade execution (buy/sell)
  | 'signal.generated'    // Strategy signal generated
  | 'stop_loss.triggered' // Stop-loss order triggered
  | 'take_profit.triggered' // Take-profit order triggered
  | 'bot.started'         // Trading bot started
  | 'bot.stopped'         // Trading bot stopped
  | 'bot.paused'          // Trading bot paused
  | 'system.alert';       // System alert/warning

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret: string;           // HMAC signing secret
  events: WebhookEventType[]; // Events to subscribe to
  enabled: boolean;
  retryCount: number;       // Max retry attempts (default: 3)
  retryDelayMs: number;     // Initial retry delay in ms (default: 1000)
  timeoutMs: number;        // Request timeout in ms (default: 5000)
  ipWhitelist?: string[];   // Optional IP whitelist for receiving
  headers?: Record<string, string>; // Custom headers
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook payload sent to external systems
 */
export interface WebhookPayload {
  id: string;               // Unique payload ID
  event: WebhookEventType;
  timestamp: string;        // ISO 8601 timestamp
  data: WebhookEventData;
  signature: string;        // HMAC-SHA256 signature
}

/**
 * Event data for different event types
 */
export type WebhookEventData =
  | TradeEventData
  | SignalEventData
  | StopLossEventData
  | TakeProfitEventData
  | BotStatusEventData
  | SystemAlertEventData;

/**
 * Trade execution event data
 */
export interface TradeEventData {
  type: 'trade';
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  total: number;
  strategyId?: string;
  strategyName?: string;
  orderId?: string;
  tradeId?: string;
}

/**
 * Strategy signal event data
 */
export interface SignalEventData {
  type: 'signal';
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  strategyId: string;
  strategyName?: string;
  signalId: string;
}

/**
 * Stop-loss triggered event data
 */
export interface StopLossEventData {
  type: 'stop_loss';
  symbol: string;
  side: 'sell';
  triggerPrice: number;
  executedPrice: number;
  quantity: number;
  orderId?: string;
  tradeId?: string;
  pnl?: number;
}

/**
 * Take-profit triggered event data
 */
export interface TakeProfitEventData {
  type: 'take_profit';
  symbol: string;
  side: 'sell';
  triggerPrice: number;
  executedPrice: number;
  quantity: number;
  orderId?: string;
  tradeId?: string;
  pnl?: number;
}

/**
 * Bot status change event data
 */
export interface BotStatusEventData {
  type: 'bot_status';
  botId: string;
  botName?: string;
  status: 'started' | 'stopped' | 'paused';
  reason?: string;
  strategyId?: string;
}

/**
 * System alert event data
 */
export interface SystemAlertEventData {
  type: 'alert';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  component?: string;
  metadata?: Record<string, any>;
}

/**
 * Webhook delivery status
 */
export type DeliveryStatus =
  | 'pending'     // Waiting to be sent
  | 'sent'        // Successfully delivered
  | 'failed'      // Failed after all retries
  | 'retrying';   // Currently retrying

/**
 * Webhook delivery log entry
 */
export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  eventType: WebhookEventType;
  payload: WebhookPayload;
  status: DeliveryStatus;
  attemptCount: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  responseCode?: number;
  responseTime?: number;    // ms
  errorMessage?: string;
  deliveredAt?: Date;
  createdAt: Date;
}

/**
 * Webhook delivery filters for querying
 */
export interface WebhookDeliveryFilters {
  webhookId?: string;
  eventType?: WebhookEventType;
  status?: DeliveryStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Webhook test result
 */
export interface WebhookTestResult {
  success: boolean;
  responseCode?: number;
  responseTime?: number;
  errorMessage?: string;
  payload: WebhookPayload;
}

/**
 * Create webhook request
 */
export interface CreateWebhookRequest {
  name: string;
  url: string;
  secret?: string;          // Auto-generated if not provided
  events: WebhookEventType[];
  enabled?: boolean;
  retryCount?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  ipWhitelist?: string[];
  headers?: Record<string, string>;
}

/**
 * Update webhook request
 */
export interface UpdateWebhookRequest {
  name?: string;
  url?: string;
  secret?: string;
  events?: WebhookEventType[];
  enabled?: boolean;
  retryCount?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  ipWhitelist?: string[];
  headers?: Record<string, string>;
}

/**
 * Webhook statistics
 */
export interface WebhookStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  averageResponseTime: number;
  lastDeliveryAt?: Date;
}
