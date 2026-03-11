/**
 * OrderBookService Tests
 */

import { OrderBookService, MarketOrderBookUpdate } from '../src/orderbook';
import { OrderBook } from '../src/orderbook';

describe('OrderBookService', () => {
  let service: OrderBookService;

  beforeEach(() => {
    service = new OrderBookService('BTC/USD');
  });

  afterEach(() => {
    service.disconnect();
  });

  describe('Initialization', () => {
    test('should create service with empty order book', () => {
      expect(service.getOrderBook()).toBeInstanceOf(OrderBook);
      expect(service.isConnected()).toBe(false);
      expect(service.getBestPrices()).toEqual({
        bestBid: null,
        bestAsk: null,
        spread: null,
      });
    });
  });

  describe('Connection', () => {
    test('should connect successfully', async () => {
      const connectPromise = service.connect();
      await connectPromise;
      expect(service.isConnected()).toBe(true);
    });

    test('should emit connected event', (done) => {
      service.on('connected', (data: any) => {
        expect(data.symbol).toBe('BTC/USD');
        done();
      });
      service.connect();
    });
  });

  describe('Market Update - Snapshot', () => {
    test('should apply snapshot update', () => {
      const snapshot: MarketOrderBookUpdate = {
        bids: [
          ['100.00', '10.5'],
          ['99.50', '20.0'],
        ],
        asks: [
          ['100.50', '8.0'],
          ['101.00', '12.0'],
        ],
        isSnapshot: true,
        timestamp: Date.now(),
      };

      service.applyMarketUpdate(snapshot);

      const orderBook = service.getOrderBook();
      expect(orderBook.getOrderCount()).toBe(4);
    });
  });

  describe('Best Prices', () => {
    beforeEach(async () => {
      const snapshot: MarketOrderBookUpdate = {
        bids: [
          ['100.00', '10.5'],
          ['99.50', '20.0'],
        ],
        asks: [
          ['100.50', '8.0'],
          ['101.00', '12.0'],
        ],
        isSnapshot: true,
      };
      service.applyMarketUpdate(snapshot);
    });

    test('should calculate best bid', () => {
      const { bestBid } = service.getBestPrices();
      expect(bestBid).toBeCloseTo(100, 2);
    });

    test('should calculate best ask', () => {
      const { bestAsk } = service.getBestPrices();
      expect(bestAsk).toBeCloseTo(100.5, 2);
    });

    test('should calculate spread', () => {
      const { spread } = service.getBestPrices();
      expect(spread).toBeCloseTo(0.5, 2);
    });
  });
});
