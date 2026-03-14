/**
 * API Client for AlphaArena Backend
 * Provides REST API and Supabase Realtime connections
 * 
 * Note: API endpoints are mapped to Supabase Edge Functions when using Supabase:
 * - /api/strategies → get-strategies
 * - /api/trades → get-trades
 * - etc.
 */

// Use environment variables for API and Supabase URLs
// Falls back to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || API_BASE_URL.replace('http', 'ws');

// Check if using Supabase Edge Functions (URL contains /functions/v1)
const IS_SUPABASE_FUNCTIONS = API_BASE_URL.includes('/functions/v1');

// Supabase API Key (required for Edge Functions)
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Map API endpoints to Supabase Function names
const FUNCTION_MAP: Record<string, string> = {
  '/api/strategies': 'get-strategies',
  '/api/trades': 'get-trades',
  '/api/portfolios': 'get-portfolios',
  '/api/stats': 'get-stats',
  '/api/leaderboard': 'get-leaderboard',
  '/api/orderbook': 'get-orderbook',
  '/api/market/tickers': 'get-market-tickers',
  '/api/market/kline': 'get-market-tickers', // Use same function
};

// Helper to map API paths to Supabase function names
function mapToFunction(path: string): string {
  if (!IS_SUPABASE_FUNCTIONS) {
    return path;
  }

  // Check for mapped endpoints
  for (const [apiPath, functionName] of Object.entries(FUNCTION_MAP)) {
    if (path.startsWith(apiPath)) {
      const remaining = path.slice(apiPath.length);
      return functionName + remaining;
    }
  }

  // Handle special cases
  if (path === '/api/leaderboard/refresh') return 'refresh-leaderboard';
  if (path === '/api/leaderboard/snapshot') return 'get-leaderboard-snapshot';
  if (path.startsWith('/api/leaderboard/')) return 'get-strategy-rank' + path.replace('/api/leaderboard', '');
  if (path.startsWith('/api/strategies') && path.includes('/')) {
    // Individual strategy operations
    if (path.includes('POST') || path.includes('PATCH')) {
      // Will be handled by method-specific logic
    }
  }

  // Default: remove /api/ prefix
  return path.replace('/api/', '');
}

// Unified fetch wrapper that handles Supabase function mapping
async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const endpoint = mapToFunction(path);
  const url = `${API_BASE_URL}/${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(IS_SUPABASE_FUNCTIONS && SUPABASE_ANON_KEY ? {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    } : {}),
    ...(options?.headers || {}),
  };
  
  return fetch(url, { ...options, headers });
}

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  symbol: string;
  status: 'active' | 'paused' | 'stopped';
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Trade {
  id: string;
  strategyId: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  total: number;
  fee?: number;
  buyOrderId?: string;
  sellOrderId?: string;
  executedAt: string;
}

export interface Portfolio {
  id: string;
  strategyId: string;
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  cashBalance: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    averageCost: number;
  }>;
  totalValue: number;
  snapshotAt: string;
}

export interface Stats {
  totalStrategies: number;
  activeStrategies: number;
  totalTrades: number;
  totalVolume: number;
  buyTrades: number;
  sellTrades: number;
}

export interface StrategyMetrics {
  strategyId: string;
  strategyName: string;
  status: string;
  totalTrades: number;
  totalVolume: number;
  totalPnL: number;
  roi: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgTradeSize: number;
  profitableTrades: number;
  losingTrades: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  bestTrade: number;
  worstTrade: number;
  calculatedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  strategyId: string;
  strategyName: string;
  status: string;
  metrics: StrategyMetrics;
  rankChange: number;
}

export interface LeaderboardSnapshot {
  id?: string;
  timestamp: string;
  entries: LeaderboardEntry[];
  totalStrategies: number;
  totalTrades: number;
  totalVolume: number;
}

export interface MarketTicker {
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  bid: number;
  ask: number;
  timestamp: number;
}

export interface KLineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceLevel {
  price: number;
  orders: any[];
  totalQuantity: number;
}

export interface OrderBookSnapshot {
  bids: PriceLevel[];
  asks: PriceLevel[];
  timestamp: number;
}

export interface BestPrices {
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

/**
 * REST API Client
 */
export const api = {
  async health(): Promise<{ status: string; timestamp: number }> {
    if (IS_SUPABASE_FUNCTIONS) {
      return { status: 'ok', timestamp: Date.now() };
    }
    const res = await apiFetch('/health');
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  },

  async getStrategies(): Promise<Strategy[]> {
    const res = await apiFetch('/api/strategies');
    const data: ApiResponse<Strategy[]> = await res.json();
    return data.success ? data.data : [];
  },

  async getStrategy(id: string): Promise<Strategy | null> {
    const res = await apiFetch(`/api/strategies/${id}`);
    const data: ApiResponse<Strategy> = await res.json();
    return data.success ? data.data : null;
  },

  async createStrategy(strategy: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt'>): Promise<Strategy | null> {
    const res = await apiFetch('/functions/v1/create-strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(strategy),
    });
    const data: ApiResponse<Strategy> = await res.json();
    return data.success ? data.data : null;
  },

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy | null> {
    const res = await apiFetch(`/functions/v1/update-strategy/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data: ApiResponse<Strategy> = await res.json();
    return data.success ? data.data : null;
  },

  async getTrades(filters?: {
    strategyId?: string;
    symbol?: string;
    side?: 'buy' | 'sell';
    limit?: number;
    offset?: number;
  }): Promise<Trade[]> {
    const params = new URLSearchParams();
    if (filters?.strategyId) params.append('strategyId', filters.strategyId);
    if (filters?.symbol) params.append('symbol', filters.symbol);
    if (filters?.side) params.append('side', filters.side);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    const res = await apiFetch(`/api/trades?${params}`);
    const data: ApiResponse<Trade[]> = await res.json();
    return data.success ? data.data : [];
  },

  async getPortfolio(strategyId?: string, symbol?: string): Promise<Portfolio | null> {
    const params = new URLSearchParams();
    if (strategyId) params.append('strategyId', strategyId);
    if (symbol) params.append('symbol', symbol);
    const res = await apiFetch(`/api/portfolios?${params}`);
    const data: ApiResponse<Portfolio> = await res.json();
    return data.success ? data.data : null;
  },

  async getStats(): Promise<Stats | null> {
    const res = await apiFetch('/api/stats');
    const data: ApiResponse<Stats> = await res.json();
    return data.success ? data.data : null;
  },

  async getLeaderboard(sortBy?: string): Promise<LeaderboardEntry[]> {
    const params = sortBy ? `?sortBy=${sortBy}` : '';
    const res = await apiFetch(`/api/leaderboard${params}`);
    const data: ApiResponse<LeaderboardEntry[]> = await res.json();
    return data.success ? data.data : [];
  },

  async getStrategyRank(strategyId: string): Promise<LeaderboardEntry | null> {
    const res = await apiFetch(`/api/leaderboard/${strategyId}`);
    const data: ApiResponse<LeaderboardEntry> = await res.json();
    return data.success ? data.data : null;
  },

  async refreshLeaderboard(sortBy?: string): Promise<LeaderboardEntry[]> {
    const params = sortBy ? `?sortBy=${sortBy}` : '';
    const res = await apiFetch(`/functions/v1/refresh-leaderboard${params}`, {
      method: 'POST',
    });
    const data: ApiResponse<LeaderboardEntry[]> = await res.json();
    return data.success ? data.data : [];
  },

  async getLeaderboardSnapshot(): Promise<LeaderboardSnapshot | null> {
    const res = await apiFetch('/functions/v1/get-leaderboard-snapshot');
    const data: ApiResponse<LeaderboardSnapshot> = await res.json();
    return data.success ? data.data : null;
  },

  async getOrderBook(symbol: string, levels?: number): Promise<OrderBookSnapshot | null> {
    const params = levels ? `?levels=${levels}` : '';
    const res = await apiFetch(`/api/orderbook/${symbol}${params}`);
    const data: ApiResponse<OrderBookSnapshot> = await res.json();
    return data.success ? data.data : null;
  },

  async getBestPrices(symbol: string): Promise<BestPrices | null> {
    const res = await apiFetch(`/api/orderbook/${symbol}/best`);
    const data: ApiResponse<BestPrices> = await res.json();
    return data.success ? data.data : null;
  },

  async getMarketTickers(): Promise<MarketTicker[]> {
    const res = await apiFetch('/api/market/tickers');
    const data: ApiResponse<MarketTicker[]> = await res.json();
    return data.success ? data.data : [];
  },

  async getMarketTicker(symbol: string): Promise<MarketTicker | null> {
    const res = await apiFetch(`/api/market/tickers/${symbol}`);
    const data: ApiResponse<MarketTicker> = await res.json();
    return data.success ? data.data : null;
  },

  async getKLineData(symbol: string, timeframe: string, limit?: number): Promise<KLineData[]> {
    const params = new URLSearchParams();
    params.append('timeframe', timeframe);
    if (limit) params.append('limit', limit.toString());
    const res = await apiFetch(`/api/market/kline/${symbol}?${params}`);
    const data: ApiResponse<KLineData[]> = await res.json();
    return data.success ? data.data : [];
  },

  async createOrder(order: {
    symbol: string;
    side: 'buy' | 'sell';
    type: 'limit' | 'market';
    price?: number;
    quantity: number;
  }): Promise<any | null> {
    const res = await apiFetch('/functions/v1/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    const data: ApiResponse<any> = await res.json();
    return data.success ? data.data : null;
  },
};

/**
 * WebSocket Client
 * Note: Supabase does not support custom WebSocket servers.
 * This client uses Socket.IO which requires a Node.js server.
 * Options:
 * 1. Keep Railway for WebSocket only
 * 2. Migrate to Supabase Realtime (requires code changes)
 * 3. Use polling instead of WebSocket
 */
/**
 * @deprecated Use RealtimeClient from './realtime' instead
 * Legacy WebSocketClient for backward compatibility - will be removed in next major version
 */
export class WebSocketClient {
  private realtimeClient: any;

  constructor() {
    console.warn('[WebSocketClient] WebSocketClient is deprecated. Use getRealtimeClient() from "./realtime" instead.');
    // Import dynamically to avoid circular dependency
    import('./realtime').then(({ getRealtimeClient }) => {
      this.realtimeClient = getRealtimeClient();
    });
  }

  async connect(): Promise<void> {
    console.warn('[WebSocketClient] connect() is deprecated - RealtimeClient auto-connects');
  }

  subscribe(strategyId?: string, symbol?: string): void {
    if (strategyId) {
      this.realtimeClient?.subscribe(`strategy:${strategyId}`);
    }
    if (symbol) {
      this.realtimeClient?.subscribe(`ticker:${symbol}`);
    }
  }

  unsubscribe(topic: string): void {
    this.realtimeClient?.unsubscribe(topic);
  }

  subscribeOrderBook(symbol: string): void {
    this.realtimeClient?.subscribeOrderBook(symbol);
  }

  unsubscribeOrderBook(symbol: string): void {
    this.realtimeClient?.unsubscribe(`orderbook:${symbol}`);
  }

  on(event: string, callback: Function): () => void {
    // Map legacy Socket.IO events to Supabase Realtime channels
    const [channelType, ...eventParts] = event.split(':');
    const eventName = eventParts.join(':');

    switch (channelType) {
      case 'orderbook':
        return this.realtimeClient?.on(`orderbook:${eventName}`, event, callback as any);
      case 'market':
        return this.realtimeClient?.on(`ticker:${eventName}`, event, callback as any);
      case 'trade':
        return this.realtimeClient?.on('trade:global', event, callback as any);
      case 'portfolio':
        return this.realtimeClient?.on('trade:global', event, callback as any);
      case 'strategy':
        return this.realtimeClient?.on(`strategy:${eventName}`, event, callback as any);
      case 'leaderboard':
        return this.realtimeClient?.on('leaderboard:global', event, callback as any);
      default:
        console.warn(`[WebSocketClient] Unknown event type: ${event}`);
        return () => {};
    }
  }

  off(event: string, callback: Function): void {
    console.warn('[WebSocketClient] off() is deprecated - use the unsubscribe function from on()');
  }

  disconnect(): void {
    this.realtimeClient?.disconnect();
  }
}
