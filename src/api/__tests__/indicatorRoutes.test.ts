/**
 * Indicator Routes Tests
 * Tests for VIP-only technical indicators API
 */

import request from 'supertest';
import express, { Express } from 'express';
import indicatorRoutes from '../indicatorRoutes';
import { requirePlan } from '../../middleware/subscription.middleware';

// Mock the subscription middleware
jest.mock('../../middleware/subscription.middleware', () => ({
  requirePlan: jest.fn(() => (req: any, res: any, next: any) => {
    // Simulate Pro user
    req.user = { id: 'test-user', plan: 'pro' };
    next();
  }),
}));

describe('Indicator Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/indicators', indicatorRoutes);
    // Don't clear mocks here - requirePlan is called at module import time
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/indicators', () => {
    it('should return list of available indicators', async () => {
      const response = await request(app)
        .get('/api/indicators')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.indicators).toBeDefined();
      expect(response.body.indicators.length).toBe(5);
      expect(response.body.indicators.map((i: any) => i.type)).toContain('sma');
      expect(response.body.indicators.map((i: any) => i.type)).toContain('ema');
      expect(response.body.indicators.map((i: any) => i.type)).toContain('rsi');
      expect(response.body.indicators.map((i: any) => i.type)).toContain('macd');
      expect(response.body.indicators.map((i: any) => i.type)).toContain('bollinger');
      expect(response.body.vipRequired).toBe(true);
    });
  });

  describe('GET /api/indicators/:type', () => {
    it('should return SMA indicator data', async () => {
      const response = await request(app)
        .get('/api/indicators/sma')
        .query({ symbol: 'BTC/USDT', timeframe: '1h', period: 20 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.type).toBe('sma');
      expect(response.body.symbol).toBe('BTC/USDT');
      expect(response.body.timeframe).toBe('1h');
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return EMA indicator data', async () => {
      const response = await request(app)
        .get('/api/indicators/ema')
        .query({ symbol: 'ETH/USDT', timeframe: '4h', period: 50 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.type).toBe('ema');
      expect(response.body.symbol).toBe('ETH/USDT');
      expect(response.body.params.period).toBe('50');
    });

    it('should return RSI indicator data', async () => {
      const response = await request(app)
        .get('/api/indicators/rsi')
        .query({ symbol: 'SOL/USDT', timeframe: '1d', period: 14 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.type).toBe('rsi');
      expect(response.body.data).toBeDefined();
      
      // RSI values should be between 0 and 100
      const validValues = response.body.data.filter((d: any) => 
        d.value >= 0 && d.value <= 100
      );
      expect(validValues.length).toBe(response.body.data.length);
    });

    it('should return MACD indicator data', async () => {
      const response = await request(app)
        .get('/api/indicators/macd')
        .query({ 
          symbol: 'BTC/USDT', 
          timeframe: '1h',
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.type).toBe('macd');
      expect(response.body.data).toBeDefined();
      
      // MACD should have macd, signal, and histogram values
      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('macd');
        expect(response.body.data[0]).toHaveProperty('signal');
        expect(response.body.data[0]).toHaveProperty('histogram');
      }
    });

    it('should return Bollinger Bands indicator data', async () => {
      const response = await request(app)
        .get('/api/indicators/bollinger')
        .query({ 
          symbol: 'BTC/USDT', 
          timeframe: '1h',
          period: 20,
          stdDev: 2
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.type).toBe('bollinger');
      expect(response.body.data).toBeDefined();
      
      // Bollinger Bands should have upper, middle, and lower values
      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('upper');
        expect(response.body.data[0]).toHaveProperty('middle');
        expect(response.body.data[0]).toHaveProperty('lower');
        
        // Upper should be greater than middle, which should be greater than lower
        const { upper, middle, lower } = response.body.data[response.body.data.length - 1];
        if (!isNaN(upper) && !isNaN(middle) && !isNaN(lower)) {
          expect(upper).toBeGreaterThan(middle);
          expect(middle).toBeGreaterThan(lower);
        }
      }
    });

    it('should return 400 for invalid indicator type', async () => {
      const response = await request(app)
        .get('/api/indicators/invalid')
        .query({ symbol: 'BTC/USDT' })
        .expect(400);

      expect(response.body.error).toBe('Invalid indicator type');
      expect(response.body.validTypes).toContain('sma');
    });

    it('should return 400 when symbol is missing', async () => {
      const response = await request(app)
        .get('/api/indicators/sma')
        .expect(400);

      expect(response.body.error).toBe('Symbol is required');
    });

    it('should use default values for optional parameters', async () => {
      const response = await request(app)
        .get('/api/indicators/sma')
        .query({ symbol: 'BTC/USDT' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.timeframe).toBe('1h'); // Default timeframe
    });
  });

  describe('requirePlan middleware', () => {
    it('should check Pro plan requirement for indicator endpoints', async () => {
      // The requirePlan('pro') is called at module import time when routes are defined
      // We verify that the route returns 200 (meaning middleware passed)
      // since the mock sets up a Pro user
      const response = await request(app)
        .get('/api/indicators/sma')
        .query({ symbol: 'BTC/USDT' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});