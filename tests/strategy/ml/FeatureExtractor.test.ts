/**
 * Feature Extractor Tests
 */

import { FeatureExtractor } from '../../../src/strategy/ml/FeatureExtractor';
import { FeatureExtractorConfig, MarketDataPoint } from '../../../src/strategy/ml/MLTypes';

function createTestMarketData(count: number, basePrice: number = 100): MarketDataPoint[] {
  const data: MarketDataPoint[] = [];
  let price = basePrice;
  
  for (let i = 0; i < count; i++) {
    // Create some realistic price movement
    const change = (Math.random() - 0.5) * 2;
    price = price + change;
    
    data.push({
      timestamp: Date.now() - (count - i) * 60000,
      open: price,
      high: price + Math.random(),
      low: price - Math.random(),
      close: price,
      volume: 1000 + Math.random() * 500,
    });
  }
  
  return data;
}

describe('FeatureExtractor', () => {
  describe('Construction', () => {
    test('should create with default configuration', () => {
      const config: FeatureExtractorConfig = {
        features: ['price', 'volume', 'returns'],
        lookbackPeriod: 20,
      };
      
      const extractor = new FeatureExtractor(config);
      expect(extractor).toBeDefined();
    });

    test('should create with all feature types', () => {
      const config: FeatureExtractorConfig = {
        features: [
          'price', 'volume', 'returns', 'log-returns',
          'sma-5', 'sma-10', 'sma-20',
          'ema-5', 'ema-10', 'ema-20',
          'rsi-14', 'macd',
          'bollinger-upper', 'bollinger-width',
          'atr-14', 'volatility-20',
        ],
        lookbackPeriod: 50,
      };
      
      const extractor = new FeatureExtractor(config);
      expect(extractor).toBeDefined();
    });
  });

  describe('Feature Extraction', () => {
    test('should extract price feature', () => {
      const config: FeatureExtractorConfig = {
        features: ['price'],
        lookbackPeriod: 10,
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(20);
      
      const vector = extractor.extract(data);
      
      expect(vector).toBeDefined();
      expect(vector.names).toContain('price');
      expect(vector.values.length).toBeGreaterThan(0);
    });

    test('should extract volume feature', () => {
      const config: FeatureExtractorConfig = {
        features: ['volume'],
        lookbackPeriod: 10,
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(20);
      
      const vector = extractor.extract(data);
      
      expect(vector.names).toContain('volume');
    });

    test('should extract returns feature', () => {
      const config: FeatureExtractorConfig = {
        features: ['returns', 'log-returns'],
        lookbackPeriod: 10,
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(20);
      
      const vector = extractor.extract(data);
      
      expect(vector.names).toContain('returns');
      expect(vector.names).toContain('log-returns');
    });

    test('should extract SMA features', () => {
      const config: FeatureExtractorConfig = {
        features: ['sma-5', 'sma-10', 'sma-20'],
        lookbackPeriod: 30,
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(50);
      
      const vector = extractor.extract(data);
      
      expect(vector.names).toContain('sma-5');
      expect(vector.names).toContain('sma-10');
      expect(vector.names).toContain('sma-20');
    });

    test('should extract EMA features', () => {
      const config: FeatureExtractorConfig = {
        features: ['ema-5', 'ema-10', 'ema-20'],
        lookbackPeriod: 30,
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(50);
      
      const vector = extractor.extract(data);
      
      expect(vector.names).toContain('ema-5');
      expect(vector.names).toContain('ema-10');
      expect(vector.names).toContain('ema-20');
    });

    test('should extract RSI feature', () => {
      const config: FeatureExtractorConfig = {
        features: ['rsi-14'],
        lookbackPeriod: 30,
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(50);
      
      const vector = extractor.extract(data);
      
      expect(vector.names).toContain('rsi-14');
      // RSI should be between 0 and 100
      const rsiValue = vector.values[vector.names.indexOf('rsi-14')];
      expect(rsiValue).toBeGreaterThanOrEqual(0);
      expect(rsiValue).toBeLessThanOrEqual(100);
    });

    test('should extract MACD features', () => {
      const config: FeatureExtractorConfig = {
        features: ['macd'],
        lookbackPeriod: 50,
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(100);
      
      const vector = extractor.extract(data);
      
      expect(vector.names).toContain('macd');
      expect(vector.names).toContain('macd-signal');
      expect(vector.names).toContain('macd-histogram');
    });

    test('should extract Bollinger Bands features', () => {
      const config: FeatureExtractorConfig = {
        features: ['bollinger-upper', 'bollinger-middle', 'bollinger-lower', 'bollinger-width'],
        lookbackPeriod: 30,
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(50);
      
      const vector = extractor.extract(data);
      
      expect(vector.names).toContain('bollinger-upper');
      expect(vector.names).toContain('bollinger-middle');
      expect(vector.names).toContain('bollinger-lower');
      expect(vector.names).toContain('bollinger-width');
      
      // Upper should be greater than middle, middle greater than lower
      const upper = vector.values[vector.names.indexOf('bollinger-upper')];
      const middle = vector.values[vector.names.indexOf('bollinger-middle')];
      const lower = vector.values[vector.names.indexOf('bollinger-lower')];
      
      expect(upper).toBeGreaterThanOrEqual(middle);
      expect(middle).toBeGreaterThanOrEqual(lower);
    });

    test('should extract ATR feature', () => {
      const config: FeatureExtractorConfig = {
        features: ['atr-14'],
        lookbackPeriod: 30,
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(50);
      
      const vector = extractor.extract(data);
      
      expect(vector.names).toContain('atr-14');
      // ATR should be positive
      const atrValue = vector.values[vector.names.indexOf('atr-14')];
      expect(atrValue).toBeGreaterThanOrEqual(0);
    });

    test('should extract volatility feature', () => {
      const config: FeatureExtractorConfig = {
        features: ['volatility-20'],
        lookbackPeriod: 30,
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(50);
      
      const vector = extractor.extract(data);
      
      expect(vector.names).toContain('volatility-20');
    });

    test('should extract multiple features at once', () => {
      const config: FeatureExtractorConfig = {
        features: ['price', 'volume', 'returns', 'sma-20', 'rsi-14', 'atr-14'],
        lookbackPeriod: 30,
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(50);
      
      const vector = extractor.extract(data);
      
      expect(vector.names.length).toBe(6);
      expect(vector.values.length).toBe(6);
    });
  });

  describe('Feature Set Extraction', () => {
    test('should extract feature set from historical data', () => {
      const config: FeatureExtractorConfig = {
        features: ['price', 'volume', 'returns'],
        lookbackPeriod: 10,
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(50);
      
      const featureSet = extractor.extractSet(data);
      
      expect(featureSet.features.length).toBeGreaterThan(0);
      expect(featureSet.metadata.count).toBe(featureSet.features.length);
    });
  });

  describe('Normalization', () => {
    test('should fit normalization parameters', () => {
      const config: FeatureExtractorConfig = {
        features: ['price', 'volume', 'returns'],
        lookbackPeriod: 10,
        normalization: 'zscore',
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(100);
      
      extractor.fitNormalization(data);
      
      const params = extractor.getNormalizationParams();
      expect(params).toBeDefined();
      expect(params!.method).toBe('zscore');
      expect(params!.mean.length).toBeGreaterThan(0);
      expect(params!.std.length).toBeGreaterThan(0);
    });

    test('should normalize feature vectors', () => {
      const config: FeatureExtractorConfig = {
        features: ['price', 'volume', 'returns'],
        lookbackPeriod: 10,
        normalization: 'zscore',
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(100);
      
      extractor.fitNormalization(data);
      
      const vector = extractor.extract(data);
      const normalized = extractor.normalize(vector);
      
      expect(normalized.values.length).toBe(vector.values.length);
      // Normalized values should have smaller magnitude (roughly)
    });

    test('should support minmax normalization', () => {
      const config: FeatureExtractorConfig = {
        features: ['price', 'volume'],
        lookbackPeriod: 10,
        normalization: 'minmax',
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(100);
      
      extractor.fitNormalization(data);
      
      const params = extractor.getNormalizationParams();
      expect(params!.method).toBe('minmax');
      expect(params!.min).toBeDefined();
      expect(params!.max).toBeDefined();
    });

    test('should support robust normalization', () => {
      const config: FeatureExtractorConfig = {
        features: ['price', 'volume'],
        lookbackPeriod: 10,
        normalization: 'robust',
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(100);
      
      extractor.fitNormalization(data);
      
      const params = extractor.getNormalizationParams();
      expect(params!.method).toBe('robust');
    });
  });

  describe('Reset', () => {
    test('should reset feature extractor state', () => {
      const config: FeatureExtractorConfig = {
        features: ['price', 'volume'],
        lookbackPeriod: 10,
      };
      
      const extractor = new FeatureExtractor(config);
      const data = createTestMarketData(50);
      
      extractor.extract(data);
      extractor.fitNormalization(data);
      
      extractor.reset();
      
      const params = extractor.getNormalizationParams();
      expect(params).toBeNull();
    });
  });
});
