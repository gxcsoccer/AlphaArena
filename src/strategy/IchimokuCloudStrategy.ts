/**
 * Ichimoku Cloud Strategy (一目均衡表)
 *
 * A comprehensive technical analysis strategy that provides trend direction,
 * support/resistance levels, and buy/sell signals based on the Ichimoku Cloud.
 *
 * Ichimoku Components:
 * - Tenkan-sen (Conversion Line): (9-period high + 9-period low) / 2
 * - Kijun-sen (Base Line): (26-period high + 26-period low) / 2
 * - Senkou Span A (Leading Span A): (Tenkan-sen + Kijun-sen) / 2, shifted forward 26 periods
 * - Senkou Span B (Leading Span B): (52-period high + 52-period low) / 2, shifted forward 26 periods
 * - Chikou Span (Lagging Span): Close price shifted back 26 periods
 *
 * Trading Signals:
 * - Buy: Price above cloud + Tenkan-sen crosses above Kijun-sen (bullish TK cross)
 * - Sell: Price below cloud + Tenkan-sen crosses below Kijun-sen (bearish TK cross)
 * - Signal strength based on cloud thickness and cross angle
 *
 * Default parameters: tenkan=9, kijun=26, senkouB=52, displacement=26
 */

import { Strategy } from './Strategy';
import { StrategyConfig, StrategyContext, OrderSignal } from './types';

/**
 * Ichimoku Cloud Strategy configuration
 */
export interface IchimokuCloudStrategyConfig extends StrategyConfig {
  params?: {
    /** Tenkan-sen period (default: 9) */
    tenkanPeriod?: number;
    /** Kijun-sen period (default: 26) */
    kijunPeriod?: number;
    /** Senkou Span B period (default: 52) */
    senkouBPeriod?: number;
    /** Displacement/shift period (default: 26) */
    displacement?: number;
    /** Minimum cloud thickness as percentage for signal filtering (default: 0) */
    minCloudThickness?: number;
    /** Quantity to trade per signal */
    tradeQuantity?: number;
  };
}

/**
 * Ichimoku components data
 */
export interface IchimokuComponents {
  /** Tenkan-sen (Conversion Line) - 9 period */
  tenkanSen: number;
  /** Kijun-sen (Base Line) - 26 period */
  kijunSen: number;
  /** Senkou Span A (Leading Span A) - (Tenkan + Kijun) / 2, displaced 26 periods */
  senkouSpanA: number;
  /** Senkou Span B (Leading Span B) - 52 period mid, displaced 26 periods */
  senkouSpanB: number;
  /** Chikou Span (Lagging Span) - Close displaced back 26 periods */
  chikouSpan: number;
}

/**
 * Ichimoku signal data
 */
export interface IchimokuSignal {
  /** Current trend direction */
  trend: 'bullish' | 'bearish' | 'neutral';
  /** Signal strength (0-1) */
  strength: number;
  /** Top of the cloud (max of Span A and B) */
  cloudTop: number;
  /** Bottom of the cloud (min of Span A and B) */
  cloudBottom: number;
  /** Price position relative to cloud */
  priceVsCloud: 'above' | 'below' | 'inside';
  /** Tenkan-sen / Kijun-sen cross status */
  tkCross: 'bullish' | 'bearish' | 'none';
  /** Cloud twist detected (Senkou Span A crosses Span B) */
  kumoTwist: boolean;
}

/**
 * Price data point for Ichimoku calculation
 */
interface PriceData {
  high: number;
  low: number;
  close: number;
}

/**
 * Ichimoku Cloud Strategy - 一目均衡表策略
 *
 * Implements Ichimoku Cloud strategy:
 * - Bullish signal: Price above cloud + TK cross above
 * - Bearish signal: Price below cloud + TK cross below
 * - Cloud twist detection for trend changes
 */
export class IchimokuCloudStrategy extends Strategy {
  private tenkanPeriod: number;
  private kijunPeriod: number;
  private senkouBPeriod: number;
  private displacement: number;
  private minCloudThickness: number;
  private tradeQuantity: number;

  // Price history for calculation (stores high, low, close)
  private priceHistory: PriceData[] = [];
  // Current Ichimoku values
  private currentComponents: IchimokuComponents | null = null;
  private currentSignal: IchimokuSignal | null = null;

  // Store historical values for crossover detection
  private lastTenkanSen: number | null = null;
  private lastKijunSen: number | null = null;

  // Track Senkou Span history for cloud twist detection
  private senkouSpanAHistory: number[] = [];
  private senkouSpanBHistory: number[] = [];

  // Track if we've generated a signal to avoid repeated signals
  private lastGeneratedSignal: 'buy' | 'sell' | null = null;

  constructor(config: IchimokuCloudStrategyConfig) {
    super(config);

    // Default parameters (standard Ichimoku settings)
    this.tenkanPeriod = config.params?.tenkanPeriod ?? 9;
    this.kijunPeriod = config.params?.kijunPeriod ?? 26;
    this.senkouBPeriod = config.params?.senkouBPeriod ?? 52;
    this.displacement = config.params?.displacement ?? 26;
    this.minCloudThickness = config.params?.minCloudThickness ?? 0;
    this.tradeQuantity = config.params?.tradeQuantity ?? 10;

    // Validate parameters
    if (this.tenkanPeriod <= 0 || this.kijunPeriod <= 0 || this.senkouBPeriod <= 0) {
      throw new Error('All periods must be positive');
    }
    if (this.tenkanPeriod >= this.kijunPeriod) {
      throw new Error('Tenkan period must be less than Kijun period');
    }
    if (this.kijunPeriod >= this.senkouBPeriod) {
      throw new Error('Kijun period must be less than Senkou B period');
    }
    if (this.tradeQuantity <= 0) {
      throw new Error('Trade quantity must be positive');
    }
    if (this.minCloudThickness < 0) {
      throw new Error('Minimum cloud thickness must be non-negative');
    }
  }

  /**
   * Initialize strategy
   */
  protected init(_context: StrategyContext): void {
    this.priceHistory = [];
    this.currentComponents = null;
    this.currentSignal = null;
    this.lastTenkanSen = null;
    this.lastKijunSen = null;
    this.senkouSpanAHistory = [];
    this.senkouSpanBHistory = [];
    this.lastGeneratedSignal = null;
  }

  /**
   * Handle tick event - generate trading signals based on Ichimoku Cloud
   */
  onTick(context: StrategyContext): OrderSignal | null {
    const marketData = context.getMarketData();

    // Get price data from order book
    const priceData = this.extractPriceData(marketData.orderBook);
    if (priceData === null) {
      return null;
    }

    // Add to price history
    this.priceHistory.push(priceData);

    // Need at least senkouBPeriod + displacement data points for full calculation
    // Minimum requirement: senkouBPeriod for Senkou Span B
    if (this.priceHistory.length < this.senkouBPeriod) {
      return null;
    }

    // Calculate Ichimoku components
    const components = this.calculateIchimokuComponents();
    if (components === null) {
      return null;
    }

    this.currentComponents = components;

    // Calculate signal data
    const signal = this.calculateIchimokuSignal(components, priceData.close);
    this.currentSignal = signal;

    // Generate trading signal based on conditions
    let orderSignal: OrderSignal | null = null;

    // Check for bullish TK cross with price above cloud
    if (
      signal.tkCross === 'bullish' &&
      signal.priceVsCloud === 'above' &&
      this.lastGeneratedSignal !== 'buy'
    ) {
      // Check minimum cloud thickness if configured
      const cloudThickness = this.calculateCloudThicknessPercent(signal);
      if (cloudThickness >= this.minCloudThickness) {
        orderSignal = this.createSignal('buy', priceData.close, this.tradeQuantity, {
          confidence: signal.strength,
          reason: this.generateSignalReason(signal, components, 'buy'),
        });
        this.lastGeneratedSignal = 'buy';
      }
    }
    // Check for bearish TK cross with price below cloud
    else if (
      signal.tkCross === 'bearish' &&
      signal.priceVsCloud === 'below' &&
      this.lastGeneratedSignal !== 'sell'
    ) {
      // Check minimum cloud thickness if configured
      const cloudThickness = this.calculateCloudThicknessPercent(signal);
      if (cloudThickness >= this.minCloudThickness) {
        orderSignal = this.createSignal('sell', priceData.close, this.tradeQuantity, {
          confidence: signal.strength,
          reason: this.generateSignalReason(signal, components, 'sell'),
        });
        this.lastGeneratedSignal = 'sell';
      }
    }
    // Reset signal state when conditions change
    else if (signal.tkCross === 'none') {
      // Allow new signals when TK lines are not crossing
      this.lastGeneratedSignal = null;
    }

    // Update last values for next crossover detection
    this.lastTenkanSen = components.tenkanSen;
    this.lastKijunSen = components.kijunSen;

    return orderSignal;
  }

  /**
   * Extract price data from order book
   */
  private extractPriceData(orderBook: any): PriceData | null {
    const bestBid = orderBook.getBestBid?.();
    const bestAsk = orderBook.getBestAsk?.();

    if (bestBid !== null && bestAsk !== null) {
      const midPrice = (bestBid + bestAsk) / 2;
      // For order book, use mid price as high, low, and close
      // In real trading, you'd use actual candle data
      return {
        high: midPrice,
        low: midPrice,
        close: midPrice,
      };
    }

    return null;
  }

  /**
   * Calculate Ichimoku components
   */
  private calculateIchimokuComponents(): IchimokuComponents | null {
    if (this.priceHistory.length < this.senkouBPeriod) {
      return null;
    }

    // Calculate Tenkan-sen (9-period mid)
    const tenkanSen = this.calculateMidPoint(this.tenkanPeriod);

    // Calculate Kijun-sen (26-period mid)
    const kijunSen = this.calculateMidPoint(this.kijunPeriod);

    // Calculate Senkou Span A ((Tenkan + Kijun) / 2)
    // This is projected forward by displacement periods
    const senkouSpanA = (tenkanSen + kijunSen) / 2;

    // Calculate Senkou Span B (52-period mid)
    // This is projected forward by displacement periods
    const senkouSpanB = this.calculateMidPoint(this.senkouBPeriod);

    // Store for twist detection
    this.senkouSpanAHistory.push(senkouSpanA);
    this.senkouSpanBHistory.push(senkouSpanB);

    // Keep only recent history for twist detection
    if (this.senkouSpanAHistory.length > this.displacement + 2) {
      this.senkouSpanAHistory.shift();
      this.senkouSpanBHistory.shift();
    }

    // Calculate Chikou Span (close shifted back 26 periods)
    let chikouSpan: number;
    if (this.priceHistory.length > this.displacement) {
      chikouSpan = this.priceHistory[this.priceHistory.length - this.displacement - 1].close;
    } else {
      chikouSpan = this.priceHistory[0].close; // Fallback for early data
    }

    return {
      tenkanSen,
      kijunSen,
      senkouSpanA,
      senkouSpanB,
      chikouSpan,
    };
  }

  /**
   * Calculate mid point (high + low) / 2 for a given period
   */
  private calculateMidPoint(period: number): number {
    if (this.priceHistory.length < period) {
      throw new Error('Not enough price history');
    }

    const recentPrices = this.priceHistory.slice(-period);
    const highestHigh = Math.max(...recentPrices.map(p => p.high));
    const lowestLow = Math.min(...recentPrices.map(p => p.low));

    return (highestHigh + lowestLow) / 2;
  }

  /**
   * Calculate Ichimoku signal data
   */
  private calculateIchimokuSignal(
    components: IchimokuComponents,
    currentPrice: number
  ): IchimokuSignal {
    // Determine cloud top and bottom
    const cloudTop = Math.max(components.senkouSpanA, components.senkouSpanB);
    const cloudBottom = Math.min(components.senkouSpanA, components.senkouSpanB);

    // Determine price position relative to cloud
    let priceVsCloud: 'above' | 'below' | 'inside';
    if (currentPrice > cloudTop) {
      priceVsCloud = 'above';
    } else if (currentPrice < cloudBottom) {
      priceVsCloud = 'below';
    } else {
      priceVsCloud = 'inside';
    }

    // Determine TK cross status
    let tkCross: 'bullish' | 'bearish' | 'none' = 'none';
    if (this.lastTenkanSen !== null && this.lastKijunSen !== null) {
      // Bullish cross: Tenkan crosses above Kijun
      if (
        this.lastTenkanSen <= this.lastKijunSen &&
        components.tenkanSen > components.kijunSen
      ) {
        tkCross = 'bullish';
      }
      // Bearish cross: Tenkan crosses below Kijun
      else if (
        this.lastTenkanSen >= this.lastKijunSen &&
        components.tenkanSen < components.kijunSen
      ) {
        tkCross = 'bearish';
      }
    }

    // Detect cloud twist (Senkou Span A crosses Span B)
    let kumoTwist = false;
    if (this.senkouSpanAHistory.length >= 2 && this.senkouSpanBHistory.length >= 2) {
      const prevA = this.senkouSpanAHistory[this.senkouSpanAHistory.length - 2];
      const prevB = this.senkouSpanBHistory[this.senkouSpanBHistory.length - 2];
      const currA = components.senkouSpanA;
      const currB = components.senkouSpanB;

      // Bullish twist: A crosses above B
      // Bearish twist: A crosses below B
      kumoTwist =
        (prevA <= prevB && currA > currB) || (prevA >= prevB && currA < currB);
    }

    // Determine trend
    let trend: 'bullish' | 'bearish' | 'neutral';
    if (priceVsCloud === 'above' && tkCross === 'bullish') {
      trend = 'bullish';
    } else if (priceVsCloud === 'below' && tkCross === 'bearish') {
      trend = 'bearish';
    } else if (priceVsCloud === 'above') {
      trend = 'bullish';
    } else if (priceVsCloud === 'below') {
      trend = 'bearish';
    } else {
      trend = 'neutral';
    }

    // Calculate signal strength
    const strength = this.calculateSignalStrength(
      components,
      currentPrice,
      cloudTop,
      cloudBottom,
      tkCross,
      kumoTwist
    );

    return {
      trend,
      strength,
      cloudTop,
      cloudBottom,
      priceVsCloud,
      tkCross,
      kumoTwist,
    };
  }

  /**
   * Calculate signal strength based on multiple factors
   */
  private calculateSignalStrength(
    components: IchimokuComponents,
    currentPrice: number,
    cloudTop: number,
    cloudBottom: number,
    tkCross: 'bullish' | 'bearish' | 'none',
    kumoTwist: boolean
  ): number {
    let strength = 0.5; // Base strength

    // Factor 1: Cloud thickness (thicker cloud = stronger support/resistance)
    const cloudThickness = cloudTop - cloudBottom;
    const midCloud = (cloudTop + cloudBottom) / 2;
    const cloudThicknessPercent = cloudThickness / midCloud;
    
    // Normalize cloud thickness contribution (0 to 0.2)
    const cloudContribution = Math.min(cloudThicknessPercent * 2, 0.2);
    strength += cloudContribution;

    // Factor 2: Distance from cloud (further = stronger trend)
    const distanceFromCloud =
      currentPrice > cloudTop
        ? (currentPrice - cloudTop) / cloudTop
        : currentPrice < cloudBottom
        ? (cloudBottom - currentPrice) / cloudBottom
        : 0;

    // Normalize distance contribution (0 to 0.15)
    const distanceContribution = Math.min(distanceFromCloud * 2, 0.15);
    strength += distanceContribution;

    // Factor 3: TK cross strength (actual cross = stronger signal)
    if (tkCross === 'bullish' || tkCross === 'bearish') {
      strength += 0.15;
    }

    // Factor 4: Cloud twist (adds confirmation)
    if (kumoTwist) {
      strength += 0.1;
    }

    // Factor 5: All three signals aligned (TK cross, price above/below cloud, cloud color)
    const bullishCloud = components.senkouSpanA > components.senkouSpanB;
    const bearishCloud = components.senkouSpanA < components.senkouSpanB;
    
    if (tkCross === 'bullish' && bullishCloud) {
      strength += 0.1;
    } else if (tkCross === 'bearish' && bearishCloud) {
      strength += 0.1;
    }

    return Math.min(Math.max(strength, 0), 1);
  }

  /**
   * Calculate cloud thickness as percentage
   */
  private calculateCloudThicknessPercent(signal: IchimokuSignal): number {
    const midCloud = (signal.cloudTop + signal.cloudBottom) / 2;
    return ((signal.cloudTop - signal.cloudBottom) / midCloud) * 100;
  }

  /**
   * Generate human-readable signal reason
   */
  private generateSignalReason(
    signal: IchimokuSignal,
    components: IchimokuComponents,
    side: 'buy' | 'sell'
  ): string {
    const reasons: string[] = [];

    if (side === 'buy') {
      reasons.push('Ichimoku Bullish Signal');
      if (signal.tkCross === 'bullish') {
        reasons.push(
          `TK Cross: Tenkan(${components.tenkanSen.toFixed(2)}) > Kijun(${components.kijunSen.toFixed(2)})`
        );
      }
      if (signal.priceVsCloud === 'above') {
        reasons.push(`Price above cloud (${signal.cloudTop.toFixed(2)} - ${signal.cloudBottom.toFixed(2)})`);
      }
      if (components.senkouSpanA > components.senkouSpanB) {
        reasons.push('Bullish cloud (Span A > Span B)');
      }
    } else {
      reasons.push('Ichimoku Bearish Signal');
      if (signal.tkCross === 'bearish') {
        reasons.push(
          `TK Cross: Tenkan(${components.tenkanSen.toFixed(2)}) < Kijun(${components.kijunSen.toFixed(2)})`
        );
      }
      if (signal.priceVsCloud === 'below') {
        reasons.push(`Price below cloud (${signal.cloudBottom.toFixed(2)} - ${signal.cloudTop.toFixed(2)})`);
      }
      if (components.senkouSpanA < components.senkouSpanB) {
        reasons.push('Bearish cloud (Span A < Span B)');
      }
    }

    if (signal.kumoTwist) {
      reasons.push('Cloud twist detected');
    }

    return reasons.join('. ');
  }

  /**
   * Get current Ichimoku components
   */
  getComponents(): IchimokuComponents | null {
    return this.currentComponents;
  }

  /**
   * Get current Ichimoku signal data
   */
  getSignal(): IchimokuSignal | null {
    return this.currentSignal;
  }

  /**
   * Get Tenkan-sen value
   */
  getTenkanSen(): number | null {
    return this.currentComponents?.tenkanSen ?? null;
  }

  /**
   * Get Kijun-sen value
   */
  getKijunSen(): number | null {
    return this.currentComponents?.kijunSen ?? null;
  }

  /**
   * Get Senkou Span A value
   */
  getSenkouSpanA(): number | null {
    return this.currentComponents?.senkouSpanA ?? null;
  }

  /**
   * Get Senkou Span B value
   */
  getSenkouSpanB(): number | null {
    return this.currentComponents?.senkouSpanB ?? null;
  }

  /**
   * Get Chikou Span value
   */
  getChikouSpan(): number | null {
    return this.currentComponents?.chikouSpan ?? null;
  }

  /**
   * Get cloud top value
   */
  getCloudTop(): number | null {
    return this.currentSignal?.cloudTop ?? null;
  }

  /**
   * Get cloud bottom value
   */
  getCloudBottom(): number | null {
    return this.currentSignal?.cloudBottom ?? null;
  }

  /**
   * Get price history length
   */
  getPriceHistoryLength(): number {
    return this.priceHistory.length;
  }

  /**
   * Check if strategy has enough data to generate signals
   */
  isReady(): boolean {
    return (
      this.priceHistory.length >= this.senkouBPeriod &&
      this.currentComponents !== null &&
      this.currentSignal !== null
    );
  }

  /**
   * Get current trend
   */
  getTrend(): 'bullish' | 'bearish' | 'neutral' | null {
    return this.currentSignal?.trend ?? null;
  }

  /**
   * Check if price is above cloud
   */
  isPriceAboveCloud(): boolean {
    return this.currentSignal?.priceVsCloud === 'above';
  }

  /**
   * Check if price is below cloud
   */
  isPriceBelowCloud(): boolean {
    return this.currentSignal?.priceVsCloud === 'below';
  }

  /**
   * Check if there's a bullish TK cross
   */
  hasBullishTKCross(): boolean {
    return this.currentSignal?.tkCross === 'bullish';
  }

  /**
   * Check if there's a bearish TK cross
   */
  hasBearishTKCross(): boolean {
    return this.currentSignal?.tkCross === 'bearish';
  }

  /**
   * Check for cloud twist
   */
  hasKumoTwist(): boolean {
    return this.currentSignal?.kumoTwist ?? false;
  }

  /**
   * Reset strategy state (useful for backtesting)
   */
  reset(): void {
    this.priceHistory = [];
    this.currentComponents = null;
    this.currentSignal = null;
    this.lastTenkanSen = null;
    this.lastKijunSen = null;
    this.senkouSpanAHistory = [];
    this.senkouSpanBHistory = [];
    this.lastGeneratedSignal = null;
  }
}
