/**
 * Bot Manager - 机器人生命周期管理
 *
 * Manages the lifecycle of trading bots:
 * - Create, start, stop, delete bots
 * - Manage bot configurations
 * - Coordinate multiple bot instances
 * - Handle bot state persistence
 */

import { EventEmitter } from 'events';
import {
  BotConfig,
  BotState,
  CreateBotRequest,
  UpdateBotRequest,
  BotStatus,
  TradingMode,
  DEFAULT_RISK_SETTINGS,
  DEFAULT_STRATEGY_PARAMS,
  generateBotId,
} from './BotConfig';
import { BotStorage } from './BotStorage';
import { BotExecutor } from './BotExecutor';
import { IStrategy } from '../strategy/Strategy';
import { SMAStrategy } from '../strategy/SMAStrategy';
import { RSIStrategy } from '../strategy/RSIStrategy';
import { MACDStrategy } from '../strategy/MACDStrategy';
import { BollingerBandsStrategy } from '../strategy/BollingerBandsStrategy';
import { StochasticStrategy } from '../strategy/StochasticStrategy';
import { ATRStrategy } from '../strategy/ATRStrategy';
import { OrderBook } from '../orderbook/OrderBook';

/**
 * Bot Manager event types
 */
export type BotManagerEventType =
  | 'bot:created'
  | 'bot:updated'
  | 'bot:started'
  | 'bot:stopped'
  | 'bot:paused'
  | 'bot:resumed'
  | 'bot:deleted'
  | 'bot:error';

/**
 * Bot Manager event
 */
export interface BotManagerEvent {
  type: BotManagerEventType;
  botId: string;
  timestamp: Date;
  data?: unknown;
}

/**
 * Bot instance tracking
 */
interface BotInstance {
  config: BotConfig;
  executor: BotExecutor;
  strategy: IStrategy;
  orderBook: OrderBook;
}

/**
 * Bot Manager
 */
export class BotManager extends EventEmitter {
  private storage: BotStorage;
  private bots: Map<string, BotInstance> = new Map();
  private running: boolean = false;

  constructor() {
    super();
    this.storage = new BotStorage();
  }

  /**
   * Initialize bot manager and load existing bots
   */
  async initialize(): Promise<void> {
    try {
      const configs = await this.storage.getEnabledBots();
      
      for (const config of configs) {
        try {
          await this.createBotInstance(config);
        } catch (error) {
          console.error(`Failed to initialize bot ${config.id}:`, error);
        }
      }

      this.running = true;
      this.emit('initialized', { botCount: this.bots.size });
    } catch (error) {
      console.error('Failed to initialize bot manager:', error);
      throw error;
    }
  }

  /**
   * Create a new bot
   */
  async createBot(request: CreateBotRequest): Promise<BotConfig> {
    const id = generateBotId();
    const now = new Date();

    const strategyParams = {
      ...DEFAULT_STRATEGY_PARAMS[request.strategy],
      ...request.strategyParams,
    };

    const riskSettings = {
      ...DEFAULT_RISK_SETTINGS,
      ...request.riskSettings,
    };

    const config: BotConfig = {
      id,
      name: request.name,
      description: request.description,
      strategy: request.strategy,
      strategyParams,
      tradingPair: request.tradingPair,
      interval: request.interval,
      mode: request.mode || TradingMode.PAPER,
      riskSettings,
      initialCapital: request.initialCapital,
      createdAt: now,
      updatedAt: now,
      enabled: true,
    };

    // Save to database
    await this.storage.createBot(config);

    // Create bot instance
    await this.createBotInstance(config);

    this.emitEvent('bot:created', config.id, { config });

    return config;
  }

  /**
   * Get bot configuration
   */
  async getBot(id: string): Promise<BotConfig | null> {
    return this.storage.getBot(id);
  }

  /**
   * Get all bots
   */
  async getAllBots(): Promise<BotConfig[]> {
    return this.storage.getAllBots();
  }

  /**
   * Get bot state
   */
  async getBotState(id: string): Promise<BotState | null> {
    const instance = this.bots.get(id);
    if (instance) {
      return instance.executor.getState();
    }
    return this.storage.getState(id);
  }

  /**
   * Update bot configuration
   */
  async updateBot(id: string, request: UpdateBotRequest): Promise<BotConfig> {
    const instance = this.bots.get(id);
    if (!instance) {
      throw new Error(`Bot not found: ${id}`);
    }

    // Build update object
    const updates: Partial<BotConfig> = {
      updatedAt: new Date(),
    };

    if (request.name !== undefined) updates.name = request.name;
    if (request.description !== undefined) updates.description = request.description;
    if (request.enabled !== undefined) updates.enabled = request.enabled;

    // Merge risk settings if provided
    if (request.riskSettings !== undefined) {
      updates.riskSettings = {
        ...instance.config.riskSettings,
        ...request.riskSettings,
      };
    }

    // Merge strategy params if provided
    if (request.strategyParams !== undefined) {
      updates.strategyParams = {
        ...instance.config.strategyParams,
        ...request.strategyParams,
      };
    }

    const updatedConfig = await this.storage.updateBot(id, updates);
    instance.config = updatedConfig;

    await instance.executor.updateConfig(updates);

    this.emitEvent('bot:updated', id, { config: updatedConfig });

    return updatedConfig;
  }

  /**
   * Delete a bot
   */
  async deleteBot(id: string): Promise<void> {
    const instance = this.bots.get(id);
    if (!instance) {
      throw new Error(`Bot not found: ${id}`);
    }

    // Stop the bot first
    if (instance.executor.getState().status === BotStatus.RUNNING) {
      await instance.executor.stop();
    }

    // Delete from database
    await this.storage.deleteBot(id);

    // Remove from memory
    this.bots.delete(id);

    this.emitEvent('bot:deleted', id);
  }

  /**
   * Start a bot
   */
  async startBot(id: string): Promise<void> {
    const instance = this.bots.get(id);
    if (!instance) {
      throw new Error(`Bot not found: ${id}`);
    }

    await instance.executor.start();

    this.emitEvent('bot:started', id);
  }

  /**
   * Stop a bot
   */
  async stopBot(id: string): Promise<void> {
    const instance = this.bots.get(id);
    if (!instance) {
      throw new Error(`Bot not found: ${id}`);
    }

    await instance.executor.stop();

    this.emitEvent('bot:stopped', id);
  }

  /**
   * Pause a bot
   */
  async pauseBot(id: string): Promise<void> {
    const instance = this.bots.get(id);
    if (!instance) {
      throw new Error(`Bot not found: ${id}`);
    }

    await instance.executor.pause();

    this.emitEvent('bot:paused', id);
  }

  /**
   * Resume a bot
   */
  async resumeBot(id: string): Promise<void> {
    const instance = this.bots.get(id);
    if (!instance) {
      throw new Error(`Bot not found: ${id}`);
    }

    await instance.executor.resume();

    this.emitEvent('bot:resumed', id);
  }

  /**
   * Start all bots
   */
  async startAllBots(): Promise<void> {
    const botIds = Array.from(this.bots.keys());
    for (const id of botIds) {
      try {
        await this.startBot(id);
      } catch (error) {
        console.error(`Failed to start bot ${id}:`, error);
      }
    }
  }

  /**
   * Stop all bots
   */
  async stopAllBots(): Promise<void> {
    const botIds = Array.from(this.bots.keys());
    for (const id of botIds) {
      try {
        await this.stopBot(id);
      } catch (error) {
        console.error(`Failed to stop bot ${id}:`, error);
      }
    }
  }

  /**
   * Get running bots
   */
  getRunningBots(): string[] {
    const running: string[] = [];
    this.bots.forEach((instance, id) => {
      if (instance.executor.getState().status === BotStatus.RUNNING) {
        running.push(id);
      }
    });
    return running;
  }

  /**
   * Process market tick for a specific bot
   */
  async processTick(id: string, price: number, bid: number, ask: number): Promise<void> {
    const instance = this.bots.get(id);
    if (!instance) {
      throw new Error(`Bot not found: ${id}`);
    }

    await instance.executor.processTick(price, bid, ask);
  }

  /**
   * Process market tick for all running bots
   */
  async processTickAll(price: number, bid: number, ask: number, symbol?: string): Promise<void> {
    const entries = Array.from(this.bots.entries());
    for (const [id, instance] of entries) {
      // Filter by symbol if provided
      if (symbol && instance.config.tradingPair.symbol !== symbol) {
        continue;
      }

      if (instance.executor.getState().status === BotStatus.RUNNING) {
        try {
          await instance.executor.processTick(price, bid, ask);
        } catch (error) {
          console.error(`Failed to process tick for bot ${id}:`, error);
        }
      }
    }
  }

  /**
   * Shutdown bot manager
   */
  async shutdown(): Promise<void> {
    this.running = false;
    await this.stopAllBots();
    this.bots.clear();
    this.emit('shutdown');
  }

  /**
   * Create bot instance
   */
  private async createBotInstance(config: BotConfig): Promise<void> {
    // Create strategy
    const strategy = this.createStrategy(config);

    // Create order book
    const orderBook = new OrderBook();

    // Create executor
    const executor = new BotExecutor(config, strategy, orderBook, this.storage);

    // Setup event listeners
    this.setupExecutorListeners(executor, config.id);

    // Store instance
    this.bots.set(config.id, {
      config,
      executor,
      strategy,
      orderBook,
    });

    // Load existing state if available
    const existingState = await this.storage.getState(config.id);
    if (existingState) {
      // State is loaded automatically by executor through storage
    }
  }

  /**
   * Create strategy instance based on type
   */
  private createStrategy(config: BotConfig): IStrategy {
    const params = config.strategyParams;

    switch (config.strategy) {
      case 'SMA':
        return new SMAStrategy({
          id: config.id,
          name: config.name,
          params: {
            shortPeriod: params.shortPeriod ?? 10,
            longPeriod: params.longPeriod ?? 20,
          },
        });
      case 'RSI':
        return new RSIStrategy({
          id: config.id,
          name: config.name,
          params: {
            period: params.rsiPeriod ?? 14,
            overbought: params.rsiOverbought ?? 70,
            oversold: params.rsiOversold ?? 30,
          },
        });
      case 'MACD':
        return new MACDStrategy({
          id: config.id,
          name: config.name,
          params: {
            fastPeriod: params.macdFastPeriod ?? 12,
            slowPeriod: params.macdSlowPeriod ?? 26,
            signalPeriod: params.macdSignalPeriod ?? 9,
          },
        });
      case 'Bollinger':
        return new BollingerBandsStrategy({
          id: config.id,
          name: config.name,
          params: {
            period: params.bollingerPeriod ?? 20,
            stdDevMultiplier: params.bollingerStdDev ?? 2,
          },
        });
      case 'Stochastic':
        return new StochasticStrategy({
          id: config.id,
          name: config.name,
          params: {
            kPeriod: params.stochasticK ?? 14,
            dPeriod: params.stochasticD ?? 3,
            overbought: params.stochasticOverbought ?? 80,
            oversold: params.stochasticOversold ?? 20,
          },
        });
      case 'ATR':
        return new ATRStrategy({
          id: config.id,
          name: config.name,
          params: {
            period: params.atrPeriod ?? 14,
            atrMultiplier: params.atrMultiplier ?? 2,
          },
        });
      default:
        throw new Error(`Unknown strategy type: ${config.strategy}`);
    }
  }

  /**
   * Setup executor event listeners
   */
  private setupExecutorListeners(executor: BotExecutor, botId: string): void {
    executor.on('error', (event) => {
      this.emitEvent('bot:error', botId, event);
    });

    executor.on('emergency_stop', (event) => {
      this.emitEvent('bot:error', botId, event);
    });
  }

  /**
   * Emit bot manager event
   */
  private emitEvent(type: BotManagerEventType, botId: string, data?: unknown): void {
    const event: BotManagerEvent = {
      type,
      botId,
      timestamp: new Date(),
      data,
    };

    this.emit(type, event);
  }
}
