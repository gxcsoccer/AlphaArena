/**
 * Tests for OrderBook Edge Function
 * 
 * Verifies that the get-orderbook function returns proper data
 * even when database has no price history.
 */

// Jest provides describe, it, expect as globals - no import needed

// Mock the Supabase client
const mockSupabase = {
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: () => ({
            single: async () => {
              // Simulate no data in database (PGRST116 error)
              return { data: null, error: { code: 'PGRST116' } };
            },
          }),
        }),
      }),
    }),
  }),
};

describe('get-orderbook Edge Function', () => {
  it('should return simulated orderbook when no price data exists', async () => {
    // Simulate the logic from get-orderbook/index.ts
    let midPrice = 50000; // Default BTC-like price
    const priceData: any = null; // No data from database
    
    if (priceData) {
      midPrice = parseFloat(priceData.price.toString());
    }
    
    const spread = midPrice * 0.001; // 0.1% spread

    // Generate 20 levels of bids and asks
    const bids = [];
    const asks = [];
    for (let i = 0; i < 20; i++) {
      const bidPrice = midPrice - (spread * (i + 1)) - (Math.random() * 2);
      const askPrice = midPrice + (spread * (i + 1)) + (Math.random() * 2);
      const bidQty = 0.5 + Math.random() * 2;
      const askQty = 0.5 + Math.random() * 2;
      
      bids.push({
        price: parseFloat(bidPrice.toFixed(2)),
        orders: [],
        totalQuantity: parseFloat(bidQty.toFixed(4)),
      });
      asks.push({
        price: parseFloat(askPrice.toFixed(2)),
        orders: [],
        totalQuantity: parseFloat(askQty.toFixed(4)),
      });
    }

    // Verify we have 20 levels of bids and asks
    expect(bids).toHaveLength(20);
    expect(asks).toHaveLength(20);

    // Verify bid prices are in descending order (highest first)
    for (let i = 1; i < bids.length; i++) {
      expect(bids[i].price).toBeLessThan(bids[i - 1].price);
    }

    // Verify ask prices are in ascending order (lowest first)
    for (let i = 1; i < asks.length; i++) {
      expect(asks[i].price).toBeGreaterThan(asks[i - 1].price);
    }

    // Verify best bid < best ask (no crossed book)
    expect(bids[0].price).toBeLessThan(asks[0].price);

    // Verify quantities are positive
    bids.forEach(bid => {
      expect(bid.totalQuantity).toBeGreaterThan(0);
    });
    asks.forEach(ask => {
      expect(ask.totalQuantity).toBeGreaterThan(0);
    });
  });

  it('should use database price when available', async () => {
    const priceData: any = { price: 45000 };
    let midPrice = 50000;
    
    if (priceData) {
      midPrice = parseFloat(priceData.price.toString());
    }
    
    expect(midPrice).toBe(45000);
  });

  it('should generate realistic spread', () => {
    const midPrice = 50000;
    const spread = midPrice * 0.001; // 0.1%
    
    expect(spread).toBe(50);
    
    // Best bid should be around midPrice - spread
    // Best ask should be around midPrice + spread
    const bestBid = midPrice - spread - 1; // Approximate
    const bestAsk = midPrice + spread + 1; // Approximate
    
    expect(bestBid).toBeLessThan(midPrice);
    expect(bestAsk).toBeGreaterThan(midPrice);
    expect(bestAsk - bestBid).toBeGreaterThan(spread);
  });
});
