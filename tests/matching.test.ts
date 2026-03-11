import { MatchingEngine } from '../src/matching/MatchingEngine';
import { OrderBook } from '../src/orderbook/OrderBook';
import { Order, OrderType } from '../src/orderbook/types';
import { TradeStatus } from '../src/matching/types';

describe('MatchingEngine', () => {
  let matchingEngine: MatchingEngine;
  let orderBook: OrderBook;

  beforeEach(() => {
    orderBook = new OrderBook();
    matchingEngine = new MatchingEngine(orderBook);
  });

  describe('submitOrder', () => {
    describe('no matching orders', () => {
      it('should add order to orderbook when no opposite orders exist', () => {
        const order: Order = {
          id: '1',
          price: 100,
          quantity: 10,
          timestamp: Date.now(),
          type: OrderType.BID,
        };

        const result = matchingEngine.submitOrder(order);

        expect(result.trades.length).toBe(0);
        expect(result.remainingOrder).not.toBeNull();
        expect(result.remainingOrder!.status).toBe(TradeStatus.PENDING);
        expect(result.remainingOrder!.remainingQuantity).toBe(10);
        expect(orderBook.getOrderCount()).toBe(1);
      });
    });

    describe('full fill', () => {
      it('should fully fill a buy order against existing sell order', () => {
        // Add a sell order first
        const sellOrder: Order = {
          id: 'sell-1',
          price: 100,
          quantity: 10,
          timestamp: Date.now(),
          type: OrderType.ASK,
        };
        orderBook.add(sellOrder);

        // Submit a matching buy order
        const buyOrder: Order = {
          id: 'buy-1',
          price: 100,
          quantity: 10,
          timestamp: Date.now(),
          type: OrderType.BID,
        };

        const result = matchingEngine.submitOrder(buyOrder);

        expect(result.trades.length).toBe(1);
        expect(result.trades[0].price).toBe(100);
        expect(result.trades[0].quantity).toBe(10);
        expect(result.trades[0].buyOrderId).toBe('buy-1');
        expect(result.trades[0].sellOrderId).toBe('sell-1');
        expect(result.trades[0].status).toBe(TradeStatus.FILLED);
        expect(result.remainingOrder!.status).toBe(TradeStatus.FILLED);
        expect(result.remainingOrder!.filledQuantity).toBe(10);
        expect(orderBook.getOrderCount()).toBe(0); // Both orders filled
      });

      it('should fully fill a sell order against existing buy order', () => {
        // Add a buy order first
        const buyOrder: Order = {
          id: 'buy-1',
          price: 100,
          quantity: 10,
          timestamp: Date.now(),
          type: OrderType.BID,
        };
        orderBook.add(buyOrder);

        // Submit a matching sell order
        const sellOrder: Order = {
          id: 'sell-1',
          price: 100,
          quantity: 10,
          timestamp: Date.now(),
          type: OrderType.ASK,
        };

        const result = matchingEngine.submitOrder(sellOrder);

        expect(result.trades.length).toBe(1);
        expect(result.trades[0].price).toBe(100);
        expect(result.trades[0].quantity).toBe(10);
        expect(result.remainingOrder!.status).toBe(TradeStatus.FILLED);
        expect(orderBook.getOrderCount()).toBe(0);
      });
    });

    describe('partial fill', () => {
      it('should partially fill when order quantity exceeds available', () => {
        // Add a sell order with less quantity
        const sellOrder: Order = {
          id: 'sell-1',
          price: 100,
          quantity: 5,
          timestamp: Date.now(),
          type: OrderType.ASK,
        };
        orderBook.add(sellOrder);

        // Submit a larger buy order
        const buyOrder: Order = {
          id: 'buy-1',
          price: 100,
          quantity: 10,
          timestamp: Date.now(),
          type: OrderType.BID,
        };

        const result = matchingEngine.submitOrder(buyOrder);

        expect(result.trades.length).toBe(1);
        expect(result.trades[0].quantity).toBe(5); // Only 5 filled
        expect(result.remainingOrder!.status).toBe(TradeStatus.PARTIALLY_FILLED);
        expect(result.remainingOrder!.filledQuantity).toBe(5);
        expect(result.remainingOrder!.remainingQuantity).toBe(5);
        expect(orderBook.getOrderCount()).toBe(1); // Remaining buy order in book
      });

      it('should fill across multiple orders', () => {
        // Add multiple sell orders
        orderBook.add({
          id: 'sell-1',
          price: 100,
          quantity: 5,
          timestamp: 1000,
          type: OrderType.ASK,
        });
        orderBook.add({
          id: 'sell-2',
          price: 100,
          quantity: 5,
          timestamp: 2000,
          type: OrderType.ASK,
        });
        orderBook.add({
          id: 'sell-3',
          price: 100,
          quantity: 5,
          timestamp: 3000,
          type: OrderType.ASK,
        });

        // Submit a buy order that fills 2.5 orders
        const buyOrder: Order = {
          id: 'buy-1',
          price: 100,
          quantity: 12,
          timestamp: Date.now(),
          type: OrderType.BID,
        };

        const result = matchingEngine.submitOrder(buyOrder);

        expect(result.trades.length).toBe(3);
        expect(result.trades[0].quantity).toBe(5);
        expect(result.trades[1].quantity).toBe(5);
        expect(result.trades[2].quantity).toBe(2); // Partial from third order
        expect(result.remainingOrder!.status).toBe(TradeStatus.FILLED); // Buy order fully filled
        expect(result.remainingOrder!.remainingQuantity).toBe(0);
        expect(orderBook.getOrderCount()).toBe(1); // Remaining sell-3 with 3 quantity
      });
    });

    describe('price-time priority', () => {
      it('should match at better price first', () => {
        // Add sell orders at different prices
        orderBook.add({
          id: 'sell-1',
          price: 102,
          quantity: 10,
          timestamp: 1000,
          type: OrderType.ASK,
        });
        orderBook.add({
          id: 'sell-2',
          price: 100,
          quantity: 10,
          timestamp: 2000,
          type: OrderType.ASK,
        });
        orderBook.add({
          id: 'sell-3',
          price: 101,
          quantity: 10,
          timestamp: 3000,
          type: OrderType.ASK,
        });

        // Submit buy order at 101
        const buyOrder: Order = {
          id: 'buy-1',
          price: 101,
          quantity: 10,
          timestamp: Date.now(),
          type: OrderType.BID,
        };

        const result = matchingEngine.submitOrder(buyOrder);

        // Should match with sell-2 first (best price 100)
        expect(result.trades.length).toBe(1);
        expect(result.trades[0].price).toBe(100);
        expect(result.trades[0].sellOrderId).toBe('sell-2');
      });

      it('should match earlier order first at same price', () => {
        // Add sell orders at same price, different times
        orderBook.add({
          id: 'sell-1',
          price: 100,
          quantity: 10,
          timestamp: 1000,
          type: OrderType.ASK,
        });
        orderBook.add({
          id: 'sell-2',
          price: 100,
          quantity: 10,
          timestamp: 2000,
          type: OrderType.ASK,
        });

        // Submit buy order that only fills one
        const buyOrder: Order = {
          id: 'buy-1',
          price: 100,
          quantity: 10,
          timestamp: Date.now(),
          type: OrderType.BID,
        };

        const result = matchingEngine.submitOrder(buyOrder);

        expect(result.trades.length).toBe(1);
        expect(result.trades[0].sellOrderId).toBe('sell-1'); // Earlier timestamp
        expect(orderBook.getOrder('sell-2')).not.toBeNull(); // Still in book
      });
    });

    describe('price compatibility', () => {
      it('should not match if buy price is too low', () => {
        orderBook.add({
          id: 'sell-1',
          price: 100,
          quantity: 10,
          timestamp: 1000,
          type: OrderType.ASK,
        });

        const buyOrder: Order = {
          id: 'buy-1',
          price: 99, // Lower than sell price
          quantity: 10,
          timestamp: Date.now(),
          type: OrderType.BID,
        };

        const result = matchingEngine.submitOrder(buyOrder);

        expect(result.trades.length).toBe(0);
        expect(result.remainingOrder!.status).toBe(TradeStatus.PENDING);
        expect(orderBook.getOrderCount()).toBe(2); // Both orders remain
      });

      it('should not match if sell price is too high', () => {
        orderBook.add({
          id: 'buy-1',
          price: 100,
          quantity: 10,
          timestamp: 1000,
          type: OrderType.BID,
        });

        const sellOrder: Order = {
          id: 'sell-1',
          price: 101, // Higher than buy price
          quantity: 10,
          timestamp: Date.now(),
          type: OrderType.ASK,
        };

        const result = matchingEngine.submitOrder(sellOrder);

        expect(result.trades.length).toBe(0);
        expect(result.remainingOrder!.status).toBe(TradeStatus.PENDING);
        expect(orderBook.getOrderCount()).toBe(2);
      });

      it('should match when prices are compatible (buy >= sell)', () => {
        orderBook.add({
          id: 'sell-1',
          price: 100,
          quantity: 10,
          timestamp: 1000,
          type: OrderType.ASK,
        });

        const buyOrder: Order = {
          id: 'buy-1',
          price: 101, // Higher than sell price - should match at 100
          quantity: 10,
          timestamp: Date.now(),
          type: OrderType.BID,
        };

        const result = matchingEngine.submitOrder(buyOrder);

        expect(result.trades.length).toBe(1);
        expect(result.trades[0].price).toBe(100); // Match at sell price
      });
    });
  });

  describe('getTrades', () => {
    it('should return all trades', () => {
      orderBook.add({
        id: 'sell-1',
        price: 100,
        quantity: 10,
        timestamp: 1000,
        type: OrderType.ASK,
      });
      orderBook.add({
        id: 'sell-2',
        price: 101,
        quantity: 10,
        timestamp: 2000,
        type: OrderType.ASK,
      });

      matchingEngine.submitOrder({
        id: 'buy-1',
        price: 101,
        quantity: 10,
        timestamp: 3000,
        type: OrderType.BID,
      });
      matchingEngine.submitOrder({
        id: 'buy-2',
        price: 101,
        quantity: 10,
        timestamp: 4000,
        type: OrderType.BID,
      });

      const trades = matchingEngine.getTrades();

      expect(trades.length).toBe(2);
      expect(trades[0].id).toBe('trade-1');
      expect(trades[1].id).toBe('trade-2');
    });

    it('should return empty array when no trades', () => {
      const trades = matchingEngine.getTrades();
      expect(trades.length).toBe(0);
    });
  });

  describe('getTradesByOrderId', () => {
    it('should return trades for specific order', () => {
      orderBook.add({
        id: 'sell-1',
        price: 100,
        quantity: 10,
        timestamp: 1000,
        type: OrderType.ASK,
      });

      matchingEngine.submitOrder({
        id: 'buy-1',
        price: 100,
        quantity: 10,
        timestamp: 2000,
        type: OrderType.BID,
      });

      const trades = matchingEngine.getTradesByOrderId('buy-1');

      expect(trades.length).toBe(1);
      expect(trades[0].buyOrderId).toBe('buy-1');
    });

    it('should return empty array for order with no trades', () => {
      const trades = matchingEngine.getTradesByOrderId('non-existent');
      expect(trades.length).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all trades', () => {
      orderBook.add({
        id: 'sell-1',
        price: 100,
        quantity: 10,
        timestamp: 1000,
        type: OrderType.ASK,
      });
      matchingEngine.submitOrder({
        id: 'buy-1',
        price: 100,
        quantity: 10,
        timestamp: 2000,
        type: OrderType.BID,
      });

      expect(matchingEngine.getTrades().length).toBe(1);

      matchingEngine.clear();

      expect(matchingEngine.getTrades().length).toBe(0);
    });
  });

  describe('Trade record structure', () => {
    it('should create trade with all required fields', () => {
      orderBook.add({
        id: 'sell-1',
        price: 100,
        quantity: 10,
        timestamp: 1000,
        type: OrderType.ASK,
      });

      const result = matchingEngine.submitOrder({
        id: 'buy-1',
        price: 100,
        quantity: 10,
        timestamp: 2000,
        type: OrderType.BID,
      });

      const trade = result.trades[0];

      expect(trade.id).toBeDefined();
      expect(trade.price).toBe(100);
      expect(trade.quantity).toBe(10);
      expect(trade.timestamp).toBeDefined();
      expect(trade.buyOrderId).toBe('buy-1');
      expect(trade.sellOrderId).toBe('sell-1');
      expect(trade.status).toBe(TradeStatus.FILLED);
    });
  });
});
