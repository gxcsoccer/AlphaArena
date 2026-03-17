/**
 * Bot Executor - 交易执行引擎
 *
 * Executes trading operations for bots:
 * - Processes strategy signals
 * - Manages positions
 * - Handles paper trading vs live trading
 * - Records trades and logs
 */

import { EventEmitter } from 'events';
import {
  BotConfig,
  BotState,
  BotTrade,
  BotLog,
  BotStatus,
  TradingMode,
  generateLogId,
  generateTradeId,
} from './BotConfig';
import { RiskController, RiskEvent } from './RiskController';
import { BotStorage } from './BotStorage';
import { IStrategy } from '../strategy/Strategy';
import { StrategyContext, OrderSignal, MarketData } from '../strategy/types';
import { OrderBook } from '../orderbook/OrderBook';
import { PortfolioSnapshot, Position } from '../portfolio/types';

/**
 * Execution event types
 */
export type ExecutorEventType =
  | 'signal:generated'
  | 'order:submitted'
  | 'order:filled'
  | 'trade:executed'
  | 'position:updated'
  | 'risk:triggered'
  | 'error';

/**
 * Execution event
 */
export interface ExecutorEvent {
  type: ExecutorEventType;
  timestamp: Date;
  botId: string;
  data?: unknown;
}

/**
 * Bot Executor
 */
export class BotExecutor extends EventEmitter {
  private config: BotConfig;
  private state: BotState;
  private riskController: RiskController;
  private storage: BotStorage;
  private strategy: IStrategy;
  private orderBook: OrderBook;

  // Runtime state
  private running: boolean = false;
  private lastPrice: number = 0;
  private tickTimer?: NodeJS.Timeout;
  private orderCounter: number = 0;

  constructor(
    config: BotConfig,
    strategy: IStrategy,
    orderBook: OrderBook,
    storage: BotStorage
  ) {
    super();
    this.config = config;
    this.strategy = strategy;
    this.orderBook = orderBook;
    this.storage = storage;

    // Initialize state
    this.state = this.createInitialState();

    // Initialize risk controller
    this.riskController = new RiskController(config.id, config.riskSettings);
    this.setupRiskListeners();
  }

  /**
   * Start the executor
   */
  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    this.state.status = BotStatus.RUNNING;
    this.state.startedAt = new Date();

    // Reset daily P&L if needed
    this.maybeResetDailyPnL();

    await this.log('info', 'Bot executor started', {
      mode: this.config.mode,
      strategy: this.config.strategy,
    });

    await this.saveState();

    // Initialize strategy
    const context = this.createStrategyContext();
    this.strategy.onInit(context);

    this.emit('started', { botId: this.config.id });
  }

  /**
   * Stop the executor
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    this.state.status = BotStatus.STOPPED;

    // Cleanup strategy
    const context = this.createStrategyContext();
    this.strategy.onCleanup(context);

    // Clear timer
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }

    await this.log('info', 'Bot executor stopped');
    await this.saveState();

    this.emit('stopped', { botId: this.config.id });
  }

  /**
   * Pause the executor
   */
  async pause(): Promise<void> {
    if (!this.running || this.state.status === BotStatus.PAUSED) return;

    this.state.status = BotStatus.PAUSED;
    this.riskController.resetRateLimiter();

    await this.log('info', 'Bot executor paused');
    await this.saveState();

    this.emit('paused', { botId: this.config.id });
  }

  /**
   * Resume the executor
   */
  async resume(): Promise<void> {
    if (!this.running || this.state.status !== BotStatus.PAUSED) return;

    this.state.status = BotStatus.RUNNING;

    await this.log('info', 'Bot executor resumed');
    await this.saveState();

    this.emit('resumed', { botId: this.config.id });
  }

  /**
   * Process a market tick
   */
  async processTick(price: number, bid: number, ask: number): Promise<void> {
    if (!this.running || this.state.status !== BotStatus.RUNNING) return;

    this.lastPrice = price;

    // Check for price anomaly
    if (this.riskController.checkPriceAnomaly(price)) {
      await this.handleEmergencyStop('Price anomaly detected');
      return;
    }

    // Check stop loss / take profit for existing position
    if (this.state.positionQuantity > 0 && this.state.positionAveragePrice > 0) {
      if (this.riskController.checkStopLoss(price, this.state.positionAveragePrice, this.state)) {
        await this.executeEmergencySell(price, 'Stop loss triggered');
        return;
      }

      if (this.riskController.checkTakeProfit(price, this.state.positionAveragePrice, this.state)) {
        await this.executeTakeProfit(price);
        return;
      }
    }

    // Update unrealized P&L
    this.updateUnrealizedPnL(price);

    // Get strategy signal
    try {
      const context = this.createStrategyContext(price, bid, ask);
      const signal = this.strategy.onTick(context);

      if (signal) {
        await this.handleSignal(signal, price);
      }
    } catch (error) {
      await this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get current state
   */
  getState(): BotState {
    return { ...this.state };
  }

  /**
   * Get config
   */
  getConfig(): BotConfig {
    return { ...this.config };
  }

  /**
   * Update config
   */
  async updateConfig(config: Partial<BotConfig>): Promise<void> {
    this.config = { ...this.config, ...config, updatedAt: new Date() };

    if (config.riskSettings) {
      this.riskController.updateSettings(config.riskSettings);
    }

    await this.saveState();
  }

  /**
   * Handle strategy signal
   */
  private async handleSignal(signal: OrderSignal, currentPrice: number): Promise<void> {
    this.state.lastSignalTime = new Date();

    this.emitEvent('signal:generated', { signal });

    // Determine order details
    const side = signal.side;
    let quantity = signal.quantity;
    const price = signal.price || currentPrice;

    // Calculate quantity based on capital if not specified
    if (quantity === 0 && side === 'buy') {
      const capitalToUse = this.config.riskSettings.usePercentageCapital
        ? this.state.portfolioValue * this.config.riskSettings.maxCapitalPerTrade
        : this.config.riskSettings.maxCapitalPerTrade;
      quantity = Math.floor(capitalToUse / price);
    }

    if (quantity <= 0) {
      await this.log('warn', 'Signal resulted in zero quantity, skipping');
      return;
    }

    // Risk check
    const riskResult =
      side === 'buy'
        ? this.riskController.checkBuyOrder(price, quantity, this.state)
        : this.riskController.checkSellOrder(price, quantity, this.state);

    if (!riskResult.approved) {
      await this.log('warn', 'Signal blocked by risk control', {
        reason: riskResult.reason,
        riskType: riskResult.riskType,
      });
      this.emitEvent('risk:triggered', { signal, riskResult });
      return;
    }

    // Execute order
    await this.executeOrder(side, price, quantity, signal.reason);
  }

  /**
   * Execute an order
   */
  private async executeOrder(
    side: 'buy' | 'sell',
    price: number,
    quantity: number,
    reason?: string
  ): Promise<void> {
    const orderId = `${this.config.id}-${this.orderCounter++}`;
    const total = price * quantity;
    const fee = this.calculateFee(total);

    this.emitEvent('order:submitted', { orderId, side, price, quantity, total });

    // Update state based on order side
    if (side === 'buy') {
      await this.handleBuy(price, quantity, fee, orderId);
    } else {
      await this.handleSell(price, quantity, fee, orderId);
    }

    // Create trade record
    const trade: BotTrade = {
      id: generateTradeId(),
      botId: this.config.id,
      strategyId: this.config.strategy,
      symbol: this.config.tradingPair.symbol,
      side,
      price,
      quantity,
      total,
      fee,
      executedAt: new Date(),
      orderId,
      isPaperTrade: this.config.mode === TradingMode.PAPER,
    };

    // Save trade
    await this.storage.saveTrade(trade);

    // Update state
    this.state.lastTradeTime = new Date();
    this.state.tradeCount++;

    this.emitEvent('trade:executed', { trade, reason });

    await this.log('info', `Order executed: ${side} ${quantity} @ ${price}`, {
      orderId,
      total,
      fee,
      reason,
    });

    await this.saveState();
  }

  /**
   * Handle buy order
   */
  private async handleBuy(price: number, quantity: number, fee: number, orderId: string): Promise<void> {
    const cost = price * quantity + fee;

    // Check if we have enough capital
    if (cost > this.state.portfolioValue) {
      await this.log('warn', 'Insufficient capital for buy order', {
        required: cost,
        available: this.state.portfolioValue,
      });
      return;
    }

    // Update position
    const newPositionQuantity = this.state.positionQuantity + quantity;
    const newCostBasis = this.state.positionQuantity * this.state.positionAveragePrice + cost - fee;

    this.state.positionQuantity = newPositionQuantity;
    this.state.positionAveragePrice = newCostBasis / newPositionQuantity;

    // Update portfolio value
    this.state.portfolioValue -= cost;

    await this.log('debug', 'Position updated after buy', {
      newPositionQuantity,
      positionAveragePrice: this.state.positionAveragePrice,
      remainingCapital: this.state.portfolioValue,
    });

    this.emitEvent('position:updated', {
      quantity: this.state.positionQuantity,
      averagePrice: this.state.positionAveragePrice,
      orderId,
    });
  }

  /**
   * Handle sell order
   */
  private async handleSell(price: number, quantity: number, fee: number, orderId: string): Promise<void> {
    if (quantity > this.state.positionQuantity) {
      await this.log('warn', 'Cannot sell more than position', {
        requested: quantity,
        available: this.state.positionQuantity,
      });
      return;
    }

    const proceeds = price * quantity - fee;
    const costBasis = quantity * this.state.positionAveragePrice;
    const realizedProfit = proceeds - costBasis;

    // Update position
    this.state.positionQuantity -= quantity;
    if (this.state.positionQuantity === 0) {
      this.state.positionAveragePrice = 0;
    }

    // Update realized P&L
    this.state.realizedPnL += realizedProfit;
    this.state.dailyPnL += realizedProfit;

    // Update win/loss count
    if (realizedProfit > 0) {
      this.state.winCount++;
    } else {
      this.state.lossCount++;
    }

    // Update portfolio value
    this.state.portfolioValue += proceeds;
    this.state.totalPnL = this.state.realizedPnL + this.state.unrealizedPnL;

    await this.log('debug', 'Position updated after sell', {
      quantitySold: quantity,
      realizedProfit,
      remainingPosition: this.state.positionQuantity,
    });

    this.emitEvent('position:updated', {
      quantity: this.state.positionQuantity,
      realizedProfit,
      orderId,
    });
  }

  /**
   * Execute emergency sell (stop loss)
   */
  private async executeEmergencySell(currentPrice: number, reason: string): Promise<void> {
    if (this.state.positionQuantity === 0) return;

    await this.log('warn', `Emergency sell triggered: ${reason}`);

    await this.executeOrder('sell', currentPrice, this.state.positionQuantity, reason);
  }

  /**
   * Execute take profit sell
   */
  private async executeTakeProfit(currentPrice: number): Promise<void> {
    if (this.state.positionQuantity === 0) return;

    await this.log('info', 'Take profit triggered');

    await this.executeOrder('sell', currentPrice, this.state.positionQuantity, 'Take profit');
  }

  /**
   * Handle emergency stop
   */
  private async handleEmergencyStop(reason: string): Promise<void> {
    this.state.status = BotStatus.ERROR;
    this.state.lastError = reason;

    await this.log('error', `Emergency stop: ${reason}`);

    // Close position if any
    if (this.state.positionQuantity > 0 && this.lastPrice > 0) {
      await this.executeEmergencySell(this.lastPrice, reason);
    }

    await this.stop();

    this.emit('emergency_stop', { botId: this.config.id, reason });
  }

  /**
   * Update unrealized P&L based on current price
   */
  private updateUnrealizedPnL(currentPrice: number): void {
    if (this.state.positionQuantity === 0) {
      this.state.unrealizedPnL = 0;
    } else {
      const positionValue = this.state.positionQuantity * currentPrice;
      const costBasis = this.state.positionQuantity * this.state.positionAveragePrice;
      this.state.unrealizedPnL = positionValue - costBasis;
    }
    this.state.totalPnL = this.state.realizedPnL + this.state.unrealizedPnL;
  }

  /**
   * Check and reset daily P&L if needed
   */
  private maybeResetDailyPnL(): void {
    const now = new Date();
    const resetAt = this.state.dailyPnLResetAt;

    if (!resetAt || !this.isSameDay(now, resetAt)) {
      this.state.dailyPnL = 0;
      this.state.dailyPnLResetAt = now;
    }
  }

  /**
   * Check if two dates are the same day
   */
  private isSameDay(d1: Date, d2: Date): boolean {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  /**
   * Calculate trading fee
   */
  private calculateFee(total: number): number {
    // Default 0.1% fee
    const feeRate = 0.001;
    return total * feeRate;
  }

  /**
   * Handle error
   */
  private async handleError(error: Error): Promise<void> {
    this.state.lastError = error.message;

    await this.log('error', `Error during execution: ${error.message}`, {
      stack: error.stack,
    });

    this.emitEvent('error', { error });
  }

  /**
   * Create strategy context
   */
  private createStrategyContext(price?: number, bid?: number, ask?: number): StrategyContext {
    const currentPrice = price || this.lastPrice || 0;
    const positions: Position[] = this.state.positionQuantity > 0
      ? [{
          symbol: this.config.tradingPair.symbol,
          quantity: this.state.positionQuantity,
          averageCost: this.state.positionAveragePrice,
        }]
      : [];

    const portfolio: PortfolioSnapshot = {
      cash: this.state.portfolioValue,
      totalValue: this.state.portfolioValue + this.state.unrealizedPnL,
      positions,
      unrealizedPnL: this.state.unrealizedPnL,
      timestamp: Date.now(),
    };

    return {
      portfolio,
      clock: Date.now(),
      getMarketData: (): MarketData => ({
        orderBook: this.orderBook,
        trades: [],
        timestamp: Date.now(),
      }),
      getPosition: (symbol: string) => 
        symbol === this.config.tradingPair.symbol ? this.state.positionQuantity : 0,
      getCash: () => this.state.portfolioValue,
    };
  }

  /**
   * Create initial state
   */
  private createInitialState(): BotState {
    return {
      botId: this.config.id,
      status: BotStatus.STOPPED,
      portfolioValue: this.config.initialCapital,
      initialCapital: this.config.initialCapital,
      realizedPnL: 0,
      unrealizedPnL: 0,
      totalPnL: 0,
      tradeCount: 0,
      winCount: 0,
      lossCount: 0,
      positionQuantity: 0,
      positionAveragePrice: 0,
      totalRuntimeMs: 0,
      dailyPnL: 0,
    };
  }

  /**
   * Setup risk event listeners
   */
  private setupRiskListeners(): void {
    this.riskController.on('risk', async (event: RiskEvent) => {
      await this.log('warn', `Risk event: ${event.message}`, {
        type: event.type,
        action: event.action,
        data: event.data,
      });

      if (event.action === 'emergency_stop') {
        await this.handleEmergencyStop(event.message);
      }
    });
  }

  /**
   * Log a message
   */
  private async log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: Record<string, unknown>): Promise<void> {
    const log: BotLog = {
      id: generateLogId(),
      botId: this.config.id,
      timestamp: new Date(),
      level,
      message,
      data,
    };

    try {
      await this.storage.addLog(log);
    } catch (error) {
      console.error(`Failed to save log: ${error}`);
    }
  }

  /**
   * Save state to storage
   */
  private async saveState(): Promise<void> {
    try {
      await this.storage.saveState(this.state);
    } catch (error) {
      console.error(`Failed to save state: ${error}`);
    }
  }

  /**
   * Emit executor event
   */
  private emitEvent(type: ExecutorEventType, data?: unknown): void {
    const event: ExecutorEvent = {
      type,
      timestamp: new Date(),
      botId: this.config.id,
      data,
    };

    this.emit(type, event);
  }
}
