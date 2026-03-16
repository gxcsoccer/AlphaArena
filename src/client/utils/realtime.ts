/**
 * Enhanced Supabase Realtime Client with Advanced Reconnection Logic
 * 
 * Features:
 * - Exponential backoff reconnection with jitter
 * - Connection state management
 * - Connection quality monitoring (latency tracking, stale detection)
 * - Message queueing for offline actions
 * - Automatic reconnection on network recovery
 */

import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { validateConfig, isSupabaseConfigValid, logConfigStatus } from './config';

// Reconnection settings with exponential backoff
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const RECONNECT_MULTIPLIER = 2; // Exponential backoff
const JITTER_FACTOR = 0.2; // 20% jitter to prevent thundering herd
const CONNECTION_TIMEOUT = 10000; // 10 seconds timeout for subscription
const STALE_CONNECTION_THRESHOLD = 60000; // 60 seconds without ping = stale
const PING_INTERVAL = 15000; // 15 seconds ping interval

// Connection states
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ConnectionQuality {
  latency: number;
  lastPingAt: number;
  isStale: boolean;
  reconnectAttempts: number;
  lastReconnectAt: number | null;
}

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

// Message queue item for offline actions
interface QueuedMessage {
  topic: string;
  event: string;
  payload: any;
  timestamp: number;
  priority: number; // Higher = more important
}

/**
 * Enhanced Realtime Client with advanced reconnection and monitoring
 */
export class RealtimeClient {
  private supabase: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();
  private listeners: Map<string, Array<{ callback: Function; handler: Function }>> = new Map();
  
  // Connection state
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectDelay: number = INITIAL_RECONNECT_DELAY;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private pingTimer: NodeJS.Timeout | null = null;
  private connectionQuality: ConnectionQuality = {
    latency: 0,
    lastPingAt: 0,
    isStale: false,
    reconnectAttempts: 0,
    lastReconnectAt: null,
  };
  
  // Message queue for offline actions
  private messageQueue: QueuedMessage[] = [];
  private isProcessingQueue: boolean = false;
  
  // Event listeners for connection state changes
  private connectionListeners: Array<(status: ConnectionStatus) => void> = [];
  private qualityListeners: Array<(quality: ConnectionQuality) => void> = [];

  constructor() {
    const config = validateConfig();
    const SUPABASE_URL = config.supabaseUrl;
    const SUPABASE_ANON_KEY = config.supabaseAnonKey;

    // Log configuration status for debugging
    logConfigStatus(config);

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('[RealtimeClient] ❌ Missing Supabase credentials. Realtime features will be disabled.');
      console.error('[RealtimeClient] Missing vars:', config.missingVars);
    } else if (!isSupabaseConfigValid(config)) {
      console.error('[RealtimeClient] ❌ Supabase configuration appears invalid.');
      console.error('[RealtimeClient] URL:', SUPABASE_URL);
      console.error('[RealtimeClient] Key format valid:', SUPABASE_ANON_KEY.split('.').length === 3 ? 'Yes' : 'No');
    } else {
      console.log('[RealtimeClient] ✅ Supabase configuration appears valid');
    }

    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });

    // Monitor browser online status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkRecovery());
      window.addEventListener('offline', () => this.handleNetworkLoss());
    }

    // Start connection quality monitoring
    this.startQualityMonitoring();
  }

  /**
   * Calculate reconnect delay with exponential backoff and jitter
   */
  private calculateReconnectDelay(attempt: number): number {
    const baseDelay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(RECONNECT_MULTIPLIER, attempt - 1),
      MAX_RECONNECT_DELAY
    );
    
    // Add jitter to prevent thundering herd
    const jitter = baseDelay * JITTER_FACTOR * (Math.random() * 2 - 1);
    return Math.max(100, baseDelay + jitter);
  }

  /**
   * Start connection quality monitoring
   */
  private startQualityMonitoring() {
    // Clear existing timer
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }

    // Ping interval to detect stale connections
    this.pingTimer = setInterval(() => {
      this.checkConnectionHealth();
    }, PING_INTERVAL);
  }

  /**
   * Check connection health and detect stale connections
   */
  private checkConnectionHealth() {
    const now = Date.now();
    const timeSinceLastPing = now - this.connectionQuality.lastPingAt;
    
    // Mark as stale if no ping in threshold time
    const isStale = timeSinceLastPing > STALE_CONNECTION_THRESHOLD;
    
    if (isStale && this.connectionQuality.isStale === false) {
      console.warn('[RealtimeClient] Connection detected as stale');
      this.connectionQuality.isStale = true;
      this.notifyQualityListeners();
      
      // If connected but stale, trigger reconnection
      if (this.connectionStatus === 'connected') {
        this.handleReconnect('stale');
      }
    } else if (!isStale) {
      this.connectionQuality.isStale = false;
    }
  }

  /**
   * Record a successful ping/pong
   */
  private recordPing(latency: number) {
    this.connectionQuality.latency = latency;
    this.connectionQuality.lastPingAt = Date.now();
    this.connectionQuality.isStale = false;
    this.notifyQualityListeners();
  }

  /**
   * Get or create a channel for a specific topic
   */
  private getChannel(topic: string): RealtimeChannel {
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
   * Subscribe to a channel with automatic reconnection and timeout handling
   */
  public async subscribe(topic: string): Promise<RealtimeChannel> {
    if (this.channels.has(topic)) {
      return this.channels.get(topic)!;
    }

    // Clear any existing reconnect timer for this topic
    if (this.reconnectTimers.has(topic)) {
      clearTimeout(this.reconnectTimers.get(topic)!);
      this.reconnectTimers.delete(topic);
    }

    const channel = this.getChannel(topic);
    this.connectionStatus = 'connecting';
    this.notifyConnectionListeners();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(`[RealtimeClient] Subscription timeout for ${topic}`);
        // Update connection status to disconnected on timeout
        this.connectionStatus = 'disconnected';
        this.notifyConnectionListeners();
        this.handleReconnect(topic);
        reject(new Error(`订阅超时：${topic}`));
      }, CONNECTION_TIMEOUT);

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          console.log(`[RealtimeClient] Subscribed to ${topic}`);
          this.connectionStatus = 'connected';
          this.reconnectDelay = INITIAL_RECONNECT_DELAY; // Reset on success
          this.connectionQuality.reconnectAttempts = 0;
          this.recordPing(0);
          this.notifyConnectionListeners();
          
          // Process any queued messages
          this.processMessageQueue();
          
          resolve(channel);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          console.error(`[RealtimeClient] Subscription error for ${topic}:`, status);
          // Update connection status on error
          this.connectionStatus = 'disconnected';
          this.notifyConnectionListeners();
          this.handleReconnect(topic);
          reject(new Error(`订阅失败：${status}`));
        }
      });
    });
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(topic: string) {
    // Clear existing timer
    if (this.reconnectTimers.has(topic)) {
      clearTimeout(this.reconnectTimers.get(topic)!);
    }

    this.connectionStatus = 'reconnecting';
    this.connectionQuality.reconnectAttempts++;
    this.connectionQuality.lastReconnectAt = Date.now();
    this.notifyConnectionListeners();
    this.notifyQualityListeners();

    const delay = this.calculateReconnectDelay(this.connectionQuality.reconnectAttempts);
    console.log(`[RealtimeClient] Reconnecting to ${topic} in ${Math.round(delay)}ms (attempt ${this.connectionQuality.reconnectAttempts})`);

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(topic);
      this.channels.delete(topic); // Remove failed channel
      
      // Try to resubscribe
      this.subscribe(topic).catch((error) => {
        console.warn(`[RealtimeClient] Reconnection attempt failed for ${topic}`);
        // Next attempt will use increased delay
      });
    }, delay);

    this.reconnectTimers.set(topic, timer);
  }

  /**
   * Handle network recovery (browser came back online)
   */
  private handleNetworkRecovery() {
    console.log('[RealtimeClient] Network recovered, attempting to reconnect all channels');
    this.connectionQuality.reconnectAttempts = 0;
    this.reconnectDelay = INITIAL_RECONNECT_DELAY;
    
    // Re-subscribe to all channels
    const topics = Array.from(this.channels.keys());
    topics.forEach(topic => {
      this.channels.delete(topic);
      this.subscribe(topic).catch(() => {});
    });
  }

  /**
   * Handle network loss
   */
  private handleNetworkLoss() {
    console.log('[RealtimeClient] Network lost');
    this.connectionStatus = 'disconnected';
    this.notifyConnectionListeners();
  }

  /**
   * Subscribe to order book updates
   */
  public async subscribeOrderBook(symbol: string): Promise<void> {
    const topic = `orderbook:${symbol}`;
    await this.subscribe(topic);
  }

  /**
   * Subscribe to market ticker updates
   */
  public async subscribeMarket(): Promise<void> {
    const commonSymbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT'];
    await Promise.all(
      commonSymbols.map(symbol => this.subscribe(`ticker:${symbol}`))
    );
  }

  /**
   * Subscribe to trade notifications
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
   * Listen to broadcast messages
   */
/**
   * Listen to broadcast messages
   */
  public on(topic: string, event: string, callback: (payload: any) => void): () => void {
    const channel = this.getChannel(topic);
    const filter = { event };

    const handler = (payload: any) => {
      if (payload.event === event) {
        const data = payload.payload?.data || payload.payload;
        callback(data);
        // Update ping on receiving messages
        this.recordPing(Date.now() - (payload.timestamp || Date.now()));
      }
    };

    // Use correct Supabase API with filter object
    channel.on('broadcast', filter, handler);

    const listenerKey = `${topic}:${event}`;
    if (!this.listeners.has(listenerKey)) {
      this.listeners.set(listenerKey, []);
    }
    const eventListeners = this.listeners.get(listenerKey)!;
    eventListeners.push({ callback, handler });

    return () => {
      // Use _off private method with same filter object
      (channel as any)._off('broadcast', filter);
      const index = eventListeners.findIndex(l => l.callback === callback);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
      if (eventListeners.length === 0) {
        this.listeners.delete(listenerKey);
      }
    };
  }

  /**
   * Event-specific listeners
   */
  public onOrderBookSnapshot(symbol: string, callback: (snapshot: any) => void): () => void {
    return this.on(`orderbook:${symbol}`, 'snapshot', callback);
  }

  public onOrderBookDelta(symbol: string, callback: (delta: any) => void): () => void {
    return this.on(`orderbook:${symbol}`, 'delta', callback);
  }

  public onMarketTick(symbol: string, callback: (ticker: any) => void): () => void {
    return this.on(`ticker:${symbol}`, 'tick', callback);
  }

  public onTrade(userId: string = 'global', callback: (trade: any) => void): () => void {
    return this.on(`trade:${userId}`, 'new', callback);
  }

  public onStrategyTick(strategyId: string, callback: (data: any) => void): () => void {
    return this.on(`strategy:${strategyId}`, 'tick', callback);
  }

  public onLeaderboardUpdate(callback: (entries: any[]) => void): () => void {
    return this.on('leaderboard:global', 'update', callback);
  }

  /**
   * Queue a message for later delivery (when offline)
   */
  public queueMessage(topic: string, event: string, payload: any, priority: number = 0): void {
    this.messageQueue.push({
      topic,
      event,
      payload,
      timestamp: Date.now(),
      priority,
    });
    
    // Sort by priority (higher first)
    this.messageQueue.sort((a, b) => b.priority - a.priority);
    
    console.log(`[RealtimeClient] Message queued: ${topic}:${event} (queue size: ${this.messageQueue.length})`);
  }

  /**
   * Process queued messages
   */
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    
    while (this.messageQueue.length > 0 && this.connectionStatus === 'connected') {
      const message = this.messageQueue.shift()!;
      console.log(`[RealtimeClient] Processing queued message: ${message.topic}:${message.event}`);
      
      try {
        const channel = this.getChannel(message.topic);
        await channel.send({
          type: 'broadcast',
          event: message.event,
          payload: message.payload,
        });
      } catch (error) {
        console.error(`[RealtimeClient] Failed to send queued message`, error);
        // Re-queue with lower priority
        this.messageQueue.push({ ...message, priority: Math.max(0, message.priority - 1) });
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Presence tracking
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

    console.log(`[RealtimeClient] Presence tracked for ${userId}`);
  }

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

  public onPresence(callback: (state: PresenceState) => void): () => void {
    const channel = this.getChannel('presence:traders');

    const presenceHandler = () => {
      const state = this.getPresenceState();
      callback(state);
    };

    (channel as any).on('presence', { event: 'sync' }, presenceHandler);
    (channel as any).on('presence', { event: 'join' }, presenceHandler);
    (channel as any).on('presence', { event: 'leave' }, presenceHandler);

    return () => {
      (channel as any)._off('presence', { event: 'sync' });
      (channel as any)._off('presence', { event: 'join' });
      (channel as any)._off('presence', { event: 'leave' });
    };
  }

  /**
   * Connection state listeners
   */
  public onConnectionChange(callback: (status: ConnectionStatus) => void): () => void {
    this.connectionListeners.push(callback);
    return () => {
      const index = this.connectionListeners.indexOf(callback);
      if (index !== -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  public onQualityChange(callback: (quality: ConnectionQuality) => void): () => void {
    this.qualityListeners.push(callback);
    return () => {
      const index = this.qualityListeners.indexOf(callback);
      if (index !== -1) {
        this.qualityListeners.splice(index, 1);
      }
    };
  }

  private notifyConnectionListeners() {
    this.connectionListeners.forEach(cb => cb(this.connectionStatus));
  }

  private notifyQualityListeners() {
    this.qualityListeners.forEach(cb => cb({ ...this.connectionQuality }));
  }

  /**
   * Unsubscribe from a channel
   */
  public async unsubscribe(topic: string): Promise<void> {
    // Clear reconnect timer
    if (this.reconnectTimers.has(topic)) {
      clearTimeout(this.reconnectTimers.get(topic)!);
      this.reconnectTimers.delete(topic);
    }

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

    console.log(`[RealtimeClient] Unsubscribed from ${topic}`);
  }

  /**
   * Unsubscribe from all channels
   */
  public async unsubscribeAll(): Promise<void> {
    // Clear all reconnect timers
    this.reconnectTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectTimers.clear();

    const topics = Array.from(this.channels.keys());
    await Promise.all(topics.map((topic) => this.unsubscribe(topic)));
    this.channels.clear();
    this.listeners.clear();
    this.connectionStatus = 'disconnected';
    this.notifyConnectionListeners();
  }

  /**
   * Disconnect and cleanup
   */
  public async disconnect(): Promise<void> {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    if (this.reconnectTimers.size > 0) {
      this.reconnectTimers.forEach((timer) => clearTimeout(timer));
      this.reconnectTimers.clear();
    }

    await this.unsubscribeAll();
    this.messageQueue = [];
    this.connectionQuality = {
      latency: 0,
      lastPingAt: 0,
      isStale: false,
      reconnectAttempts: 0,
      lastReconnectAt: null,
    };
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get connection quality metrics
   */
  public getConnectionQuality(): ConnectionQuality {
    return { ...this.connectionQuality };
  }

  /**
   * Get number of active channels
   */
  public getChannelCount(): number {
    return this.channels.size;
  }

  /**
   * Get queued message count
   */
  public getQueuedMessageCount(): number {
    return this.messageQueue.length;
  }
}

// Singleton instance
let realtimeClientInstance: RealtimeClient | null = null;

export function getRealtimeClient(): RealtimeClient {
  if (!realtimeClientInstance) {
    realtimeClientInstance = new RealtimeClient();
  }
  return realtimeClientInstance;
}

export default RealtimeClient;
