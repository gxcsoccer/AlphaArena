/**
 * Real-time Trading Engine - 实时交易引擎
 *
 * Main engine that coordinates:
 * - Market data simulation
 * - Strategy execution
 * - Order matching
 * - Risk control
 * - Event emission
 * - Database persistence
 */

import { EventEmitter } from 'events';
import { OrderBook } from '../orderbook/OrderBook';
import { MatchingEngine } from '../matching/MatchingEngine';
import { Portfolio } from '../portfolio/Portfolio';
import { IStrategy } from '../strategy/Strategy';
import { OrderSignal, StrategyContext, MarketData } from '../strategy/types';
import { Order, OrderType } from '../orderbook/types';
import { Trade } from '../matching/types';
import { TradesDAO } from '../database/trades.dao';
import { MarketDataSimulator } from './MarketDataSimulator';
import { RiskControl } from './RiskControl';
import {
  EngineConfig,
  EngineState,
  EngineEvent,
  EngineEventType,
  RiskControlConfig,
  TradingStats,
} from './types';

/**
 * Real-time Trading Engine
 */
export class TradingEngine extends EventEmitter {
  private config: EngineConfig;
  private state: EngineState = EngineState.STOPPED;

  // Core components
  private marketSimulator: MarketDataSimulator;
  private orderBook: OrderBook;
  private matchingEngine: MatchingEngine;
  private portfolio: Portfolio;
  private riskControl: RiskControl;
  private tradesDAO: TradesDAO;

  // Strategies
  private strategies: IStrategy[] = [];
  private strategyContexts: Map<string, StrategyContext> = new Map();

  // State
  private tickCount: number = 0;
  private startTime?: number;
  private tickTimer?: NodeJS.Timeout;
  private orderCounter: number = 0;

  // Statistics
  private stats: TradingStats = {
    totalTicks: 0,
    totalSignals: 0,
    totalOrders: 0,
    totalTrades: 0,
  };

  constructor(config: EngineConfig, riskConfig: RiskControlConfig, initialCash: number = 100000) {
    super();
    this.config = config;

    // Initialize market simulator
    this.marketSimulator = new MarketDataSimulator(
      config.symbols,
      config.initialPrices,
      config.volatility,
      config.tickInterval
    );

    // Initialize core components
    this.orderBook = new OrderBook();
    this.matchingEngine = new MatchingEngine(this.orderBook);
    this.portfolio = new Portfolio(initialCash);
    this.riskControl = new RiskControl(riskConfig);
    this.tradesDAO = new TradesDAO();

    // Setup market simulator event listeners
    this.marketSimulator.on('tick', (tick) => this.handleMarketTick(tick));
    // Note: engine:start and engine:stop events are emitted in start()/stop() methods
    // to include proper event data (symbols, stats)
  }

  /**
   * Add a strategy to the engine
   */
  addStrategy(strategy: IStrategy): void {
    this.strategies.push(strategy);

    // Initialize strategy
    const context = this.createStrategyContext(strategy.getConfig().id);
    this.strategyContexts.set(strategy.getConfig().id, context);
    strategy.onInit(context);

    this.emitEvent('engine:tick', { strategy: strategy.getConfig().id, action: 'initialized' });
  }

  /**
   * Remove a strategy from the engine
   */
  removeStrategy(strategyId: string): void {
    const index = this.strategies.findIndex((s) => s.getConfig().id === strategyId);
    if (index !== -1) {
      const strategy = this.strategies[index];
      const context = this.strategyContexts.get(strategyId);
      if (context) {
        strategy.onCleanup(context);
      }
      this.strategies.splice(index, 1);
      this.strategyContexts.delete(strategyId);

      this.emitEvent('engine:tick', { strategy: strategyId, action: 'removed' });
    }
  }

  /**
   * Start the engine
   */
  start(): void {
    if (this.state === EngineState.RUNNING) {
      return;
    }

    this.state = EngineState.RUNNING;
    this.startTime = Date.now();
    this.tickCount = 0;

    // Start market simulator
    this.marketSimulator.start();

    this.emitEvent('engine:start', {
      timestamp: Date.now(),
      symbols: this.config.symbols,
    });
  }

  /**
   * Stop the engine
   */
  stop(): void {
    if (this.state === EngineState.STOPPED) {
      return;
    }

    // Cleanup strategies
    this.strategies.forEach((strategy) => {
      const context = this.strategyContexts.get(strategy.getConfig().id);
      if (context) {
        strategy.onCleanup(context);
      }
    });

    // Stop market simulator
    this.marketSimulator.stop();

    this.state = EngineState.STOPPED;

    this.emitEvent('engine:stop', {
      timestamp: Date.now(),
      totalTicks: this.tickCount,
      stats: this.getStats(),
    });
  }

  /**
   * Pause the engine
   */
  pause(): void {
    if (this.state !== EngineState.RUNNING) {
      return;
    }

    this.marketSimulator.pause();
    this.state = EngineState.PAUSED;

    this.emitEvent('engine:pause', { timestamp: Date.now() });
  }

  /**
   * Resume the engine
   */
  resume(): void {
    if (this.state !== EngineState.PAUSED) {
      return;
    }

    this.marketSimulator.resume();
    this.state = EngineState.RUNNING;

    this.emitEvent('engine:resume', { timestamp: Date.now() });
  }

  /**
   * Get current engine state
   */
  getState(): EngineState {
    return this.state;
  }

  /**
   * Get current statistics
   */
  getStats(): TradingStats {
    return {
      ...this.stats,
      startTime: this.startTime,
      endTime: this.state === EngineState.STOPPED ? Date.now() : undefined,
    };
  }

  /**
   * Get portfolio
   */
  getPortfolio(): Portfolio {
    return this.portfolio;
  }

  /**
   * Get order book
   */
  getOrderBook(): OrderBook {
    return this.orderBook;
  }

  /**
   * Get risk control
   */
  getRiskControl(): RiskControl {
    return this.riskControl;
  }

  /**
   * Handle market tick - process strategies and execute signals
   */
  private handleMarketTick(tick: any): void {
    this.tickCount++;
    this.stats.totalTicks++;

    if (this.config.enableLogging && this.tickCount % 10 === 0) {
      console.log(`[Engine] Tick ${this.tickCount}: ${tick.symbol} @ ${tick.price.toFixed(2)}`);
    }

    // Execute each strategy
    this.strategies.forEach((strategy) => {
      try {
        const context = this.strategyContexts.get(strategy.getConfig().id);
        if (!context) return;

        // Update context with latest market data
        const marketData = this.createMarketData(tick);
        (context as any).getMarketData = () => marketData;
        (context as any).portfolio = this.portfolio.getSnapshot(
          this.marketSimulator.getAllPrices()
        );
        (context as any).clock = Date.now();

        // Get signal from strategy
        const signal = strategy.onTick(context);

        if (signal) {
          this.stats.totalSignals++;
          this.emitEvent('signal:generated', {
            strategy: strategy.getConfig().id,
            signal,
          });

          // Execute signal
          this.executeSignal(signal, strategy.getConfig().id);
        }
      } catch (error) {
        console.error(`[Engine] Strategy ${strategy.getConfig().id} error:`, error);
        this.emitEvent('engine:error', {
          strategy: strategy.getConfig().id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Emit tick event
    this.emitEvent('engine:tick', {
      tick: this.tickCount,
      symbol: tick.symbol,
      price: tick.price,
    });
  }

  /**
   * Execute a trading signal
   */
  private executeSignal(signal: OrderSignal, strategyId: string): void {
    // Risk check
    const portfolioSnapshot = this.portfolio.getSnapshot(this.marketSimulator.getAllPrices());
    const riskResult = this.riskControl.checkSignal(signal, portfolioSnapshot);

    if (!riskResult.approved) {
      this.emitEvent('risk:triggered', {
        signal,
        strategy: strategyId,
        reason: riskResult.reason,
        riskType: riskResult.riskType,
      });

      if (this.config.enableLogging) {
        console.log(`[Risk] Signal rejected: ${riskResult.reason}`);
      }
      return;
    }

    // Create order
    const orderType = signal.side === 'buy' ? OrderType.BID : OrderType.ASK;
    const orderId = `${signal.id.split('-')[0]}-${this.orderCounter++}`;

    const order: Order = {
      id: orderId,
      type: orderType,
      price: signal.price,
      quantity: signal.quantity,
      timestamp: Date.now(),
    };

    // Submit order to matching engine
    const result = this.matchingEngine.submitOrder(order);

    this.stats.totalOrders++;
    this.emitEvent('order:submitted', { order, strategy: strategyId });

    // Process trades
    if (result.trades.length > 0) {
      result.trades.forEach((trade) => {
        this.processTrade(trade, strategyId);
      });
    }

    // Handle remaining order
    if (result.remainingOrder) {
      if (this.config.enableLogging) {
        console.log(
          `[Order] ${result.remainingOrder.status}: ${result.remainingOrder.filledQuantity}/${order.quantity} filled`
        );
      }
    }
  }

  /**
   * Process a trade - update portfolio and save to database
   */
  private async processTrade(trade: Trade, strategyId: string): Promise<void> {
    // Determine which side belongs to our strategy
    const isBuyer = trade.buyOrderId.startsWith(strategyId.split('-')[0]);
    const portfolioOrderId = isBuyer ? trade.buyOrderId : trade.sellOrderId;

    // Update portfolio
    const result = this.portfolio.onTrade(trade, portfolioOrderId);

    this.stats.totalTrades++;
    this.emitEvent('trade:executed', {
      trade,
      strategy: strategyId,
      portfolioUpdate: result,
    });

    // Save to database
    try {
      await this.tradesDAO.create({
        strategyId: strategyId,
        symbol: trade.buyOrderId.split('-')[0] || 'UNKNOWN',
        side: isBuyer ? 'buy' : 'sell',
        price: trade.price,
        quantity: trade.quantity,
        total: trade.price * trade.quantity,
        fee: 0,
        orderId: portfolioOrderId,
        tradeId: trade.id,
        executedAt: new Date(trade.timestamp),
      });

      if (this.config.enableLogging) {
        console.log(`[Trade] Saved: ${trade.id} @ ${trade.price.toFixed(2)} x ${trade.quantity}`);
      }
    } catch (error) {
      console.error('[Trade] Failed to save to database:', error);
      this.emitEvent('engine:error', {
        component: 'database',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Create strategy context
   */
  private createStrategyContext(__strategyId: string): StrategyContext {
    const context: StrategyContext = {
      portfolio: this.portfolio.getSnapshot(this.marketSimulator.getAllPrices()),
      clock: Date.now(),
      getMarketData: () => this.createMarketData(),
      getPosition: (symbol: string) => {
        const position = this.portfolio.getPosition(symbol);
        return position ? position.quantity : 0;
      },
      getCash: () => this.portfolio.getCash(),
    };

    return context;
  }

  /**
   * Create market data from current state
   */
  private createMarketData(__currentTick?: any): MarketData {
    return {
      orderBook: this.orderBook,
      trades: this.matchingEngine.getTrades(),
      timestamp: Date.now(),
    };
  }

  /**
   * Emit engine event
   */
  private emitEvent(type: EngineEventType, data?: any): void {
    const event: EngineEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    this.emit(type, event);
    this.emit('event', event); // Generic event listener
  }
}
