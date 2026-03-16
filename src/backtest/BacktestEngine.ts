/**
 * BacktestEngine - 回测引擎
 *
 * 负责：
 * - 加载历史数据
 * - 模拟市场运行
 * - 执行策略信号
 * - 跟踪组合表现
 * - 生成统计报告
 */

import { BacktestConfig, BacktestResult, BacktestStats, PriceDataPoint } from './types';
import { Portfolio } from '../portfolio/Portfolio';
import { OrderBook } from '../orderbook/OrderBook';
import { MatchingEngine } from '../matching/MatchingEngine';
import { SMAStrategy } from '../strategy/SMAStrategy';
import { RSIStrategy } from '../strategy/RSIStrategy';
import { MACDStrategy } from '../strategy/MACDStrategy';
import { BollingerBandsStrategy } from '../strategy/BollingerBandsStrategy';
import { Strategy } from '../strategy/Strategy';
import { OrderType, Order } from '../orderbook/types';
import { PortfolioSnapshot } from '../portfolio/types';
import { MarketData, StrategyContext } from '../strategy/types';

/**
 * BacktestEngine - 回测引擎
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
      default:
        throw new Error(`Unknown strategy: ${name}`);
    }
  }

  /**
   * Generate simulated price data
   * In production, this would load from a data source
   */
  private generatePriceData(): PriceDataPoint[] {
    const data: PriceDataPoint[] = [];
    const tickInterval = this.config.tickInterval ?? 60000; // 1 minute default
    const numTicks = Math.floor((this.config.endTime - this.config.startTime) / tickInterval);

    // Generate realistic-looking price data using random walk
    let price = 100; // Starting price
    const volatility = 0.02; // 2% volatility

    for (let i = 0; i < numTicks; i++) {
      const timestamp = this.config.startTime + i * tickInterval;

      // Random price movement
      const change = (Math.random() - 0.5) * 2 * volatility * price;
      const close = price + change;
      const high = Math.max(price, close) + Math.random() * volatility * price;
      const low = Math.min(price, close) - Math.random() * volatility * price;
      const volume = Math.floor(Math.random() * 10000) + 1000;

      data.push({
        timestamp,
        open: price,
        high,
        low,
        close,
        volume,
      });

      price = close;
    }

    return data;
  }

  /**
   * Update order book with new price data
   */
  private updateOrderBook(price: PriceDataPoint): void {
    // Clear existing orders
    this.orderBook.clear();

    // Add simulated bid/ask orders around the current price
    const spread = price.close * 0.001; // 0.1% spread
    const bidPrice = price.close - spread;
    const askPrice = price.close + spread;

    // Add some liquidity
    for (let i = 0; i < 5; i++) {
      this.orderBook.add({
        id: `bid-${Date.now()}-${i}`,
        type: OrderType.BID,
        price: bidPrice - i * spread,
        quantity: 100 + Math.random() * 900,
        timestamp: price.timestamp,
      });

      this.orderBook.add({
        id: `ask-${Date.now()}-${i}`,
        type: OrderType.ASK,
        price: askPrice + i * spread,
        quantity: 100 + Math.random() * 900,
        timestamp: price.timestamp,
      });
    }

    this.currentPrice = price.close;
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
   * Run the backtest
   */
  run(): BacktestResult {
    this.startTime = Date.now();

    // Generate price data
    const priceData = this.generatePriceData();

    // Initialize strategy (call protected init via subclass access)
    // We'll skip explicit init call and let onTick handle initialization

    // Process each tick
    for (const price of priceData) {
      // Update order book
      this.updateOrderBook(price);

      // Get strategy signal
      const context = this.createStrategyContext();
      const signal = this.strategy.onTick(context);

      // Execute signal if present
      if (signal) {
        const order: Order = {
          id: `order-${price.timestamp}-${signal.side}`,
          type: signal.side === 'buy' ? OrderType.BID : OrderType.ASK,
          price: signal.price,
          quantity: signal.quantity,
          timestamp: price.timestamp,
        };

        const matchResult = this.matchingEngine.submitOrder(order);

        // Process trades
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

      // Record snapshot periodically (every 100 ticks)
      if (priceData.indexOf(price) % 100 === 0) {
        const marketPrices = new Map([[this.config.symbol, price.close]]);
        this.snapshots.push(this.portfolio.getSnapshot(marketPrices));
      }
    }

    // Final snapshot
    const finalPrice = priceData.length > 0 ? priceData[priceData.length - 1].close : 100;
    const marketPrices = new Map([[this.config.symbol, finalPrice]]);
    this.snapshots.push(this.portfolio.getSnapshot(marketPrices));

    this.endTime = Date.now();

    // Calculate statistics
    const stats = this.calculateStats();

    return {
      config: this.config,
      stats,
      snapshots: this.snapshots,
      trades: this.trades,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime - this.startTime,
    };
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

    // Calculate trade statistics
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

    // Calculate Sharpe ratio (simplified)
    const sharpeRatio = this.calculateSharpeRatio();

    // Calculate maximum drawdown
    const maxDrawdown = this.calculateMaxDrawdown();

    // Annualized return (assuming 252 trading days)
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
   * Calculate Sharpe ratio
   */
  private calculateSharpeRatio(): number {
    if (this.snapshots.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < this.snapshots.length; i++) {
      const prevValue = this.snapshots[i - 1].totalValue;
      const currValue = this.snapshots[i].totalValue;
      returns.push((currValue - prevValue) / prevValue);
    }

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Annualize (assuming daily returns, 252 trading days)
    const riskFreeRate = 0.02 / 252; // 2% annual risk-free rate
    const annualizedReturn = avgReturn * 252;
    const annualizedStdDev = stdDev * Math.sqrt(252);

    return annualizedStdDev > 0 ? (annualizedReturn - riskFreeRate * 252) / annualizedStdDev : 0;
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(): number {
    if (this.snapshots.length === 0) return 0;

    let peak = this.snapshots[0].totalValue;
    let maxDrawdown = 0;

    for (const snapshot of this.snapshots) {
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

    // CSV header
    let csv = 'timestamp,cash,totalValue,unrealizedPnL,positions\n';

    // CSV rows
    for (const snapshot of result.snapshots) {
      const positionsStr = JSON.stringify(snapshot.positions);
      csv += `${snapshot.timestamp},${snapshot.cash},${snapshot.totalValue},${snapshot.unrealizedPnL},"${positionsStr}"\n`;
    }

    return csv;
  }
}