/**
 * Signal Realtime Service
 * Provides WebSocket real-time trading signal push notifications
 * 
 * Channel naming:
 * - signals:{userId} - User-specific signal events (subscribed signals)
 * - signals:global - Global signal feed (all active signals)
 * 
 * Events:
 * - signal:new - New signal published
 * - signal:update - Signal updated (price target hit, etc.)
 * - signal:close - Signal closed/executed/cancelled
 * - signal:alert - Risk alert for a signal
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../database/client';
import { createLogger } from '../utils/logger';
import { TradingSignal, TradingSignalsDAO } from '../database/trading-signals.dao';
import { SignalPushConfigDAO, SignalPushConfig } from '../database/signal-push-config.dao';

const log = createLogger('SignalRealtime');

export type SignalEventType = 'signal:new' | 'signal:update' | 'signal:close' | 'signal:alert';

export interface SignalRealtimeEvent {
  type: SignalEventType;
  signalId: string;
  symbol: string;
  side: 'buy' | 'sell';
  signalType: string;
  title?: string;
  description?: string;
  entryPrice?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  riskLevel: string;
  confidenceScore?: number;
  status: string;
  publisherId: string;
  publisherName?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface SignalAlertEvent {
  type: 'signal:alert';
  alertType: 'target_hit' | 'stop_loss_hit' | 'expiring_soon' | 'price_alert';
  signalId: string;
  symbol: string;
  message: string;
  currentPrice?: number;
  targetPrice?: number;
  timestamp: number;
}

class SignalRealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private supabase = getSupabaseClient();
  private signalsDAO: TradingSignalsDAO;
  private pushConfigDAO: SignalPushConfigDAO;

  constructor() {
    this.signalsDAO = new TradingSignalsDAO();
    this.pushConfigDAO = new SignalPushConfigDAO();
  }

  /**
   * Get or create a channel for a user
   */
  private getChannel(userId: string): RealtimeChannel {
    const topic = `signals:${userId}`;
    
    if (!this.channels.has(topic)) {
      const channel = this.supabase.channel(topic, {
        config: {
          private: false,
        },
      });
      this.channels.set(topic, channel);
    }
    
    return this.channels.get(topic)!;
  }

  /**
   * Broadcast a new signal to all relevant users
   */
  async broadcastNewSignal(
    signal: TradingSignal,
    subscriberIds: string[]
  ): Promise<{ success: number; failed: number }> {
    const event: SignalRealtimeEvent = {
      type: 'signal:new',
      signalId: signal.id,
      symbol: signal.symbol,
      side: signal.side,
      signalType: signal.signalType,
      title: signal.title,
      description: signal.description,
      entryPrice: signal.entryPrice,
      targetPrice: signal.targetPrice,
      stopLossPrice: signal.stopLossPrice,
      riskLevel: signal.riskLevel,
      confidenceScore: signal.confidenceScore,
      status: signal.status,
      publisherId: signal.publisherId,
      timestamp: Date.now(),
    };

    const results = { success: 0, failed: 0 };

    // Broadcast to each subscriber
    for (const userId of subscriberIds) {
      try {
        const config = await this.pushConfigDAO.getOrCreate(userId);
        
        // Check if user wants this signal type
        if (!this.shouldReceiveSignal(config, signal)) {
          log.debug(`User ${userId} filtered out signal ${signal.id}`);
          continue;
        }

        // Check quiet hours
        if (this.isInQuietHours(config)) {
          log.debug(`User ${userId} in quiet hours, skipping push`);
          continue;
        }

        const success = await this.broadcastToUser(userId, 'signal:new', event);
        if (success) {
          results.success++;
        } else {
          results.failed++;
        }
      } catch (error: any) {
        log.error(`Failed to broadcast signal to user ${userId}:`, error.message);
        results.failed++;
      }
    }

    log.info(`Broadcast signal ${signal.id} to ${results.success} users (${results.failed} failed)`);
    return results;
  }

  /**
   * Broadcast signal update to subscribers
   */
  async broadcastSignalUpdate(
    signal: TradingSignal,
    updateType: 'target_hit' | 'stop_loss_hit' | 'status_change',
    subscriberIds: string[]
  ): Promise<void> {
    const event: SignalRealtimeEvent = {
      type: 'signal:update',
      signalId: signal.id,
      symbol: signal.symbol,
      side: signal.side,
      signalType: signal.signalType,
      riskLevel: signal.riskLevel,
      status: signal.status,
      publisherId: signal.publisherId,
      timestamp: Date.now(),
      data: { updateType },
    };

    for (const userId of subscriberIds) {
      try {
        await this.broadcastToUser(userId, 'signal:update', event);
      } catch (error: any) {
        log.error(`Failed to broadcast update to user ${userId}:`, error.message);
      }
    }
  }

  /**
   * Broadcast signal close event
   */
  async broadcastSignalClose(
    signal: TradingSignal,
    closeReason: 'executed' | 'cancelled' | 'expired',
    pnl?: number,
    pnlPercent?: number
  ): Promise<void> {
    const subscriberIds = await this.getSubscriberIds(signal.publisherId);
    
    const event: SignalRealtimeEvent = {
      type: 'signal:close',
      signalId: signal.id,
      symbol: signal.symbol,
      side: signal.side,
      signalType: signal.signalType,
      riskLevel: signal.riskLevel,
      status: signal.status,
      publisherId: signal.publisherId,
      timestamp: Date.now(),
      data: {
        closeReason,
        pnl,
        pnlPercent,
        executionPrice: signal.executionPrice,
      },
    };

    for (const userId of subscriberIds) {
      try {
        await this.broadcastToUser(userId, 'signal:close', event);
      } catch (error: any) {
        log.error(`Failed to broadcast close to user ${userId}:`, error.message);
      }
    }

    log.info(`Broadcast signal ${signal.id} close event to ${subscriberIds.length} users`);
  }

  /**
   * Broadcast a risk alert for a signal
   */
  async broadcastSignalAlert(
    signal: TradingSignal,
    alertType: 'target_hit' | 'stop_loss_hit' | 'expiring_soon' | 'price_alert',
    message: string,
    currentPrice?: number
  ): Promise<void> {
    const subscriberIds = await this.getSubscriberIds(signal.publisherId);
    
    const event: SignalAlertEvent = {
      type: 'signal:alert',
      alertType,
      signalId: signal.id,
      symbol: signal.symbol,
      message,
      currentPrice,
      targetPrice: signal.targetPrice,
      timestamp: Date.now(),
    };

    for (const userId of subscriberIds) {
      try {
        const config = await this.pushConfigDAO.getOrCreate(userId);
        
        // Check if user wants alerts
        if (!config.pushEnabled) continue;
        
        await this.broadcastToUser(userId, 'signal:alert', event);
      } catch (error: any) {
        log.error(`Failed to broadcast alert to user ${userId}:`, error.message);
      }
    }

    log.info(`Broadcast signal ${signal.id} alert (${alertType}) to ${subscriberIds.length} users`);
  }

  /**
   * Broadcast to global channel (for public signal feed)
   */
  async broadcastToGlobal(signal: TradingSignal): Promise<boolean> {
    try {
      const topic = 'signals:global';
      
      if (!this.channels.has(topic)) {
        const channel = this.supabase.channel(topic, {
          config: {
            private: false,
          },
        });
        this.channels.set(topic, channel);
      }

      const channel = this.channels.get(topic)!;
      
      const event: SignalRealtimeEvent = {
        type: 'signal:new',
        signalId: signal.id,
        symbol: signal.symbol,
        side: signal.side,
        signalType: signal.signalType,
        title: signal.title,
        description: signal.description,
        entryPrice: signal.entryPrice,
        targetPrice: signal.targetPrice,
        stopLossPrice: signal.stopLossPrice,
        riskLevel: signal.riskLevel,
        confidenceScore: signal.confidenceScore,
        status: signal.status,
        publisherId: signal.publisherId,
        timestamp: Date.now(),
      };

      const result = await channel.send({
        type: 'broadcast',
        event: 'signal:new',
        payload: event,
      });

      const success = result === 'ok' || (result as any).status === 'ok';
      
      if (success) {
        log.debug(`Broadcast signal ${signal.id} to global channel`);
      }

      return success;
    } catch (error: any) {
      log.error(`Error broadcasting to global: ${error.message}`);
      return false;
    }
  }

  /**
   * Broadcast to a specific user
   */
  private async broadcastToUser(
    userId: string,
    eventType: SignalEventType,
    event: SignalRealtimeEvent | SignalAlertEvent
  ): Promise<boolean> {
    try {
      const channel = this.getChannel(userId);

      const result = await channel.send({
        type: 'broadcast',
        event: eventType,
        payload: event,
      });

      const success = result === 'ok' || (result as any).status === 'ok';
      
      if (success) {
        log.debug(`Broadcast ${eventType} to user ${userId}`);
      }

      return success;
    } catch (error: any) {
      log.error(`Error broadcasting to user ${userId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get subscriber IDs for a signal publisher
   */
  private async getSubscriberIds(publisherId: string): Promise<string[]> {
    // Import here to avoid circular dependency
    const { SignalSubscriptionsDAO } = await import('../database/signal-subscriptions.dao');
    const subscriptionsDAO = new SignalSubscriptionsDAO();
    
    const subscriptions = await subscriptionsDAO.getActiveSubscriptionsForSource('user', publisherId);
    return subscriptions.map(s => s.subscriberId);
  }

  /**
   * Check if user should receive this signal based on config
   */
  private shouldReceiveSignal(config: SignalPushConfig, signal: TradingSignal): boolean {
    // Check master toggle
    if (!config.pushEnabled) return false;

    // Check signal types
    if (!config.signalTypes.includes('all')) {
      const signalTypeMap: Record<string, string> = {
        'entry': signal.side === 'buy' ? 'buy' : 'sell',
        'stop_loss': 'stop_loss',
        'take_profit': 'take_profit',
        'exit': signal.side === 'buy' ? 'sell' : 'buy',
        'update': 'all',
      };
      
      const mappedType = signalTypeMap[signal.signalType] || 'all';
      if (!config.signalTypes.includes(mappedType as any)) {
        return false;
      }
    }

    // Check confidence score
    if (signal.confidenceScore !== undefined && signal.confidenceScore < config.minConfidenceScore) {
      return false;
    }

    // Check risk level
    if (!config.riskLevels.includes(signal.riskLevel)) {
      return false;
    }

    // Check symbols filter
    if (config.symbols.length > 0 && !config.symbols.includes(signal.symbol)) {
      return false;
    }

    return true;
  }

  /**
   * Check if current time is in user's quiet hours
   */
  private isInQuietHours(config: SignalPushConfig): boolean {
    if (!config.quietHoursEnabled) return false;

    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: config.quietHoursTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const currentTime = formatter.format(now);
      const [currentHour, currentMinute] = currentTime.split(':').map(Number);
      const currentMinutes = currentHour * 60 + currentMinute;

      const [startHour, startMinute] = config.quietHoursStart.split(':').map(Number);
      const startMinutes = startHour * 60 + startMinute;

      const [endHour, endMinute] = config.quietHoursEnd.split(':').map(Number);
      const endMinutes = endHour * 60 + endMinute;

      // Handle overnight quiet hours (e.g., 22:00 - 08:00)
      if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }

      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } catch (error) {
      log.error('Error checking quiet hours:', error);
      return false;
    }
  }

  /**
   * Cleanup channels for a user
   */
  async cleanup(userId: string): Promise<void> {
    const topic = `signals:${userId}`;
    const channel = this.channels.get(topic);
    
    if (channel) {
      await this.supabase.removeChannel(channel);
      this.channels.delete(topic);
      log.debug(`Cleaned up channel for user ${userId}`);
    }
  }

  /**
   * Cleanup all channels
   */
  async cleanupAll(): Promise<void> {
    for (const [topic, channel] of this.channels) {
      await this.supabase.removeChannel(channel);
      this.channels.delete(topic);
    }
    log.debug('Cleaned up all signal realtime channels');
  }
}

// Singleton instance
let instance: SignalRealtimeService | null = null;

export function getSignalRealtimeService(): SignalRealtimeService {
  if (!instance) {
    instance = new SignalRealtimeService();
  }
  return instance;
}

// Named export for the class
export { SignalRealtimeService };

export default SignalRealtimeService;