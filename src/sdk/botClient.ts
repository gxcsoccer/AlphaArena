/**
 * AlphaArena Bot API Client SDK
 *
 * JavaScript/TypeScript SDK for the Trading Bot External API
 */


// Types
export type StrategyType = 'SMA' | 'RSI' | 'MACD' | 'Bollinger' | 'Stochastic' | 'ATR';
export type BotStatus = 'stopped' | 'running' | 'paused' | 'error';
export type TradingMode = 'paper' | 'live';
export type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type ApiKeyPermission = 'read' | 'trade' | 'admin';

export interface TradingPair {
  base: string;
  quote: string;
  symbol: string;
}

export interface RiskSettings {
  maxCapitalPerTrade?: number;
  usePercentageCapital?: boolean;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  maxPositionSize?: number;
  maxOrdersPerMinute?: number;
  maxDailyLoss?: number;
  riskControlEnabled?: boolean;
}

export interface StrategyParams {
  // SMA parameters
  shortPeriod?: number;
  longPeriod?: number;
  // RSI parameters
  rsiPeriod?: number;
  rsiOverbought?: number;
  rsiOversold?: number;
  // MACD parameters
  macdFastPeriod?: number;
  macdSlowPeriod?: number;
  macdSignalPeriod?: number;
  // Bollinger Bands parameters
  bollingerPeriod?: number;
  bollingerStdDev?: number;
  // Stochastic parameters
  stochasticK?: number;
  stochasticD?: number;
  stochasticOverbought?: number;
  stochasticOversold?: number;
  // ATR parameters
  atrPeriod?: number;
  atrMultiplier?: number;
}

export interface BotConfig {
  id: string;
  name: string;
  description?: string;
  strategy: StrategyType;
  strategyParams: StrategyParams;
  tradingPair: TradingPair;
  interval: TimeInterval;
  mode: TradingMode;
  riskSettings: RiskSettings;
  initialCapital: number;
  createdAt: Date;
  updatedAt: Date;
  enabled: boolean;
}

export interface BotState {
  botId: string;
  status: BotStatus;
  portfolioValue: number;
  initialCapital: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  positionQuantity: number;
  positionAveragePrice: number;
  lastSignalTime?: Date;
  lastTradeTime?: Date;
  lastError?: string;
  startedAt?: Date;
  totalRuntimeMs: number;
}

export interface CreateBotRequest {
  name: string;
  description?: string;
  strategy: StrategyType;
  strategyParams?: Partial<StrategyParams>;
  tradingPair: TradingPair;
  interval?: TimeInterval;
  mode?: TradingMode;
  riskSettings?: Partial<RiskSettings>;
  initialCapital: number;
}

export interface UpdateBotRequest {
  name?: string;
  description?: string;
  strategyParams?: Partial<StrategyParams>;
  riskSettings?: Partial<RiskSettings>;
  enabled?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export interface RateLimitInfo {
  limitMinute: number;
  remainingMinute: number;
  limitDay: number;
  remainingDay: number;
  resetAtMinute: Date;
  resetAtDay: Date;
}

export interface BotClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

/**
 * AlphaArena Bot API Client
 */
export class BotClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private lastRateLimit?: RateLimitInfo;

  constructor(config: BotClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
  }

  /**
   * Make an API request
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      // Update rate limit info
      this.lastRateLimit = {
        limitMinute: parseInt(response.headers.get('X-RateLimit-Limit-Minute') || '0'),
        remainingMinute: parseInt(response.headers.get('X-RateLimit-Remaining-Minute') || '0'),
        limitDay: parseInt(response.headers.get('X-RateLimit-Limit-Day') || '0'),
        remainingDay: parseInt(response.headers.get('X-RateLimit-Remaining-Day') || '0'),
        resetAtMinute: new Date(response.headers.get('X-RateLimit-Reset-Minute') || ''),
        resetAtDay: new Date(response.headers.get('X-RateLimit-Reset-Day') || ''),
      };

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          code: data.code,
        };
      }

      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
          code: 'TIMEOUT',
        };
      }
      return {
        success: false,
        error: error.message,
        code: 'NETWORK_ERROR',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get current rate limit info
   */
  getRateLimitInfo(): RateLimitInfo | undefined {
    return this.lastRateLimit;
  }

  // ==================== Bot Management ====================

  /**
   * List all bots
   */
  async listBots(): Promise<ApiResponse<BotConfig[]>> {
    const response = await this.request<{ data: BotConfig[]; count: number }>('GET', '/bot');
    return {
      success: response.success,
      data: response.data?.data,
      error: response.error,
    };
  }

  /**
   * Create a new bot
   */
  async createBot(request: CreateBotRequest): Promise<ApiResponse<BotConfig>> {
    return this.request<BotConfig>('POST', '/bot', request);
  }

  /**
   * Get bot details
   */
  async getBot(id: string): Promise<ApiResponse<{ config: BotConfig; state: BotState }>> {
    return this.request<{ config: BotConfig; state: BotState }>('GET', `/bot/${id}`);
  }

  /**
   * Update bot configuration
   */
  async updateBot(id: string, request: UpdateBotRequest): Promise<ApiResponse<BotConfig>> {
    return this.request<BotConfig>('PUT', `/bot/${id}`, request);
  }

  /**
   * Delete a bot
   */
  async deleteBot(id: string): Promise<ApiResponse<void>> {
    return this.request<void>('DELETE', `/bot/${id}`);
  }

  // ==================== Bot Control ====================

  /**
   * Start a bot
   */
  async startBot(id: string): Promise<ApiResponse<void>> {
    return this.request<void>('POST', `/bot/${id}/start`);
  }

  /**
   * Stop a bot
   */
  async stopBot(id: string): Promise<ApiResponse<void>> {
    return this.request<void>('POST', `/bot/${id}/stop`);
  }

  /**
   * Pause a bot
   */
  async pauseBot(id: string): Promise<ApiResponse<void>> {
    return this.request<void>('POST', `/bot/${id}/pause`);
  }

  /**
   * Resume a bot
   */
  async resumeBot(id: string): Promise<ApiResponse<void>> {
    return this.request<void>('POST', `/bot/${id}/resume`);
  }

  /**
   * Get bot state
   */
  async getBotState(id: string): Promise<ApiResponse<BotState>> {
    return this.request<BotState>('GET', `/bot/${id}/state`);
  }

  /**
   * List running bots
   */
  async listRunningBots(): Promise<ApiResponse<string[]>> {
    const response = await this.request<{ data: string[]; count: number }>('GET', '/bot/running/list');
    return {
      success: response.success,
      data: response.data?.data,
      error: response.error,
    };
  }

  /**
   * Start all bots (requires admin permission)
   */
  async startAllBots(): Promise<ApiResponse<void>> {
    return this.request<void>('POST', '/bot/start-all');
  }

  /**
   * Stop all bots (requires admin permission)
   */
  async stopAllBots(): Promise<ApiResponse<void>> {
    return this.request<void>('POST', '/bot/stop-all');
  }
}

export default BotClient;
