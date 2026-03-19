/**
 * Strategy Manager - 多策略管理器
 *
 * Manages multiple trading strategy instances with:
 * - Dynamic loading/unloading of strategies
 * - Strategy isolation (independent Portfolio, OrderBook)
 * - Strategy configuration management
 * - Strategy lifecycle management
 * - Optional inter-strategy communication
 * - Database persistence for strategy configurations
 */

import { EventEmitter } from 'events';
import { IStrategy } from './Strategy';
import { StrategyConfig, StrategyContext, OrderSignal, MarketData } from './types';
import { Portfolio } from '../portfolio/Portfolio';
import { OrderBook } from '../orderbook/OrderBook';
import { StrategiesDAO } from '../database/strategies.dao';
import { Trade } from '../matching/types';

/**
 * Strategy instance wrapper - 策略实例包装器
 *
 * Contains all isolated components for a single strategy
 */
export interface StrategyInstance {
  /** Strategy ID */
  id: string;
  /** Strategy instance */
  strategy: IStrategy;
  /** Isolated portfolio for this strategy */
  portfolio: Portfolio;
  /** Isolated order book view for this strategy */
  orderBook: OrderBook;
  /** Strategy context */
  context: StrategyContext;
  /** Is this strategy currently running? */
  isRunning: boolean;
  /** Last tick timestamp */
  lastTick?: number;
  /** Total signals generated */
  totalSignals: number;
  /** Total trades executed */
  totalTrades: number;
}

/**
 * Strategy Manager configuration - 策略管理器配置
 */
export interface StrategyManagerConfig {
  /** Enable inter-strategy communication */
  enableCommunication?: boolean;
  /** Enable database persistence */
  enablePersistence?: boolean;
  /** Initial cash for each strategy */
  initialCash?: number;
  /** Enable logging */
  enableLogging?: boolean;
}

/**
 * Strategy event types - 策略事件类型
 */
export type StrategyEventType =
  | 'strategy:added'
  | 'strategy:removed'
  | 'strategy:started'
  | 'strategy:stopped'
  | 'strategy:paused'
  | 'strategy:resumed'
  | 'strategy:signal'
  | 'strategy:trade'
  | 'strategy:error'
  | 'strategy:config-updated';

/**
 * Strategy event - 策略事件
 */
export interface StrategyEvent {
  type: StrategyEventType;
  timestamp: number;
  data?: any;
}

/**
 * Strategy status - 策略状态
 */
export interface StrategyStatus {
  id: string;
  name: string;
  isRunning: boolean;
  lastTick?: number;
  totalSignals: number;
  totalTrades: number;
  portfolioValue: number;
  cash: number;
}

/**
 * Message for inter-strategy communication - 策略间通信消息
 */
export interface StrategyMessage {
  /** Sender strategy ID */
  from: string;
  /** Recipient strategy ID (or '*' for broadcast) */
  to: string;
  /** Message type */
  type: string;
  /** Message payload */
  payload: any;
  /** Message timestamp */
  timestamp: number;
}

/**
 * Strategy Manager - 多策略管理器
 *
 * Manages multiple trading strategy instances with isolation and coordination
 */
export class StrategyManager extends EventEmitter {
  private config: StrategyManagerConfig;
  private strategies: Map<string, StrategyInstance> = new Map();
  private messageQueue: StrategyMessage[] = [];
  private strategiesDAO?: StrategiesDAO;
  private globalOrderBook?: OrderBook;
  private globalMarketData?: MarketData;

  constructor(
    config: StrategyManagerConfig = {},
    globalOrderBook?: OrderBook,
    globalMarketData?: MarketData
  ) {
    super();
    this.config = {
      enableCommunication: config.enableCommunication ?? false,
      enablePersistence: config.enablePersistence ?? false,
      initialCash: config.initialCash ?? 100000,
      enableLogging: config.enableLogging ?? false,
    };
    this.globalOrderBook = globalOrderBook;
    this.globalMarketData = globalMarketData;

    if (this.config.enablePersistence) {
      this.strategiesDAO = new StrategiesDAO();
    }
  }

  /**
   * Register a strategy class factory - 注册策略类工厂
   *
   * @param config - Strategy configuration
   * @param factory - Factory function that creates strategy instance
   * @returns Strategy ID
   */
  async registerStrategy(
    config: StrategyConfig,
    factory: (config: StrategyConfig) => IStrategy
  ): Promise<string> {
    const strategyId = config.id;

    if (this.strategies.has(strategyId)) {
      throw new Error(`Strategy with ID '${strategyId}' already exists`);
    }

    // Create strategy instance
    const strategy = factory(config);

    // Create isolated components
    const portfolio = new Portfolio(this.config.initialCash!);
    const orderBook = new OrderBook();

    // Create strategy context
    const context = this.createStrategyContext(strategyId, portfolio, orderBook);

    // Create strategy instance wrapper
    const instance: StrategyInstance = {
      id: strategyId,
      strategy,
      portfolio,
      orderBook,
      context,
      isRunning: false,
      totalSignals: 0,
      totalTrades: 0,
    };

    // Initialize strategy
    strategy.onInit(context);

    // Save to database if persistence is enabled
    if (this.config.enablePersistence && this.strategiesDAO) {
      try {
        await this.strategiesDAO.create(
          config.name,
          'UNKNOWN', // Symbol will be updated later
          config.params?.description,
          config.params as any
        );
      } catch (error) {
        this.emitEvent('strategy:error', {
          strategy: strategyId,
          error: error instanceof Error ? error.message : String(error),
          action: 'persistence',
        });
      }
    }

    // Store instance
    this.strategies.set(strategyId, instance);

    this.emitEvent('strategy:added', { strategy: strategyId, config });

    if (this.config.enableLogging) {
      console.log(`[StrategyManager] Registered strategy: ${strategyId} (${config.name})`);
    }

    return strategyId;
  }

  /**
   * Load strategies from database - 从数据库加载策略
   *
   * @param strategyFactoryMap - Map of strategy type to factory function
   * @returns Number of strategies loaded
   */
  async loadFromDatabase(
    strategyFactoryMap: Map<string, (config: StrategyConfig) => IStrategy>
  ): Promise<number> {
    if (!this.strategiesDAO) {
      throw new Error('Persistence is not enabled');
    }

    const dbStrategies = await this.strategiesDAO.getActive();
    let loadedCount = 0;

    for (const dbStrategy of dbStrategies) {
      const factory = strategyFactoryMap.get(dbStrategy.name);
      if (!factory) {
        if (this.config.enableLogging) {
          console.log(`[StrategyManager] No factory found for strategy: ${dbStrategy.name}`);
        }
        continue;
      }

      const config: StrategyConfig = {
        id: dbStrategy.id,
        name: dbStrategy.name,
        params: dbStrategy.config as any,
      };

      try {
        await this.registerStrategy(config, factory);
        loadedCount++;
      } catch (error) {
        console.error(`[StrategyManager] Failed to load strategy ${dbStrategy.id}:`, error);
      }
    }

    if (this.config.enableLogging) {
      console.log(`[StrategyManager] Loaded ${loadedCount} strategies from database`);
    }

    return loadedCount;
  }

  /**
   * Unregister a strategy - 注销策略
   *
   * @param strategyId - Strategy ID
   * @returns true if strategy was removed
   */
  async unregisterStrategy(strategyId: string): Promise<boolean> {
    const instance = this.strategies.get(strategyId);
    if (!instance) {
      return false;
    }

    // Stop strategy if running
    if (instance.isRunning) {
      await this.stopStrategy(strategyId);
    }

    // Cleanup strategy
    instance.strategy.onCleanup(instance.context);

    // Remove from database if persistence is enabled
    if (this.config.enablePersistence && this.strategiesDAO) {
      try {
        await this.strategiesDAO.delete(strategyId);
      } catch (error) {
        this.emitEvent('strategy:error', {
          strategy: strategyId,
          error: error instanceof Error ? error.message : String(error),
          action: 'persistence',
        });
      }
    }

    // Remove from map
    this.strategies.delete(strategyId);

    this.emitEvent('strategy:removed', { strategy: strategyId });

    if (this.config.enableLogging) {
      console.log(`[StrategyManager] Unregistered strategy: ${strategyId}`);
    }

    return true;
  }

  /**
   * Start a strategy - 启动策略
   *
   * @param strategyId - Strategy ID
   */
  async startStrategy(strategyId: string): Promise<void> {
    const instance = this.strategies.get(strategyId);
    if (!instance) {
      throw new Error(`Strategy '${strategyId}' not found`);
    }

    if (instance.isRunning) {
      return;
    }

    instance.isRunning = true;
    this.emitEvent('strategy:started', { strategy: strategyId });

    if (this.config.enableLogging) {
      console.log(`[StrategyManager] Started strategy: ${strategyId}`);
    }

    // Update database status
    if (this.config.enablePersistence && this.strategiesDAO) {
      try {
        await this.strategiesDAO.updateStatus(strategyId, 'active');
      } catch (error) {
        this.emitEvent('strategy:error', {
          strategy: strategyId,
          error: error instanceof Error ? error.message : String(error),
          action: 'persistence',
        });
      }
    }
  }

  /**
   * Stop a strategy - 停止策略
   *
   * @param strategyId - Strategy ID
   */
  async stopStrategy(strategyId: string): Promise<void> {
    const instance = this.strategies.get(strategyId);
    if (!instance) {
      throw new Error(`Strategy '${strategyId}' not found`);
    }

    if (!instance.isRunning) {
      return;
    }

    instance.isRunning = false;
    this.emitEvent('strategy:stopped', { strategy: strategyId });

    if (this.config.enableLogging) {
      console.log(`[StrategyManager] Stopped strategy: ${strategyId}`);
    }

    // Update database status
    if (this.config.enablePersistence && this.strategiesDAO) {
      try {
        await this.strategiesDAO.updateStatus(strategyId, 'stopped');
      } catch (error) {
        this.emitEvent('strategy:error', {
          strategy: strategyId,
          error: error instanceof Error ? error.message : String(error),
          action: 'persistence',
        });
      }
    }
  }

  /**
   * Pause a strategy - 暂停策略
   *
   * @param strategyId - Strategy ID
   */
  async pauseStrategy(strategyId: string): Promise<void> {
    const instance = this.strategies.get(strategyId);
    if (!instance) {
      throw new Error(`Strategy '${strategyId}' not found`);
    }

    instance.isRunning = false;
    this.emitEvent('strategy:paused', { strategy: strategyId });

    if (this.config.enablePersistence && this.strategiesDAO) {
      try {
        await this.strategiesDAO.updateStatus(strategyId, 'paused');
      } catch (error) {
        this.emitEvent('strategy:error', {
          strategy: strategyId,
          error: error instanceof Error ? error.message : String(error),
          action: 'persistence',
        });
      }
    }
  }

  /**
   * Resume a strategy - 恢复策略
   *
   * @param strategyId - Strategy ID
   */
  async resumeStrategy(strategyId: string): Promise<void> {
    const instance = this.strategies.get(strategyId);
    if (!instance) {
      throw new Error(`Strategy '${strategyId}' not found`);
    }

    instance.isRunning = true;
    this.emitEvent('strategy:resumed', { strategy: strategyId });

    if (this.config.enablePersistence && this.strategiesDAO) {
      try {
        await this.strategiesDAO.updateStatus(strategyId, 'active');
      } catch (error) {
        this.emitEvent('strategy:error', {
          strategy: strategyId,
          error: error instanceof Error ? error.message : String(error),
          action: 'persistence',
        });
      }
    }
  }

  /**
   * Update strategy configuration - 更新策略配置
   *
   * @param strategyId - Strategy ID
   * @param config - New configuration
   */
  async updateStrategyConfig(strategyId: string, config: Partial<StrategyConfig>): Promise<void> {
    const instance = this.strategies.get(strategyId);
    if (!instance) {
      throw new Error(`Strategy '${strategyId}' not found`);
    }

    // Update config
    instance.strategy.getConfig().name = config.name ?? instance.strategy.getConfig().name;
    instance.strategy.getConfig().params = {
      ...instance.strategy.getConfig().params,
      ...config.params,
    };

    // Save to database
    if (this.config.enablePersistence && this.strategiesDAO) {
      try {
        await this.strategiesDAO.updateConfig(strategyId, config as any);
      } catch (error) {
        this.emitEvent('strategy:error', {
          strategy: strategyId,
          error: error instanceof Error ? error.message : String(error),
          action: 'persistence',
        });
      }
    }

    this.emitEvent('strategy:config-updated', { strategy: strategyId, config });

    if (this.config.enableLogging) {
      console.log(`[StrategyManager] Updated config for strategy: ${strategyId}`);
    }
  }

  /**
   * Execute tick for all running strategies - 执行所有运行中策略的 tick
   *
   * @param marketData - Current market data
   */
  async executeTick(marketData: MarketData): Promise<Map<string, OrderSignal | null>> {
    this.globalMarketData = marketData;
    const results = new Map<string, OrderSignal | null>();

    for (const [strategyId, instance] of this.strategies) {
      if (!instance.isRunning) {
        continue;
      }

      try {
        // Update context with latest market data
        this.updateStrategyContext(instance, marketData);

        // Execute strategy tick
        const signal = instance.strategy.onTick(instance.context);
        instance.lastTick = Date.now();

        if (signal) {
          instance.totalSignals++;
          this.emitEvent('strategy:signal', {
            strategy: strategyId,
            signal,
          });
        }

        results.set(strategyId, signal);
      } catch (error) {
        this.emitEvent('strategy:error', {
          strategy: strategyId,
          error: error instanceof Error ? error.message : String(error),
          action: 'tick',
        });

        if (this.config.enableLogging) {
          console.error(`[StrategyManager] Strategy ${strategyId} tick error:`, error);
        }
      }
    }

    // Process inter-strategy messages if enabled
    if (this.config.enableCommunication) {
      await this.processMessageQueue();
    }

    return results;
  }

  /**
   * Process a trade for a specific strategy - 处理特定策略的交易
   *
   * @param strategyId - Strategy ID
   * @param trade - Trade object
   * @param isBuyer - Whether the strategy was the buyer
   */
  processTrade(strategyId: string, trade: Trade, isBuyer: boolean): void {
    const instance = this.strategies.get(strategyId);
    if (!instance) {
      return;
    }

    // Update portfolio
    const portfolioOrderId = isBuyer ? trade.buyOrderId : trade.sellOrderId;
    instance.portfolio.onTrade(trade, portfolioOrderId);
    instance.totalTrades++;

    // Update order book
    this.updateOrderBookFromTrade(trade);

    this.emitEvent('strategy:trade', {
      strategy: strategyId,
      trade,
      isBuyer,
    });
  }

  /**
   * Send message to another strategy - 发送消息到另一个策略
   *
   * @param from - Sender strategy ID
   * @param to - Recipient strategy ID (or '*' for broadcast)
   * @param type - Message type
   * @param payload - Message payload
   */
  sendMessage(from: string, to: string, type: string, payload: any): void {
    if (!this.config.enableCommunication) {
      return;
    }

    const message: StrategyMessage = {
      from,
      to,
      type,
      payload,
      timestamp: Date.now(),
    };

    this.messageQueue.push(message);

    if (this.config.enableLogging) {
      console.log(
        `[StrategyManager] Message sent: ${from} -> ${to} (${type})`
      );
    }
  }

  /**
   * Get strategy status - 获取策略状态
   *
   * @param strategyId - Strategy ID
   * @returns Strategy status or undefined if not found
   */
  getStrategyStatus(strategyId: string): StrategyStatus | undefined {
    const instance = this.strategies.get(strategyId);
    if (!instance) {
      return undefined;
    }

    const marketPrices = this.globalMarketData
      ? this.extractMarketPrices(this.globalMarketData)
      : new Map<string, number>();

    return {
      id: strategyId,
      name: instance.strategy.getConfig().name,
      isRunning: instance.isRunning,
      lastTick: instance.lastTick,
      totalSignals: instance.totalSignals,
      totalTrades: instance.totalTrades,
      portfolioValue: instance.portfolio.getTotalValue(marketPrices),
      cash: instance.portfolio.getCash(),
    };
  }

  /**
   * Get all strategy statuses - 获取所有策略状态
   *
   * @returns Array of strategy statuses
   */
  getAllStrategyStatuses(): StrategyStatus[] {
    const statuses: StrategyStatus[] = [];
    for (const strategyId of this.strategies.keys()) {
      const status = this.getStrategyStatus(strategyId);
      if (status) {
        statuses.push(status);
      }
    }
    return statuses;
  }

  /**
   * Get strategy instance - 获取策略实例
   *
   * @param strategyId - Strategy ID
   * @returns Strategy instance or undefined
   */
  getStrategy(strategyId: string): IStrategy | undefined {
    return this.strategies.get(strategyId)?.strategy;
  }

  /**
   * Get strategy portfolio - 获取策略组合
   *
   * @param strategyId - Strategy ID
   * @returns Portfolio or undefined
   */
  getStrategyPortfolio(strategyId: string): Portfolio | undefined {
    return this.strategies.get(strategyId)?.portfolio;
  }

  /**
   * Get number of registered strategies - 获取注册策略数量
   *
   * @returns Number of strategies
   */
  getStrategyCount(): number {
    return this.strategies.size;
  }

  /**
   * Get all strategy IDs - 获取所有策略 ID
   *
   * @returns Array of strategy IDs
   */
  getStrategyIds(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Shutdown all strategies - 关闭所有策略
   */
  async shutdown(): Promise<void> {
    const strategyIds = Array.from(this.strategies.keys());
    for (const strategyId of strategyIds) {
      await this.stopStrategy(strategyId);
    }

    // Cleanup all strategies
    for (const instance of this.strategies.values()) {
      instance.strategy.onCleanup(instance.context);
    }

    this.strategies.clear();

    if (this.config.enableLogging) {
      console.log('[StrategyManager] All strategies shutdown');
    }
  }

  /**
   * Create strategy context - 创建策略上下文
   */
  private createStrategyContext(
    strategyId: string,
    portfolio: Portfolio,
    orderBook: OrderBook
  ): StrategyContext {
    return {
      portfolio: portfolio.getSnapshot(new Map()),
      clock: Date.now(),
      getMarketData: () => {
        // Return isolated order book view
        return {
          orderBook,
          trades: [],
          timestamp: Date.now(),
        };
      },
      getPosition: (symbol: string) => {
        const position = portfolio.getPosition(symbol);
        return position ? position.quantity : 0;
      },
      getCash: () => portfolio.getCash(),
    };
  }

  /**
   * Update strategy context with latest market data - 更新策略上下文
   */
  private updateStrategyContext(instance: StrategyInstance, marketData: MarketData): void {
    // Update context market data getter
    (instance.context as any).getMarketData = () => ({
      orderBook: instance.orderBook,
      trades: marketData.trades,
      timestamp: Date.now(),
    });

    // Update portfolio snapshot
    const marketPrices = this.extractMarketPrices(marketData);
    (instance.context as any).portfolio = instance.portfolio.getSnapshot(marketPrices);
    (instance.context as any).clock = Date.now();
  }

  /**
   * Update order book from trade - 从交易更新订单簿
   */
  private updateOrderBookFromTrade(trade: Trade): void {
    // This would normally update the order book based on the trade
    // For now, we just sync with the global order book if available
    if (this.globalOrderBook) {
      // Copy relevant data from global order book
      // Implementation depends on OrderBook internals
    }
  }

  /**
   * Process inter-strategy message queue - 处理策略间消息队列
   */
  private async processMessageQueue(): Promise<void> {
    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messages) {
      // Deliver message to recipient(s)
      if (message.to === '*') {
        // Broadcast to all strategies except sender
        for (const [strategyId, instance] of this.strategies) {
          if (strategyId !== message.from && instance.isRunning) {
            this.deliverMessage(strategyId, message);
          }
        }
      } else {
        // Deliver to specific strategy
        const recipient = this.strategies.get(message.to);
        if (recipient && recipient.isRunning) {
          this.deliverMessage(message.to, message);
        }
      }
    }
  }

  /**
   * Deliver message to a strategy - 投递消息到策略
   *
   * Note: Strategies need to implement message handling interface
   * This is a placeholder for future implementation
   */
  private deliverMessage(strategyId: string, message: StrategyMessage): void {
    // Strategies would need an onMessage handler
    // This is optional functionality for advanced use cases
    if (this.config.enableLogging) {
      console.log(
        `[StrategyManager] Message delivered: ${message.from} -> ${strategyId} (${message.type})`
      );
    }
  }

  /**
   * Extract market prices from market data - 从市场数据提取价格
   */
  private extractMarketPrices(marketData: MarketData): Map<string, number> {
    const prices = new Map<string, number>();
    // Extract prices from order book or trades
    // This is a simplified implementation
    const bestBid = marketData.orderBook.getBestBid();
    const bestAsk = marketData.orderBook.getBestAsk();
    if (bestBid && bestAsk) {
      const midPrice = (bestBid + bestAsk) / 2;
      // Assume single symbol for now
      prices.set('UNKNOWN', midPrice);
    }
    return prices;
  }

  /**
   * Emit strategy event - 发射策略事件
   */
  private emitEvent(type: StrategyEventType, data?: any): void {
    const event: StrategyEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    this.emit(type, event);
    this.emit('event', event);
  }
}
