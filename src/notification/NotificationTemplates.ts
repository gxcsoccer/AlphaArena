/**
 * Signal Notification Templates Service
 * Manages notification templates with variable substitution
 */

import { createLogger } from '../utils/logger';
import { getSupabaseClient } from '../database/client';

const log = createLogger('SignalNotificationTemplates');

export interface NotificationTemplate {
  id: string;
  templateKey: string;
  notificationType: string;
  titleTemplate: string;
  bodyTemplate: string;
  language: string;
  isActive: boolean;
}

export interface SignalNotificationVariables {
  strategy_name?: string;
  symbol?: string;
  side?: 'buy' | 'sell';
  signal_type?: string;
  entry_price?: string | number;
  target_price?: string | number;
  stop_loss?: string | number;
  current_price?: string | number;
  confidence?: string | number;
  risk_level?: string;
  status?: string;
  pnl?: string | number;
  pnl_percent?: string | number;
  analysis?: string;
  alert_type?: string;
  message?: string;
  quick_actions?: string;
  market_context?: string;
}

export interface MarketContext {
  currentPrice?: number;
  priceChange24h?: number;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
  rsi?: number;
  ma50?: number;
  ma200?: number;
}

const DEFAULT_TEMPLATES: Record<string, { title: string; body: string }> = {
  'signal.new.zh': {
    title: '【{strategy_name}】{side}信号',
    body: '{symbol} {side}信号\n入场价: {entry_price}\n目标价: {target_price}\n止损价: {stop_loss}\n置信度: {confidence}%\n\n{analysis}\n\n{market_context}\n\n{quick_actions}',
  },
  'signal.update.zh': {
    title: '【{strategy_name}】信号更新',
    body: '{symbol} 信号状态更新: {status}\n当前价: {current_price}\n盈亏: {pnl_percent}%\n\n{market_context}',
  },
  'signal.close.zh': {
    title: '【{strategy_name}】信号平仓',
    body: '{symbol} 信号已平仓\n盈亏: {pnl_percent}%\n\n{market_context}\n\n点击查看详情',
  },
  'signal.alert.zh': {
    title: '【{strategy_name}】价格提醒',
    body: '{symbol} 价格提醒\n{alert_type}: {message}\n当前价: {current_price}\n\n{market_context}',
  },
  'signal.new.en': {
    title: '[{strategy_name}] {side} Signal',
    body: '{symbol} {side} Signal\nEntry: {entry_price}\nTarget: {target_price}\nStop Loss: {stop_loss}\nConfidence: {confidence}%\n\n{analysis}\n\n{market_context}\n\n{quick_actions}',
  },
  'signal.update.en': {
    title: '[{strategy_name}] Signal Update',
    body: '{symbol} Status: {status}\nCurrent: {current_price}\nPnL: {pnl_percent}%\n\n{market_context}',
  },
  'signal.close.en': {
    title: '[{strategy_name}] Signal Closed',
    body: '{symbol} Signal closed\nPnL: {pnl_percent}%\n\n{market_context}\n\nTap for details',
  },
  'signal.alert.en': {
    title: '[{strategy_name}] Price Alert',
    body: '{symbol} Alert\n{alert_type}: {message}\nCurrent: {current_price}\n\n{market_context}',
  },
};

export class SignalNotificationTemplates {
  private templates: Map<string, NotificationTemplate> = new Map();
  private initialized = false;

  /**
   * Initialize templates from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('signal_notification_templates')
        .select('*')
        .eq('is_active', true);

      if (error) {
        if (error.code !== '42P01') {
          log.error('Error loading templates:', error);
        }
        // Use default templates
        this.loadDefaultTemplates();
      } else if (data && data.length > 0) {
        // Load from database
        for (const row of data) {
          const key = `${row.template_key}.${row.language}`;
          this.templates.set(key, {
            id: row.id,
            templateKey: row.template_key,
            notificationType: row.notification_type,
            titleTemplate: row.title_template,
            bodyTemplate: row.body_template,
            language: row.language,
            isActive: row.is_active,
          });
        }
        log.info(`Loaded ${this.templates.size} templates from database`);
      } else {
        // Database returned empty, use default templates
        this.loadDefaultTemplates();
      }

      this.initialized = true;
    } catch (error) {
      log.error('Error initializing templates:', error);
      this.loadDefaultTemplates();
      this.initialized = true;
    }
  }

  /**
   * Load default templates
   */
  private loadDefaultTemplates(): void {
    for (const [key, template] of Object.entries(DEFAULT_TEMPLATES)) {
      // Key format: 'template.subtype.language', e.g., 'signal.new.zh'
      const parts = key.split('.');
      const language = parts.pop() || 'zh'; // Last part is language
      const templateKey = parts.join('.'); // Rest is template key (e.g., 'signal.new')
      this.templates.set(key, {
        id: `default-${key}`,
        templateKey: templateKey,
        notificationType: 'SIGNAL',
        titleTemplate: template.title,
        bodyTemplate: template.body,
        language: language,
        isActive: true,
      });
    }
    log.info('Loaded default templates');
  }

  /**
   * Render a template with variables
   */
  render(
    templateKey: string,
    variables: SignalNotificationVariables,
    language: string = 'zh'
  ): { title: string; body: string } {
    const key = `${templateKey}.${language}`;
    let template = this.templates.get(key);

    // Fallback to default if not found
    if (!template) {
      const defaultKey = `${templateKey}.zh`;
      template = this.templates.get(defaultKey);

      if (!template) {
        log.warn(`Template not found: ${key}, using fallback`);
        return {
          title: variables.strategy_name
            ? `【${variables.strategy_name}】${variables.symbol} 信号`
            : `${variables.symbol} 信号`,
          body: `${variables.side} ${variables.symbol}\n入场: ${variables.entry_price}\n目标: ${variables.target_price}`,
        };
      }
    }

    const title = this.substituteVariables(template.titleTemplate, variables);
    const body = this.substituteVariables(template.bodyTemplate, variables);

    return { title, body };
  }

  /**
   * Substitute variables in template string
   */
  private substituteVariables(template: string, variables: SignalNotificationVariables): string {
    let result = template;

    // Replace all variables
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined && value !== null) {
        const placeholder = `{${key}}`;
        result = result.replace(new RegExp(placeholder, 'g'), String(value));
      }
    }

    // Remove any remaining placeholders with empty values
    result = result.replace(/\{[^}]+\}/g, 'N/A');

    // Clean up multiple newlines
    result = result.replace(/\n{3,}/g, '\n\n').trim();

    return result;
  }

  /**
   * Format market context for notification
   */
  formatMarketContext(context: MarketContext | undefined, language: string = 'zh'): string {
    if (!context) return '';

    const lines: string[] = [];

    if (language === 'zh') {
      if (context.currentPrice !== undefined) {
        lines.push(`当前价: ${context.currentPrice}`);
      }
      if (context.priceChange24h !== undefined) {
        const change = context.priceChange24h >= 0 ? '+' : '';
        lines.push(`24h涨跌: ${change}${context.priceChange24h.toFixed(2)}%`);
      }
      if (context.high24h !== undefined && context.low24h !== undefined) {
        lines.push(`24h高低: ${context.low24h} - ${context.high24h}`);
      }
      if (context.volume24h !== undefined) {
        lines.push(`24h成交量: ${this.formatVolume(context.volume24h)}`);
      }
      if (context.rsi !== undefined) {
        lines.push(`RSI: ${context.rsi.toFixed(1)}`);
      }
    } else {
      if (context.currentPrice !== undefined) {
        lines.push(`Current: ${context.currentPrice}`);
      }
      if (context.priceChange24h !== undefined) {
        const change = context.priceChange24h >= 0 ? '+' : '';
        lines.push(`24h Change: ${change}${context.priceChange24h.toFixed(2)}%`);
      }
      if (context.high24h !== undefined && context.low24h !== undefined) {
        lines.push(`24h Range: ${context.low24h} - ${context.high24h}`);
      }
      if (context.volume24h !== undefined) {
        lines.push(`24h Volume: ${this.formatVolume(context.volume24h)}`);
      }
      if (context.rsi !== undefined) {
        lines.push(`RSI: ${context.rsi.toFixed(1)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format quick actions for notification
   */
  formatQuickActions(
    signalId: string,
    side: 'buy' | 'sell',
    language: string = 'zh'
  ): string {
    if (language === 'zh') {
      return `快速操作:\n• 查看详情: /signals/${signalId}\n• ${side === 'buy' ? '立即买入' : '立即卖出'}\n• 设置提醒`;
    } else {
      return `Quick Actions:\n• View Details: /signals/${signalId}\n• ${side === 'buy' ? 'Buy Now' : 'Sell Now'}\n• Set Alert`;
    }
  }

  /**
   * Format volume with appropriate units
   */
  private formatVolume(volume: number): string {
    if (volume >= 1e9) {
      return `${(volume / 1e9).toFixed(2)}B`;
    } else if (volume >= 1e6) {
      return `${(volume / 1e6).toFixed(2)}M`;
    } else if (volume >= 1e3) {
      return `${(volume / 1e3).toFixed(2)}K`;
    }
    return volume.toFixed(2);
  }

  /**
   * Get template by key
   */
  getTemplate(templateKey: string, language: string = 'zh'): NotificationTemplate | undefined {
    const key = `${templateKey}.${language}`;
    return this.templates.get(key);
  }

  /**
   * Add or update a template (admin function)
   */
  async upsertTemplate(
    templateKey: string,
    titleTemplate: string,
    bodyTemplate: string,
    language: string = 'zh'
  ): Promise<NotificationTemplate | null> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('signal_notification_templates')
        .upsert(
          {
            template_key: templateKey,
            notification_type: 'SIGNAL',
            title_template: titleTemplate,
            body_template: bodyTemplate,
            language,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'template_key' }
        )
        .select()
        .single();

      if (error) {
        log.error('Error upserting template:', error);
        return null;
      }

      const template: NotificationTemplate = {
        id: data.id,
        templateKey: data.template_key,
        notificationType: data.notification_type,
        titleTemplate: data.title_template,
        bodyTemplate: data.body_template,
        language: data.language,
        isActive: data.is_active,
      };

      // Update cache
      this.templates.set(`${templateKey}.${language}`, template);

      return template;
    } catch (error) {
      log.error('Error upserting template:', error);
      return null;
    }
  }
}

// Singleton instance
let signalNotificationTemplates: SignalNotificationTemplates | null = null;

export function getSignalNotificationTemplates(): SignalNotificationTemplates {
  if (!signalNotificationTemplates) {
    signalNotificationTemplates = new SignalNotificationTemplates();
  }
  return signalNotificationTemplates;
}