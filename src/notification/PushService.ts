/**
 * Push Notification Service
 * Unified push notification interface with multiple provider support
 */

import { createLogger } from '../utils/logger.js';
import {
  IPushProvider,
  PushMessage,
  PushSendResult,
  PushDeviceToken,
  PushOptions,
  PushData,
  PushProviderType,
  PushProviderConfig,
  createPushProvider,
  MockPushProvider,
} from './PushProviders.js';

const log = createLogger('PushService');

// Re-export types for convenience
export type {
  PushMessage,
  PushSendResult,
  PushDeviceToken,
  PushOptions,
  PushData,
} from './PushProviders.js';

/**
 * Push Service Configuration
 */
export interface PushServiceConfig {
  /**
   * Default provider to use
   * Can be set via PUSH_PROVIDER env var
   * Defaults to 'mock' in development
   */
  provider?: PushProviderType;

  /**
   * Provider-specific configurations
   */
  providers?: PushProviderConfig;

  /**
   * Enable development mode (always use mock provider)
   */
  developmentMode?: boolean;

  /**
   * Default icon for notifications
   */
  defaultIcon?: string;

  /**
   * Default sound for notifications
   */
  defaultSound?: string;

  /**
   * Default badge count
   */
  defaultBadge?: number;
}

/**
 * Template data for push templates
 */
export type PushTemplateData = Record<string, unknown>;

/**
 * Push notification template type
 */
export type PushTemplateType =
  | 'signal'
  | 'trade-executed'
  | 'trade-closed'
  | 'risk-alert'
  | 'performance-summary'
  | 'system-alert';

/**
 * Push template definition
 */
export interface PushTemplate {
  title: string | ((data: PushTemplateData) => string);
  body: string | ((data: PushTemplateData) => string);
  options?: PushOptions | ((data: PushTemplateData) => PushOptions);
}

/**
 * Push Service - Main push notification service
 *
 * Features:
 * - Multiple provider support (FCM, OneSignal, Expo, Web Push)
 * - Mock mode for development
 * - Push templating
 * - Unified interface for all push operations
 *
 * @example
 * // Basic usage
 * const pushService = new PushService();
 * await pushService.send({
 *   tokens: [{ token: 'device-token', platform: 'ios' }],
 *   title: 'Trade Executed',
 *   body: 'Your BTC/USDT order was filled',
 * });
 *
 * @example
 * // Using templates
 * await pushService.sendFromTemplate('signal', tokens, { symbol: 'BTC/USDT', side: 'buy' });
 */
export class PushService {
  private provider: IPushProvider;
  private developmentMode: boolean;
  private defaultIcon?: string;
  private defaultSound?: string;
  private defaultBadge?: number;
  private templates: Map<PushTemplateType, PushTemplate> = new Map();

  constructor(config: PushServiceConfig = {}) {
    // Determine if we're in development mode
    this.developmentMode = config.developmentMode ??
      (process.env.NODE_ENV !== 'production' && process.env.PUSH_PROVIDER !== 'production');

    // Determine provider
    let providerType: PushProviderType;

    if (this.developmentMode && !process.env.PUSH_PROVIDER) {
      // In development mode without explicit provider, use mock
      providerType = 'mock';
      log.info('PushService running in development mode - push notifications will be logged only');
    } else {
      providerType = config.provider ??
        (process.env.PUSH_PROVIDER as PushProviderType) ??
        'mock';
    }

    // Create provider instance
    this.provider = createPushProvider(providerType, config.providers);

    // Set defaults
    this.defaultIcon = config.defaultIcon ?? process.env.PUSH_DEFAULT_ICON;
    this.defaultSound = config.defaultSound ?? process.env.PUSH_DEFAULT_SOUND ?? 'default';
    this.defaultBadge = config.defaultBadge;

    // Register default templates
    this.registerDefaultTemplates();

    log.info('PushService initialized', {
      provider: this.provider.name,
      isConfigured: this.provider.isConfigured,
      developmentMode: this.developmentMode,
    });
  }

  /**
   * Get the current provider name
   */
  get providerName(): string {
    return this.provider.name;
  }

  /**
   * Check if the push provider is properly configured
   */
  get isConfigured(): boolean {
    return this.provider.isConfigured;
  }

  /**
   * Check if running in development mode (mock provider)
   */
  get isDevelopmentMode(): boolean {
    return this.developmentMode || this.provider instanceof MockPushProvider;
  }

  /**
   * Send a push notification
   */
  async send(message: PushMessage): Promise<PushSendResult> {
    // Apply defaults to options
    const fullMessage: PushMessage = {
      ...message,
      options: {
        icon: message.options?.icon ?? this.defaultIcon,
        sound: message.options?.sound ?? this.defaultSound,
        badge: message.options?.badge ?? this.defaultBadge,
        ...message.options,
      },
    };

    // Validate required fields
    if (!fullMessage.tokens || fullMessage.tokens.length === 0) {
      return {
        success: false,
        error: 'At least one device token is required',
        totalSent: 0,
        totalFailed: 0,
      };
    }

    if (!fullMessage.title) {
      return {
        success: false,
        error: 'Title is required',
        totalSent: 0,
        totalFailed: 0,
      };
    }

    if (!fullMessage.body) {
      return {
        success: false,
        error: 'Body is required',
        totalSent: 0,
        totalFailed: 0,
      };
    }

    try {
      const result = await this.provider.send(fullMessage);

      if (result.success) {
        log.info('Push notification sent successfully', {
          tokens: fullMessage.tokens.length,
          title: fullMessage.title,
          messageId: result.messageId,
          provider: result.provider,
          totalSent: result.totalSent,
        });
      } else {
        log.error('Failed to send push notification', new Error(result.error ?? 'Unknown error'), {
          tokens: fullMessage.tokens.length,
          title: fullMessage.title,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Exception while sending push notification', error);

      return {
        success: false,
        error: errorMessage,
        totalSent: 0,
        totalFailed: fullMessage.tokens.length,
      };
    }
  }

  /**
   * Send push to a single device
   */
  async sendToDevice(
    token: string | PushDeviceToken,
    title: string,
    body: string,
    options?: PushOptions
  ): Promise<PushSendResult> {
    const deviceToken: PushDeviceToken = typeof token === 'string'
      ? { token, platform: 'android' }
      : token;

    return this.send({
      tokens: [deviceToken],
      title,
      body,
      options,
    });
  }

  /**
   * Send push to multiple devices
   */
  async sendToDevices(
    tokens: (string | PushDeviceToken)[],
    title: string,
    body: string,
    options?: PushOptions
  ): Promise<PushSendResult> {
    const deviceTokens: PushDeviceToken[] = tokens.map(t =>
      typeof t === 'string' ? { token: t, platform: 'android' as const } : t
    );

    return this.send({
      tokens: deviceTokens,
      title,
      body,
      options,
    });
  }

  /**
   * Register a push template
   */
  registerTemplate(type: PushTemplateType, template: PushTemplate): void {
    this.templates.set(type, template);
    log.debug('Push template registered', { type });
  }

  /**
   * Send push using a template
   */
  async sendFromTemplate(
    templateType: PushTemplateType,
    tokens: (string | PushDeviceToken)[],
    data: PushTemplateData,
    additionalOptions?: PushOptions
  ): Promise<PushSendResult> {
    const template = this.templates.get(templateType);

    if (!template) {
      return {
        success: false,
        error: `Template '${templateType}' not found`,
        totalSent: 0,
        totalFailed: 0,
      };
    }

    // Resolve title
    const title = typeof template.title === 'function'
      ? template.title(data)
      : template.title;

    // Resolve body
    const body = typeof template.body === 'function'
      ? template.body(data)
      : template.body;

    // Resolve options
    let options: PushOptions = {};
    if (template.options) {
      options = typeof template.options === 'function'
        ? template.options(data)
        : { ...template.options };
    }

    // Merge additional options
    if (additionalOptions) {
      options = { ...options, ...additionalOptions };
    }

    // Merge data payload
    if (data) {
      // Convert template data to PushData format (filter out non-primitive values)
      const safeData: PushData = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'object') {
          safeData[key] = value as string | number | boolean | object;
        } else {
          safeData[key] = String(value);
        }
      }
      options.data = { ...options.data, ...safeData };
    }

    return this.sendToDevices(tokens, title, body, options);
  }

  /**
   * Send to user (fetches tokens from database)
   * Note: This is a placeholder - actual implementation would need user device token storage
   */
  async sendToUser(
    userId: string,
    _title: string,
    _body: string,
    _options?: PushOptions
  ): Promise<PushSendResult> {
    // TODO: Implement user device token lookup
    // For now, return a placeholder result
    log.warn('sendToUser called but user device token lookup not implemented', { userId });

    return {
      success: false,
      error: 'User device token lookup not implemented',
      totalSent: 0,
      totalFailed: 0,
    };
  }

  /**
   * Register default push templates
   */
  private registerDefaultTemplates(): void {
    // Signal notification template
    this.registerTemplate('signal', {
      title: (data) => `📊 Signal: ${data.symbol ?? 'Unknown'}`,
      body: (data) =>
        `${data.side === 'buy' ? '🟢 BUY' : '🔴 SELL'} ${data.symbol ?? 'Asset'}${data.price ? ` @ ${data.price}` : ''}${data.confidence ? ` (${Math.round(data.confidence as number * 100)}% confidence)` : ''}`,
      options: (data) => ({
        sound: 'signal.wav',
        priority: 'high',
        data: {
          type: 'signal',
          symbol: String(data.symbol ?? ''),
          side: String(data.side ?? ''),
        },
        actions: [
          { id: 'view', title: 'View Details' },
          { id: 'execute', title: 'Execute Trade' },
        ],
      }),
    });

    // Trade executed template
    this.registerTemplate('trade-executed', {
      title: (data) => `✅ Trade Executed`,
      body: (data) =>
        `${data.side === 'buy' ? 'Bought' : 'Sold'} ${data.quantity ?? ''} ${data.symbol ?? 'Asset'} @ ${data.price ?? 'market price'}`,
      options: (data) => ({
        sound: 'trade.wav',
        priority: 'high',
        data: {
          type: 'trade-executed',
          orderId: String(data.orderId ?? ''),
        },
      }),
    });

    // Trade closed template
    this.registerTemplate('trade-closed', {
      title: (data) => `🔒 Trade Closed`,
      body: (data) => {
        const pnl = data.pnl as number | undefined;
        const pnlStr = pnl !== undefined ? (pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`) : '';
        return `Closed ${data.symbol ?? 'position'} ${pnlStr}`;
      },
      options: (data) => ({
        sound: 'trade.wav',
        data: {
          type: 'trade-closed',
          positionId: String(data.positionId ?? ''),
        },
      }),
    });

    // Risk alert template
    this.registerTemplate('risk-alert', {
      title: (data) => `⚠️ Risk Alert: ${data.riskType ?? 'Unknown Risk'}`,
      body: (data) =>
        `${data.message ?? 'Risk threshold exceeded'}${data.currentValue ? ` Current: ${data.currentValue}` : ''}${data.threshold ? ` Threshold: ${data.threshold}` : ''}`,
      options: (data) => ({
        sound: 'alert.wav',
        priority: 'high',
        badge: 1,
        data: {
          type: 'risk-alert',
          riskType: String(data.riskType ?? ''),
        },
        actions: [
          { id: 'view', title: 'View Details' },
          { id: 'close', title: 'Close Position' },
        ],
      }),
    });

    // Performance summary template
    this.registerTemplate('performance-summary', {
      title: (data) => `📈 ${data.period ?? 'Daily'} Performance`,
      body: (data) => {
        const pnl = data.pnl as number | undefined;
        const pnlPercent = data.pnlPercent as number | undefined;
        const pnlStr = pnl !== undefined ? (pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`) : '';
        const pnlPercentStr = pnlPercent !== undefined ? ` (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)` : '';
        return `P&L: ${pnlStr}${pnlPercentStr}${data.winRate ? ` | Win Rate: ${(data.winRate as number * 100).toFixed(1)}%` : ''}`;
      },
      options: () => ({
        sound: 'default',
        data: {
          type: 'performance-summary',
        },
      }),
    });

    // System alert template
    this.registerTemplate('system-alert', {
      title: (data) => `🔔 ${data.eventType ?? 'System Alert'}`,
      body: (data) => String(data.message ?? 'Important system notification'),
      options: (data) => ({
        sound: 'default',
        data: {
          type: 'system-alert',
          eventType: String(data.eventType ?? ''),
        },
      }),
    });
  }
}

// Default instance for convenience
let defaultInstance: PushService | null = null;

/**
 * Get the default PushService instance
 */
export function getPushService(config?: PushServiceConfig): PushService {
  if (!defaultInstance || config) {
    defaultInstance = new PushService(config);
  }
  return defaultInstance;
}

/**
 * Reset the default PushService instance
 * Useful for testing or reconfiguration
 */
export function resetPushService(): void {
  defaultInstance = null;
}

export default PushService;