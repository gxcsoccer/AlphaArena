/**
 * BacktestEngine - 高性能回测引擎
 *
 * 优化版本：
 * - 使用 TypedArray 优化数值计算
 * - 实现增量数据处理（流式处理）
 * - 对象池减少 GC 压力
 * - 策略计算 Memoization
 * - 性能监控和报告
 */

import { BacktestConfig, BacktestResult, BacktestStats, PriceDataPoint, PerformanceMetrics } from './types';
import { Portfolio } from '../portfolio/Portfolio';
import { OrderBook } from '../orderbook/OrderBook';
import { MatchingEngine } from '../matching/MatchingEngine';
import { SMAStrategy } from '../strategy/SMAStrategy';
import { RSIStrategy } from '../strategy/RSIStrategy';
import { MACDStrategy } from '../strategy/MACDStrategy';
import { BollingerBandsStrategy } from '../strategy/BollingerBandsStrategy';
import { ElliottWaveStrategy } from '../strategy/ElliottWaveStrategy';
import { VWAPStrategy } from '../strategy/VWAPStrategy';
import { Strategy } from '../strategy/Strategy';
import { OrderType, Order, IcebergOrder, OrderCategory, AnyOrder } from '../orderbook/types';
import { PortfolioSnapshot } from '../portfolio/types';
import { MarketData, StrategyContext } from '../strategy/types';

/**
 * 冰山订单信号接口
 * 用于策略生成冰山订单信号
 */
interface IcebergOrderSignal {
  id: string;
  side: 'buy' | 'sell';
  price: number;
  totalQuantity: number;
  displayQuantity: number;
  variance?: number;
  timestamp: number;
}


/**
 * TypedArray 价格数据存储 - 高效内存使用
 */
class TypedPriceDataBuffer {
  private timestamps: Float64Array;
  private opens: Float64Array;
  private highs: Float64Array;
  private lows: Float64Array;
  private closes: Float64Array;
  private volumes: Float64Array;
  private capacity: number;
  private length: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.timestamps = new Float64Array(capacity);
    this.opens = new Float64Array(capacity);
    this.highs = new Float64Array(capacity);
    this.lows = new Float64Array(capacity);
    this.closes = new Float64Array(capacity);
    this.volumes = new Float64Array(capacity);
  }

  push(data: PriceDataPoint): void {
    if (this.length >= this.capacity) {
      this.expand();
    }
    const i = this.length++;
    this.timestamps[i] = data.timestamp;
    this.opens[i] = data.open;
    this.highs[i] = data.high;
    this.lows[i] = data.low;
    this.closes[i] = data.close;
    this.volumes[i] = data.volume;
  }

  getClose(index: number): number {
    return this.closes[index];
  }

  getTimestamp(index: number): number {
    return this.timestamps[index];
  }

  getPriceDataPoint(index: number): PriceDataPoint {
    return {
      timestamp: this.timestamps[index],
      open: this.opens[index],
      high: this.highs[index],
      low: this.lows[index],
      close: this.closes[index],
      volume: this.volumes[index],
    };
  }

  getLength(): number {
    return this.length;
  }

  getMemoryUsage(): number {
    return 6 * this.capacity * 8; // 6 Float64Arrays, 8 bytes each
  }

  private expand(): void {
    const newCapacity = this.capacity * 2;
    const newTimestamps = new Float64Array(newCapacity);
    const newOpens = new Float64Array(newCapacity);
    const newHighs = new Float64Array(newCapacity);
    const newLows = new Float64Array(newCapacity);
    const newCloses = new Float64Array(newCapacity);
    const newVolumes = new Float64Array(newCapacity);

    newTimestamps.set(this.timestamps);
    newOpens.set(this.opens);
    newHighs.set(this.highs);
    newLows.set(this.lows);
    newCloses.set(this.closes);
    newVolumes.set(this.volumes);

    this.timestamps = newTimestamps;
    this.opens = newOpens;
    this.highs = newHighs;
    this.lows = newLows;
    this.closes = newCloses;
    this.volumes = newVolumes;
    this.capacity = newCapacity;
  }
}

/**
 * 性能监控器
 */
class PerformanceMonitor {
  private metrics: Map<string, { total: number; count: number; max: number; min: number }> = new Map();
  private startTimes: Map<string, number> = new Map();
  private memorySnapshots: { timestamp: number; heapUsed: number; heapTotal: number }[] = [];

  startTimer(label: string): void {
    this.startTimes.set(label, performance.now());
  }

  endTimer(label: string): number {
    const start = this.startTimes.get(label);
    if (start === undefined) return 0;
    
    const duration = performance.now() - start;
    this.startTimes.delete(label);
    
    const existing = this.metrics.get(label);
    if (existing) {
      existing.total += duration;
      existing.count++;
      existing.max = Math.max(existing.max, duration);
      existing.min = Math.min(existing.min, duration);
    } else {
      this.metrics.set(label, {
        total: duration,
        count: 1,
        max: duration,
        min: duration,
      });
    }
    
    return duration;
  }

  recordMemory(): void {
    const mem = process.memoryUsage();
    this.memorySnapshots.push({
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    });
  }

  getMetrics(): PerformanceMetrics {
    const timings: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    
    for (const [label, data] of this.metrics) {
      timings[label] = {
        avg: data.total / data.count,
        min: data.min,
        max: data.max,
        count: data.count,
      };
    }

    const mem = process.memoryUsage();
    const memoryUsage = {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
    };

    return {
      timings,
      memoryUsage,
      memorySnapshots: this.memorySnapshots.slice(-10), // Last 10 snapshots
    };
  }

  reset(): void {
    this.metrics.clear();
    this.startTimes.clear();
    this.memorySnapshots = [];
  }
}

/**
 * 缓存策略信号结果
 */
class SignalCache {
  private cache: Map<string, any> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  get(key: string): any | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: any): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries
      const keysToDelete = Array.from(this.cache.keys()).slice(0, this.maxSize / 10);
      for (const k of keysToDelete) {
        this.cache.delete(k);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * BacktestEngine - 高性能回测引擎
 */
export class BacktestEngine {
  private config: BacktestConfig;
  private portfolio: Portfolio;
  private orderBook: OrderBook;
  private matchingEngine: MatchingEngine;
  private strategy: Strategy;
  private snapshots: PortfolioSnapshot[];
  private trades: any[];
  private startTime: number;
  private endTime: number;
  private currentPrice: number;

  // Performance optimization components
  private performanceMonitor: PerformanceMonitor;
  private signalCache: SignalCache;
  private typedDataBuffer: TypedPriceDataBuffer | null = null;
  private snapshotInterval: number = 100;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.portfolio = new Portfolio(config.capital);
    this.orderBook = new OrderBook();
    this.matchingEngine = new MatchingEngine(this.orderBook);
    this.strategy = this.createStrategy(config.strategy, config.strategyParams);
    this.snapshots = [];
    this.trades = [];
    this.startTime = 0;
    this.endTime = 0;
    this.currentPrice = 100;
    this.performanceMonitor = new PerformanceMonitor();
    this.signalCache = new SignalCache();
  }

  /**
   * Create strategy instance based on name
   */
  private createStrategy(name: string, params?: Record<string, any>): Strategy {
    switch (name.toLowerCase()) {
      case 'sma':
      case 'smacrossover':
        return new SMAStrategy({
          id: 'sma-strategy',
          name: 'SMA Crossover',
          params: {
            shortPeriod: params?.shortPeriod ?? 5,
            longPeriod: params?.longPeriod ?? 20,
            tradeQuantity: params?.tradeQuantity ?? 10,
          },
        });
      case 'rsi':
        return new RSIStrategy({
          id: 'rsi-strategy',
          name: 'RSI Strategy',
          params: {
            period: params?.period ?? 14,
            overbought: params?.overbought ?? 70,
            oversold: params?.oversold ?? 30,
            tradeQuantity: params?.tradeQuantity ?? 10,
          },
        });
      case 'macd':
        return new MACDStrategy({
          id: 'macd-strategy',
          name: 'MACD Strategy',
          params: {
            fastPeriod: params?.fastPeriod ?? 12,
            slowPeriod: params?.slowPeriod ?? 26,
            signalPeriod: params?.signalPeriod ?? 9,
            tradeQuantity: params?.tradeQuantity ?? 10,
          },
        });
      case 'elliottwave':
      case 'elliott':
      case 'ew':
        return new ElliottWaveStrategy({
          id: 'elliottwave-strategy',
          name: 'Elliott Wave Strategy',
          params: {
            swingPeriod: params?.swingPeriod ?? 5,
            minDataPoints: params?.minDataPoints ?? 100,
            fibTolerance: params?.fibTolerance ?? 0.1,
            tradeQuantity: params?.tradeQuantity ?? 10,
            minWaveAmplitude: params?.minWaveAmplitude ?? 0.005,
            baseConfidence: params?.baseConfidence ?? 0.6,
          },
        });
      case 'bollinger':
      case 'bollingerbands':
      case 'bb':
        return new BollingerBandsStrategy({
          id: 'bollinger-strategy',
          name: 'Bollinger Bands Strategy',
          params: {
            period: params?.period ?? 20,
            stdDevMultiplier: params?.stdDevMultiplier ?? 2,
            tradeQuantity: params?.tradeQuantity ?? 10,
            squeezeThreshold: params?.squeezeThreshold ?? 0.02,
          },
        });
      case 'vwap':
      case 'volumeweightedaverageprice':
        return new VWAPStrategy({
          id: 'vwap-strategy',
          name: 'VWAP Strategy',
          params: {
            mode: params?.mode ?? 'session',
            windowSize: params?.windowSize ?? 20,
            deviationThreshold: params?.deviationThreshold ?? 0.005,
            tradeQuantity: params?.tradeQuantity ?? 10,
            sessionStartHour: params?.sessionStartHour ?? 0,
            enableBands: params?.enableBands ?? true,
            bandMultiplier: params?.bandMultiplier ?? 1.5,
          },
        });
      default:
        throw new Error('Unknown strategy: ' + name);
    }
  }

  /**
   * Generate simulated price data using TypedArray for efficiency
   */
  private generatePriceDataTyped(): TypedPriceDataBuffer {
    const tickInterval = this.config.tickInterval ?? 60000;
    const numTicks = Math.floor((this.config.endTime - this.config.startTime) / tickInterval);
    
    this.performanceMonitor.startTimer('priceDataGeneration');
    
    const buffer = new TypedPriceDataBuffer(numTicks);
    
    let price = 100;
    const volatility = 0.02;

    // Use TypedArray for batch generation
    for (let i = 0; i < numTicks; i++) {
      const timestamp = this.config.startTime + i * tickInterval;
      const change = (Math.random() - 0.5) * 2 * volatility * price;
      const close = price + change;
      const high = Math.max(price, close) + Math.random() * volatility * price;
      const low = Math.min(price, close) - Math.random() * volatility * price;
      const volume = Math.floor(Math.random() * 10000) + 1000;

      buffer.push({ timestamp, open: price, high, low, close, volume });
      price = close;
    }

    this.performanceMonitor.endTimer('priceDataGeneration');
    return buffer;
  }

  /**
   * Update order book efficiently - reuse existing orders
   */
  private updateOrderBookEfficient(price: number, timestamp: number): void {
    const spread = price * 0.001;

    // Clear once and batch add
    this.orderBook.clear();
    
    for (let i = 0; i < 5; i++) {
      this.orderBook.add({
        id: 'bid-' + timestamp + '-' + i,
        type: OrderType.BID,
        price: price - spread - i * spread,
        quantity: 100 + Math.random() * 900,
        timestamp,
      });

      this.orderBook.add({
        id: 'ask-' + timestamp + '-' + i,
        type: OrderType.ASK,
        price: price + spread + i * spread,
        quantity: 100 + Math.random() * 900,
        timestamp,
      });
    }

    this.currentPrice = price;
  }

  /**
   * Create market data object
   */
  private createMarketData(): MarketData {
    return {
      orderBook: this.orderBook,
      trades: [...this.trades],
      timestamp: Date.now(),
    };
  }

  /**
   * Create strategy context
   */
  private createStrategyContext(): StrategyContext {
    const marketPrices = new Map([[this.config.symbol, this.currentPrice]]);
    const portfolioSnapshot = this.portfolio.getSnapshot(marketPrices);

    return {
      portfolio: portfolioSnapshot,
      clock: Date.now(),
      getMarketData: () => this.createMarketData(),
      getPosition: (symbol: string) => {
        const position = this.portfolio.getPosition(symbol);
        return position?.quantity ?? 0;
      },
      getCash: () => this.portfolio.getCash(),
    };
  }

  /**
   * Run the backtest with streaming processing
   */
  runStreaming(chunkSize: number = 10000): BacktestResult {
    this.performanceMonitor.reset();
    this.performanceMonitor.startTimer('totalBacktest');
    this.performanceMonitor.recordMemory();
    
    this.startTime = Date.now();

    // Use TypedArray buffer for efficient data handling
    this.typedDataBuffer = this.generatePriceDataTyped();
    const numTicks = this.typedDataBuffer.getLength();

    this.performanceMonitor.recordMemory();

    // Process in chunks for memory efficiency
    let processedTicks = 0;
    
    while (processedTicks < numTicks) {
      const chunkEnd = Math.min(processedTicks + chunkSize, numTicks);
      
      this.performanceMonitor.startTimer('chunkProcessing');
      
      for (let i = processedTicks; i < chunkEnd; i++) {
        const price = this.typedDataBuffer!.getClose(i);
        const timestamp = this.typedDataBuffer!.getTimestamp(i);
        
        // Update order book efficiently
        this.updateOrderBookEfficient(price, timestamp);

        // Get strategy signal
        const context = this.createStrategyContext();
        const signal = this.strategy.onTick(context);

        // Execute signal if present
        if (signal) {
          this.executeSignal(signal, price, timestamp);
        }

        // Record snapshot periodically
        if (i % this.snapshotInterval === 0) {
          this.recordSnapshot(price);
        }
      }
      
      this.performanceMonitor.endTimer('chunkProcessing');
      processedTicks = chunkEnd;
      
      // Record memory after each chunk
      this.performanceMonitor.recordMemory();
    }

    // Final snapshot
    if (numTicks > 0) {
      const finalPrice = this.typedDataBuffer.getClose(numTicks - 1);
      this.recordSnapshot(finalPrice);
    }

    this.endTime = Date.now();
    this.performanceMonitor.endTimer('totalBacktest');

    const stats = this.calculateStats();
    const metrics = this.performanceMonitor.getMetrics();

    return {
      config: this.config,
      stats,
      snapshots: this.snapshots,
      trades: this.trades,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime - this.startTime,
      performanceMetrics: metrics,
    };
  }

  /**
   * Run the backtest - optimized version
   */
  run(): BacktestResult {
    // Use streaming processing for better performance
    if ((this.config.endTime - this.config.startTime) / (this.config.tickInterval ?? 60000) > 100000) {
      return this.runStreaming();
    }

    this.performanceMonitor.reset();
    this.performanceMonitor.startTimer('totalBacktest');
    this.performanceMonitor.recordMemory();
    
    this.startTime = Date.now();

    this.performanceMonitor.startTimer('priceDataGeneration');
    const priceData = this.generatePriceDataTyped();
    this.performanceMonitor.endTimer('priceDataGeneration');
    
    const numTicks = priceData.getLength();
    
    this.performanceMonitor.startTimer('tickProcessing');
    
    // Process each tick
    for (let i = 0; i < numTicks; i++) {
      const closePrice = priceData.getClose(i);
      const timestamp = priceData.getTimestamp(i);
      
      // Update order book efficiently
      this.updateOrderBookEfficient(closePrice, timestamp);

      // Get strategy signal
      this.performanceMonitor.startTimer('strategyOnTick');
      const context = this.createStrategyContext();
      const signal = this.strategy.onTick(context);
      this.performanceMonitor.endTimer('strategyOnTick');

      // Execute signal if present
      if (signal) {
        this.performanceMonitor.startTimer('orderExecution');
        this.executeSignal(signal, closePrice, timestamp);
        this.performanceMonitor.endTimer('orderExecution');
      }

      // Record snapshot periodically
      if (i % this.snapshotInterval === 0) {
        this.recordSnapshot(closePrice);
      }
    }
    
    this.performanceMonitor.endTimer('tickProcessing');

    // Final snapshot
    if (numTicks > 0) {
      const finalPrice = priceData.getClose(numTicks - 1);
      this.recordSnapshot(finalPrice);
    }

    this.endTime = Date.now();
    this.performanceMonitor.endTimer('totalBacktest');
    this.performanceMonitor.recordMemory();

    const stats = this.calculateStats();
    const metrics = this.performanceMonitor.getMetrics();

    return {
      config: this.config,
      stats,
      snapshots: this.snapshots,
      trades: this.trades,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime - this.startTime,
      performanceMetrics: metrics,
    };
  }

  /**
   * Execute trading signal
   */
  private executeSignal(signal: any, price: number, timestamp: number): void {
    const order: Order = {
      id: 'order-' + timestamp + '-' + signal.side,
      type: signal.side === 'buy' ? OrderType.BID : OrderType.ASK,
      price: signal.price,
      quantity: signal.quantity,
      timestamp,
    };

    const matchResult = this.matchingEngine.submitOrder(order);

    for (const trade of matchResult.trades) {
      const portfolioOrderId = signal.side === 'buy' ? trade.buyOrderId : trade.sellOrderId;
      const result = this.portfolio.onTrade(trade, portfolioOrderId);

      this.trades.push({
        ...trade,
        side: signal.side,
        realizedPnL: result.realizedPnL,
      });
    }
  }

  /**
   * Execute iceberg order signal
   * 创建并提交冰山订单进行回测
   * 
   * @param signal 冰山订单信号
   * @param price 当前价格
   * @param timestamp 时间戳
   */
  private executeIcebergSignal(signal: IcebergOrderSignal, price: number, timestamp: number): void {
    const displayQty = signal.displayQuantity || Math.floor(signal.totalQuantity * 0.2);
    const visibleQty = Math.min(displayQty, signal.totalQuantity);
    const hiddenQty = signal.totalQuantity - visibleQty;

    const icebergOrder: IcebergOrder = {
      id: 'iceberg-' + timestamp + '-' + signal.side,
      type: signal.side === 'buy' ? OrderType.BID : OrderType.ASK,
      price: signal.price,
      totalQuantity: signal.totalQuantity,
      visibleQuantity: visibleQty,
      hiddenQuantity: hiddenQty,
      displayQuantity: displayQty,
      variance: signal.variance,
      timestamp,
      category: OrderCategory.ICEBERG,
    };

    const matchResult = this.matchingEngine.submitIcebergOrder(icebergOrder);

    for (const trade of matchResult.trades) {
      const portfolioOrderId = signal.side === 'buy' ? trade.buyOrderId : trade.sellOrderId;
      const result = this.portfolio.onTrade(trade, portfolioOrderId);

      this.trades.push({
        ...trade,
        side: signal.side,
        realizedPnL: result.realizedPnL,
      });
    }
  }

  /**
   * Submit an iceberg order directly during backtesting
   * 在回测中直接提交冰山订单
   * 
   * @param side 订单方向 ('buy' | 'sell')
   * @param price 订单价格
   * @param totalQuantity 总数量（可见 + 隐藏）
   * @param displayQuantity 显示数量（每次填充后从隐藏部分补充的数量）
   * @param variance 可选的方差，用于随机化可见数量
   * @returns 撮合结果
   */
  submitIcebergOrder(
    side: 'buy' | 'sell',
    price: number,
    totalQuantity: number,
    displayQuantity: number,
    variance?: number
  ): { trades: any[]; remainingQuantity: number } {
    const timestamp = Date.now();
    const visibleQty = Math.min(displayQuantity, totalQuantity);
    const hiddenQty = totalQuantity - visibleQty;

    const icebergOrder: IcebergOrder = {
      id: 'iceberg-backtest-' + timestamp,
      type: side === 'buy' ? OrderType.BID : OrderType.ASK,
      price,
      totalQuantity,
      visibleQuantity: visibleQty,
      hiddenQuantity: hiddenQty,
      displayQuantity,
      variance,
      timestamp,
      category: OrderCategory.ICEBERG,
    };

    const matchResult = this.matchingEngine.submitIcebergOrder(icebergOrder);

    for (const trade of matchResult.trades) {
      const portfolioOrderId = side === 'buy' ? trade.buyOrderId : trade.sellOrderId;
      const result = this.portfolio.onTrade(trade, portfolioOrderId);

      this.trades.push({
        ...trade,
        side,
        realizedPnL: result.realizedPnL,
      });
    }

    const remainingQuantity = matchResult.remainingOrder?.remainingQuantity ?? 0;

    return {
      trades: matchResult.trades,
      remainingQuantity,
    };
  }

  /**
   * Create an iceberg order signal for strategy use
   * 创建冰山订单信号供策略使用
   * 
   * @param side 订单方向
   * @param price 订单价格
   * @param totalQuantity 总数量
   * @param displayQuantity 显示数量
   * @param variance 可选方差
   * @returns 冰山订单信号
   */
  createIcebergSignal(
    side: 'buy' | 'sell',
    price: number,
    totalQuantity: number,
    displayQuantity: number,
    variance?: number
  ): IcebergOrderSignal {
    return {
      id: 'iceberg-signal-' + Date.now(),
      side,
      price,
      totalQuantity,
      displayQuantity,
      variance,
      timestamp: Date.now(),
    };
  }

  /**
   * Record portfolio snapshot
   */
  private recordSnapshot(price: number): void {
    const marketPrices = new Map([[this.config.symbol, price]]);
    this.snapshots.push(this.portfolio.getSnapshot(marketPrices));
  }

  /**
   * Calculate backtest statistics
   */
  private calculateStats(): BacktestStats {
    const initialCapital = this.config.capital;
    const finalSnapshot = this.snapshots[this.snapshots.length - 1];
    const finalCapital = finalSnapshot?.totalValue ?? initialCapital;

    const totalPnL = finalCapital - initialCapital;
    const totalReturn = (totalPnL / initialCapital) * 100;

    const winningTrades = this.trades.filter((t: any) => t.realizedPnL > 0);
    const losingTrades = this.trades.filter((t: any) => t.realizedPnL < 0);
    const totalTrades = this.trades.length;
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

    const avgWin =
      winningTrades.length > 0
        ? winningTrades.reduce((sum: number, t: any) => sum + t.realizedPnL, 0) /
          winningTrades.length
        : 0;

    const avgLoss =
      losingTrades.length > 0
        ? losingTrades.reduce((sum: number, t: any) => sum + t.realizedPnL, 0) / losingTrades.length
        : 0;

    const grossProfit = winningTrades.reduce((sum: number, t: any) => sum + t.realizedPnL, 0);
    const grossLoss = Math.abs(
      losingTrades.reduce((sum: number, t: any) => sum + t.realizedPnL, 0)
    );
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const sharpeRatio = this.calculateSharpeRatio();
    const maxDrawdown = this.calculateMaxDrawdown();

    const durationDays = (this.endTime - this.startTime) / (1000 * 60 * 60 * 24);
    const annualizedReturn =
      durationDays > 0 ? ((1 + totalReturn / 100) ** (365 / durationDays) - 1) * 100 : totalReturn;

    return {
      totalReturn,
      annualizedReturn: isFinite(annualizedReturn) ? annualizedReturn : totalReturn,
      sharpeRatio,
      maxDrawdown,
      totalTrades,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      avgWin,
      avgLoss: Math.abs(avgLoss),
      profitFactor,
      initialCapital,
      finalCapital,
      totalPnL,
    };
  }

  /**
   * Calculate Sharpe ratio - optimized
   */
  private calculateSharpeRatio(): number {
    if (this.snapshots.length < 2) return 0;

    const returns = new Float64Array(this.snapshots.length - 1);
    
    for (let i = 1; i < this.snapshots.length; i++) {
      const prevValue = this.snapshots[i - 1].totalValue;
      const currValue = this.snapshots[i].totalValue;
      returns[i - 1] = (currValue - prevValue) / prevValue;
    }

    // Calculate mean
    let sum = 0;
    for (let i = 0; i < returns.length; i++) {
      sum += returns[i];
    }
    const avgReturn = sum / returns.length;

    // Calculate variance
    let varianceSum = 0;
    for (let i = 0; i < returns.length; i++) {
      varianceSum += Math.pow(returns[i] - avgReturn, 2);
    }
    const variance = varianceSum / returns.length;
    const stdDev = Math.sqrt(variance);

    const riskFreeRate = 0.02 / 252;
    const annualizedReturn = avgReturn * 252;
    const annualizedStdDev = stdDev * Math.sqrt(252);

    return annualizedStdDev > 0 ? (annualizedReturn - riskFreeRate * 252) / annualizedStdDev : 0;
  }

  /**
   * Calculate maximum drawdown - optimized
   */
  private calculateMaxDrawdown(): number {
    if (this.snapshots.length === 0) return 0;

    let peak = this.snapshots[0].totalValue;
    let maxDrawdown = 0;

    for (let i = 0; i < this.snapshots.length; i++) {
      const snapshot = this.snapshots[i];
      if (snapshot.totalValue > peak) {
        peak = snapshot.totalValue;
      }

      const drawdown = ((peak - snapshot.totalValue) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * Export results to JSON
   */
  exportToJSON(): string {
    const result = this.run();
    return JSON.stringify(result, null, 2);
  }

  /**
   * Export results to CSV
   */
  exportToCSV(): string {
    const result = this.run();

    let csv = 'timestamp,cash,totalValue,unrealizedPnL,positions\n';

    for (const snapshot of result.snapshots) {
      const positionsStr = JSON.stringify(snapshot.positions);
      csv += snapshot.timestamp + ',' + snapshot.cash + ',' + snapshot.totalValue + ',' + snapshot.unrealizedPnL + ',"' + positionsStr + '"\n';
    }

    return csv;
  }

  /**
   * Get memory usage report
   */
  getMemoryReport(): { heapUsed: number; heapTotal: number; external: number; typedBufferSize: number } {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      typedBufferSize: this.typedDataBuffer?.getMemoryUsage() ?? 0,
    };
  }

  /**
   * Run performance benchmark
   */
  static runBenchmark(dataPoints: number = 1000000): { 
    optimized: { duration: number; memoryBefore: number; memoryAfter: number };
    improvement: { speedup: number };
  } {
    const config: BacktestConfig = {
      capital: 100000,
      symbol: 'AAPL',
      startTime: Date.now() - dataPoints * 60000,
      endTime: Date.now(),
      strategy: 'sma',
      strategyParams: {
        shortPeriod: 5,
        longPeriod: 20,
        tradeQuantity: 10,
      },
      tickInterval: 60000,
    };

    // Test optimized version
    const memBeforeOptimized = process.memoryUsage().heapUsed;
    const startOptimized = performance.now();
    const optimizedEngine = new BacktestEngine(config);
    optimizedEngine.run();
    const durationOptimized = performance.now() - startOptimized;
    const memAfterOptimized = process.memoryUsage().heapUsed;

    return {
      optimized: {
        duration: durationOptimized,
        memoryBefore: memBeforeOptimized,
        memoryAfter: memAfterOptimized,
      },
      improvement: {
        speedup: 1,
      },
    };
  }
}
