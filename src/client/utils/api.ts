/**
 * API Client for AlphaArena Backend
 * Provides REST API and WebSocket connections
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  // Health check
  async health(): Promise<{ status: string; timestamp: number }> {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) {
      throw new Error(`Health check failed: ${res.status}`);
    }
    return res.json();
  },

  // Strategies
  async getStrategies(): Promise<Strategy[]> {
    const res = await fetch(`${API_BASE_URL}/api/strategies`);
    const data: ApiResponse<Strategy[]> = await res.json();
    return data.success ? data.data : [];
  },

  async getStrategy(id: string): Promise<Strategy | null> {
    const res = await fetch(`${API_BASE_URL}/api/strategies/${id}`);
    const data: ApiResponse<Strategy> = await res.json();
    return data.success ? data.data : null;
  },

  async createStrategy(strategy: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt'>): Promise<Strategy | null> {
    const res = await fetch(`${API_BASE_URL}/api/strategies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(strategy),
    });
    const data: ApiResponse<Strategy> = await res.json();
    return data.success ? data.data : null;
  },

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy | null> {
    const res = await fetch(`${API_BASE_URL}/api/strategies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data: ApiResponse<Strategy> = await res.json();
    return data.success ? data.data : null;
  },

  // Trades
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

    const res = await fetch(`${API_BASE_URL}/api/trades?${params}`);
    const data: ApiResponse<Trade[]> = await res.json();
    return data.success ? data.data : [];
  },

  // Portfolios
  async getPortfolio(strategyId?: string, symbol?: string): Promise<Portfolio | null> {
    const params = new URLSearchParams();
    if (strategyId) params.append('strategyId', strategyId);
    if (symbol) params.append('symbol', symbol);

    const res = await fetch(`${API_BASE_URL}/api/portfolios?${params}`);
    const data: ApiResponse<Portfolio> = await res.json();
    return data.success ? data.data : null;
  },

  // Stats
  async getStats(): Promise<Stats | null> {
    const res = await fetch(`${API_BASE_URL}/api/stats`);
    const data: ApiResponse<Stats> = await res.json();
    return data.success ? data.data : null;
  },

  // Leaderboard
  async getLeaderboard(sortBy?: string): Promise<LeaderboardEntry[]> {
    const params = sortBy ? `?sortBy=${sortBy}` : '';
    const res = await fetch(`${API_BASE_URL}/api/leaderboard${params}`);
    const data: ApiResponse<LeaderboardEntry[]> = await res.json();
    return data.success ? data.data : [];
  },

  async getStrategyRank(strategyId: string): Promise<LeaderboardEntry | null> {
    const res = await fetch(`${API_BASE_URL}/api/leaderboard/${strategyId}`);
    const data: ApiResponse<LeaderboardEntry> = await res.json();
    return data.success ? data.data : null;
  },

  async refreshLeaderboard(sortBy?: string): Promise<LeaderboardEntry[]> {
    const params = sortBy ? `?sortBy=${sortBy}` : '';
    const res = await fetch(`${API_BASE_URL}/api/leaderboard/refresh${params}`, {
      method: 'POST',
    });
    const data: ApiResponse<LeaderboardEntry[]> = await res.json();
    return data.success ? data.data : [];
  },

  async getLeaderboardSnapshot(): Promise<LeaderboardSnapshot | null> {
    const res = await fetch(`${API_BASE_URL}/api/leaderboard/snapshot`);
    const data: ApiResponse<LeaderboardSnapshot> = await res.json();
    return data.success ? data.data : null;
  },

  async getOrderBook(symbol: string, levels?: number): Promise<OrderBookSnapshot | null> {
    const params = levels ? `?levels=${levels}` : '';
    const res = await fetch(`${API_BASE_URL}/api/orderbook/${symbol}${params}`);
    const data: ApiResponse<OrderBookSnapshot> = await res.json();
    return data.success ? data.data : null;
  },

  async getBestPrices(symbol: string): Promise<BestPrices | null> {
    const res = await fetch(`${API_BASE_URL}/api/orderbook/${symbol}/best`);
    const data: ApiResponse<BestPrices> = await res.json();
    return data.success ? data.data : null;
  },

  // Market Data
  async getMarketTickers(): Promise<MarketTicker[]> {
    const res = await fetch(`${API_BASE_URL}/api/market/tickers`);
    const data: ApiResponse<MarketTicker[]> = await res.json();
    return data.success ? data.data : [];
  },

  async getMarketTicker(symbol: string): Promise<MarketTicker | null> {
    const res = await fetch(`${API_BASE_URL}/api/market/tickers/${symbol}`);
    const data: ApiResponse<MarketTicker> = await res.json();
    return data.success ? data.data : null;
  },
};

/**
 * WebSocket Client
 */
export class WebSocketClient {
  private socket: any;
  private url: string;
  private listeners: Map<string, Set<Function>> = new Map();
  private connectionPromise: Promise<void> | null = null;

  constructor(url: string = API_BASE_URL.replace('http', 'ws')) {
    this.url = url;
    this.socket = null;
  }

  connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      // Dynamic import for socket.io-client
      import('socket.io-client').then(({ io }) => {
        this.socket = io(this.url, {
          transports: ['websocket', 'polling'],
        });

        this.socket.on('connect', () => {
          console.log('[WebSocket] Connected');
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('[WebSocket] Disconnected');
        });

        this.socket.on('connect_error', (error: any) => {
          console.error('[WebSocket] Connection error:', error);
          this.connectionPromise = null;
          reject(error);
        });

        // Setup event listeners
        this.socket.on('trade:new', (data: any) => {
          this.emit('trade:new', data);
        });

        this.socket.on('portfolio:update', (data: any) => {
          this.emit('portfolio:update', data);
        });

        this.socket.on('strategy:tick', (data: any) => {
          this.emit('strategy:tick', data);
        });

        this.socket.on('leaderboard:update', (data: any) => {
          this.emit('leaderboard:update', data);
        });

        this.socket.on('orderbook:snapshot', (data: any) => {
          this.emit('orderbook:snapshot', data);
        });

        this.socket.on('orderbook:delta', (data: any) => {
          this.emit('orderbook:delta', data);
        });
      }).catch((error) => {
        this.connectionPromise = null;
        reject(error);
      });
    });

    return this.connectionPromise;
  }

  subscribe(strategyId?: string, symbol?: string): void {
    if (!this.socket) return;
    
    if (strategyId) {
      this.socket.emit('subscribe:strategy', strategyId);
    }
    if (symbol) {
      this.socket.emit('subscribe:symbol', symbol);
    }
  }

  unsubscribe(room: string): void {
    if (!this.socket) return;
    this.socket.emit('unsubscribe', room);
  }

  subscribeOrderBook(symbol: string): void {
    if (!this.socket) return;
    this.socket.emit('subscribe:orderbook', symbol);
  }

  unsubscribeOrderBook(symbol: string): void {
    if (!this.socket) return;
    this.socket.emit('unsubscribe:orderbook', symbol);
  }

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[WebSocket] Error in listener for event "${event}":`, error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionPromise = null;
      this.listeners.clear();
    }
  }
}
