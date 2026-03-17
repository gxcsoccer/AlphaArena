/**
 * Feature Extractor
 *
 * Extracts technical indicators and features from market data for ML models
 */

import {
  FeatureVector,
  FeatureSet,
  FeatureExtractorConfig,
  FeatureType,
  NormalizationParams,
  MarketDataPoint,
} from './MLTypes';

/**
 * Feature Extractor - 特征提取器
 *
 * Computes technical indicators and transforms them into feature vectors
 * suitable for machine learning models.
 */
export class FeatureExtractor {
  private config: FeatureExtractorConfig;
  private normalizationParams: NormalizationParams | null = null;
  private featureBuffer: MarketDataPoint[] = [];
  private featureHistory: FeatureVector[] = [];

  constructor(config: FeatureExtractorConfig) {
    this.config = config;
  }

  /**
   * Extract features from market data
   */
  extract(data: MarketDataPoint[]): FeatureVector {
    // Update buffer
    this.featureBuffer.push(...data);
    
    // Keep only necessary lookback
    const lookback = Math.max(this.config.lookbackPeriod, 50);
    if (this.featureBuffer.length > lookback) {
      this.featureBuffer = this.featureBuffer.slice(-lookback);
    }

    // Compute all features
    const features: Record<string, number> = {};
    const values: number[] = [];
    const names: string[] = [];

    for (const featureType of this.config.features) {
      const computedFeatures = this.computeFeature(featureType);
      
      for (const [name, value] of Object.entries(computedFeatures)) {
        features[name] = value;
        names.push(name);
        values.push(value);
      }
    }

    const vector: FeatureVector = {
      names,
      values,
      timestamp: Date.now(),
    };

    // Store in history
    this.featureHistory.push(vector);
    if (this.featureHistory.length > 1000) {
      this.featureHistory.shift();
    }

    return vector;
  }

  /**
   * Extract features from a single data point
   */
  extractSingle(point: MarketDataPoint): FeatureVector {
    return this.extract([point]);
  }

  /**
   * Extract feature set from historical data
   */
  extractSet(data: MarketDataPoint[]): FeatureSet {
    const features: FeatureVector[] = [];
    
    // Reset buffer
    this.featureBuffer = [];
    
    for (let i = 0; i < data.length; i++) {
      const vector = this.extract([data[i]]);
      if (i >= this.config.lookbackPeriod - 1) {
        features.push(vector);
      }
    }

    return {
      features,
      metadata: {
        count: features.length,
        normalization: this.normalizationParams || undefined,
        selectedFeatures: this.config.featureSelection?.method !== 'none' 
          ? features[0]?.names 
          : undefined,
      },
    };
  }

  /**
   * Fit normalization parameters from training data
   */
  fitNormalization(data: MarketDataPoint[]): void {
    const featureSet = this.extractSet(data);
    const allValues: number[][] = featureSet.features.map(f => f.values);
    
    if (allValues.length === 0) {
      return;
    }

    const numFeatures = allValues[0].length;
    const method: 'zscore' | 'minmax' | 'robust' = (this.config.normalization === 'none' ? undefined : this.config.normalization) || 'zscore';

    const mean: number[] = [];
    const std: number[] = [];
    const min: number[] = [];
    const max: number[] = [];

    for (let i = 0; i < numFeatures; i++) {
      const values = allValues.map(v => v[i]).filter(v => !isNaN(v) && isFinite(v));
      
      if (values.length === 0) {
        mean.push(0);
        std.push(1);
        min.push(0);
        max.push(1);
        continue;
      }

      const m = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length;
      const s = Math.sqrt(variance) || 1;

      mean.push(m);
      std.push(s);
      min.push(Math.min(...values));
      max.push(Math.max(...values));
    }

    this.normalizationParams = {
      mean,
      std,
      min,
      max,
      method,
    };
  }

  /**
   * Normalize a feature vector
   */
  normalize(vector: FeatureVector): FeatureVector {
    if (!this.normalizationParams) {
      return vector;
    }

    const { mean, std, min, max, method } = this.normalizationParams;
    const normalizedValues: number[] = [];

    for (let i = 0; i < vector.values.length; i++) {
      const v = vector.values[i];
      let normalized: number;

      switch (method) {
        case 'zscore':
          normalized = (v - mean[i]) / std[i];
          break;
        case 'minmax':
          const range = (max?.[i] ?? 1) - (min?.[i] ?? 0);
          normalized = range > 0 ? (v - (min?.[i] ?? 0)) / range : 0;
          break;
        case 'robust':
          // Median absolute deviation based normalization
          normalized = (v - mean[i]) / (std[i] * 1.4826); // Scale factor for MAD
          break;
        default:
          normalized = v;
      }

      // Handle NaN and Infinity
      normalizedValues.push(isFinite(normalized) ? normalized : 0);
    }

    return {
      ...vector,
      values: normalizedValues,
    };
  }

  /**
   * Get normalization parameters
   */
  getNormalizationParams(): NormalizationParams | null {
    return this.normalizationParams;
  }

  /**
   * Set normalization parameters
   */
  setNormalizationParams(params: NormalizationParams): void {
    this.normalizationParams = params;
  }

  /**
   * Get feature names
   */
  getFeatureNames(): string[] {
    const names: string[] = [];
    for (const featureType of this.config.features) {
      // Some features produce multiple values
      switch (featureType) {
        case 'macd':
          names.push('macd', 'macd-signal', 'macd-histogram');
          break;
        case 'bollinger-upper':
        case 'bollinger-middle':
        case 'bollinger-lower':
          names.push(featureType);
          break;
        case 'bollinger-width':
          names.push('bollinger-width');
          break;
        case 'stoch-k':
        case 'stoch-d':
          names.push(featureType);
          break;
        default:
          names.push(featureType);
      }
    }
    return names;
  }

  /**
   * Compute a specific feature
   */
  private computeFeature(type: FeatureType): Record<string, number> {
    const closes = this.featureBuffer.map(d => d.close);
    const highs = this.featureBuffer.map(d => d.high);
    const lows = this.featureBuffer.map(d => d.low);
    const volumes = this.featureBuffer.map(d => d.volume);

    switch (type) {
      case 'price':
        return { price: closes[closes.length - 1] || 0 };
      
      case 'volume':
        return { volume: volumes[volumes.length - 1] || 0 };
      
      case 'returns':
        if (closes.length < 2) return { returns: 0 };
        const returns = (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2];
        return { returns };
      
      case 'log-returns':
        if (closes.length < 2) return { 'log-returns': 0 };
        const logReturns = Math.log(closes[closes.length - 1] / closes[closes.length - 2]);
        return { 'log-returns': logReturns };
      
      case 'sma-5':
        return { 'sma-5': this.calculateSMA(closes, 5) };
      
      case 'sma-10':
        return { 'sma-10': this.calculateSMA(closes, 10) };
      
      case 'sma-20':
        return { 'sma-20': this.calculateSMA(closes, 20) };
      
      case 'ema-5':
        return { 'ema-5': this.calculateEMA(closes, 5) };
      
      case 'ema-10':
        return { 'ema-10': this.calculateEMA(closes, 10) };
      
      case 'ema-20':
        return { 'ema-20': this.calculateEMA(closes, 20) };
      
      case 'rsi-14':
        return { 'rsi-14': this.calculateRSI(closes, 14) };
      
      case 'rsi-7':
        return { 'rsi-7': this.calculateRSI(closes, 7) };
      
      case 'macd':
        return this.calculateMACD(closes);
      
      case 'bollinger-upper':
        return { 'bollinger-upper': this.calculateBollingerBands(closes, 20).upper };
      
      case 'bollinger-middle':
        return { 'bollinger-middle': this.calculateBollingerBands(closes, 20).middle };
      
      case 'bollinger-lower':
        return { 'bollinger-lower': this.calculateBollingerBands(closes, 20).lower };
      
      case 'bollinger-width':
        const bb = this.calculateBollingerBands(closes, 20);
        return { 'bollinger-width': bb.upper - bb.lower };
      
      case 'atr-14':
        return { 'atr-14': this.calculateATR(highs, lows, closes, 14) };
      
      case 'atr-7':
        return { 'atr-7': this.calculateATR(highs, lows, closes, 7) };
      
      case 'volatility-20':
        return { 'volatility-20': this.calculateVolatility(closes, 20) };
      
      case 'momentum-5':
        return { 'momentum-5': this.calculateMomentum(closes, 5) };
      
      case 'momentum-10':
        return { 'momentum-10': this.calculateMomentum(closes, 10) };
      
      case 'roc-5':
        return { 'roc-5': this.calculateROC(closes, 5) };
      
      case 'roc-10':
        return { 'roc-10': this.calculateROC(closes, 10) };
      
      case 'obv':
        return { obv: this.calculateOBV(closes, volumes) };
      
      case 'vwap':
        return { vwap: this.calculateVWAP(highs, lows, closes, volumes) };
      
      case 'adl':
        return { adl: this.calculateADL(highs, lows, closes, volumes) };
      
      case 'stoch-k':
      case 'stoch-d':
        const stoch = this.calculateStochastic(highs, lows, closes, 14);
        return { 'stoch-k': stoch.k, 'stoch-d': stoch.d };
      
      case 'williams-r':
        return { 'williams-r': this.calculateWilliamsR(highs, lows, closes, 14) };
      
      case 'cci':
        return { cci: this.calculateCCI(highs, lows, closes, 20) };
      
      case 'mfi':
        return { mfi: this.calculateMFI(highs, lows, closes, volumes, 14) };
      
      case 'adx':
        return { adx: this.calculateADX(highs, lows, closes, 14) };
      
      case 'plus-di':
        return { 'plus-di': this.calculateDI(highs, lows, closes, 14).plus };
      
      case 'minus-di':
        return { 'minus-di': this.calculateDI(highs, lows, closes, 14).minus };
      
      default:
        return {};
    }
  }

  // ==================== Technical Indicator Calculations ====================

  private calculateSMA(data: number[], period: number): number {
    if (data.length < period) {
      return data.length > 0 ? data.reduce((a, b) => a + b, 0) / data.length : 0;
    }
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private calculateEMA(data: number[], period: number): number {
    if (data.length === 0) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / Math.min(period, data.length);
    
    for (let i = Math.min(period, data.length); i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  private calculateRSI(data: number[], period: number): number {
    if (data.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain/loss
    for (let i = data.length - period; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(data: number[]): Record<string, number> {
    if (data.length < 26) {
      return { 'macd': 0, 'macd-signal': 0, 'macd-histogram': 0 };
    }

    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    const macd = ema12 - ema26;

    // Calculate MACD signal line (9-period EMA of MACD)
    // Simplified: use current MACD as approximation
    const signal = macd * 0.9; // Simplified
    const histogram = macd - signal;

    return {
      'macd': macd,
      'macd-signal': signal,
      'macd-histogram': histogram,
    };
  }

  private calculateBollingerBands(
    data: number[],
    period: number,
    stdDev: number = 2
  ): { upper: number; middle: number; lower: number } {
    const middle = this.calculateSMA(data, period);
    
    if (data.length < period) {
      return { upper: middle, middle, lower: middle };
    }

    const slice = data.slice(-period);
    const variance = slice.reduce((sum, v) => sum + Math.pow(v - middle, 2), 0) / period;
    const std = Math.sqrt(variance);

    return {
      upper: middle + stdDev * std,
      middle,
      lower: middle - stdDev * std,
    };
  }

  private calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): number {
    if (highs.length < 2) return 0;

    const trueRanges: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }

    if (trueRanges.length < period) {
      return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
    }

    const slice = trueRanges.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private calculateVolatility(data: number[], period: number): number {
    if (data.length < period + 1) return 0;

    const returns: number[] = [];
    for (let i = data.length - period; i < data.length; i++) {
      returns.push(Math.log(data[i] / data[i - 1]));
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized
  }

  private calculateMomentum(data: number[], period: number): number {
    if (data.length < period + 1) return 0;
    return data[data.length - 1] - data[data.length - 1 - period];
  }

  private calculateROC(data: number[], period: number): number {
    if (data.length < period + 1) return 0;
    const current = data[data.length - 1];
    const past = data[data.length - 1 - period];
    return ((current - past) / past) * 100;
  }

  private calculateOBV(closes: number[], volumes: number[]): number {
    if (closes.length < 2) return 0;

    let obv = 0;
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        obv += volumes[i];
      } else if (closes[i] < closes[i - 1]) {
        obv -= volumes[i];
      }
    }
    return obv;
  }

  private calculateVWAP(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[]
  ): number {
    if (closes.length === 0) return 0;

    let sumPV = 0;
    let sumV = 0;

    for (let i = 0; i < closes.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      sumPV += typicalPrice * volumes[i];
      sumV += volumes[i];
    }

    return sumV > 0 ? sumPV / sumV : closes[closes.length - 1];
  }

  private calculateADL(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[]
  ): number {
    if (closes.length < 2) return 0;

    let adl = 0;
    for (let i = 1; i < closes.length; i++) {
      const highLow = highs[i] - lows[i];
      if (highLow === 0) continue;

      const moneyFlowMultiplier = ((closes[i] - lows[i]) - (highs[i] - closes[i])) / highLow;
      const moneyFlowVolume = moneyFlowMultiplier * volumes[i];
      adl += moneyFlowVolume;
    }
    return adl;
  }

  private calculateStochastic(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): { k: number; d: number } {
    if (closes.length < period) {
      return { k: 50, d: 50 };
    }

    const sliceHigh = highs.slice(-period);
    const sliceLow = lows.slice(-period);
    const close = closes[closes.length - 1];

    const highestHigh = Math.max(...sliceHigh);
    const lowestLow = Math.min(...sliceLow);

    const k = highestHigh !== lowestLow 
      ? ((close - lowestLow) / (highestHigh - lowestLow)) * 100 
      : 50;

    // D is 3-period SMA of K (simplified)
    const d = k; // Simplified - would need K history

    return { k, d };
  }

  private calculateWilliamsR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): number {
    if (closes.length < period) return -50;

    const sliceHigh = highs.slice(-period);
    const sliceLow = lows.slice(-period);
    const close = closes[closes.length - 1];

    const highestHigh = Math.max(...sliceHigh);
    const lowestLow = Math.min(...sliceLow);

    if (highestHigh === lowestLow) return -50;

    return ((highestHigh - close) / (highestHigh - lowestLow)) * -100;
  }

  private calculateCCI(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): number {
    if (closes.length < period) return 0;

    const typicalPrices: number[] = [];
    for (let i = 0; i < closes.length; i++) {
      typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
    }

    const slice = typicalPrices.slice(-period);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    
    const meanDev = slice.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;
    
    if (meanDev === 0) return 0;
    
    const currentTP = typicalPrices[typicalPrices.length - 1];
    return (currentTP - sma) / (0.015 * meanDev);
  }

  private calculateMFI(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[],
    period: number
  ): number {
    if (closes.length < period + 1) return 50;

    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      const prevTypicalPrice = (highs[i - 1] + lows[i - 1] + closes[i - 1]) / 3;
      const moneyFlow = typicalPrice * volumes[i];

      if (typicalPrice > prevTypicalPrice) {
        positiveFlow += moneyFlow;
      } else {
        negativeFlow += moneyFlow;
      }
    }

    if (negativeFlow === 0) return 100;
    
    const moneyRatio = positiveFlow / negativeFlow;
    return 100 - (100 / (1 + moneyRatio));
  }

  private calculateADX(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): number {
    const { plus, minus } = this.calculateDI(highs, lows, closes, period);
    
    if (plus + minus === 0) return 0;
    
    return (Math.abs(plus - minus) / (plus + minus)) * 100;
  }

  private calculateDI(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): { plus: number; minus: number } {
    if (closes.length < period + 1) return { plus: 0, minus: 0 };

    let plusDM = 0;
    let minusDM = 0;
    let tr = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];

      plusDM += upMove > downMove && upMove > 0 ? upMove : 0;
      minusDM += downMove > upMove && downMove > 0 ? downMove : 0;

      tr += Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
    }

    if (tr === 0) return { plus: 0, minus: 0 };

    return {
      plus: (plusDM / tr) * 100,
      minus: (minusDM / tr) * 100,
    };
  }

  /**
   * Reset the feature extractor state
   */
  reset(): void {
    this.featureBuffer = [];
    this.featureHistory = [];
    this.normalizationParams = null;
  }
}
