/**
 * Strategy Interface
 * 
 * Abstract base class for trading strategies
 */

import { OrderSignal, StrategyContext, StrategyLifecycleEvent, StrategyConfig } from './types';

/**
 * Strategy interface - 策略接口
 * 
 * All trading strategies must implement this interface
 */
export interface IStrategy {
  /**
   * Get strategy configuration
   */
  getConfig(): StrategyConfig;

  /**
   * Initialize strategy - 策略初始化
   * 
   * Called once when the strategy is first loaded
   * @param context - Strategy context
   */
  onInit(context: StrategyContext): void;

  /**
   * Handle tick event - 处理行情数据
   * 
   * Called on each market data update
   * @param context - Strategy context
   * @returns Order signal or null if no action
   */
  onTick(context: StrategyContext): OrderSignal | null;

  /**
   * Handle order filled event - 处理成交事件
   * 
   * Called when an order is filled
   * @param context - Strategy context
   * @param signal - The original signal that led to this fill
   */
  onOrderFilled(context: StrategyContext, signal: OrderSignal): void;

  /**
   * Cleanup strategy - 策略清理
   * 
   * Called when the strategy is being shut down
   * @param context - Strategy context
   */
  onCleanup(context: StrategyContext): void;
}

/**
 * Abstract strategy base class - 策略抽象基类
 * 
 * Provides common functionality for all strategies
 */
export abstract class Strategy implements IStrategy {
  protected config: StrategyConfig;
  protected initialized: boolean = false;

  constructor(config: StrategyConfig) {
    this.config = config;
  }

  /**
   * Get strategy configuration
   */
  getConfig(): StrategyConfig {
    return this.config;
  }

  /**
   * Initialize strategy
   */
  onInit(context: StrategyContext): void {
    this.initialized = true;
    this.init(context);
  }

  /**
   * Initialize strategy - to be implemented by subclasses
   */
  protected init(context: StrategyContext): void {
    // Default implementation does nothing
  }

  /**
   * Handle tick event - must be implemented by subclasses
   */
  abstract onTick(context: StrategyContext): OrderSignal | null;

  /**
   * Handle order filled event
   */
  onOrderFilled(context: StrategyContext, signal: OrderSignal): void {
    this.orderFilled(context, signal);
  }

  /**
   * Handle order filled event - can be overridden by subclasses
   */
  protected orderFilled(context: StrategyContext, signal: OrderSignal): void {
    // Default implementation does nothing
  }

  /**
   * Cleanup strategy
   */
  onCleanup(context: StrategyContext): void {
    this.initialized = false;
    this.cleanup(context);
  }

  /**
   * Cleanup strategy - can be overridden by subclasses
   */
  protected cleanup(context: StrategyContext): void {
    // Default implementation does nothing
  }

  /**
   * Check if strategy is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Generate a unique signal ID
   */
  protected generateSignalId(): string {
    return `${this.config.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create an order signal helper
   */
  protected createSignal(
    side: 'buy' | 'sell',
    price: number,
    quantity: number,
    options?: {
      bid?: number;
      ask?: number;
      confidence?: number;
      reason?: string;
    }
  ): OrderSignal {
    return {
      id: this.generateSignalId(),
      side,
      price,
      quantity,
      timestamp: Date.now(),
      ...options,
    };
  }
}
