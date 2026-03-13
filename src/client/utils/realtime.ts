/**
 * Supabase Realtime Client for Frontend
 * 
 * Replaces Socket.IO client with Supabase Realtime SDK.
 * Provides real-time subscriptions for:
 * - Order book updates (snapshot/delta)
 * - Market ticker updates
 * - Trade notifications
 * - Presence tracking (online traders)
 * 
 * Channel naming convention (matches backend):
 * - orderbook:{symbol} - Order book updates
 * - ticker:{symbol} - Market ticker updates
 * - trade:{userId} - User-specific trade notifications
 * - leaderboard:global - Leaderboard updates
 */

import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://plnylmnckssnfpwznpwf.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Reconnection settings
const RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const RECONNECT_MULTIPLIER = 2; // Exponential backoff

export interface RealtimeMessage {
  event: string;
  payload: any;
  timestamp: number;
}

export type RealtimeEventType = 
  | 'orderbook:snapshot'
  | 'orderbook:delta'
  | 'market:tick'
  | 'trade:new'
  | 'portfolio:update'
  | 'strategy:tick'
  | 'leaderboard:update';

export interface PresenceState {
  [key: string]: {
    presence: Array<{
      id: string;
      userId?: string;
      online_at: string;
    }>;
  };
}

/**
 * Supabase Realtime Client
 * Manages channel subscriptions and message handling
 */
export class RealtimeClient {
  private supabase: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();
  private listeners: Map<string, Map<string, Set<Function>>> = new Map();
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
  private reconnectDelay: number = RECONNECT_DELAY;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('[RealtimeClient] Missing Supabase credentials. Realtime features will be disabled.');
    }

    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });

    // Set up connection status monitoring
    this.monitorConnection();
  }

  /**
   * Monitor Supabase realtime connection status
   */
  private monitorConnection() {
    // Supabase JS client handles reconnection automatically
    // We just track the status for UI purposes
    this.connectionStatus = 'connected';
  }

  /**
   * Get or create a channel for a specific topic
   */
  private getChannel(topic: string): RealtimeChannel {
    if (!this.channels.has(topic)) {
      const channel = this.supabase.channel(topic, {
        config: {
          private: false, // Public channels for broadcast
        },
      });
      this.channels.set(topic, channel);
    }
    return this.channels.get(topic)!;
  }

  /**
   * Subscribe to a channel with automatic reconnection
   */
  public async subscribe(topic: string): Promise<RealtimeChannel> {
    if (this.channels.has(topic)) {
      return this.channels.get(topic)!;
    }

    const channel = this.getChannel(topic);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Subscription timeout for ${topic}`));
      }, 10000);

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          console.log(`[Realtime] Subscribed to ${topic}`);
          this.connectionStatus = 'connected';
          this.reconnectDelay = RECONNECT_DELAY; // Reset on success
          resolve(channel);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          console.error(`[Realtime] Subscription error for ${topic}:`, status);
          this.handleReconnect(topic);
          reject(new Error(`Subscription failed: ${status}`));
        }
      });
    });
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(topic: string) {
    if (this.reconnectTimer) return;

    this.connectionStatus = 'reconnecting';
    console.log(`[Realtime] Reconnecting to ${topic} in ${this.reconnectDelay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.channels.delete(topic); // Remove failed channel
      this.subscribe(topic).catch(() => {
        // Increase delay for next attempt
        this.reconnectDelay = Math.min(
          this.reconnectDelay * RECONNECT_MULTIPLIER,
          MAX_RECONNECT_DELAY
        );
        this.handleReconnect(topic);
      });
    }, this.reconnectDelay);
  }

  /**
   * Subscribe to order book updates
   */
  public async subscribeOrderBook(symbol: string): Promise<void> {
    const topic = `orderbook:${symbol}`;
    await this.subscribe(topic);
  }

  /**
   * Subscribe to market ticker updates for all symbols
   */
  public async subscribeMarket(): Promise<void> {
    // Subscribe to a wildcard or specific symbols
    // For now, we'll subscribe to common symbols
    // In production, this should be dynamic based on user preferences
    const commonSymbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT'];
    await Promise.all(
      commonSymbols.map(symbol => this.subscribe(`ticker:${symbol}`))
    );
  }

  /**
   * Subscribe to trade notifications for a user
   */
  public async subscribeTrades(userId: string = 'global'): Promise<void> {
    const topic = `trade:${userId}`;
    await this.subscribe(topic);
  }

  /**
   * Subscribe to leaderboard updates
   */
  public async subscribeLeaderboard(): Promise<void> {
    const topic = 'leaderboard:global';
    await this.subscribe(topic);
  }

  /**
   * Listen to broadcast messages on a channel
   */
  public on(topic: string, event: string, callback: (payload: any) => void): () => void {
    const channel = this.getChannel(topic);

    const handler = (payload: any) => {
      // Supabase Realtime broadcast payload structure:
      // { event: string, payload: any, ref: string, ... }
      if (payload.event === event) {
        // Extract the actual data from the payload
        const data = payload.payload?.data || payload.payload;
        callback(data);
      }
    };

    // Register the listener
    channel.on('broadcast', handler);

    // Store listener for cleanup
    const listenerKey = `${topic}:${event}`;
    if (!this.listeners.has(listenerKey)) {
      this.listeners.set(listenerKey, new Map());
    }
    const eventListeners = this.listeners.get(listenerKey)!;
    if (!eventListeners.has(callback)) {
      eventListeners.set(callback, new Set([handler]));
    }

    // Return unsubscribe function
    return () => {
      channel.off('broadcast', handler);
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        this.listeners.delete(listenerKey);
      }
    };
  }

  /**
   * Listen to order book snapshot events
   */
  public onOrderBookSnapshot(symbol: string, callback: (snapshot: any) => void): () => void {
    return this.on(`orderbook:${symbol}`, 'snapshot', callback);
  }

  /**
   * Listen to order book delta events
   */
  public onOrderBookDelta(symbol: string, callback: (delta: any) => void): () => void {
    return this.on(`orderbook:${symbol}`, 'delta', callback);
  }

  /**
   * Listen to market tick events
   */
  public onMarketTick(symbol: string, callback: (ticker: any) => void): () => void {
    return this.on(`ticker:${symbol}`, 'tick', callback);
  }

  /**
   * Listen to trade events
   */
  public onTrade(userId: string = 'global', callback: (trade: any) => void): () => void {
    return this.on(`trade:${userId}`, 'new', callback);
  }

  /**
   * Listen to strategy tick events
   */
  public onStrategyTick(strategyId: string, callback: (data: any) => void): () => void {
    return this.on(`strategy:${strategyId}`, 'tick', callback);
  }

  /**
   * Listen to leaderboard update events
   */
  public onLeaderboardUpdate(callback: (entries: any[]) => void): () => void {
    return this.on('leaderboard:global', 'update', callback);
  }

  /**
   * Track presence for current user
   */
  public async trackPresence(userId: string, metadata?: Record<string, any>): Promise<void> {
    const channel = this.getChannel('presence:traders');
    await this.subscribe('presence:traders');

    await channel.track({
      id: userId,
      userId,
      online_at: new Date().toISOString(),
      ...metadata,
    });

    console.log(`[Realtime] Presence tracked for ${userId}`);
  }

  /**
   * Get current presence state
   */
  public getPresenceState(): PresenceState {
    const channel = this.channels.get('presence:traders');
    if (!channel) {
      return {};
    }

    const rawState = channel.presenceState();
    const result: PresenceState = {};

    for (const [key, value] of Object.entries(rawState as any)) {
      if (Array.isArray(value)) {
        result[key] = {
          presence: value.map((item: any) => ({
            id: item.id || key,
            userId: item.userId,
            online_at: item.online_at || new Date().toISOString(),
          })),
        };
      }
    }

    return result;
  }

  /**
   * Listen to presence events
   */
  public onPresence(callback: (state: PresenceState) => void): () => void {
    const channel = this.getChannel('presence:traders');

    const presenceHandler = () => {
      const state = this.getPresenceState();
      callback(state);
    };

    channel.on('presence', { event: 'sync' }, presenceHandler);
    channel.on('presence', { event: 'join' }, presenceHandler);
    channel.on('presence', { event: 'leave' }, presenceHandler);

    return () => {
      channel.off('presence', { event: 'sync' }, presenceHandler);
      channel.off('presence', { event: 'join' }, presenceHandler);
      channel.off('presence', { event: 'leave' }, presenceHandler);
    };
  }

  /**
   * Unsubscribe from a channel
   */
  public async unsubscribe(topic: string): Promise<void> {
    const channel = this.channels.get(topic);
    if (!channel) {
      return;
    }

    this.supabase.removeChannel(channel);
    this.channels.delete(topic);
    
    // Clean up listeners
    for (const [key] of this.listeners.entries()) {
      if (key.startsWith(`${topic}:`)) {
        this.listeners.delete(key);
      }
    }

    console.log(`[Realtime] Unsubscribed from ${topic}`);
  }

  /**
   * Unsubscribe from all channels
   */
  public async unsubscribeAll(): Promise<void> {
    const topics = Array.from(this.channels.keys());
    await Promise.all(topics.map((topic) => this.unsubscribe(topic)));
    this.channels.clear();
    this.listeners.clear();
    this.connectionStatus = 'disconnected';
  }

  /**
   * Disconnect and cleanup
   */
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.unsubscribeAll();
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' | 'reconnecting' {
    return this.connectionStatus;
  }

  /**
   * Get number of active channels
   */
  public getChannelCount(): number {
    return this.channels.size;
  }
}

// Singleton instance for app-wide use
let realtimeClientInstance: RealtimeClient | null = null;

export function getRealtimeClient(): RealtimeClient {
  if (!realtimeClientInstance) {
    realtimeClientInstance = new RealtimeClient();
  }
  return realtimeClientInstance;
}

export default RealtimeClient;
