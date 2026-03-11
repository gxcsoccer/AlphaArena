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

/**
 * REST API Client
 */
export const api = {
  // Health check
  async health(): Promise<{ status: string; timestamp: number }> {
    const res = await fetch(`${API_BASE_URL}/health`);
    return res.json();
  },

  // Strategies
  async getStrategies(): Promise<Strategy[]> {
    const res = await fetch(`${API_BASE_URL}/api/strategies`);
    const data = await res.json();
    return data.success ? data.data : [];
  },

  async getStrategy(id: string): Promise<Strategy | null> {
    const res = await fetch(`${API_BASE_URL}/api/strategies/${id}`);
    const data = await res.json();
    return data.success ? data.data : null;
  },

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy | null> {
    const res = await fetch(`${API_BASE_URL}/api/strategies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
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
    const data = await res.json();
    return data.success ? data.data : [];
  },

  // Portfolios
  async getPortfolio(strategyId?: string, symbol?: string): Promise<Portfolio | null> {
    const params = new URLSearchParams();
    if (strategyId) params.append('strategyId', strategyId);
    if (symbol) params.append('symbol', symbol);

    const res = await fetch(`${API_BASE_URL}/api/portfolios?${params}`);
    const data = await res.json();
    return data.success ? data.data : null;
  },

  // Stats
  async getStats(): Promise<Stats | null> {
    const res = await fetch(`${API_BASE_URL}/api/stats`);
    const data = await res.json();
    return data.success ? data.data : null;
  },
};

/**
 * WebSocket Client
 */
export class WebSocketClient {
  private socket: any;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(url: string = API_BASE_URL.replace('http', 'ws')) {
    this.socket = null;
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
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
      }).catch(reject);
    });
  }

  subscribe(strategyId?: string, symbol?: string): void {
    if (strategyId) {
      this.socket.emit('subscribe:strategy', strategyId);
    }
    if (symbol) {
      this.socket.emit('subscribe:symbol', symbol);
    }
  }

  unsubscribe(room: string): void {
    this.socket.emit('unsubscribe', room);
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
