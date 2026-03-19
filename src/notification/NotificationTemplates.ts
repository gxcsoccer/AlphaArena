/**
 * Notification Templates
 * Predefined templates for common notification types
 */

import type { NotificationPriority } from './NotificationService.js';
import type { SignalNotificationData, RiskNotificationData, PerformanceNotificationData, SystemNotificationData } from './NotificationService.js';

export interface NotificationTemplate {
  title: string;
  message: string;
  priority: NotificationPriority;
  actionUrl?: string;
}

/**
 * Generate signal notification templates
 */
export function generateSignalTemplate(
  data: SignalNotificationData
): NotificationTemplate {
  const { symbol, side, price, strategy, confidence } = data;
  
  const sideEmoji = side === 'buy' ? '📈' : '📉';
  const strategyName = strategy || 'Trading Strategy';
  
  const title = `${sideEmoji} ${symbol} ${side.toUpperCase()} Signal`;
  
  let message = `${strategyName} has generated a ${side} signal for ${symbol}.`;
  
  if (price) {
    message += ` Target price: $${price.toFixed(2)}.`;
  }
  
  if (confidence) {
    const confidencePercent = (confidence * 100).toFixed(0);
    message += ` Confidence: ${confidencePercent}%.`;
  }
  
  return {
    title,
    message,
    priority: confidence && confidence >= 0.8 ? 'HIGH' : 'MEDIUM',
    actionUrl: `/trading/${symbol}`,
  };
}

/**
 * Generate risk alert notification templates
 */
export function generateRiskTemplate(
  data: RiskNotificationData
): NotificationTemplate {
  const { risk_type, symbol, current_value, threshold_value, message_details } = data;
  
  let title: string;
  let message: string;
  let priority: NotificationPriority = 'HIGH';
  
  switch (risk_type) {
    case 'position_limit':
      title = `⚠️ Position Limit Exceeded${symbol ? ` for ${symbol}` : ''}`;
      message = `Your position has exceeded the defined limit. Current: ${current_value.toFixed(2)}, Threshold: ${threshold_value.toFixed(2)}.`;
      break;
      
    case 'loss_threshold':
      title = `🚨 Loss Threshold Alert${symbol ? ` for ${symbol}` : ''}`;
      message = `Your losses have reached the warning threshold. Current loss: ${current_value.toFixed(2)}%, Threshold: ${threshold_value.toFixed(2)}%.`;
      priority = 'URGENT';
      break;
      
    case 'exposure_limit':
      title = `⚠️ Exposure Limit Warning`;
      message = `Your total exposure has reached the configured limit. Current: ${current_value.toFixed(2)}, Threshold: ${threshold_value.toFixed(2)}.`;
      break;
      
    case 'margin_call':
      title = `🚨 Margin Call Warning`;
      message = `Your margin level is critically low. Current: ${current_value.toFixed(2)}%, Required: ${threshold_value.toFixed(2)}%. Please reduce positions or add funds immediately.`;
      priority = 'URGENT';
      break;
      
    default:
      title = '⚠️ Risk Alert';
      message = `A risk alert has been triggered. ${message_details || ''}`;
  }
  
  if (message_details) {
    message += ` ${message_details}`;
  }
  
  return {
    title,
    message,
    priority,
    actionUrl: '/portfolio',
  };
}

/**
 * Generate performance report notification templates
 */
export function generatePerformanceTemplate(
  data: PerformanceNotificationData
): NotificationTemplate {
  const { period, total_pnl, total_pnl_percent, win_rate, trade_count, best_trade, worst_trade } = data;
  
  const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
  const pnlEmoji = total_pnl >= 0 ? '📈' : '📉';
  const _pnlColor = total_pnl >= 0 ? '' : '';
  
  const title = `📊 ${periodLabel} Performance Report`;
  
  let message = `Your ${period} performance: ${pnlEmoji} ${total_pnl >= 0 ? '+' : ''}$${total_pnl.toFixed(2)} (${total_pnl_percent >= 0 ? '+' : ''}${total_pnl_percent.toFixed(2)}%). `;
  message += `Win rate: ${(win_rate * 100).toFixed(1)}% across ${trade_count} trades.`;
  
  if (best_trade) {
    message += ` Best: ${best_trade.symbol} (+$${best_trade.pnl.toFixed(2)}).`;
  }
  
  if (worst_trade) {
    message += ` Worst: ${worst_trade.symbol} (-$${Math.abs(worst_trade.pnl).toFixed(2)}).`;
  }
  
  return {
    title,
    message,
    priority: 'LOW',
    actionUrl: '/analytics',
  };
}

/**
 * Generate system notification templates
 */
export function generateSystemTemplate(
  data: SystemNotificationData
): NotificationTemplate {
  const { event_type, scheduled_time, duration_minutes, details } = data;
  
  let title: string;
  let message: string;
  let priority: NotificationPriority = 'LOW';
  
  switch (event_type) {
    case 'maintenance':
      title = '🔧 Scheduled Maintenance';
      message = 'The system will undergo scheduled maintenance.';
      if (scheduled_time) {
        message += ` Start: ${new Date(scheduled_time).toLocaleString()}.`;
      }
      if (duration_minutes) {
        message += ` Expected duration: ${duration_minutes} minutes.`;
      }
      priority = 'MEDIUM';
      break;
      
    case 'update':
      title = '✨ System Update Available';
      message = 'A new version of the platform is available.';
      if (details) {
        message += ` ${details}`;
      }
      break;
      
    case 'alert':
      title = '⚠️ System Alert';
      message = details || 'An important system alert has been issued.';
      priority = 'HIGH';
      break;
      
    case 'info':
    default:
      title = 'ℹ️ System Notice';
      message = details || 'A system notification has been issued.';
  }
  
  return {
    title,
    message,
    priority,
  };
}

/**
 * Template registry for easy access
 */
export const NotificationTemplates = {
  signal: generateSignalTemplate,
  risk: generateRiskTemplate,
  performance: generatePerformanceTemplate,
  system: generateSystemTemplate,
};

export default NotificationTemplates;
