/**
 * Twelve Data Provider Tests
 */

import { TwelveDataProvider } from '../providers/TwelveDataProvider';
import { DataSourceStatus, DataSourceError, DataSourceErrorType } from '../types';

describe('TwelveDataProvider', () => {
  let provider: TwelveDataProvider;

  beforeEach(() => {
    provider = new TwelveDataProvider();
  });

  afterEach(async () => {
    if (provider.status !== DataSourceStatus.DISCONNECTED) {
      await provider.disconnect();
    }
  });

  describe('Basic Properties', () => {
    it('should have correct provider name and id', () => {
      expect(provider.name).toBe('Twelve Data Provider');
      expect(provider.providerId).toBe('twelvedata');
    });

    it('should start disconnected', () => {
      expect(provider.status).toBe(DataSourceStatus.DISCONNECTED);
    });

    it('should return correct capabilities', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities.realtimeQuotes).toBe(true);
      expect(capabilities.historicalBars).toBe(true);
      expect(capabilities.realtimeTrades).toBe(false);
      expect(capabilities.realtimeOrderBook).toBe(false);
      expect(capabilities.multiSymbolSubscription).toBe(true);
      expect(capabilities.supportedIntervals).toContain('1m');
      expect(capabilities.supportedIntervals).toContain('1h');
      expect(capabilities.supportedIntervals).toContain('1d');
      expect(capabilities.maxBarHistory).toBe(5000);
    });
  });

  describe('Connection Management', () => {
    it('should connect without API key in demo mode', async () => {
      await provider.connect({ providerId: 'twelvedata' });
      
      expect(provider.status).toBe(DataSourceStatus.CONNECTED);
    });

    it('should connect with demo credentials', async () => {
      await provider.connect({
        providerId: 'twelvedata',
        apiKey: 'demo',
      });
      
      expect(provider.status).toBe(DataSourceStatus.CONNECTED);
    });

    it('should disconnect properly', async () => {
      await provider.connect({ providerId: 'twelvedata' });
      expect(provider.status).toBe(DataSourceStatus.CONNECTED);
      
      await provider.disconnect();
      expect(provider.status).toBe(DataSourceStatus.DISCONNECTED);
    });

    it('should emit connected event', async () => {
      const connectedSpy = jest.fn();
      provider.on('connected', connectedSpy);
      
      await provider.connect({ providerId: 'twelvedata' });
      
      expect(connectedSpy).toHaveBeenCalled();
    });

    it('should emit disconnected event', async () => {
      const disconnectedSpy = jest.fn();
      provider.on('disconnected', disconnectedSpy);
      
      await provider.connect({ providerId: 'twelvedata' });
      await provider.disconnect();
      
      expect(disconnectedSpy).toHaveBeenCalled();
    });
  });

  describe('Quote Data (Demo Mode)', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'twelvedata' });
    });

    it('should get quote for a symbol', async () => {
      const quote = await provider.getQuote('AAPL');
      
      expect(quote.symbol).toBe('AAPL');
      expect(quote.lastPrice).toBeGreaterThan(0);
      expect(quote.bid).toBeGreaterThan(0);
      expect(quote.ask).toBeGreaterThan(0);
      expect(quote.timestamp).toBeGreaterThan(0);
      expect(quote.source).toBe('twelvedata');
    });

    it('should get quotes for multiple symbols', async () => {
      const quotes = await provider.getQuotes(['AAPL', 'GOOGL', 'MSFT']);
      
      expect(quotes).toHaveLength(3);
      expect(quotes[0].symbol).toBe('AAPL');
      expect(quotes[1].symbol).toBe('GOOGL');
      expect(quotes[2].symbol).toBe('MSFT');
    });

    it('should normalize symbol format', async () => {
      const quote1 = await provider.getQuote('aapl');
      const quote2 = await provider.getQuote('AAPL');
      
      expect(quote1.symbol).toBe('AAPL');
      expect(quote2.symbol).toBe('AAPL');
    });
  });

  describe('Bar Data (Demo Mode)', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'twelvedata' });
    });

    it('should get bars for a symbol', async () => {
      const bars = await provider.getBars('AAPL', '1h', 10);
      
      expect(bars).toHaveLength(10);
      expect(bars[0].symbol).toBe('AAPL');
      expect(bars[0].interval).toBe('1h');
      expect(bars[0].open).toBeGreaterThan(0);
      expect(bars[0].high).toBeGreaterThan(0);
      expect(bars[0].low).toBeGreaterThan(0);
      expect(bars[0].close).toBeGreaterThan(0);
      expect(bars[0].volume).toBeGreaterThan(0);
    });

    it('should get bars for different intervals', async () => {
      const bars1m = await provider.getBars('AAPL', '1m', 5);
      const bars1h = await provider.getBars('AAPL', '1h', 5);
      const bars1d = await provider.getBars('AAPL', '1d', 5);
      
      expect(bars1m[0].interval).toBe('1m');
      expect(bars1h[0].interval).toBe('1h');
      expect(bars1d[0].interval).toBe('1d');
    });

    it('should get bars by time range', async () => {
      const endTime = Date.now();
      const startTime = endTime - 24 * 60 * 60 * 1000; // 24 hours ago
      
      const bars = await provider.getBarsByRange('AAPL', '1h', startTime, endTime);
      
      expect(bars.length).toBeGreaterThan(0);
      expect(bars[0].openTime).toBeGreaterThanOrEqual(startTime);
      // Allow small margin for timing differences
      expect(bars[bars.length - 1].closeTime).toBeLessThanOrEqual(endTime + 1000);
    });
  });

  describe('Order Book (Demo Mode)', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'twelvedata' });
    });

    it('should get order book (minimal from quote)', async () => {
      const orderBook = await provider.getOrderBook('AAPL');
      
      expect(orderBook.symbol).toBe('AAPL');
      expect(orderBook.bids.length).toBeGreaterThanOrEqual(1);
      expect(orderBook.asks.length).toBeGreaterThanOrEqual(1);
      expect(orderBook.bids[0].price).toBeGreaterThan(0);
      expect(orderBook.asks[0].price).toBeGreaterThan(0);
    });
  });

  describe('Trade Data (Demo Mode)', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'twelvedata' });
    });

    it('should get recent trades (mock data)', async () => {
      const trades = await provider.getRecentTrades('AAPL', 10);
      
      expect(trades.length).toBe(10);
      expect(trades[0].symbol).toBe('AAPL');
      expect(trades[0].price).toBeGreaterThan(0);
      expect(trades[0].quantity).toBeGreaterThan(0);
      expect(['buy', 'sell']).toContain(trades[0].side);
    });
  });

  describe('Market Info (Demo Mode)', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'twelvedata' });
    });

    it('should get market info for a symbol', async () => {
      const marketInfo = await provider.getMarketInfo('AAPL');
      
      expect(marketInfo.symbol).toBe('AAPL');
      expect(marketInfo.baseCurrency).toBe('AAPL');
      expect(marketInfo.quoteCurrency).toBe('USD');
      expect(marketInfo.isActive).toBe(true);
    });

    it('should get available markets', async () => {
      const markets = await provider.getAvailableMarkets();
      
      expect(markets.length).toBeGreaterThan(0);
      expect(markets.some(m => m.symbol === 'AAPL')).toBe(true);
      expect(markets.some(m => m.symbol === 'EUR/USD')).toBe(true);
    });
  });

  describe('Technical Indicators (Demo Mode)', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'twelvedata' });
    });

    it('should get SMA indicator', async () => {
      const sma = await provider.getSMA('AAPL', '1d', 20);
      
      expect(sma.symbol).toBe('AAPL');
      expect(sma.name).toBe('sma');
      expect(sma.values.length).toBeGreaterThan(0);
    });

    it('should get EMA indicator', async () => {
      const ema = await provider.getEMA('AAPL', '1d', 20);
      
      expect(ema.symbol).toBe('AAPL');
      expect(ema.name).toBe('ema');
    });

    it('should get RSI indicator', async () => {
      const rsi = await provider.getRSI('AAPL', '1d', 14);
      
      expect(rsi.symbol).toBe('AAPL');
      expect(rsi.name).toBe('rsi');
      expect(rsi.values.length).toBeGreaterThan(0);
      
      // RSI values should be between 0 and 100
      const rsiValue = rsi.values[0].rsi as number;
      expect(rsiValue).toBeGreaterThanOrEqual(0);
      expect(rsiValue).toBeLessThanOrEqual(100);
    });

    it('should get MACD indicator', async () => {
      const macd = await provider.getMACD('AAPL', '1d', 12, 26, 9);
      
      expect(macd.symbol).toBe('AAPL');
      expect(macd.name).toBe('macd');
    });

    it('should get Bollinger Bands indicator', async () => {
      const bbands = await provider.getBollingerBands('AAPL', '1d', 20, 2, 2);
      
      expect(bbands.symbol).toBe('AAPL');
      expect(bbands.name).toBe('bbands');
    });

    it('should get custom technical indicator', async () => {
      const indicator = await provider.getTechnicalIndicator({
        indicator: 'sma',
        symbol: 'AAPL',
        interval: '1d',
        time_period: 50,
        outputsize: 20,
      });
      
      expect(indicator.symbol).toBe('AAPL');
      expect(indicator.values.length).toBe(20);
    });
  });

  describe('Real-time Subscriptions (Demo Mode)', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'twelvedata' });
    });

    it('should subscribe to quotes', async () => {
      const callback = jest.fn();
      const unsubscribe = provider.subscribeToQuotes('AAPL', callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
    });

    it('should subscribe to bars', async () => {
      const callback = jest.fn();
      const unsubscribe = provider.subscribeToBars('AAPL', '1m', callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
    });

    it('should subscribe to trades', async () => {
      const callback = jest.fn();
      const unsubscribe = provider.subscribeToTrades('AAPL', callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
    });

    it('should subscribe to multi quotes', async () => {
      const callback = jest.fn();
      const unsubscribe = provider.subscribeToMultiQuotes(['AAPL', 'GOOGL'], callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
    });

    it('should unsubscribe from all', () => {
      provider.subscribeToQuotes('AAPL', jest.fn());
      provider.subscribeToQuotes('GOOGL', jest.fn());
      
      provider.unsubscribeFromAll();
      
      // Should not throw
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not connected', async () => {
      await expect(provider.getQuote('AAPL')).rejects.toThrow();
    });

    it('should throw error for operations when not connected', async () => {
      await expect(provider.getBars('AAPL', '1h')).rejects.toThrow();
      await expect(provider.getOrderBook('AAPL')).rejects.toThrow();
      await expect(provider.getRecentTrades('AAPL')).rejects.toThrow();
    });
  });

  describe('Symbol Normalization', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'twelvedata' });
    });

    it('should handle various symbol formats', async () => {
      // These should all work without throwing
      await expect(provider.getQuote('aapl')).resolves.toBeDefined();
      await expect(provider.getQuote('AAPL')).resolves.toBeDefined();
      await expect(provider.getQuote('AAPL/USD')).resolves.toBeDefined();
    });
  });
});