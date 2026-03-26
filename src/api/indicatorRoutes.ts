/**
 * Indicator Routes
 * 
 * API endpoints for technical indicators
 * VIP-only feature: MACD, RSI, Bollinger Bands, SMA, EMA
 */

import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { requirePlan } from '../middleware/subscription.middleware';

const log = createLogger('IndicatorRoutes');

const router = Router();

// Indicator calculation functions

/**
 * Calculate Simple Moving Average (SMA)
 */
function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j];
    }
    result.push(sum / period);
  }
  
  return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
    result.push(NaN);
  }
  result[period - 1] = sum / period;
  
  // Calculate EMA for remaining data
  for (let i = period; i < data.length; i++) {
    const ema = (data[i] - result[i - 1]) * multiplier + result[i - 1];
    result.push(ema);
  }
  
  return result;
}

/**
 * Calculate RSI (Relative Strength Index)
 */
function calculateRSI(data: number[], period: number): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  // Calculate initial average gain/loss
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period - 1; i++) {
    result.push(NaN);
  }
  
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  // First RSI value
  if (avgLoss === 0) {
    result.push(100);
  } else {
    const rs = avgGain / avgLoss;
    result.push(100 - (100 / (1 + rs)));
  }
  
  // Calculate remaining RSI values
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    
    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }
  
  return result;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
function calculateMACD(
  data: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  const macd: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (isNaN(fastEMA[i]) || isNaN(slowEMA[i])) {
      macd.push(NaN);
    } else {
      macd.push(fastEMA[i] - slowEMA[i]);
    }
  }
  
  const signal = calculateEMA(macd.filter(v => !isNaN(v)), signalPeriod);
  
  // Pad signal with NaN to match macd length
  const padLength = macd.length - signal.length;
  const paddedSignal: number[] = [];
  for (let i = 0; i < macd.length; i++) {
    if (i < padLength) {
      paddedSignal.push(NaN);
    } else {
      paddedSignal.push(signal[i - padLength] || NaN);
    }
  }
  
  const histogram: number[] = [];
  for (let i = 0; i < macd.length; i++) {
    if (isNaN(macd[i]) || isNaN(paddedSignal[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macd[i] - paddedSignal[i]);
    }
  }
  
  return { macd, signal: paddedSignal, histogram };
}

/**
 * Calculate Bollinger Bands
 */
function calculateBollingerBands(
  data: number[],
  period: number,
  stdDev: number
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calculateSMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }
    
    // Calculate standard deviation
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += Math.pow(data[i - j] - middle[i], 2);
    }
    const sd = Math.sqrt(sum / period);
    
    upper.push(middle[i] + sd * stdDev);
    lower.push(middle[i] - sd * stdDev);
  }
  
  return { upper, middle, lower };
}

/**
 * Generate mock price data for testing
 * In production, this would fetch real data from the database
 */
function getMockPriceData(symbol: string, count: number = 100): number[] {
  const basePrice = symbol.includes('BTC') ? 50000 : 
                    symbol.includes('ETH') ? 3000 : 
                    symbol.includes('SOL') ? 100 : 50;
  
  const data: number[] = [];
  let currentPrice = basePrice;
  
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 0.02 * currentPrice;
    currentPrice += change;
    data.push(currentPrice);
  }
  
  return data;
}

/**
 * Generate timestamps for the data
 */
function generateTimestamps(count: number, timeframe: string): number[] {
  const now = Date.now();
  const timestamps: number[] = [];
  
  const interval = timeframe === '1m' ? 60000 :
                   timeframe === '5m' ? 300000 :
                   timeframe === '15m' ? 900000 :
                   timeframe === '1h' ? 3600000 :
                   timeframe === '4h' ? 14400000 :
                   86400000; // 1d default
  
  for (let i = count - 1; i >= 0; i--) {
    timestamps.push(now - i * interval);
  }
  
  return timestamps;
}

/**
 * GET /api/indicators/:type
 * Get indicator data for a symbol and timeframe
 * 
 * Query params:
 * - symbol: Trading pair (e.g., BTC/USDT)
 * - timeframe: Chart timeframe (1m, 5m, 15m, 1h, 4h, 1d)
 * - period: Indicator period (default depends on indicator)
 * - fastPeriod, slowPeriod, signalPeriod: MACD specific
 * - stdDev: Bollinger Bands standard deviation
 */
router.get('/:type', requirePlan('pro'), async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { symbol, timeframe = '1h', period, fastPeriod, slowPeriod, signalPeriod, stdDev } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    // Validate indicator type
    const validTypes = ['sma', 'ema', 'rsi', 'macd', 'bollinger'] as const;
    if (!validTypes.includes(type as typeof validTypes[number])) {
      return res.status(400).json({ 
        error: 'Invalid indicator type',
        validTypes 
      });
    }
    
    log.info(`Calculating ${type} indicator for ${Array.isArray(symbol) ? symbol[0] : symbol} ${Array.isArray(timeframe) ? timeframe[0] : timeframe}`);
    
    // Get price data (mock for now, would fetch from DB in production)
    const dataCount = 200;
    const symbolStr = Array.isArray(symbol) ? String(symbol[0]) : String(symbol || 'BTC/USDT');
    const timeframeStr = Array.isArray(timeframe) ? String(timeframe[0]) : String(timeframe || '1h');
    const priceData = getMockPriceData(symbolStr || 'BTC/USDT', dataCount);
    const timestamps = generateTimestamps(dataCount, timeframeStr || '1h');
    
    let indicatorData: any = {};
    
    switch (type) {
      case 'sma':
        const smaPeriod = parseInt(String(period)) || 20;
        const smaData = calculateSMA(priceData, smaPeriod);
        indicatorData = timestamps.map((t, i) => ({
          time: t,
          value: smaData[i]
        })).filter(d => !isNaN(d.value));
        break;
        
      case 'ema':
        const emaPeriod = parseInt(String(period)) || 20;
        const emaData = calculateEMA(priceData, emaPeriod);
        indicatorData = timestamps.map((t, i) => ({
          time: t,
          value: emaData[i]
        })).filter(d => !isNaN(d.value));
        break;
        
      case 'rsi':
        const rsiPeriod = parseInt(String(period)) || 14;
        const rsiData = calculateRSI(priceData, rsiPeriod);
        indicatorData = timestamps.map((t, i) => ({
          time: t,
          value: rsiData[i]
        })).filter(d => !isNaN(d.value));
        break;
        
      case 'macd':
        const macdFast = parseInt(String(fastPeriod)) || 12;
        const macdSlow = parseInt(String(slowPeriod)) || 26;
        const macdSignal = parseInt(String(signalPeriod)) || 9;
        const macdResult = calculateMACD(priceData, macdFast, macdSlow, macdSignal);
        indicatorData = timestamps.map((t, i) => ({
          time: t,
          macd: macdResult.macd[i],
          signal: macdResult.signal[i],
          histogram: macdResult.histogram[i]
        })).filter(d => !isNaN(d.macd) && !isNaN(d.signal));
        break;
        
      case 'bollinger':
        const bbPeriod = parseInt(String(period)) || 20;
        const bbStdDev = parseFloat(String(stdDev)) || 2;
        const bbResult = calculateBollingerBands(priceData, bbPeriod, bbStdDev);
        indicatorData = timestamps.map((t, i) => ({
          time: t,
          upper: bbResult.upper[i],
          middle: bbResult.middle[i],
          lower: bbResult.lower[i]
        })).filter(d => !isNaN(d.upper) && !isNaN(d.middle) && !isNaN(d.lower));
        break;
    }
    
    res.json({
      success: true,
      type,
      symbol: symbolStr,
      timeframe: timeframeStr,
      params: {
        period: period || undefined,
        fastPeriod: fastPeriod || undefined,
        slowPeriod: slowPeriod || undefined,
        signalPeriod: signalPeriod || undefined,
        stdDev: stdDev || undefined
      },
      data: indicatorData
    });
    
  } catch (error: any) {
    log.error('Error calculating indicator:', error);
    res.status(500).json({ error: 'Failed to calculate indicator' });
  }
});

/**
 * GET /api/indicators
 * List available indicators
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    indicators: [
      {
        type: 'sma',
        name: 'Simple Moving Average',
        description: 'Simple average of prices over a period',
        category: 'Trend',
        params: [
          { name: 'period', type: 'number', default: 20, min: 1, max: 200 }
        ]
      },
      {
        type: 'ema',
        name: 'Exponential Moving Average',
        description: 'Weighted average giving more importance to recent prices',
        category: 'Trend',
        params: [
          { name: 'period', type: 'number', default: 20, min: 1, max: 200 }
        ]
      },
      {
        type: 'rsi',
        name: 'Relative Strength Index',
        description: 'Momentum indicator measuring overbought/oversold conditions',
        category: 'Momentum',
        params: [
          { name: 'period', type: 'number', default: 14, min: 1, max: 100 }
        ]
      },
      {
        type: 'macd',
        name: 'MACD',
        description: 'Trend-following momentum indicator',
        category: 'Trend',
        params: [
          { name: 'fastPeriod', type: 'number', default: 12, min: 1, max: 100 },
          { name: 'slowPeriod', type: 'number', default: 26, min: 1, max: 200 },
          { name: 'signalPeriod', type: 'number', default: 9, min: 1, max: 50 }
        ]
      },
      {
        type: 'bollinger',
        name: 'Bollinger Bands',
        description: 'Volatility indicator showing price channels',
        category: 'Volatility',
        params: [
          { name: 'period', type: 'number', default: 20, min: 1, max: 100 },
          { name: 'stdDev', type: 'number', default: 2, min: 0.5, max: 3 }
        ]
      }
    ],
    vipRequired: true,
    message: 'These indicators are available to Pro and Enterprise users only'
  });
});

export default router;