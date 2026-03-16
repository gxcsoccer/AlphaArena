/**
 * Supabase Realtime Broadcast Service
 * 
 * Replaces Socket.IO with Supabase Realtime for real-time event broadcasting.
 * Supports Broadcast and Presence features.
 * 
 * Features:
 * - Order book updates (snapshot/delta)
 * - Market ticker updates
 * - Trade notifications
 * - Presence tracking for online traders
 * 
 * Channel naming convention:
 * - orderbook:{symbol} - Order book updates
 * - ticker:{symbol} - Market ticker updates
 * - trade:{userId} - User-specific trade notifications
 * - presence:traders - Online trader presence
 */

import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface BroadcastEvent {
  type: 'broadcast';
  event: string;
  payload: any;
}

export interface PresenceState {
  [key: string]: {
    presence: Array<{
      id: string;
      userId?: string;
      online_at: string;
    }>;
  };
}

export type RealtimeEventType = 
  | 'orderbook:snapshot'
  | 'orderbook:delta'
  | 'market:tick'
  | 'trade:new'
  | 'portfolio:update'
  | 'strategy:tick'
  | 'leaderboard:update';

export interface RealtimeMessage {
  event: RealtimeEventType;
  data: any;
  timestamp: number;
}
export class SupabaseRealtimeService {
  private supabase: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();
  private isConnected: boolean = false;
  private presenceState: Map<string, PresenceState> = new Map();

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10, // Allow up to 10 events per second per channel
        },
      },
    });
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
   * Subscribe to a channel
   */
  public async subscribe(topic: string): Promise<RealtimeChannel> {
    const channel = this.getChannel(topic);
    
    return new Promise((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          console.log(`[Realtime] Subscribed to ${topic}`);
          resolve(channel);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`[Realtime] Subscription error for ${topic}:`, status);
          reject(new Error(`Subscription failed: ${status}`));
        }
      });
    });
  }

  /**
   * Send a broadcast message to a channel
   */
  public async broadcast(
    topic: string,
    event: string,
    payload: any
  ): Promise<boolean> {
    try {
      const channel = this.getChannel(topic);
      
      const result = await channel.send({
        type: 'broadcast',
        event,
        payload,
      });

      // Check if result is 'ok' (string) or has status property
      const isSuccess = result === 'ok' || (result as any).status === 'ok';
      
      if (isSuccess) {
        console.log(`[Realtime] Broadcast to ${topic}:${event}`);
        return true;
      } else {
        console.error(`[Realtime] Broadcast failed to ${topic}:${event}`, result);
        return false;
      }
    } catch (error: any) {
      console.error(`[Realtime] Broadcast error to ${topic}:${event}:`, error.message);
      return false;
    }
  }

  /**
   * Broadcast order book snapshot
   */
  public async broadcastOrderBookSnapshot(
    symbol: string,
    snapshot: any
  ): Promise<boolean> {
    const topic = `orderbook:${symbol}`;
    return this.broadcast(topic, 'snapshot', {
      data: snapshot,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast order book delta
   */
  public async broadcastOrderBookDelta(
    symbol: string,
    delta: any
  ): Promise<boolean> {
    const topic = `orderbook:${symbol}`;
    return this.broadcast(topic, 'delta', {
      data: delta,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast market ticker update
   */
  public async broadcastMarketTick(symbol: string, ticker: any): Promise<boolean> {
    const topic = `ticker:${symbol}`;
    return this.broadcast(topic, 'tick', {
      data: ticker,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast trade notification
   */
  public async broadcastTrade(
    userId: string | 'global',
    trade: any
  ): Promise<boolean> {
    const topic = `trade:${userId}`;
    return this.broadcast(topic, 'new', {
      data: trade,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast portfolio update
   */
  public async broadcastPortfolioUpdate(
    userId: string | 'global',
    portfolio: any
  ): Promise<boolean> {
    const topic = `trade:${userId}`; // Use trade channel for user-specific updates
    return this.broadcast(topic, 'portfolio_update', {
      data: portfolio,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast strategy tick
   */
  public async broadcastStrategyTick(
    strategyId: string,
    data: any
  ): Promise<boolean> {
    const topic = `strategy:${strategyId}`;
    return this.broadcast(topic, 'tick', {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast leaderboard update
   */
  public async broadcastLeaderboardUpdate(entries: any[]): Promise<boolean> {
    const topic = 'leaderboard:global';
    return this.broadcast(topic, 'update', {
      data: entries,
      timestamp: Date.now(),
    });
  }

  /**
   * Track presence for a user
   */
  public async trackPresence(
    userId: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      const channel = this.getChannel('presence:traders');
      
      await channel.track({
        id: userId,
        userId,
        online_at: new Date().toISOString(),
        ...metadata,
      });

      console.log(`[Realtime] Presence tracked for ${userId}`);
      return true;
    } catch (error: any) {
      console.error(`[Realtime] Presence track error for ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Get current presence state
   */
  public getPresenceState(): PresenceState {
    const channel = this.channels.get('presence:traders');
    if (!channel) {
      return {};
    }
    // Convert Supabase presence state to our format
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
   * Listen to broadcast messages on a channel
   */
/**
   * Listen to broadcast messages on a channel
   */
  public onBroadcast(
    topic: string,
    event: string | '*',
    callback: (payload: any) => void
  ): () => void {
    const channel = this.getChannel(topic);
    const filter = { event };

    const handler = (payload: any) => {
      if (event === '*' || payload.event === event) {
        callback(payload);
      }
    };

    // Use correct Supabase API with filter object
    channel.on('broadcast', filter, handler);

    // Return unsubscribe function
    return () => {
      (channel as any)._off('broadcast', filter);
    };
  }

  /**
   * Listen to presence events
   */
/**
   * Listen to presence events
   */
  public onPresence(
    callback: (state: PresenceState) => void
  ): () => void {
    const channel = this.getChannel('presence:traders');

    const presenceHandler = () => {
      const state = this.getPresenceState();
      callback(state);
    };

    // Subscribe to presence events
    channel.on('presence', { event: 'sync' }, presenceHandler);
    channel.on('presence', { event: 'join' }, presenceHandler);
    channel.on('presence', { event: 'leave' }, presenceHandler);

    // Return unsubscribe function using _off
    return () => {
      (channel as any)._off('presence', { event: 'sync' });
      (channel as any)._off('presence', { event: 'join' });
      (channel as any)._off('presence', { event: 'leave' });
    };
  }

  /**
   * Unsubscribe from a channel
   */
  public async unsubscribe(topic: string): Promise<boolean> {
    const channel = this.channels.get(topic);
    if (!channel) {
      return false;
    }

    return new Promise((resolve) => {
      this.supabase.removeChannel(channel);
      this.channels.delete(topic);
      console.log(`[Realtime] Unsubscribed from ${topic}`);
      resolve(true);
    });
  }

  /**
   * Unsubscribe from all channels
   */
  public async unsubscribeAll(): Promise<void> {
    const topics = Array.from(this.channels.keys());
    await Promise.all(topics.map((topic) => this.unsubscribe(topic)));
    this.channels.clear();
    this.isConnected = false;
  }

  /**
   * Check if connected
   */
  public getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get channel count
   */
  public getChannelCount(): number {
    return this.channels.size;
  }
}

export default SupabaseRealtimeService;
