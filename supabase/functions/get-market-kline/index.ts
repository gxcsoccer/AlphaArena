import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default trading symbols for simulation
const DEFAULT_SYMBOLS = ['BTC/USD', 'ETH/USD', 'AAPL', 'GOOGL', 'TSLA', 'MSFT', 'NVDA'];

// Initial prices for simulation
const INITIAL_PRICES: Record<string, number> = {
  'BTC/USD': 67500.00,
  'ETH/USD': 3450.00,
  'AAPL': 175.50,
  'GOOGL': 140.25,
  'TSLA': 245.00,
  'MSFT': 415.75,
  'NVDA': 875.30,
};

// Timeframe to milliseconds mapping
const TIMEFRAME_MS: Record<string, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

/**
 * Generate simulated K-line (candlestick) data
 * Uses a random walk algorithm to create realistic-looking price data
 */
function generateSimulatedKlineData(symbol: string, timeframe: string, limit: number): any[] {
  const interval = TIMEFRAME_MS[timeframe] || TIMEFRAME_MS['1h'];
  const now = Date.now();
  const startTime = now - (interval * limit);
  
  const basePrice = INITIAL_PRICES[symbol] || 100;
  const klines: any[] = [];
  let currentPrice = basePrice;
  
  // Volatility varies by symbol type (crypto more volatile than stocks)
  const isCrypto = symbol.includes('BTC') || symbol.includes('ETH');
  const volatility = isCrypto ? 0.02 : 0.01; // 2% for crypto, 1% for stocks
  
  for (let time = startTime; time < now; time += interval) {
    // Simulate price movement (random walk with drift)
    const changePercent = (Math.random() - 0.5) * 2 * volatility;
    const open = currentPrice;
    const close = currentPrice * (1 + changePercent);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = Math.random() * 100 + 10; // Random volume
    
    klines.push({
      time: Math.floor(time / 1000), // Convert to seconds for lightweight-charts
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: parseFloat(volume.toFixed(4)),
    });
    
    currentPrice = close;
  }
  
  return klines;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse URL to extract symbol, timeframe, and limit
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    // Path is like /functions/v1/get-market-kline or /functions/v1/get-market-kline/BTC/USD
    // pathParts: ['', 'functions', 'v1', 'get-market-kline'] or ['', 'functions', 'v1', 'get-market-kline', 'BTC/USD']
    const symbol = pathParts.length > 4 ? pathParts[4] : 'BTC/USD';
    
    // Get query parameters
    const timeframe = url.searchParams.get('timeframe') || '1h';
    const limit = parseInt(url.searchParams.get('limit') || '1000', 10);

    // Try to get historical price data from database
    // For now, we'll generate simulated data since we don't have a price_history table with OHLCV
    console.log(`Generating K-line data for ${symbol}, timeframe: ${timeframe}, limit: ${limit}`);
    
    const klineData = generateSimulatedKlineData(symbol, timeframe, limit);
    
    return new Response(
      JSON.stringify({ success: true, data: klineData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in get-market-kline:', error);
    // On error, return simulated data as fallback
    try {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const symbol = pathParts.length > 4 ? pathParts[4] : 'BTC/USD';
      const timeframe = url.searchParams.get('timeframe') || '1h';
      const limit = parseInt(url.searchParams.get('limit') || '1000', 10);
      
      const klineData = generateSimulatedKlineData(symbol, timeframe, limit);
      return new Response(
        JSON.stringify({ success: true, data: klineData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } catch (fallbackError) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  }
});
