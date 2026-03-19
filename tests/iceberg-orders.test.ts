import { OrderBook } from '../src/orderbook/OrderBook';
import { MatchingEngine } from '../src/matching/MatchingEngine';
import { Order, OrderType, IcebergOrder, OrderCategory, isIcebergOrder } from '../src/orderbook/types';

describe('Iceberg Orders', () => {
  let orderBook: OrderBook;
  let matchingEngine: MatchingEngine;

  beforeEach(() => {
    orderBook = new OrderBook();
    matchingEngine = new MatchingEngine(orderBook);
  });

  describe('IcebergOrder Type', () => {
    it('should create a valid iceberg order', () => {
      const icebergOrder: IcebergOrder = {
        id: 'iceberg-1',
        price: 100,
        totalQuantity: 100,
        visibleQuantity: 20,
        hiddenQuantity: 80,
        displayQuantity: 20,
        timestamp: Date.now(),
        type: OrderType.BID,
        category: OrderCategory.ICEBERG,
      };

      expect(icebergOrder.id).toBe('iceberg-1');
      expect(icebergOrder.totalQuantity).toBe(100);
      expect(icebergOrder.visibleQuantity).toBe(20);
      expect(icebergOrder.hiddenQuantity).toBe(80);
      expect(icebergOrder.category).toBe(OrderCategory.ICEBERG);
    });

    it('should correctly identify iceberg orders using type guard', () => {
      const icebergOrder: IcebergOrder = {
        id: 'iceberg-1',
        price: 100,
        totalQuantity: 100,
        visibleQuantity: 20,
        hiddenQuantity: 80,
        displayQuantity: 20,
        timestamp: Date.now(),
        type: OrderType.BID,
        category: OrderCategory.ICEBERG,
      };

      const regularOrder: Order = {
        id: 'order-1',
        price: 100,
        quantity: 50,
        timestamp: Date.now(),
        type: OrderType.BID,
      };

      expect(isIcebergOrder(icebergOrder)).toBe(true);
      expect(isIcebergOrder(regularOrder)).toBe(false);
    });
  });

  describe('OrderBook with Iceberg Orders', () => {
    it('should add an iceberg order to the order book', () => {
      const icebergOrder: IcebergOrder = {
        id: 'iceberg-1',
        price: 100,
        totalQuantity: 100,
        visibleQuantity: 20,
        hiddenQuantity: 80,
        displayQuantity: 20,
        timestamp: Date.now(),
        type: OrderType.BID,
        category: OrderCategory.ICEBERG,
      };

      orderBook.addIceberg(icebergOrder);

      // Should only show visible quantity in the order book
      expect(orderBook.getOrderCount()).toBe(1);
      
      // Get the internal order to verify hidden quantity
      const internalOrder = orderBook.getInternalOrder('iceberg-1');
      expect(internalOrder).not.toBeNull();
      expect(internalOrder!.visibleQuantity).toBe(20);
      expect(internalOrder!.hiddenQuantity).toBe(80);
    });

    it('should only display visible quantity in price levels', () => {
      const icebergOrder: IcebergOrder = {
        id: 'iceberg-1',
        price: 100,
        totalQuantity: 100,
        visibleQuantity: 20,
        hiddenQuantity: 80,
        displayQuantity: 20,
        timestamp: Date.now(),
        type: OrderType.BID,
        category: OrderCategory.ICEBERG,
      };

      orderBook.addIceberg(icebergOrder);

      const snapshot = orderBook.getSnapshot();
      expect(snapshot.bids.length).toBe(1);
      expect(snapshot.bids[0].totalQuantity).toBe(20); // Only visible quantity
    });

    it('should detect iceberg orders correctly', () => {
      const icebergOrder: IcebergOrder = {
        id: 'iceberg-1',
        price: 100,
        totalQuantity: 100,
        visibleQuantity: 20,
        hiddenQuantity: 80,
        displayQuantity: 20,
        timestamp: Date.now(),
        type: OrderType.BID,
        category: OrderCategory.ICEBERG,
      };

      const regularOrder: Order = {
        id: 'order-1',
        price: 95,
        quantity: 50,
        timestamp: Date.now(),
        type: OrderType.BID,
      };

      orderBook.addIceberg(icebergOrder);
      orderBook.add(regularOrder);

      expect(orderBook.isIcebergOrder('iceberg-1')).toBe(true);
      expect(orderBook.isIcebergOrder('order-1')).toBe(false);
    });

    it('should refill visible quantity when iceberg order is partially filled', () => {
      const icebergOrder: IcebergOrder = {
        id: 'iceberg-1',
        price: 100,
        totalQuantity: 100,
        visibleQuantity: 20,
        hiddenQuantity: 80,
        displayQuantity: 20,
        timestamp: Date.now(),
        type: OrderType.BID,
        category: OrderCategory.ICEBERG,
      };

      orderBook.addIceberg(icebergOrder);

      // Fill the visible quantity
      const result = orderBook.fillIcebergOrder('iceberg-1', 20);

      expect(result).not.toBeNull();
      expect(result!.remainingQuantity).toBe(80);
      expect(result!.isVisibleRefilled).toBe(true);

      // Check that visible quantity was refilled
      const internalOrder = orderBook.getInternalOrder('iceberg-1');
      expect(internalOrder!.visibleQuantity).toBe(20); // Refilled with displayQuantity
      expect(internalOrder!.hiddenQuantity).toBe(60);
    });

    it('should handle partial fill of visible quantity', () => {
      const icebergOrder: IcebergOrder = {
        id: 'iceberg-1',
        price: 100,
        totalQuantity: 100,
        visibleQuantity: 20,
        hiddenQuantity: 80,
        displayQuantity: 20,
        timestamp: Date.now(),
        type: OrderType.BID,
        category: OrderCategory.ICEBERG,
      };

      orderBook.addIceberg(icebergOrder);

      // Partially fill visible quantity
      const result = orderBook.fillIcebergOrder('iceberg-1', 10);

      expect(result).not.toBeNull();
      expect(result!.remainingQuantity).toBe(90);
      expect(result!.isVisibleRefilled).toBe(false);

      const internalOrder = orderBook.getInternalOrder('iceberg-1');
      expect(internalOrder!.visibleQuantity).toBe(10);
      expect(internalOrder!.hiddenQuantity).toBe(80);
    });

    it('should remove iceberg order when fully filled', () => {
      const icebergOrder: IcebergOrder = {
        id: 'iceberg-1',
        price: 100,
        totalQuantity: 50,
        visibleQuantity: 20,
        hiddenQuantity: 30,
        displayQuantity: 20,
        timestamp: Date.now(),
        type: OrderType.BID,
        category: OrderCategory.ICEBERG,
      };

      orderBook.addIceberg(icebergOrder);

      // Fill all quantity
      let result = orderBook.fillIcebergOrder('iceberg-1', 20);
      expect(result!.isVisibleRefilled).toBe(true);
      
      result = orderBook.fillIcebergOrder('iceberg-1', 20);
      expect(result!.isVisibleRefilled).toBe(true);
      
      result = orderBook.fillIcebergOrder('iceberg-1', 10);
      expect(result).toBeNull(); // Order fully filled and removed

      expect(orderBook.getOrder('iceberg-1')).toBeNull();
    });
  });

  describe('MatchingEngine with Iceberg Orders', () => {
    it('should match incoming order against iceberg order visible quantity', () => {
      // Add an iceberg sell order
      const icebergSell: IcebergOrder = {
        id: 'iceberg-sell-1',
        price: 100,
        totalQuantity: 100,
        visibleQuantity: 20,
        hiddenQuantity: 80,
        displayQuantity: 20,
        timestamp: Date.now(),
        type: OrderType.ASK,
        category: OrderCategory.ICEBERG,
      };

      orderBook.addIceberg(icebergSell);

      // Submit a buy order that matches
      const buyOrder: Order = {
        id: 'buy-1',
        price: 100,
        quantity: 30,
        timestamp: Date.now(),
        type: OrderType.BID,
      };

      const result = matchingEngine.submitOrder(buyOrder);

      // Should have traded 30 (20 from visible + 10 from refilled)
      expect(result.trades.length).toBeGreaterThanOrEqual(1);
      expect(result.trades.reduce((sum, t) => sum + t.quantity, 0)).toBe(30);
    });

    it('should fully match iceberg order when counter order is large enough', () => {
      // Add an iceberg sell order
      const icebergSell: IcebergOrder = {
        id: 'iceberg-sell-1',
        price: 100,
        totalQuantity: 50,
        visibleQuantity: 20,
        hiddenQuantity: 30,
        displayQuantity: 20,
        timestamp: Date.now(),
        type: OrderType.ASK,
        category: OrderCategory.ICEBERG,
      };

      orderBook.addIceberg(icebergSell);

      // Submit a large buy order
      const buyOrder: Order = {
        id: 'buy-1',
        price: 100,
        quantity: 100,
        timestamp: Date.now(),
        type: OrderType.BID,
      };

      const result = matchingEngine.submitOrder(buyOrder);

      // All iceberg quantity should be traded
      const totalTraded = result.trades.reduce((sum, t) => sum + t.quantity, 0);
      expect(totalTraded).toBe(50);
      
      // Iceberg order should be removed
      expect(orderBook.getOrder('iceberg-sell-1')).toBeNull();
    });

    it('should submit iceberg order and match against existing orders', () => {
      // Add a regular sell order
      const sellOrder: Order = {
        id: 'sell-1',
        price: 100,
        quantity: 50,
        timestamp: Date.now(),
        type: OrderType.ASK,
      };

      orderBook.add(sellOrder);

      // Submit an iceberg buy order
      const icebergBuy: IcebergOrder = {
        id: 'iceberg-buy-1',
        price: 100,
        totalQuantity: 100,
        visibleQuantity: 30,
        hiddenQuantity: 70,
        displayQuantity: 30,
        timestamp: Date.now(),
        type: OrderType.BID,
        category: OrderCategory.ICEBERG,
      };

      const result = matchingEngine.submitIcebergOrder(icebergBuy);

      // Should have matched against the sell order
      expect(result.trades.length).toBe(1);
      expect(result.trades[0].quantity).toBe(50);
      
      // Remaining iceberg order should be in the book
      expect(orderBook.getOrder('iceberg-buy-1')).not.toBeNull();
    });
  });

  describe('Iceberg Order Variance', () => {
    it('should apply variance to visible quantity when refilling', () => {
      const icebergOrder: IcebergOrder = {
        id: 'iceberg-1',
        price: 100,
        totalQuantity: 100,
        visibleQuantity: 20,
        hiddenQuantity: 80,
        displayQuantity: 20,
        variance: 5, // Visible quantity will vary between 15-20
        timestamp: Date.now(),
        type: OrderType.BID,
        category: OrderCategory.ICEBERG,
      };

      orderBook.addIceberg(icebergOrder);

      // Fill visible quantity
      const result = orderBook.fillIcebergOrder('iceberg-1', 20);

      expect(result!.isVisibleRefilled).toBe(true);
      
      // Visible quantity should be between 15 and 20 (or remaining if less)
      const internalOrder = orderBook.getInternalOrder('iceberg-1');
      expect(internalOrder!.visibleQuantity).toBeGreaterThanOrEqual(15);
      expect(internalOrder!.visibleQuantity).toBeLessThanOrEqual(20);
    });
  });

  describe('Mixed Order Types', () => {
    it('should handle both regular and iceberg orders in the same order book', () => {
      const regularOrder: Order = {
        id: 'regular-1',
        price: 100,
        quantity: 30,
        timestamp: Date.now(),
        type: OrderType.BID,
      };

      const icebergOrder: IcebergOrder = {
        id: 'iceberg-1',
        price: 100,
        totalQuantity: 100,
        visibleQuantity: 20,
        hiddenQuantity: 80,
        displayQuantity: 20,
        timestamp: Date.now(),
        type: OrderType.BID,
        category: OrderCategory.ICEBERG,
      };

      orderBook.add(regularOrder);
      orderBook.addIceberg(icebergOrder);

      expect(orderBook.getOrderCount()).toBe(2);
      expect(orderBook.isIcebergOrder('regular-1')).toBe(false);
      expect(orderBook.isIcebergOrder('iceberg-1')).toBe(true);
    });

    it('should match regular orders against iceberg orders', () => {
      // Add iceberg sell order
      const icebergSell: IcebergOrder = {
        id: 'iceberg-sell-1',
        price: 100,
        totalQuantity: 100,
        visibleQuantity: 20,
        hiddenQuantity: 80,
        displayQuantity: 20,
        timestamp: Date.now(),
        type: OrderType.ASK,
        category: OrderCategory.ICEBERG,
      };

      orderBook.addIceberg(icebergSell);

      // Add regular buy order
      const buyOrder: Order = {
        id: 'buy-1',
        price: 100,
        quantity: 50,
        timestamp: Date.now(),
        type: OrderType.BID,
      };

      const result = matchingEngine.submitOrder(buyOrder);

      // Should have traded 50
      const totalTraded = result.trades.reduce((sum, t) => sum + t.quantity, 0);
      expect(totalTraded).toBe(50);

      // Iceberg should have 50 remaining
      const internalOrder = orderBook.getInternalOrder('iceberg-sell-1');
      expect(internalOrder!.hiddenQuantity + internalOrder!.visibleQuantity).toBe(50);
    });
  });
});
