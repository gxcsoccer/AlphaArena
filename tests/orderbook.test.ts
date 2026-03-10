import { OrderBook } from '../src/orderbook/OrderBook';
import { Order, OrderType } from '../src/orderbook/types';

describe('OrderBook', () => {
  let orderBook: OrderBook;

  beforeEach(() => {
    orderBook = new OrderBook();
  });

  describe('add', () => {
    it('should add a bid order', () => {
      const order: Order = {
        id: '1',
        price: 100,
        quantity: 10,
        timestamp: Date.now(),
        type: OrderType.BID
      };

      orderBook.add(order);
      const retrieved = orderBook.getOrder('1');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.price).toBe(100);
      expect(retrieved!.quantity).toBe(10);
    });

    it('should add an ask order', () => {
      const order: Order = {
        id: '2',
        price: 105,
        quantity: 5,
        timestamp: Date.now(),
        type: OrderType.ASK
      };

      orderBook.add(order);
      const retrieved = orderBook.getOrder('2');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.type).toBe(OrderType.ASK);
    });

    it('should replace existing order with same ID', () => {
      const order1: Order = {
        id: '1',
        price: 100,
        quantity: 10,
        timestamp: Date.now(),
        type: OrderType.BID
      };

      orderBook.add(order1);

      const order2: Order = {
        id: '1',
        price: 102,
        quantity: 15,
        timestamp: Date.now(),
        type: OrderType.BID
      };

      orderBook.add(order2);
      const retrieved = orderBook.getOrder('1');

      expect(retrieved!.price).toBe(102);
      expect(retrieved!.quantity).toBe(15);
      expect(orderBook.getOrderCount()).toBe(1);
    });
  });

  describe('cancel', () => {
    it('should cancel an existing order', () => {
      const order: Order = {
        id: '1',
        price: 100,
        quantity: 10,
        timestamp: Date.now(),
        type: OrderType.BID
      };

      orderBook.add(order);
      const result = orderBook.cancel('1');

      expect(result).toBe(true);
      expect(orderBook.getOrder('1')).toBeNull();
      expect(orderBook.getOrderCount()).toBe(0);
    });

    it('should return false when canceling non-existent order', () => {
      const result = orderBook.cancel('non-existent');
      expect(result).toBe(false);
    });

    it('should remove price level when last order is canceled', () => {
      const order: Order = {
        id: '1',
        price: 100,
        quantity: 10,
        timestamp: Date.now(),
        type: OrderType.BID
      };

      orderBook.add(order);
      orderBook.cancel('1');

      const snapshot = orderBook.getSnapshot();
      expect(snapshot.bids.length).toBe(0);
    });
  });

  describe('modify', () => {
    it('should modify order quantity', () => {
      const order: Order = {
        id: '1',
        price: 100,
        quantity: 10,
        timestamp: Date.now(),
        type: OrderType.BID
      };

      orderBook.add(order);
      const result = orderBook.modify('1', 20);

      expect(result).toBe(true);
      const retrieved = orderBook.getOrder('1');
      expect(retrieved!.quantity).toBe(20);
    });

    it('should modify order price', () => {
      const order: Order = {
        id: '1',
        price: 100,
        quantity: 10,
        timestamp: Date.now(),
        type: OrderType.BID
      };

      orderBook.add(order);
      const result = orderBook.modify('1', 15, 102);

      expect(result).toBe(true);
      const retrieved = orderBook.getOrder('1');
      expect(retrieved!.price).toBe(102);
      expect(retrieved!.quantity).toBe(15);
    });

    it('should return false when modifying non-existent order', () => {
      const result = orderBook.modify('non-existent', 10);
      expect(result).toBe(false);
    });
  });

  describe('getBestBid', () => {
    it('should return null when no bids', () => {
      expect(orderBook.getBestBid()).toBeNull();
    });

    it('should return highest bid price', () => {
      orderBook.add({ id: '1', price: 100, quantity: 10, timestamp: Date.now(), type: OrderType.BID });
      orderBook.add({ id: '2', price: 102, quantity: 5, timestamp: Date.now(), type: OrderType.BID });
      orderBook.add({ id: '3', price: 99, quantity: 15, timestamp: Date.now(), type: OrderType.BID });

      expect(orderBook.getBestBid()).toBe(102);
    });
  });

  describe('getBestAsk', () => {
    it('should return null when no asks', () => {
      expect(orderBook.getBestAsk()).toBeNull();
    });

    it('should return lowest ask price', () => {
      orderBook.add({ id: '1', price: 105, quantity: 10, timestamp: Date.now(), type: OrderType.ASK });
      orderBook.add({ id: '2', price: 103, quantity: 5, timestamp: Date.now(), type: OrderType.ASK });
      orderBook.add({ id: '3', price: 107, quantity: 15, timestamp: Date.now(), type: OrderType.ASK });

      expect(orderBook.getBestAsk()).toBe(103);
    });
  });

  describe('getDepth', () => {
    it('should return zero depth when empty', () => {
      const depth = orderBook.getDepth();
      expect(depth.bidDepth).toBe(0);
      expect(depth.askDepth).toBe(0);
      expect(depth.totalDepth).toBe(0);
    });

    it('should calculate correct depth', () => {
      orderBook.add({ id: '1', price: 100, quantity: 10, timestamp: Date.now(), type: OrderType.BID });
      orderBook.add({ id: '2', price: 102, quantity: 5, timestamp: Date.now(), type: OrderType.BID });
      orderBook.add({ id: '3', price: 105, quantity: 15, timestamp: Date.now(), type: OrderType.ASK });
      orderBook.add({ id: '4', price: 107, quantity: 8, timestamp: Date.now(), type: OrderType.ASK });

      const depth = orderBook.getDepth();
      expect(depth.bidDepth).toBe(15);  // 10 + 5
      expect(depth.askDepth).toBe(23);  // 15 + 8
      expect(depth.totalDepth).toBe(38);
    });
  });

  describe('getSnapshot', () => {
    it('should return empty snapshot when empty', () => {
      const snapshot = orderBook.getSnapshot();
      expect(snapshot.bids.length).toBe(0);
      expect(snapshot.asks.length).toBe(0);
      expect(snapshot.timestamp).toBeDefined();
    });

    it('should return sorted snapshot', () => {
      orderBook.add({ id: '1', price: 100, quantity: 10, timestamp: Date.now(), type: OrderType.BID });
      orderBook.add({ id: '2', price: 102, quantity: 5, timestamp: Date.now(), type: OrderType.BID });
      orderBook.add({ id: '3', price: 99, quantity: 15, timestamp: Date.now(), type: OrderType.BID });
      orderBook.add({ id: '4', price: 105, quantity: 10, timestamp: Date.now(), type: OrderType.ASK });
      orderBook.add({ id: '5', price: 103, quantity: 5, timestamp: Date.now(), type: OrderType.ASK });

      const snapshot = orderBook.getSnapshot();

      // Bids should be sorted by price descending
      expect(snapshot.bids[0].price).toBe(102);
      expect(snapshot.bids[1].price).toBe(100);
      expect(snapshot.bids[2].price).toBe(99);

      // Asks should be sorted by price ascending
      expect(snapshot.asks[0].price).toBe(103);
      expect(snapshot.asks[1].price).toBe(105);
    });

    it('should limit snapshot to specified levels', () => {
      for (let i = 0; i < 10; i++) {
        orderBook.add({
          id: `bid-${i}`,
          price: 100 + i,
          quantity: 10,
          timestamp: Date.now(),
          type: OrderType.BID
        });
      }

      const snapshot = orderBook.getSnapshot(3);
      expect(snapshot.bids.length).toBe(3);
    });
  });

  describe('clear', () => {
    it('should remove all orders', () => {
      orderBook.add({ id: '1', price: 100, quantity: 10, timestamp: Date.now(), type: OrderType.BID });
      orderBook.add({ id: '2', price: 105, quantity: 5, timestamp: Date.now(), type: OrderType.ASK });

      orderBook.clear();

      expect(orderBook.getOrderCount()).toBe(0);
      expect(orderBook.getBestBid()).toBeNull();
      expect(orderBook.getBestAsk()).toBeNull();
    });
  });

  describe('price-time priority', () => {
    it('should prioritize higher price for bids', () => {
      const now = Date.now();
      orderBook.add({ id: '1', price: 100, quantity: 10, timestamp: now, type: OrderType.BID });
      orderBook.add({ id: '2', price: 101, quantity: 5, timestamp: now + 1, type: OrderType.BID });

      const snapshot = orderBook.getSnapshot();
      expect(snapshot.bids[0].price).toBe(101);  // Higher price first
    });

    it('should prioritize earlier time for same price', () => {
      orderBook.add({ id: '1', price: 100, quantity: 10, timestamp: 1000, type: OrderType.BID });
      orderBook.add({ id: '2', price: 100, quantity: 5, timestamp: 2000, type: OrderType.BID });
      orderBook.add({ id: '3', price: 100, quantity: 15, timestamp: 1500, type: OrderType.BID });

      const snapshot = orderBook.getSnapshot();
      expect(snapshot.bids[0].orders[0].id).toBe('1');  // Earliest timestamp
      expect(snapshot.bids[0].orders[1].id).toBe('3');
      expect(snapshot.bids[0].orders[2].id).toBe('2');
    });

    it('should prioritize lower price for asks', () => {
      const now = Date.now();
      orderBook.add({ id: '1', price: 105, quantity: 10, timestamp: now, type: OrderType.ASK });
      orderBook.add({ id: '2', price: 103, quantity: 5, timestamp: now + 1, type: OrderType.ASK });

      const snapshot = orderBook.getSnapshot();
      expect(snapshot.asks[0].price).toBe(103);  // Lower price first
    });
  });
});
