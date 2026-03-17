/**
 * Elliott Wave Strategy
 *
 * A comprehensive technical analysis strategy implementing the Elliott Wave Principle.
 * Identifies wave patterns (impulse waves 1-2-3-4-5 and corrective waves A-B-C) and
 * generates trading signals based on wave completion and Fibonacci ratios.
 *
 * Wave Degrees (from largest to smallest):
 * - Grand Supercycle
 * - Supercycle
 * - Cycle
 * - Primary
 * - Intermediate
 * - Minor
 * - Minute
 * - Minuette
 * - Subminuette
 *
 * Key Fibonacci Ratios for Wave Analysis:
 * - Wave 2 retraces 50-61.8% of Wave 1
 * - Wave 3 is typically 161.8% of Wave 1
 * - Wave 4 retraces 38.2% of Wave 3
 * - Wave 5 is often 61.8-100% of Wave 1
 * - Wave C is often 161.8% of Wave A
 */

import { Strategy } from './Strategy';
import { StrategyConfig, StrategyContext, OrderSignal } from './types';

/**
 * Standard Fibonacci ratios used in Elliott Wave analysis
 */
export const ELLIOTT_FIBONACCI = {
  RETRACE_236: 0.236,
  RETRACE_382: 0.382,
  RETRACE_500: 0.5,
  RETRACE_618: 0.618,
  RETRACE_786: 0.786,
  EXT_618: 1.618,
  EXT_262: 2.618,
  EXT_423: 4.236,
} as const;

/**
 * Wave degree levels
 */
export type WaveDegree =
  | 'grand_supercycle'
  | 'supercycle'
  | 'cycle'
  | 'primary'
  | 'intermediate'
  | 'minor'
  | 'minute'
  | 'minuette'
  | 'subminuette';

/**
 * Wave type classification
 */
export type WaveType = 'impulse' | 'corrective' | 'unknown';

/**
 * Wave direction
 */
export type WaveDirection = 'up' | 'down';

/**
 * Individual wave point
 */
export interface WavePoint {
  price: number;
  index: number;
  timestamp: number;
}

/**
 * A single wave in the Elliott Wave pattern
 */
export interface Wave {
  number: number; // 1-5 for impulse, 0=A, 1=B, 2=C for corrective (internal representation)
  type: WaveType;
  direction: WaveDirection;
  startPoint: WavePoint;
  endPoint: WavePoint;
  amplitude: number; // Price difference
  retracement?: number; // For wave 2 and 4, the retracement percentage
  fibonacciRatio?: number; // Actual Fibonacci ratio relationship
}

/**
 * Complete Elliott Wave pattern
 */
export interface ElliottWavePattern {
  type: WaveType;
  degree: WaveDegree;
  waves: Wave[];
  startPoint: WavePoint;
  endPoint?: WavePoint;
  isComplete: boolean;
  confidence: number;
  targetPrice?: number;
  stopLoss?: number;
}

/**
 * Swing point (peak or trough)
 */
export interface ElliottSwingPoint {
  price: number;
  index: number;
  type: 'peak' | 'trough';
  timestamp: number;
}

/**
 * Elliott Wave Strategy configuration
 */
export interface ElliottWaveStrategyConfig extends StrategyConfig {
  params?: {
    /** Swing detection period (default: 5) */
    swingPeriod?: number;
    /** Minimum data points required (default: 100) */
    minDataPoints?: number;
    /** Fibonacci tolerance for wave validation (default: 0.1 = 10%) */
    fibTolerance?: number;
    /** Trade quantity per signal */
    tradeQuantity?: number;
    /** Minimum wave amplitude as percentage (default: 0.005 = 0.5%) */
    minWaveAmplitude?: number;
    /** Signal confidence base (default: 0.6) */
    baseConfidence?: number;
    /** Enable multi-degree analysis (default: true) */
    multiDegree?: boolean;
    /** Wave degree for analysis (default: 'minor') */
    analysisDegree?: WaveDegree;
  };
}

/**
 * Wave validation result
 */
interface WaveValidation {
  isValid: boolean;
  confidence: number;
  issues: string[];
}

/**
 * Elliott Wave Strategy Implementation
 *
 * This strategy implements the Elliott Wave Principle to identify market patterns
 * and generate trading signals based on wave completion and Fibonacci ratios.
 */
export class ElliottWaveStrategy extends Strategy {
  private swingPeriod: number;
  private minDataPoints: number;
  private fibTolerance: number;
  private tradeQuantity: number;
  private minWaveAmplitude: number;
  private baseConfidence: number;
  private multiDegree: boolean;
  private analysisDegree: WaveDegree;

  // Price history
  private priceHistory: number[] = [];
  private highHistory: number[] = [];
  private lowHistory: number[] = [];
  private timestampHistory: number[] = [];

  // Swing points
  private swingPoints: ElliottSwingPoint[] = [];

  // Current wave patterns
  private currentPattern: ElliottWavePattern | null = null;
  private previousPatterns: ElliottWavePattern[] = [];

  // Track last signal
  private lastSignal: 'buy' | 'sell' | null = null;
  private lastSignalPrice: number | null = null;
  private lastSignalTime: number = 0;

  // Signal cooldown to prevent overtrading
  private signalCooldown: number = 5; // Number of ticks between signals

  constructor(config: ElliottWaveStrategyConfig) {
    super(config);

    // Default parameters
    this.swingPeriod = config.params?.swingPeriod ?? 5;
    this.minDataPoints = config.params?.minDataPoints ?? 100;
    this.fibTolerance = config.params?.fibTolerance ?? 0.1;
    this.tradeQuantity = config.params?.tradeQuantity ?? 10;
    this.minWaveAmplitude = config.params?.minWaveAmplitude ?? 0.005;
    this.baseConfidence = config.params?.baseConfidence ?? 0.6;
    this.multiDegree = config.params?.multiDegree ?? true;
    this.analysisDegree = config.params?.analysisDegree ?? 'minor';

    // Validate parameters
    if (this.swingPeriod < 2) {
      throw new Error('Swing period must be at least 2');
    }
    if (this.minDataPoints < 50) {
      throw new Error('Minimum data points must be at least 50');
    }
    if (this.fibTolerance <= 0 || this.fibTolerance > 0.3) {
      throw new Error('Fibonacci tolerance must be between 0 and 0.3');
    }
    if (this.tradeQuantity <= 0) {
      throw new Error('Trade quantity must be positive');
    }
  }

  /**
   * Initialize strategy
   */
  protected init(_context: StrategyContext): void {
    this.priceHistory = [];
    this.highHistory = [];
    this.lowHistory = [];
    this.timestampHistory = [];
    this.swingPoints = [];
    this.currentPattern = null;
    this.previousPatterns = [];
    this.lastSignal = null;
    this.lastSignalPrice = null;
    this.lastSignalTime = 0;
  }

  /**
   * Handle tick event
   */
  onTick(context: StrategyContext): OrderSignal | null {
    const marketData = context.getMarketData();

    // Get mid price from order book
    const midPrice = this.getMidPrice(marketData.orderBook);
    if (midPrice === null) {
      return null;
    }

    // Add price to history
    this.priceHistory.push(midPrice);
    this.highHistory.push(midPrice); // In backtest, use mid as high/low
    this.lowHistory.push(midPrice);
    this.timestampHistory.push(context.clock);

    // Need minimum data points to start analysis
    if (this.priceHistory.length < this.minDataPoints) {
      return null;
    }

    // Identify swing points
    this.identifySwingPoints();

    // Analyze Elliott Wave patterns
    this.analyzeWavePattern();

    // Generate signal based on wave pattern
    return this.generateSignal(midPrice, context.clock);
  }

  /**
   * Get mid price from order book
   */
  private getMidPrice(orderBook: any): number | null {
    const bestBid = orderBook.getBestBid?.();
    const bestAsk = orderBook.getBestAsk?.();

    if (bestBid !== null && bestAsk !== null) {
      return (bestBid + bestAsk) / 2;
    }

    return null;
  }

  /**
   * Identify swing points (peaks and troughs)
   */
  private identifySwingPoints(): void {
    const len = this.priceHistory.length;
    const n = this.swingPeriod;

    if (len < 2 * n + 1) {
      return;
    }

    // Check for swing point at position len - n - 1
    const idx = len - n - 1;
    const price = this.priceHistory[idx];

    // Check for peak (local maximum)
    let isPeak = true;
    for (let i = 1; i <= n; i++) {
      if (this.priceHistory[idx - i] >= price || this.priceHistory[idx + i] >= price) {
        isPeak = false;
        break;
      }
    }

    if (isPeak) {
      // Remove any trough that might be overwritten
      this.swingPoints = this.swingPoints.filter(sp => sp.index !== idx);
      this.swingPoints.push({
        price,
        index: idx,
        type: 'peak',
        timestamp: this.timestampHistory[idx],
      });
    }

    // Check for trough (local minimum)
    let isTrough = true;
    for (let i = 1; i <= n; i++) {
      if (this.priceHistory[idx - i] <= price || this.priceHistory[idx + i] <= price) {
        isTrough = false;
        break;
      }
    }

    if (isTrough) {
      // Remove any peak that might be overwritten
      this.swingPoints = this.swingPoints.filter(sp => sp.index !== idx);
      this.swingPoints.push({
        price,
        index: idx,
        type: 'trough',
        timestamp: this.timestampHistory[idx],
      });
    }

    // Keep swing points sorted by index
    this.swingPoints.sort((a, b) => a.index - b.index);

    // Limit swing points to prevent memory issues
    if (this.swingPoints.length > 200) {
      this.swingPoints = this.swingPoints.slice(-200);
    }
  }

  /**
   * Analyze and identify Elliott Wave patterns
   */
  private analyzeWavePattern(): void {
    if (this.swingPoints.length < 6) {
      return; // Need at least 6 points for a 5-wave pattern (alternating peaks/troughs)
    }

    // Try to identify impulse wave (5-wave pattern)
    const impulsePattern = this.identifyImpulseWave();
    if (impulsePattern) {
      this.currentPattern = impulsePattern;
      return;
    }

    // Try to identify corrective wave (ABC pattern)
    const correctivePattern = this.identifyCorrectiveWave();
    if (correctivePattern) {
      this.currentPattern = correctivePattern;
    }
  }

  /**
   * Identify impulse wave pattern (1-2-3-4-5)
   */
  private identifyImpulseWave(): ElliottWavePattern | null {
    const points = this.swingPoints;
    const len = points.length;

    if (len < 5) {
      return null;
    }

    // Look for 5-wave impulse pattern
    // Pattern: Trough-Peak-Trough-Peak-Trough (bullish) or Peak-Trough-Peak-Trough-Peak (bearish)
    for (let startIdx = Math.max(0, len - 15); startIdx <= len - 5; startIdx++) {
      const pattern = this.validateImpulseWave(points.slice(startIdx, startIdx + 5));
      if (pattern) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Validate a potential 5-wave impulse pattern
   */
  private validateImpulseWave(swingPoints: ElliottSwingPoint[]): ElliottWavePattern | null {
    if (swingPoints.length < 5) {
      return null;
    }

    // Check alternating pattern
    const isBullish = swingPoints[0].type === 'trough';

    for (let i = 0; i < 5; i++) {
      const expectedType = isBullish ? (i % 2 === 0 ? 'trough' : 'peak') : (i % 2 === 0 ? 'peak' : 'trough');
      if (swingPoints[i].type !== expectedType) {
        return null;
      }
    }

    // Extract wave points
    const waves: Wave[] = [];
    const direction: WaveDirection = isBullish ? 'up' : 'down';

    for (let i = 0; i < 5; i++) {
      const startPoint: WavePoint = {
        price: swingPoints[i].price,
        index: swingPoints[i].index,
        timestamp: swingPoints[i].timestamp,
      };
      const endPoint: WavePoint = {
        price: swingPoints[i + 1]?.price ?? this.priceHistory[this.priceHistory.length - 1],
        index: swingPoints[i + 1]?.index ?? this.priceHistory.length - 1,
        timestamp: swingPoints[i + 1]?.timestamp ?? this.timestampHistory[this.timestampHistory.length - 1],
      };

      const amplitude = Math.abs(endPoint.price - startPoint.price);

      waves.push({
        number: i + 1,
        type: 'impulse',
        direction: i % 2 === 0 ? direction : (direction === 'up' ? 'down' : 'up'),
        startPoint,
        endPoint,
        amplitude,
      });
    }

    // Validate Fibonacci ratios
    const validation = this.validateImpulseFibonacci(waves);
    if (!validation.isValid) {
      return null;
    }

    // Calculate target and stop loss
    const lastPrice = this.priceHistory[this.priceHistory.length - 1];
    const wave5 = waves[4];
    const wave4 = waves[3];
    const wave1 = waves[0];
    const wave3 = waves[2];

    let targetPrice: number;
    let stopLoss: number;

    if (isBullish) {
      targetPrice = wave5.endPoint.price + (wave3.amplitude * ELLIOTT_FIBONACCI.EXT_618);
      stopLoss = Math.min(wave4.startPoint.price, wave4.endPoint.price) * 0.99;
    } else {
      targetPrice = wave5.endPoint.price - (wave3.amplitude * ELLIOTT_FIBONACCI.EXT_618);
      stopLoss = Math.max(wave4.startPoint.price, wave4.endPoint.price) * 1.01;
    }

    return {
      type: 'impulse',
      degree: this.analysisDegree,
      waves,
      startPoint: waves[0].startPoint,
      endPoint: waves[4].endPoint,
      isComplete: true,
      confidence: validation.confidence,
      targetPrice,
      stopLoss,
    };
  }

  /**
   * Validate Fibonacci ratios for impulse wave
   */
  private validateImpulseFibonacci(waves: Wave[]): WaveValidation {
    const issues: string[] = [];
    let confidence = this.baseConfidence;

    if (waves.length < 5) {
      return { isValid: false, confidence: 0, issues: ['Insufficient waves'] };
    }

    const wave1 = waves[0];
    const wave2 = waves[1];
    const wave3 = waves[2];
    const wave4 = waves[3];
    const wave5 = waves[4];

    // Wave 2 should retrace 50-61.8% of Wave 1
    if (wave1.amplitude > 0) {
      const wave2Retrace = wave2.amplitude / wave1.amplitude;
      if (wave2Retrace >= ELLIOTT_FIBONACCI.RETRACE_500 - this.fibTolerance &&
          wave2Retrace <= ELLIOTT_FIBONACCI.RETRACE_786 + this.fibTolerance) {
        confidence += 0.05;
        wave2.retracement = wave2Retrace;
      } else if (wave2Retrace > ELLIOTT_FIBONACCI.RETRACE_786 + this.fibTolerance) {
        issues.push(`Wave 2 retracement ${wave2Retrace.toFixed(3)} exceeds 78.6%`);
        confidence -= 0.1;
      }
    }

    // Wave 3 should be 161.8% of Wave 1 (extended)
    if (wave1.amplitude > 0) {
      const wave3Ratio = wave3.amplitude / wave1.amplitude;
      if (wave3Ratio >= ELLIOTT_FIBONACCI.EXT_618 - this.fibTolerance) {
        confidence += 0.1;
        wave3.fibonacciRatio = wave3Ratio;
      } else if (wave3Ratio < 1) {
        issues.push(`Wave 3 ratio ${wave3Ratio.toFixed(3)} is less than Wave 1`);
        confidence -= 0.1;
      }
    }

    // Wave 3 should not be the shortest
    if (wave3.amplitude < wave1.amplitude && wave3.amplitude < wave5.amplitude) {
      issues.push('Wave 3 is the shortest wave');
      confidence -= 0.15;
    }

    // Wave 4 should retrace 38.2% of Wave 3
    if (wave3.amplitude > 0) {
      const wave4Retrace = wave4.amplitude / wave3.amplitude;
      if (wave4Retrace >= ELLIOTT_FIBONACCI.RETRACE_236 - this.fibTolerance &&
          wave4Retrace <= ELLIOTT_FIBONACCI.RETRACE_618 + this.fibTolerance) {
        confidence += 0.05;
        wave4.retracement = wave4Retrace;
      }
    }

    // Wave 2 and Wave 4 should not overlap (in strict Elliott Wave)
    const wave2End = wave2.endPoint.price;
    const wave4Start = wave4.startPoint.price;
    const wave1End = wave1.endPoint.price;

    if (Math.abs(wave2End - wave4Start) / wave1End < 0.01) {
      issues.push('Wave 2 and Wave 4 overlap detected');
      confidence -= 0.1;
    }

    // Check minimum amplitude
    for (const wave of waves) {
      const avgPrice = (wave.startPoint.price + wave.endPoint.price) / 2;
      const amplitudePct = wave.amplitude / avgPrice;
      if (amplitudePct < this.minWaveAmplitude) {
        issues.push(`Wave ${wave.number} amplitude too small: ${(amplitudePct * 100).toFixed(3)}%`);
        confidence -= 0.05;
      }
    }

    return {
      isValid: confidence >= 0.5 && issues.length < 3,
      confidence: Math.max(0.3, Math.min(0.95, confidence)),
      issues,
    };
  }

  /**
   * Identify corrective wave pattern (A-B-C)
   */
  private identifyCorrectiveWave(): ElliottWavePattern | null {
    const points = this.swingPoints;
    const len = points.length;

    if (len < 3) {
      return null;
    }

    // Look for 3-wave corrective pattern
    for (let startIdx = Math.max(0, len - 10); startIdx <= len - 3; startIdx++) {
      const pattern = this.validateCorrectiveWave(points.slice(startIdx, startIdx + 3));
      if (pattern) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Validate a potential 3-wave corrective pattern (A-B-C)
   */
  private validateCorrectiveWave(swingPoints: ElliottSwingPoint[]): ElliottWavePattern | null {
    if (swingPoints.length < 3) {
      return null;
    }

    // Check alternating pattern
    const isZigzag = swingPoints[0].type === swingPoints[2].type;
    if (!isZigzag) {
      // Flat or irregular correction
      return null;
    }

    // Create waves
    const waves: Wave[] = [];
    const direction: WaveDirection = swingPoints[0].type === 'peak' ? 'down' : 'up';

    const waveLabels = ['A', 'B', 'C'];
    for (let i = 0; i < 3; i++) {
      const startPoint: WavePoint = {
        price: swingPoints[i].price,
        index: swingPoints[i].index,
        timestamp: swingPoints[i].timestamp,
      };
      const endPoint: WavePoint = {
        price: swingPoints[i + 1]?.price ?? this.priceHistory[this.priceHistory.length - 1],
        index: swingPoints[i + 1]?.index ?? this.priceHistory.length - 1,
        timestamp: swingPoints[i + 1]?.timestamp ?? this.timestampHistory[this.timestampHistory.length - 1],
      };

      const amplitude = Math.abs(endPoint.price - startPoint.price);

      waves.push({
        number: i, // 0=A, 1=B, 2=C internally
        type: 'corrective',
        direction: i % 2 === 0 ? direction : (direction === 'up' ? 'down' : 'up'),
        startPoint,
        endPoint,
        amplitude,
      });
    }

    // Validate Fibonacci ratios for correction
    const validation = this.validateCorrectiveFibonacci(waves);
    if (!validation.isValid) {
      return null;
    }

    // Calculate target (end of correction)
    const lastPrice = this.priceHistory[this.priceHistory.length - 1];
    const waveA = waves[0];
    const waveC = waves[2];

    // After ABC correction, expect trend continuation
    const targetPrice = direction === 'down' 
      ? waveC.endPoint.price - (waveA.amplitude * ELLIOTT_FIBONACCI.EXT_618)
      : waveC.endPoint.price + (waveA.amplitude * ELLIOTT_FIBONACCI.EXT_618);

    const stopLoss = direction === 'down'
      ? Math.max(waveC.startPoint.price, waveC.endPoint.price) * 1.01
      : Math.min(waveC.startPoint.price, waveC.endPoint.price) * 0.99;

    return {
      type: 'corrective',
      degree: this.analysisDegree,
      waves,
      startPoint: waves[0].startPoint,
      endPoint: waves[2].endPoint,
      isComplete: true,
      confidence: validation.confidence,
      targetPrice,
      stopLoss,
    };
  }

  /**
   * Validate Fibonacci ratios for corrective wave
   */
  private validateCorrectiveFibonacci(waves: Wave[]): WaveValidation {
    const issues: string[] = [];
    let confidence = this.baseConfidence;

    if (waves.length < 3) {
      return { isValid: false, confidence: 0, issues: ['Insufficient waves'] };
    }

    const waveA = waves[0];
    const waveB = waves[1];
    const waveC = waves[2];

    // Wave B should retrace 38.2-78.6% of Wave A
    if (waveA.amplitude > 0) {
      const waveBRetrace = waveB.amplitude / waveA.amplitude;
      if (waveBRetrace >= ELLIOTT_FIBONACCI.RETRACE_236 - this.fibTolerance &&
          waveBRetrace <= ELLIOTT_FIBONACCI.EXT_618 + this.fibTolerance) {
        confidence += 0.05;
        waveB.retracement = waveBRetrace;
      } else if (waveBRetrace > ELLIOTT_FIBONACCI.EXT_618) {
        issues.push(`Wave B retracement ${waveBRetrace.toFixed(3)} exceeds 161.8%`);
        confidence -= 0.1;
      }
    }

    // Wave C is often 61.8% or 161.8% of Wave A
    if (waveA.amplitude > 0) {
      const waveCRatio = waveC.amplitude / waveA.amplitude;
      if (Math.abs(waveCRatio - ELLIOTT_FIBONACCI.RETRACE_618) < this.fibTolerance ||
          Math.abs(waveCRatio - ELLIOTT_FIBONACCI.EXT_618) < this.fibTolerance ||
          Math.abs(waveCRatio - 1) < this.fibTolerance) {
        confidence += 0.1;
        waveC.fibonacciRatio = waveCRatio;
      }
    }

    // Check minimum amplitude
    for (const wave of waves) {
      const avgPrice = (wave.startPoint.price + wave.endPoint.price) / 2;
      const amplitudePct = wave.amplitude / avgPrice;
      if (amplitudePct < this.minWaveAmplitude) {
        issues.push(`Wave amplitude too small: ${(amplitudePct * 100).toFixed(3)}%`);
        confidence -= 0.05;
      }
    }

    return {
      isValid: confidence >= 0.5 && issues.length < 2,
      confidence: Math.max(0.3, Math.min(0.9, confidence)),
      issues,
    };
  }

  /**
   * Generate trading signal based on wave pattern
   */
  private generateSignal(currentPrice: number, timestamp: number): OrderSignal | null {
    if (!this.currentPattern || !this.currentPattern.isComplete) {
      return null;
    }

    // Check signal cooldown
    if (timestamp - this.lastSignalTime < this.signalCooldown) {
      return null;
    }

    // Check if we already signaled at this price level
    if (this.lastSignalPrice !== null) {
      const priceDiff = Math.abs(currentPrice - this.lastSignalPrice) / currentPrice;
      if (priceDiff < 0.005) {
        return null;
      }
    }

    const pattern = this.currentPattern;
    let signal: OrderSignal | null = null;

    if (pattern.type === 'impulse') {
      // Impulse wave completed - look for correction entry
      signal = this.generateImpulseSignal(pattern, currentPrice, timestamp);
    } else if (pattern.type === 'corrective') {
      // Corrective wave completed - look for trend continuation
      signal = this.generateCorrectiveSignal(pattern, currentPrice, timestamp);
    }

    if (signal) {
      this.lastSignal = signal.side;
      this.lastSignalPrice = currentPrice;
      this.lastSignalTime = timestamp;

      // Store pattern history
      this.previousPatterns.push(pattern);
      if (this.previousPatterns.length > 10) {
        this.previousPatterns.shift();
      }
    }

    return signal;
  }

  /**
   * Generate signal for completed impulse wave
   */
  private generateImpulseSignal(
    pattern: ElliottWavePattern,
    currentPrice: number,
    timestamp: number
  ): OrderSignal | null {
    const waves = pattern.waves;
    const wave5 = waves[4];
    const wave4 = waves[3];
    const lastWaveDirection = wave5.direction;

    // After a completed impulse wave, expect correction
    // Signal in the opposite direction of the impulse
    if (lastWaveDirection === 'up') {
      // Bullish impulse completed - look for short entry (expecting correction)
      // Or wait for correction to buy
      if (this.lastSignal !== 'sell') {
        return this.createSignal('sell', currentPrice, this.tradeQuantity, {
          confidence: pattern.confidence * 0.8,
          reason: `Elliott Wave: Bullish impulse (W1-5) completed near ${currentPrice.toFixed(2)}. Expecting ABC correction.`,
        });
      }
    } else {
      // Bearish impulse completed - look for long entry (expecting correction)
      if (this.lastSignal !== 'buy') {
        return this.createSignal('buy', currentPrice, this.tradeQuantity, {
          confidence: pattern.confidence * 0.8,
          reason: `Elliott Wave: Bearish impulse (W1-5) completed near ${currentPrice.toFixed(2)}. Expecting ABC correction.`,
        });
      }
    }

    return null;
  }

  /**
   * Generate signal for completed corrective wave
   */
  private generateCorrectiveSignal(
    pattern: ElliottWavePattern,
    currentPrice: number,
    timestamp: number
  ): OrderSignal | null {
    const waves = pattern.waves;
    const waveC = waves[2];
    const lastWaveDirection = waveC.direction;

    // After a completed corrective wave, expect trend continuation
    if (lastWaveDirection === 'down') {
      // Corrective wave C completed downward - expect bullish continuation
      if (this.lastSignal !== 'buy' && pattern.targetPrice && pattern.targetPrice > currentPrice) {
        return this.createSignal('buy', currentPrice, this.tradeQuantity, {
          confidence: pattern.confidence,
          reason: `Elliott Wave: ABC correction completed near ${currentPrice.toFixed(2)}. Target: ${pattern.targetPrice?.toFixed(2)}, Stop: ${pattern.stopLoss?.toFixed(2)}`,
        });
      }
    } else {
      // Corrective wave C completed upward - expect bearish continuation
      if (this.lastSignal !== 'sell' && pattern.targetPrice && pattern.targetPrice < currentPrice) {
        return this.createSignal('sell', currentPrice, this.tradeQuantity, {
          confidence: pattern.confidence,
          reason: `Elliott Wave: ABC correction completed near ${currentPrice.toFixed(2)}. Target: ${pattern.targetPrice?.toFixed(2)}, Stop: ${pattern.stopLoss?.toFixed(2)}`,
        });
      }
    }

    return null;
  }

  /**
   * Get current wave pattern
   */
  getCurrentPattern(): ElliottWavePattern | null {
    return this.currentPattern;
  }

  /**
   * Get swing points
   */
  getSwingPoints(): ElliottSwingPoint[] {
    return [...this.swingPoints];
  }

  /**
   * Get price history length
   */
  getPriceHistoryLength(): number {
    return this.priceHistory.length;
  }

  /**
   * Check if strategy has enough data
   */
  isReady(): boolean {
    return this.priceHistory.length >= this.minDataPoints;
  }

  /**
   * Get previous patterns
   */
  getPreviousPatterns(): ElliottWavePattern[] {
    return [...this.previousPatterns];
  }

  /**
   * Reset strategy state
   */
  reset(): void {
    this.priceHistory = [];
    this.highHistory = [];
    this.lowHistory = [];
    this.timestampHistory = [];
    this.swingPoints = [];
    this.currentPattern = null;
    this.previousPatterns = [];
    this.lastSignal = null;
    this.lastSignalPrice = null;
    this.lastSignalTime = 0;
  }
}
