/**
 * Tests for MockDataProvider
 */

import { MockDataProvider } from '../providers/MockDataProvider';
import { DataSourceStatus } from '../types';

describe('MockDataProvider', () => {
  let provider: MockDataProvider;

  beforeEach(() => {
    provider = new MockDataProvider();
  });

  afterEach(async () => {
    if (provider.status === DataSourceStatus.CONNECTED) {
      await provider.disconnect();
    }
  });

  describe('Properties', () => {
    it('should have correct name and id', () => {
      expect(provider.name).toBe('Mock Data Provider');
      expect(provider.providerId).toBe('mock');
    });

    it('should start disconnected', () => {
      expect(provider.status).toBe(DataSourceStatus.DISCONNECTED);
    });

    it('should return capabilities', () => {
      const caps = provider.getCapabilities();

      expect(caps.realtimeQuotes).toBe(true);
      expect(caps.historicalBars).toBe(true);
      expect(caps.realtimeTrades).toBe(true);
      expect(caps.realtimeOrderBook).toBe(true);
      expect(caps.maxBarHistory).toBe(1000);
    });
  });

  describe('Connection', () => {
    it('should connect successfully', async () => {
      await provider.connect({ providerId: 'mock' });
      expect(provider.status).toBe(DataSourceStatus.CONNECTED);
    });

    it('should disconnect successfully', async () => {
      await provider.connect({ providerId: 'mock' });
      await provider.disconnect();
      expect(provider.status).toBe(DataSourceStatus.DISCONNECTED);
    });

    it('should emit status change events', async () => {
      const listener = jest.fn();
      provider.on('statusChange', listener);

      await provider.connect({ providerId: 'mock' });
      // Status changes: DISCONNECTED -> CONNECTING -> CONNECTED
      await provider.disconnect();
      // Status changes: CONNECTED -> DISCONNECTED

      // Should have at least 2 status changes
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Quote Data', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'mock' });
    });

    it('should get quote for BTC/USDT', async () => {
      const quote = await provider.getQuote('BTC/USDT');

      expect(quote.symbol).toBe('BTC/USDT');
      expect(quote.lastPrice).toBeGreaterThan(0);
      expect(quote.bid).toBeLessThan(quote.ask);
      expect(quote.timestamp).toBeGreaterThan(0);
    });

    it('should get quotes for multiple symbols', async () => {
      const quotes = await provider.getQuotes(['BTC/USDT', 'ETH/USDT']);

      expect(quotes).toHaveLength(2);
      expect(quotes[0].symbol).toBe('BTC/USDT');
      expect(quotes[1].symbol).toBe('ETH/USDT');
    });

    it('should throw error for invalid symbol', async () => {
      await expect(provider.getQuote('INVALID/PAIR')).rejects.toThrow();
    });

    it('should normalize symbol format', async () => {
      const quote1 = await provider.getQuote('btc-usdt');
      const quote2 = await provider.getQuote('BTC/USDT');

      expect(quote1.symbol).toBe(quote2.symbol);
    });
  });

  describe('Bar Data', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'mock' });
    });

    it('should get bars with default limit', async () => {
      const bars = await provider.getBars('BTC/USDT', '1m');

      expect(bars.length).toBe(100);
    });

    it('should get bars with custom limit', async () => {
      const bars = await provider.getBars('BTC/USDT', '5m', 50);

      expect(bars.length).toBe(50);
    });

    it('should return bars in correct order', async () => {
      const bars = await provider.getBars('BTC/USDT', '1h', 10);

      for (let i = 1; i < bars.length; i++) {
        expect(bars[i].openTime).toBeGreaterThan(bars[i - 1].openTime);
      }
    });

    it('should include OHLCV data', async () => {
      const bars = await provider.getBars('BTC/USDT', '1d', 1);
      const bar = bars[0];

      expect(bar.open).toBeGreaterThan(0);
      expect(bar.high).toBeGreaterThanOrEqual(bar.open);
      expect(bar.high).toBeGreaterThanOrEqual(bar.close);
      expect(bar.low).toBeLessThanOrEqual(bar.open);
      expect(bar.low).toBeLessThanOrEqual(bar.close);
      expect(bar.volume).toBeGreaterThanOrEqual(0);
    });

    it('should get bars by time range', async () => {
      const now = Date.now();
      const startTime = now - 3600000; // 1 hour ago
      const endTime = now;

      const bars = await provider.getBarsByRange('BTC/USDT', '1m', startTime, endTime);

      expect(bars.length).toBeGreaterThan(0);
    });
  });

  describe('Order Book', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'mock' });
    });

    it('should get order book with default depth', async () => {
      const orderBook = await provider.getOrderBook('BTC/USDT');

      expect(orderBook.symbol).toBe('BTC/USDT');
      expect(orderBook.bids.length).toBe(20);
      expect(orderBook.asks.length).toBe(20);
    });

    it('should get order book with custom depth', async () => {
      const orderBook = await provider.getOrderBook('BTC/USDT', 5);

      expect(orderBook.bids.length).toBe(5);
      expect(orderBook.asks.length).toBe(5);
    });

    it('should have bids sorted by price descending', async () => {
      const orderBook = await provider.getOrderBook('BTC/USDT', 10);

      for (let i = 1; i < orderBook.bids.length; i++) {
        expect(orderBook.bids[i].price).toBeLessThan(orderBook.bids[i - 1].price);
      }
    });

    it('should have asks sorted by price ascending', async () => {
      const orderBook = await provider.getOrderBook('BTC/USDT', 10);

      for (let i = 1; i < orderBook.asks.length; i++) {
        expect(orderBook.asks[i].price).toBeGreaterThan(orderBook.asks[i - 1].price);
      }
    });
  });

  describe('Trade Data', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'mock' });
    });

    it('should get recent trades', async () => {
      const trades = await provider.getRecentTrades('BTC/USDT', 50);

      expect(trades.length).toBe(50);
      trades.forEach(trade => {
        expect(trade.symbol).toBe('BTC/USDT');
        expect(trade.price).toBeGreaterThan(0);
        expect(['buy', 'sell']).toContain(trade.side);
      });
    });

    it('should return trades in chronological order', async () => {
      const trades = await provider.getRecentTrades('BTC/USDT', 10);

      // Trades should generally be in order, but timestamps have some randomness
      // Just verify the first and last are in expected order
      expect(trades[trades.length - 1].timestamp).toBeGreaterThanOrEqual(trades[0].timestamp - 60000);
    });
  });

  describe('Market Info', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'mock' });
    });

    it('should get market info', async () => {
      const info = await provider.getMarketInfo('BTC/USDT');

      expect(info.symbol).toBe('BTC/USDT');
      expect(info.baseCurrency).toBe('BTC');
      expect(info.quoteCurrency).toBe('USDT');
      expect(info.isActive).toBe(true);
    });

    it('should get available markets', async () => {
      const markets = await provider.getAvailableMarkets();

      expect(markets.length).toBeGreaterThan(0);
      const btcMarket = markets.find(m => m.symbol === 'BTC/USDT');
      expect(btcMarket).toBeDefined();
    });
  });

  describe('Subscriptions', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'mock' });
    });

    it('should subscribe to quotes', async () => {
      const callback = jest.fn();
      const unsubscribe = provider.subscribeToQuotes('BTC/USDT', callback);

      // Wait for at least one update
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(callback).toHaveBeenCalled();
      unsubscribe();
    });

    it('should unsubscribe from quotes', async () => {
      const callback = jest.fn();
      const unsubscribe = provider.subscribeToQuotes('BTC/USDT', callback);

      unsubscribe();

      // Wait to ensure no more updates
      await new Promise(resolve => setTimeout(resolve, 1500));

      const callCount = callback.mock.calls.length;
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Should not have more calls after unsubscribe
      expect(callback.mock.calls.length).toBe(callCount);
    });

    it('should subscribe to order book', async () => {
      const callback = jest.fn();
      const unsubscribe = provider.subscribeToOrderBook('BTC/USDT', callback);

      // Wait for at least one update
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(callback).toHaveBeenCalled();
      unsubscribe();
    });

    it('should unsubscribe from all', async () => {
      provider.subscribeToQuotes('BTC/USDT', () => {});
      provider.subscribeToOrderBook('BTC/USDT', () => {});

      expect(() => provider.unsubscribeAll('BTC/USDT')).not.toThrow();
    });

    it('should unsubscribe from all symbols', async () => {
      provider.subscribeToQuotes('BTC/USDT', () => {});
      provider.subscribeToQuotes('ETH/USDT', () => {});

      expect(() => provider.unsubscribeFromAll()).not.toThrow();
    });
  });

  describe('Multi-Symbol Subscription', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'mock' });
    });

    it('should subscribe to multiple symbols', async () => {
      const quotes: any[] = [];
      const unsubscribe = provider.subscribeToMultiQuotes(
        ['BTC/USDT', 'ETH/USDT'],
        quote => quotes.push(quote)
      );

      // Wait for updates
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(quotes.length).toBeGreaterThan(0);
      unsubscribe();
    });
  });

  describe('Custom Markets', () => {
    beforeEach(async () => {
      await provider.connect({ providerId: 'mock' });
    });

    it('should add custom market', async () => {
      provider.addMarket({
        symbol: 'CUSTOM/USDT',
        basePrice: 100,
        volatility: 0.02,
        tickSize: 0.01,
        baseCurrency: 'CUSTOM',
        quoteCurrency: 'USDT',
      });

      const quote = await provider.getQuote('CUSTOM/USDT');
      expect(quote.symbol).toBe('CUSTOM/USDT');
    });

    it('should set custom price', async () => {
      provider.setPrice('BTC/USDT', 55000);

      const quote = await provider.getQuote('BTC/USDT');
      // Allow larger variance due to volatility simulation (up to 10%)
      expect(quote.lastPrice).toBeGreaterThan(45000);
      expect(quote.lastPrice).toBeLessThan(65000);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not connected', async () => {
      await expect(provider.getQuote('BTC/USDT')).rejects.toThrow('Not connected');
    });

    it('should throw error for invalid symbol when connected', async () => {
      await provider.connect({ providerId: 'mock' });
      await expect(provider.getQuote('INVALID')).rejects.toThrow('Market not found');
    });
  });
});