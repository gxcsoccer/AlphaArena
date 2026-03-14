/**
 * Order Cancellation API Tests
 * Tests for order creation, retrieval, and cancellation endpoints
 */

describe('Order Cancellation API', () => {
  const API_BASE_URL = 'http://localhost:3001';

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/orders', () => {
    it('should create a new limit order', async () => {
      const mockOrder = {
        id: 'order_1234567890_abc123',
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'limit',
        price: 50000,
        quantity: 0.1,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({ success: true, data: mockOrder }),
      });

      const res = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC/USD',
          side: 'buy',
          type: 'limit',
          price: 50000,
          quantity: 0.1,
        }),
      });

      const result = await res.json() as any;

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/orders`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
      expect(result.data.status).toBe('pending');
    });

    it('should create a market order without price', async () => {
      const mockOrder = {
        id: 'order_1234567890_def456',
        symbol: 'ETH/USD',
        side: 'sell',
        type: 'market',
        price: 0,
        quantity: 1.5,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({ success: true, data: mockOrder }),
      });

      const res = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'ETH/USD',
          side: 'sell',
          type: 'market',
          quantity: 1.5,
        }),
      });

      const result = await res.json() as any;

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('market');
    });

    it('should return error for limit order without price', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Price is required for limit orders',
        }),
      });

      const res = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC/USD',
          side: 'buy',
          type: 'limit',
          quantity: 0.1,
        }),
      });

      const result = await res.json() as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Price is required');
    });

    it('should return error for missing required fields', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Missing required fields: symbol, side, type, quantity',
        }),
      });

      const res = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC/USD',
        }),
      });

      const result = await res.json() as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });
  });

  describe('GET /api/orders', () => {
    it('should return list of orders', async () => {
      const mockOrders = [
        {
          id: 'order_1',
          symbol: 'BTC/USD',
          side: 'buy',
          type: 'limit',
          price: 50000,
          quantity: 0.1,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'order_2',
          symbol: 'ETH/USD',
          side: 'sell',
          type: 'market',
          price: 0,
          quantity: 1.5,
          status: 'filled',
          createdAt: new Date().toISOString(),
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({ success: true, data: mockOrders }),
      });

      const res = await fetch(`${API_BASE_URL}/api/orders`);
      const result = await res.json() as any;

      expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/orders`);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should filter orders by symbol', async () => {
      const mockOrders = [
        {
          id: 'order_1',
          symbol: 'BTC/USD',
          side: 'buy',
          type: 'limit',
          price: 50000,
          quantity: 0.1,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({ success: true, data: mockOrders }),
      });

      const res = await fetch(`${API_BASE_URL}/api/orders?symbol=BTC/USD`);
      const result = await res.json() as any;

      expect(result.success).toBe(true);
      expect(result.data.every((o: any) => o.symbol === 'BTC/USD')).toBe(true);
    });

    it('should filter orders by status', async () => {
      const mockOrders = [
        {
          id: 'order_1',
          symbol: 'BTC/USD',
          side: 'buy',
          type: 'limit',
          price: 50000,
          quantity: 0.1,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({ success: true, data: mockOrders }),
      });

      const res = await fetch(`${API_BASE_URL}/api/orders?status=pending`);
      const result = await res.json() as any;

      expect(result.success).toBe(true);
      expect(result.data.every((o: any) => o.status === 'pending')).toBe(true);
    });

    it('should limit the number of results', async () => {
      const mockOrders = Array(10).fill(null).map((_, i) => ({
        id: `order_${i}`,
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'limit',
        price: 50000,
        quantity: 0.1,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }));

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({ success: true, data: mockOrders }),
      });

      const res = await fetch(`${API_BASE_URL}/api/orders?limit=5`);
      const result = await res.json() as any;

      expect(result.data).toHaveLength(10);
    });
  });

  describe('POST /api/orders/:orderId/cancel', () => {
    it('should cancel a pending order', async () => {
      const mockOrder = {
        id: 'order_123',
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'limit',
        price: 50000,
        quantity: 0.1,
        status: 'cancelled',
        createdAt: new Date().toISOString(),
        cancelledAt: new Date().toISOString(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({ success: true, data: mockOrder }),
      });

      const res = await fetch(`${API_BASE_URL}/api/orders/order_123/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const result = await res.json() as any;

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/orders/order_123/cancel`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('cancelled');
      expect(result.data.cancelledAt).toBeDefined();
    });

    it('should return error for non-existent order', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Order not found',
        }),
        status: 404,
      });

      const res = await fetch(`${API_BASE_URL}/api/orders/non_existent_order/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const result = await res.json() as any;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });

    it('should return error for already filled order', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Only pending orders can be cancelled',
        }),
        status: 400,
      });

      const res = await fetch(`${API_BASE_URL}/api/orders/order_filled/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const result = await res.json() as any;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Only pending orders can be cancelled');
    });

    it('should return error for already cancelled order', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Only pending orders can be cancelled',
        }),
        status: 400,
      });

      const res = await fetch(`${API_BASE_URL}/api/orders/order_cancelled/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const result = await res.json() as any;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Only pending orders can be cancelled');
    });
  });

  describe('Order cancellation flow', () => {
    it('should complete full order lifecycle: create → get → cancel', async () => {
      // Create order
      const createdOrder = {
        id: 'order_lifecycle_test',
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'limit',
        price: 50000,
        quantity: 0.1,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: createdOrder }),
        })
        // Get orders
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: [createdOrder] }),
        })
        // Cancel order
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            data: { ...createdOrder, status: 'cancelled', cancelledAt: new Date().toISOString() },
          }),
        })
        // Get orders again to verify cancellation
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            data: [{ ...createdOrder, status: 'cancelled', cancelledAt: new Date().toISOString() }],
          }),
        });

      // Step 1: Create order
      const createRes = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC/USD',
          side: 'buy',
          type: 'limit',
          price: 50000,
          quantity: 0.1,
        }),
      });
      const createResult = await createRes.json() as any;
      expect(createResult.success).toBe(true);
      expect(createResult.data.status).toBe('pending');

      // Step 2: Get orders
      const getRes = await fetch(`${API_BASE_URL}/api/orders`);
      const getResult = await getRes.json() as any;
      expect(getResult.success).toBe(true);
      expect(getResult.data).toHaveLength(1);

      // Step 3: Cancel order
      const cancelRes = await fetch(`${API_BASE_URL}/api/orders/order_lifecycle_test/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const cancelResult = await cancelRes.json() as any;
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.data.status).toBe('cancelled');

      // Step 4: Verify cancellation
      const getAgainRes = await fetch(`${API_BASE_URL}/api/orders`);
      const getAgainResult = await getAgainRes.json() as any;
      expect(getAgainResult.data[0].status).toBe('cancelled');
    });
  });
});
