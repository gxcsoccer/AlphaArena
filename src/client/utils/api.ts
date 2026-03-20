/**
 * API Client for AlphaArena Backend
 * Provides REST API and Supabase Realtime connections
 * 
 * Note: API endpoints are mapped to Supabase Edge Functions when using Supabase:
 * - /api/strategies → get-strategies
 * - /api/trades → get-trades
 * - etc.
 */

import { validateConfig, logConfigStatus } from './config';
import { createLogger } from '../../utils/logger';

// Create logger for this module
const log = createLogger('APIClient');

// Use validated configuration
const config = validateConfig();
const API_BASE_URL = config.apiUrl;
const _WS_BASE_URL = config.wsUrl;

// Log configuration status once at module load time
logConfigStatus(config);

// Check if using Supabase Edge Functions (URL contains /functions/v1)
const IS_SUPABASE_FUNCTIONS = API_BASE_URL.includes('/functions/v1');

// Supabase API Key (required for Edge Functions)
const SUPABASE_ANON_KEY = config.supabaseAnonKey;

// Map API endpoints to Supabase Function names
const FUNCTION_MAP: Record<string, string> = {
  '/api/strategies': 'get-strategies',
  '/api/trades': 'get-trades',
  '/api/portfolios': 'get-portfolios',
  '/api/stats': 'get-stats',
  '/api/leaderboard': 'get-leaderboard',
  '/api/orderbook': 'get-orderbook',
  '/api/market/tickers': 'get-market-tickers',
  '/api/market/kline': 'get-market-kline',
  '/api/conditional-orders': 'conditional-orders',
  '/api/orders': 'get-orders'
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
  // Ensure proper URL construction (avoid double slashes)
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const endpointPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${baseUrl}/${endpointPath}`;
  
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

export interface PriceAlert {
  id: string;
  userId?: string | null;
  symbol: string;
  conditionType: 'above' | 'below';
  targetPrice: number;
  currentPrice?: number | null;
  status: 'active' | 'triggered' | 'disabled' | 'expired';
  notificationMethod: 'in_app' | 'feishu' | 'email' | 'push';
  triggeredAt?: string | null;
  triggeredPrice?: number | null;
  isRecurring: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
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

  async exportTrades(filters?: {
    strategyId?: string;
    symbol?: string;
    side?: 'buy' | 'sell';
    startDate?: Date;
    endDate?: Date;
  }): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters?.strategyId) params.append('strategyId', filters.strategyId);
    if (filters?.symbol) params.append('symbol', filters.symbol);
    if (filters?.side) params.append('side', filters.side);
    if (filters?.startDate) params.append('startDate', filters.startDate.toISOString());
    if (filters?.endDate) params.append('endDate', filters.endDate.toISOString());
    const res = await apiFetch(`/api/trades/export?${params}`);
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    return res.blob();
  },

  async getPortfolio(strategyId?: string, symbol?: string): Promise<Portfolio | null> {
    const params = new URLSearchParams();
    if (strategyId) params.append('strategyId', strategyId);
    if (symbol) params.append('symbol', symbol);
    const res = await apiFetch(`/api/portfolios?${params}`);
    const data: ApiResponse<Portfolio> = await res.json();
    return data.success ? data.data : null;
  },

  async getPortfolioHistory(
    strategyId: string,
    timeRange: '1d' | '1w' | '1m' | 'all' = '1w'
  ): Promise<
    Array<{
      timestamp: Date;
      totalValue: number;
      realizedPnL: number;
      unrealizedPnL: number;
    }>
  > {
    const params = new URLSearchParams();
    params.append('strategyId', strategyId);
    params.append('timeRange', timeRange);
    const res = await apiFetch(`/api/portfolios/history?${params}`);
    const data: ApiResponse<Array<{ timestamp: string; totalValue: number; realizedPnL: number; unrealizedPnL: number }>> = await res.json();
    return data.success 
      ? data.data.map(item => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }))
      : [];
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
    params.append('symbol', symbol); // Pass symbol as query param instead of path
    if (limit) params.append('limit', limit.toString());
    const url = `/api/market/kline?${params}`;
    log.info('📊 Requesting:', url);
    log.info('Config:', { 
      API_BASE_URL, 
      IS_SUPABASE_FUNCTIONS,
      hasSupabaseKey: !!config.supabaseAnonKey 
    });
    
    let res: Response;
    try {
      res = await apiFetch(url);
      log.info('Response status:', { status: res.status, ok: res.ok });
    } catch (networkError: any) {
      log.error('❌ Network error:', networkError.message);
      log.error('This usually means:');
      log.error('- CORS error (check browser console for details)');
      log.error('- Network connectivity issue');
      log.error('- Invalid API URL configuration');
      throw new Error(`Network error: ${networkError.message}`);
    }
    
    let data: ApiResponse<KLineData[]>;
    try {
      data = await res.json();
    } catch (parseError: any) {
      log.error('❌ Failed to parse response as JSON');
      log.error('Response body:', await res.text().catch(() => '<unable to read>'));
      throw new Error(`Invalid response format: ${parseError.message}`);
    }
    
    log.info('Response success:', { success: data.success, dataLength: data.data?.length });
    if (!data.success) {
      log.error('❌ API returned error:', data.error);
      log.error('Full response:', data);
      throw new Error(data.error || 'API request failed');
    }
    return data.data || [];
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

  async cancelOrder(orderId: string): Promise<any | null> {
    const res = await apiFetch(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data: ApiResponse<any> = await res.json();
    return data.success ? data.data : null;
  },

  async getOrders(filters?: {
    symbol?: string;
    status?: string;
    limit?: number;
  }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.symbol) params.append('symbol', filters.symbol);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    const res = await apiFetch(`/api/orders?${params}`);
    const data: ApiResponse<any[]> = await res.json();
    return data.success ? data.data : [];
  },

  async createConditionalOrder(order: {
    symbol: string;
    side: 'buy' | 'sell';
    orderType: 'stop_loss' | 'take_profit';
    triggerPrice: number;
    quantity: number;
    expiresAt?: string;
  }): Promise<any | null> {
    const res = await apiFetch('/functions/v1/create-conditional-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    const data: ApiResponse<any> = await res.json();
    return data.success ? data.data : null;
  },

  async getConditionalOrders(filters?: {
    symbol?: string;
    status?: 'active' | 'triggered' | 'cancelled' | 'expired';
    orderType?: 'stop_loss' | 'take_profit';
    limit?: number;
  }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.symbol) params.append('symbol', filters.symbol);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.orderType) params.append('orderType', filters.orderType);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    const res = await apiFetch(`/api/conditional-orders?${params}`);
    const data: ApiResponse<any[]> = await res.json();
    return data.success ? data.data : [];
  },

  async cancelConditionalOrder(orderId: string): Promise<any | null> {
    const res = await apiFetch(`/api/conditional-orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data: ApiResponse<any> = await res.json();
    return data.success ? data.data : null;
  },

  async getConditionalOrderStats(): Promise<any | null> {
    const res = await apiFetch('/api/conditional-orders/stats');
    const data: ApiResponse<any> = await res.json();
    return data.success ? data.data : null;
  },

  // Price Alert API methods
  async getPriceAlerts(filters?: {
    userId?: string;
    symbol?: string;
    status?: 'active' | 'triggered' | 'disabled' | 'expired';
    conditionType?: 'above' | 'below';
    limit?: number;
  }): Promise<PriceAlert[]> {
    const params = new URLSearchParams();
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.symbol) params.append('symbol', filters.symbol);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.conditionType) params.append('conditionType', filters.conditionType);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    
    const res = await apiFetch(`/functions/v1/price-alerts?${params}`);
    const data: ApiResponse<PriceAlert[]> = await res.json();
    return data.success ? data.data : [];
  },

  async createPriceAlert(alert: {
    symbol: string;
    conditionType: 'above' | 'below';
    targetPrice: number;
    notificationMethod?: 'in_app' | 'feishu' | 'email' | 'push';
    expiresAt?: string;
    isRecurring?: boolean;
    notes?: string;
    userId?: string;
  }): Promise<PriceAlert | null> {
    const res = await apiFetch('/functions/v1/create-price-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    });
    const data: ApiResponse<PriceAlert> = await res.json();
    return data.success ? data.data : null;
  },

  async updatePriceAlert(id: string, updates: {
    status?: 'active' | 'triggered' | 'disabled' | 'expired';
    targetPrice?: number;
    notificationMethod?: 'in_app' | 'feishu' | 'email' | 'push';
    isRecurring?: boolean;
    notes?: string;
  }): Promise<PriceAlert | null> {
    const res = await apiFetch(`/functions/v1/update-price-alert/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data: ApiResponse<PriceAlert> = await res.json();
    return data.success ? data.data : null;
  },

  async deletePriceAlert(id: string): Promise<boolean> {
    const res = await apiFetch(`/functions/v1/delete-price-alert/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data: ApiResponse<{ id: string; deleted: boolean }> = await res.json();
    return data.success ? data.data.deleted : false;
  },

  // OCO Order API methods
  async createOCOOrder(order: {
    symbol: string;
    side: 'buy' | 'sell';
    strategyId?: string;
    takeProfitTriggerPrice: number;
    takeProfitQuantity: number;
    takeProfitOrderType?: 'limit' | 'market';
    takeProfitLimitPrice?: number;
    stopLossTriggerPrice: number;
    stopLossQuantity: number;
    stopLossOrderType?: 'limit' | 'market';
    stopLossLimitPrice?: number;
    expiresAt?: string;
  }): Promise<any | null> {
    const res = await apiFetch('/functions/v1/create-oco-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    const data: ApiResponse<any> = await res.json();
    return data.success ? data.data : null;
  },

  async getOCOOrders(filters?: {
    symbol?: string;
    status?: string;
    strategyId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.symbol) params.append('symbol', filters.symbol);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.strategyId) params.append('strategyId', filters.strategyId);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    const res = await apiFetch(`/functions/v1/oco-orders?${params}`);
    const data: ApiResponse<any[]> = await res.json();
    return data.success ? data.data : [];
  },

  async cancelOCOOrder(orderId: string): Promise<any | null> {
    const res = await apiFetch(`/functions/v1/cancel-oco-order/${orderId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data: ApiResponse<any> = await res.json();
    return data.success ? data.data : null;
  },


  // Iceberg Order API methods
  async createIcebergOrder(order: {
    symbol: string;
    side: 'buy' | 'sell';
    price: number;
    totalQuantity: number;
    displayQuantity: number;
    hiddenQuantity: number;
    variance?: number;
    strategyId?: string;
    expiresAt?: string;
  }): Promise<any | null> {
    const res = await apiFetch('/functions/v1/create-iceberg-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    const data: ApiResponse<any> = await res.json();
    return data.success ? data.data : null;
  },

  async getIcebergOrders(filters?: {
    symbol?: string;
    status?: string;
    strategyId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.symbol) params.append('symbol', filters.symbol);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.strategyId) params.append('strategyId', filters.strategyId);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    const res = await apiFetch(`/functions/v1/iceberg-orders?${params}`);
    const data: ApiResponse<any[]> = await res.json();
    return data.success ? data.data : [];
  },

  async cancelIcebergOrder(orderId: string): Promise<any | null> {
    const res = await apiFetch(`/functions/v1/cancel-iceberg-order/${orderId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data: ApiResponse<any> = await res.json();
    return data.success ? data.data : null;
  },

  async getIcebergOrderStats(): Promise<any | null> {
    const res = await apiFetch('/functions/v1/iceberg-orders/stats');
    const data: ApiResponse<any> = await res.json();
    return data.success ? data.data : null;
  },

  // TWAP Order API methods
  async createTWAPOrder(order: {
    symbol: string;
    side: 'buy' | 'sell';
    totalQuantity: number;
    startTime: string;
    endTime: string;
    intervalSeconds: number;
    priceLimit?: number;
    priceLimitType?: 'max' | 'min' | 'none';
    strategyId?: string;
  }): Promise<any | null> {
    const res = await apiFetch('/functions/v1/create-twap-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    const data: ApiResponse<any> = await res.json();
    return data.success ? data.data : null;
  },

  async getTWAPOrders(filters?: {
    symbol?: string;
    status?: string;
    strategyId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.symbol) params.append('symbol', filters.symbol);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.strategyId) params.append('strategyId', filters.strategyId);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    const res = await apiFetch(`/functions/v1/twap-orders?${params}`);
    const data: ApiResponse<any[]> = await res.json();
    return data.success ? data.data : [];
  },

  async cancelTWAPOrder(orderId: string): Promise<any | null> {
    const res = await apiFetch(`/functions/v1/cancel-twap-order/${orderId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data: ApiResponse<any> = await res.json();
    return data.success ? data.data : null;
  },

  async getTWAPOrderProgress(orderId: string): Promise<any | null> {
    const res = await apiFetch(`/functions/v1/twap-order-progress/${orderId}`);
    const data: ApiResponse<any> = await res.json();
    return data.success ? data.data : null;
  },
};

/**
 * Supabase Realtime Client Wrapper
 * 
 * Replaces Socket.IO with Supabase Realtime for real-time updates.
 * This is a thin wrapper around the RealtimeClient from ./realtime
 * for backward compatibility with existing code.
 * 
 * For new code, use getRealtimeClient() from ./realtime directly.
 */

import { getRealtimeClient as getRealtimeClientInternal } from './realtime';

export class RealtimeClient {
  private client: ReturnType<typeof getRealtimeClientInternal>;
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    this.client = getRealtimeClientInternal();
  }

  async connect(): Promise<void> {
    if (this.connectionPromise) return this.connectionPromise;
    this.connectionPromise = Promise.resolve();
    log.info('Client initialized');
    return this.connectionPromise;
  }

  async subscribe(strategyId?: string, symbol?: string): Promise<void> {
    if (strategyId) {
      await this.client.subscribe(`strategy:${strategyId}`);
    }
    if (symbol) {
      await this.client.subscribe(`ticker:${symbol}`);
    }
  }

  async subscribeOrderBook(symbol: string): Promise<void> {
    await this.client.subscribeOrderBook(symbol);
  }

  async unsubscribe(topic: string): Promise<void> {
    await this.client.unsubscribe(topic);
  }

  async unsubscribeOrderBook(symbol: string): Promise<void> {
    await this.client.unsubscribe(`orderbook:${symbol}`);
  }

  on(event: string, callback: Function): () => void {
    // Map legacy Socket.IO events to Supabase Realtime channels
    const [channelType, ...eventParts] = event.split(':');
    const eventName = eventParts.join(':');

    switch (channelType) {
      case 'orderbook':
        return this.client.on(`orderbook:${eventName}`, event, callback as any);
      case 'market':
        return this.client.on(`ticker:${eventName}`, event, callback as any);
      case 'trade':
        return this.client.on('trade:global', event, callback as any);
      case 'portfolio':
        return this.client.on('trade:global', event, callback as any);
      case 'strategy':
        return this.client.on(`strategy:${eventName}`, event, callback as any);
      case 'leaderboard':
        return this.client.on('leaderboard:global', event, callback as any);
      default:
        log.warn(`Unknown event type: ${event}`);
        return () => {};
    }
  }

  off(_event: string, _callback: Function): void {
    log.warn('off() is deprecated - use the unsubscribe function from on()');
  }

  disconnect(): void {
    this.client.disconnect();
    this.connectionPromise = null;
  }

  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' | 'reconnecting' {
    return this.client.getConnectionStatus();
  }
}

/**
 * @deprecated Use RealtimeClient instead
 * Legacy WebSocketClient for backward compatibility
 */
export class WebSocketClient extends RealtimeClient {
  constructor() {
    super();
    log.warn('WebSocketClient is deprecated. Use RealtimeClient instead.');
  }
}

// ============================================
// Copy Trading Types
// ============================================

export type FollowerStatus = 'active' | 'paused' | 'cancelled';
export type CopyMode = 'proportional' | 'fixed' | 'mirror';

export interface FollowerSettings {
  copyMode: CopyMode;
  copyRatio: number;
  fixedAmount?: number;
  maxCopyAmount?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  maxDailyTrades: number;
  maxDailyVolume?: number;
  allowedSymbols?: string[];
  blockedSymbols?: string[];
}

export interface Follower {
  id: string;
  followerUserId: string;
  leaderUserId: string;
  status: FollowerStatus;
  settings: FollowerSettings;
  stats: {
    totalCopiedTrades: number;
    totalCopiedVolume: number;
    totalPnl: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CopyTrade {
  id: string;
  followerId: string;
  originalTradeId: string;
  symbol: string;
  side: 'buy' | 'sell';
  originalQuantity: number;
  copiedQuantity: number;
  copiedPrice?: number;
  status: 'pending' | 'executing' | 'filled' | 'partial' | 'failed' | 'cancelled';
  error?: string;
  createdAt: string;
  executedAt?: string;
}

export interface FollowerStatsRecord {
  id: string;
  followerId: string;
  periodType: 'daily' | 'weekly' | 'monthly' | 'all_time';
  periodStart: string;
  periodEnd: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  totalVolume: number;
  roiPct: number;
  avgTradeSize: number;
  maxDrawdown: number;
}

// ============================================
// Copy Trading API Methods
// ============================================

// Add copy trading methods to api object
const copyTradingApi = {
  // Get list of traders the user is following
  async getFollowing(followerUserId: string, status?: FollowerStatus): Promise<Follower[]> {
    const params = status ? `?status=${status}` : '';
    const res = await apiFetch(`/api/copy-trading/follower/${followerUserId}/following${params}`);
    const data: ApiResponse<Follower[]> = await res.json();
    return data.success ? data.data : [];
  },

  // Follow a trader
  async followTrader(
    followerUserId: string,
    leaderUserId: string,
    settings?: Partial<FollowerSettings>
  ): Promise<Follower | null> {
    const res = await apiFetch('/api/copy-trading/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followerUserId, leaderUserId, settings }),
    });
    const data: ApiResponse<Follower> = await res.json();
    return data.success ? data.data : null;
  },

  // Unfollow a trader
  async unfollowTrader(followerId: string): Promise<boolean> {
    const res = await apiFetch(`/api/copy-trading/follow/${followerId}`, {
      method: 'DELETE',
    });
    const data: ApiResponse<void> = await res.json();
    return data.success;
  },

  // Update follower settings
  async updateFollowerSettings(
    followerId: string,
    updates: { status?: FollowerStatus; settings?: Partial<FollowerSettings> }
  ): Promise<Follower | null> {
    const res = await apiFetch(`/api/copy-trading/follow/${followerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data: ApiResponse<Follower> = await res.json();
    return data.success ? data.data : null;
  },

  // Pause following
  async pauseFollowing(followerId: string): Promise<Follower | null> {
    const res = await apiFetch(`/api/copy-trading/follow/${followerId}/pause`, {
      method: 'POST',
    });
    const data: ApiResponse<Follower> = await res.json();
    return data.success ? data.data : null;
  },

  // Resume following
  async resumeFollowing(followerId: string): Promise<Follower | null> {
    const res = await apiFetch(`/api/copy-trading/follow/${followerId}/resume`, {
      method: 'POST',
    });
    const data: ApiResponse<Follower> = await res.json();
    return data.success ? data.data : null;
  },

  // Get copy trades
  async getCopyTrades(filters?: {
    followerUserId?: string;
    leaderUserId?: string;
    symbol?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<CopyTrade[]> {
    const params = new URLSearchParams();
    if (filters?.followerUserId) params.append('followerUserId', filters.followerUserId);
    if (filters?.leaderUserId) params.append('leaderUserId', filters.leaderUserId);
    if (filters?.symbol) params.append('symbol', filters.symbol);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    const res = await apiFetch(`/api/copy-trading/trades?${params}`);
    const data: ApiResponse<CopyTrade[]> = await res.json();
    return data.success ? data.data : [];
  },

  // Get a single copy trade
  async getCopyTrade(tradeId: string): Promise<CopyTrade | null> {
    const res = await apiFetch(`/api/copy-trading/trades/${tradeId}`);
    const data: ApiResponse<CopyTrade> = await res.json();
    return data.success ? data.data : null;
  },

  // Cancel a copy trade
  async cancelCopyTrade(tradeId: string): Promise<boolean> {
    const res = await apiFetch(`/api/copy-trading/trades/${tradeId}/cancel`, {
      method: 'POST',
    });
    const data: ApiResponse<void> = await res.json();
    return data.success;
  },

  // Get copy trading leaderboard
  async getCopyTradingLeaderboard(
    periodType: 'daily' | 'weekly' | 'monthly' | 'all_time' = 'monthly',
    limit: number = 10
  ): Promise<FollowerStatsRecord[]> {
    const res = await apiFetch(`/api/copy-trading/leaderboard?periodType=${periodType}&limit=${limit}`);
    const data: ApiResponse<FollowerStatsRecord[]> = await res.json();
    return data.success ? data.data : [];
  },
};

// Extend the api object with copy trading methods
Object.assign(api, copyTradingApi);
