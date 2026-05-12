/**
 * AlphaArena Public API SDK
 * 
 * TypeScript/JavaScript SDK for the AlphaArena Public API
 * 
 * Installation:
 *   npm install axios
 * 
 * Usage:
 *   import { AlphaArenaClient } from './alphaarena-sdk';
 *   
 *   const client = new AlphaArenaClient({
 *     apiKey: 'aa_live_xxxxx',
 *     baseUrl: 'https://plnylmnckssnfpwznpwf.supabase.co/functions/v1'
 *   });
 *   
 *   // Get account info
 *   const account = await client.account.getInfo();
 *   
 *   // Run a backtest
 *   const result = await client.backtest.run({
 *     symbol: 'BTC/USDT',
 *     strategy: 'sma',
 *     capital: 10000,
 *     startTime: '2024-01-01T00:00:00Z',
 *     endTime: '2024-12-31T23:59:59Z'
 *   });
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// ============================================
// Types
// ============================================

export interface ClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  code?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

// Strategy Types
export interface Strategy {
  id: string;
  name: string;
  description?: string;
  symbol: string;
  status: 'active' | 'paused' | 'stopped';
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStrategyParams {
  name: string;
  symbol: string;
  description?: string;
  config?: Record<string, unknown>;
}

// Backtest Types
export interface BacktestConfig {
  symbol: string;
  strategy: 'sma' | 'rsi' | 'macd' | 'bollinger' | 'atr';
  capital: number;
  startTime: string;
  endTime: string;
  params?: Record<string, unknown>;
}

export interface BacktestResult {
  stats: {
    totalReturn: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
  };
  trades: Array<{
    timestamp: string;
    side: 'buy' | 'sell';
    price: number;
    quantity: number;
    pnl?: number;
  }>;
  equity: Array<{
    timestamp: string;
    value: number;
  }>;
}

export interface BacktestStrategy {
  id: string;
  name: string;
  description: string;
}

export interface BacktestSymbol {
  id: string;
  name: string;
  category: string;
}

// Account Types
export interface VirtualAccount {
  id: string;
  user_id: string;
  balance: number;
  initial_capital: number;
  frozen_balance: number;
  total_realized_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  account_currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VirtualPosition {
  id: string;
  account_id: string;
  symbol: string;
  quantity: number;
  available_quantity: number;
  frozen_quantity: number;
  average_cost: number;
  total_cost: number;
  current_price: number | null;
  market_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
}

export interface VirtualOrder {
  id: string;
  account_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: 'market' | 'limit' | 'stop_market' | 'stop_limit';
  quantity: number;
  filled_quantity: number;
  remaining_quantity: number;
  price: number | null;
  stop_price: number | null;
  average_fill_price: number | null;
  status: 'pending' | 'open' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'expired';
  time_in_force: 'GTC' | 'IOC' | 'FOK' | 'GTD';
  created_at: string;
  updated_at: string;
}

export interface CreateOrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  order_type: 'market' | 'limit' | 'stop_market' | 'stop_limit';
  quantity: number;
  price?: number;
  stop_price?: number;
  time_in_force?: 'GTC' | 'IOC' | 'FOK' | 'GTD';
  expires_at?: string;
}

export interface Trade {
  id: string;
  strategyId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  fee: number;
  timestamp: string;
}

// Leaderboard Types
export interface LeaderboardEntry {
  rank: number;
  strategyId: string;
  strategyName: string;
  totalReturn: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  tradeCount: number;
}

// ============================================
// Error Classes
// ============================================

export class AlphaArenaError extends Error {
  public code?: string;
  public statusCode?: number;

  constructor(message: string, code?: string, statusCode?: number) {
    super(message);
    this.name = 'AlphaArenaError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class AuthenticationError extends AlphaArenaError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends AlphaArenaError {
  public retryAfter?: Date;

  constructor(message: string, retryAfter?: string) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
    if (retryAfter) {
      this.retryAfter = new Date(retryAfter);
    }
  }
}

// ============================================
// Client Class
// ============================================

export class AlphaArenaClient {
  private client: AxiosInstance;
  private apiKey: string;

  public strategies: StrategyAPI;
  public backtest: BacktestAPI;
  public account: AccountAPI;
  public leaderboard: LeaderboardAPI;

  constructor(config: ClientConfig) {
    this.apiKey = config.apiKey;
    
    const axiosConfig: AxiosRequestConfig = {
      baseURL: config.baseUrl || 'https://plnylmnckssnfpwznpwf.supabase.co/functions/v1',
      timeout: config.timeout || 30000,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    };

    this.client = axios.create(axiosConfig);

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status, data } = error.response;
          
          if (status === 401) {
            throw new AuthenticationError(data.error || 'Invalid API key');
          }
          
          if (status === 429) {
            throw new RateLimitError(
              data.error || 'Rate limit exceeded',
              error.response.headers['x-ratelimit-reset-minute']
            );
          }
          
          throw new AlphaArenaError(
            data.error || 'API request failed',
            data.code,
            status
          );
        }
        
        throw new AlphaArenaError(error.message || 'Network error');
      }
    );

    // Initialize API modules
    this.strategies = new StrategyAPI(this.client);
    this.backtest = new BacktestAPI(this.client);
    this.account = new AccountAPI(this.client);
    this.leaderboard = new LeaderboardAPI(this.client);
  }

  /**
   * Get API information
   */
  async getInfo(): Promise<ApiResponse<{
    version: string;
    endpoints: Record<string, string>;
    rateLimits: { remaining: number; resetAt: string };
  }>> {
    const response = await this.client.get('/public/v1');
    return response.data;
  }

  /**
   * Check API health
   */
  async healthCheck(): Promise<{ status: string; timestamp: number }> {
    const response = await this.client.get('/health');
    return response.data;
  }
}

// ============================================
// Strategy API
// ============================================

class StrategyAPI {
  constructor(private client: AxiosInstance) {}

  /**
   * List all strategies
   */
  async list(params?: PaginationParams & { status?: 'active' | 'paused' | 'stopped' }): Promise<PaginatedResponse<Strategy>> {
    const response = await this.client.get('/public/v1/strategies', { params });
    return response.data;
  }

  /**
   * Get a specific strategy
   */
  async get(id: string): Promise<ApiResponse<Strategy>> {
    const response = await this.client.get(`/public/v1/strategies/${id}`);
    return response.data;
  }

  /**
   * Create a new strategy
   */
  async create(params: CreateStrategyParams): Promise<ApiResponse<Strategy>> {
    const response = await this.client.post('/public/v1/strategies', params);
    return response.data;
  }

  /**
   * Update strategy status
   */
  async updateStatus(id: string, status: 'active' | 'paused' | 'stopped'): Promise<ApiResponse<Strategy>> {
    const response = await this.client.put(`/public/v1/strategies/${id}/status`, { status });
    return response.data;
  }
}

// ============================================
// Backtest API
// ============================================

class BacktestAPI {
  constructor(private client: AxiosInstance) {}

  /**
   * Run a backtest
   */
  async run(config: BacktestConfig): Promise<ApiResponse<BacktestResult>> {
    const response = await this.client.post('/public/v1/backtest/run', config);
    return response.data;
  }

  /**
   * List available strategies
   */
  async listStrategies(): Promise<ApiResponse<BacktestStrategy[]>> {
    const response = await this.client.get('/public/v1/backtest/strategies');
    return response.data;
  }

  /**
   * List available symbols
   */
  async listSymbols(): Promise<ApiResponse<BacktestSymbol[]>> {
    const response = await this.client.get('/public/v1/backtest/symbols');
    return response.data;
  }
}

// ============================================
// Account API
// ============================================

class AccountAPI {
  constructor(private client: AxiosInstance) {}

  /**
   * Get account information
   */
  async getInfo(): Promise<ApiResponse<VirtualAccount>> {
    const response = await this.client.get('/public/v1/account');
    return response.data;
  }

  /**
   * List positions
   */
  async listPositions(): Promise<ApiResponse<VirtualPosition[]>> {
    const response = await this.client.get('/public/v1/account/positions');
    return response.data;
  }

  /**
   * List orders
   */
  async listOrders(params?: {
    status?: VirtualOrder['status'];
    symbol?: string;
    limit?: number;
  }): Promise<ApiResponse<VirtualOrder[]>> {
    const response = await this.client.get('/public/v1/account/orders', { params });
    return response.data;
  }

  /**
   * Create an order
   */
  async createOrder(params: CreateOrderParams): Promise<ApiResponse<VirtualOrder>> {
    const response = await this.client.post('/public/v1/account/orders', params);
    return response.data;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<ApiResponse<VirtualOrder>> {
    const response = await this.client.post(`/public/v1/account/orders/${orderId}/cancel`);
    return response.data;
  }

  /**
   * List trade history
   */
  async listTrades(params?: {
    symbol?: string;
    side?: 'buy' | 'sell';
    limit?: number;
  }): Promise<ApiResponse<Trade[]>> {
    const response = await this.client.get('/public/v1/account/trades', { params });
    return response.data;
  }
}

// ============================================
// Leaderboard API
// ============================================

class LeaderboardAPI {
  constructor(private client: AxiosInstance) {}

  /**
   * Get leaderboard
   */
  async get(params?: {
    sortBy?: 'roi' | 'winRate' | 'profitFactor' | 'sharpeRatio';
    limit?: number;
  }): Promise<ApiResponse<LeaderboardEntry[]>> {
    const response = await this.client.get('/public/v1/leaderboard', { params });
    return response.data;
  }
}

export default AlphaArenaClient;