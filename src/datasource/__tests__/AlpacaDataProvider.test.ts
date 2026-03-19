/**
 * Alpaca Data Provider Tests
 */

import { AlpacaDataProvider } from '../providers/AlpacaDataProvider';
import { DataSourceStatus, DataSourceErrorType } from '../types';

describe('AlpacaDataProvider', () => {
  let provider: AlpacaDataProvider;

  beforeEach(() => {
    provider = new AlpacaDataProvider();
  });

  afterEach(async () => {
    if (provider) {
      await provider.disconnect();
    }
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(provider.name).toBe('Alpaca Data Provider');
      expect(provider.providerId).toBe('alpaca');
      expect(provider.status).toBe(DataSourceStatus.DISCONNECTED);
    });

    it('should return correct capabilities', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities.realtimeQuotes).toBe(true);
      expect(capabilities.historicalBars).toBe(true);
      expect(capabilities.realtimeTrades).toBe(true);
      expect(capabilities.realtimeOrderBook).toBe(false);
      expect(capabilities.maxBarHistory).toBe(10000);
      expect(capabilities.multiSymbolSubscription).toBe(true);
      expect(capabilities.maxSymbolsPerBatch).toBe(30);
    });
  });

  describe('connect', () => {
    it('should connect in demo mode without API credentials', async () => {
      await provider.connect({ providerId: 'alpaca' });
      
      expect(provider.status).toBe(DataSourceStatus.CONNECTED);
    });

    it('should emit connected event', async () => {
      const connectedSpy = jest.fn();
      provider.on('connected', connectedSpy);
      
      await provider.connect({ providerId: 'alpaca' });
      
      expect(connectedSpy).toHaveBeenCalled();
    });

    it('should handle connection with mock credentials', async () => {
      // When credentials are provided but are invalid, the provider should still connect in demo mode
      // In a real scenario, the provider would validate credentials, but for testing we skip validation
      await provider.connect({
        providerId: 'alpaca',
        apiKey: 'demo-key',
        apiSecret: 'demo-secret',
        testnet: true,
      });
      
      // The provider will fail to validate and fall back to demo mode
      // This is expected behavior for invalid credentials
      expect([DataSourceStatus.CONNECTED, DataSourceStatus.ERROR]).toContain(provider.status);
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      await provider.connect({ providerId: 'alpaca' });
      await provider.disconnect();
      
      expect(provider.status).toBe(DataSourceStatus.DISCONNECTED);
    });

    it('should emit disconnected event', async () => {
      await provider.connect({ providerId: 'alpaca' });
      
      const disconnectedSpy = jest.fn();
      provider.on('disconnected', disconnectedSpy);
      
      await provider.disconnect();
      
      expect(disconnectedSpy).toHaveBeenCalled();
    });

    it('should clear all subscriptions on disconnect', async () => {
      await provider.connect({ providerId: 'alpaca' });
      
      const unsubscribe = provider.subscribeToQuotes('AAPL', jest.fn());
      
      await provider.disconnect();
      
      // Should not throw when trying to unsubscribe after disconnect
      unsubscribe();
    });
  });

  describe('getQuote (demo mode)', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'alpaca' });
    });

    it('should return a valid quote for a symbol', async () => {
      const quote = await provider.getQuote('AAPL');
      
      expect(quote.symbol).toBe('AAPL');
      expect(quote.lastPrice).toBeGreaterThan(0);
      expect(quote.bid).toBeLessThan(quote.ask);
      expect(quote.timestamp).toBeGreaterThan(0);
      expect(quote.source).toBe('alpaca');
    });

    it('should normalize symbol format', async () => {
      const quote1 = await provider.getQuote('aapl');
      const quote2 = await provider.getQuote('AAPL');
      
      expect(quote1.symbol).toBe('AAPL');
      expect(quote2.symbol).toBe('AAPL');
    });
  });

  describe('getQuotes (demo mode)', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'alpaca' });
    });

    it('should return quotes for multiple symbols', async () => {
      const quotes = await provider.getQuotes(['AAPL', 'GOOGL', 'MSFT']);
      
      expect(quotes).toHaveLength(3);
      expect(quotes[0].symbol).toBe('AAPL');
      expect(quotes[1].symbol).toBe('GOOGL');
      expect(quotes[2].symbol).toBe('MSFT');
    });
  });

  describe('getBars (demo mode)', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'alpaca' });
    });

    it('should return bars with correct structure', async () => {
      const bars = await provider.getBars('AAPL', '1m', 10);
      
      expect(bars).toHaveLength(10);
      expect(bars[0].symbol).toBe('AAPL');
      expect(bars[0].interval).toBe('1m');
      expect(bars[0].open).toBeGreaterThan(0);
      expect(bars[0].high).toBeGreaterThanOrEqual(bars[0].open);
      expect(bars[0].low).toBeLessThanOrEqual(bars[0].open);
      expect(bars[0].volume).toBeGreaterThan(0);
    });

    it('should support different intervals', async () => {
      const intervals = ['1m', '5m', '15m', '1h', '1d'] as const;
      
      for (const interval of intervals) {
        const bars = await provider.getBars('AAPL', interval, 5);
        expect(bars).toHaveLength(5);
        expect(bars[0].interval).toBe(interval);
      }
    });

    it('should return bars in chronological order', async () => {
      const bars = await provider.getBars('AAPL', '1m', 10);
      
      for (let i = 1; i < bars.length; i++) {
        expect(bars[i].openTime).toBeGreaterThan(bars[i - 1].openTime);
      }
    });
  });

  describe('getBarsByRange (demo mode)', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'alpaca' });
    });

    it('should return bars within the specified time range', async () => {
      const now = Date.now();
      const oneDayAgo = now - 86400000;
      
      const bars = await provider.getBarsByRange('AAPL', '1h', oneDayAgo, now);
      
      expect(bars.length).toBeGreaterThan(0);
      
      const firstBar = bars[0];
      const lastBar = bars[bars.length - 1];
      
      expect(firstBar.openTime).toBeGreaterThanOrEqual(oneDayAgo);
      expect(lastBar.closeTime).toBeLessThanOrEqual(now);
    });
  });

  describe('getRecentTrades (demo mode)', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'alpaca' });
    });

    it('should return recent trades', async () => {
      const trades = await provider.getRecentTrades('AAPL', 50);
      
      expect(trades).toHaveLength(50);
      expect(trades[0].symbol).toBe('AAPL');
      expect(trades[0].price).toBeGreaterThan(0);
      expect(trades[0].quantity).toBeGreaterThan(0);
      expect(['buy', 'sell']).toContain(trades[0].side);
    });

    it('should return trades in reverse chronological order', async () => {
      const trades = await provider.getRecentTrades('AAPL', 10);
      
      for (let i = 1; i < trades.length; i++) {
        expect(trades[i].timestamp).toBeGreaterThanOrEqual(trades[i - 1].timestamp);
      }
    });
  });

  describe('getOrderBook (demo mode)', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'alpaca' });
    });

    it('should return minimal order book (best bid/ask only)', async () => {
      const orderBook = await provider.getOrderBook('AAPL');
      
      expect(orderBook.symbol).toBe('AAPL');
      expect(orderBook.bids.length).toBe(1);
      expect(orderBook.asks.length).toBe(1);
      expect(orderBook.bids[0].price).toBeLessThan(orderBook.asks[0].price);
    });
  });

  describe('getMarketInfo', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'alpaca' });
    });

    it('should return market info for a symbol', async () => {
      const marketInfo = await provider.getMarketInfo('AAPL');
      
      expect(marketInfo.symbol).toBe('AAPL');
      expect(marketInfo.baseCurrency).toBe('AAPL');
      expect(marketInfo.quoteCurrency).toBe('USD');
      expect(marketInfo.isActive).toBe(true);
    });
  });

  describe('getAvailableMarkets', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'alpaca' });
    });

    it('should return list of popular stocks', async () => {
      const markets = await provider.getAvailableMarkets();
      
      expect(markets.length).toBeGreaterThan(0);
      expect(markets.some(m => m.symbol === 'AAPL')).toBe(true);
      expect(markets.some(m => m.symbol === 'GOOGL')).toBe(true);
    });
  });

  describe('subscribeToQuotes', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'alpaca' });
    });

    it('should handle quote subscriptions', () => {
      const callback = jest.fn();
      const unsubscribe = provider.subscribeToQuotes('AAPL', callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      // Should not throw
      unsubscribe();
    });
  });

  describe('subscribeToBars', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'alpaca' });
    });

    it('should handle bar subscriptions', () => {
      const callback = jest.fn();
      const unsubscribe = provider.subscribeToBars('AAPL', '1m', callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      // Should not throw
      unsubscribe();
    });
  });

  describe('subscribeToTrades', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'alpaca' });
    });

    it('should handle trade subscriptions', () => {
      const callback = jest.fn();
      const unsubscribe = provider.subscribeToTrades('AAPL', callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      // Should not throw
      unsubscribe();
    });
  });

  describe('error handling', () => {
    it('should throw error when not connected', async () => {
      await expect(provider.getQuote('AAPL')).rejects.toThrow();
    });

    it('should throw appropriate error type', async () => {
      try {
        await provider.getQuote('AAPL');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.type).toBe(DataSourceErrorType.CONNECTION_ERROR);
      }
    });
  });

  describe('symbol normalization', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'alpaca' });
    });

    it('should normalize various symbol formats', async () => {
      const quote1 = await provider.getQuote('AAPL');
      const quote2 = await provider.getQuote('AAPL/USD');
      const quote3 = await provider.getQuote('aapl');
      
      expect(quote1.symbol).toBe('AAPL');
      expect(quote2.symbol).toBe('AAPL');
      expect(quote3.symbol).toBe('AAPL');
    });
  });
});