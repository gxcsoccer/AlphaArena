import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Check if requesting specific symbol
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const symbol = pathParts.length > 0 ? pathParts[pathParts.length - 1] : null;

    let query = supabase
      .from('price_history')
      .select('symbol, price, bid, ask, volume_24h, high_24h, low_24h, timestamp')
      .order('timestamp', { ascending: false });

    if (symbol && symbol !== 'tickers') {
      query = query.eq('symbol', symbol).limit(1);
    } else {
      // Get latest price for each symbol
      // Note: This is a simplified approach - in production you'd use a more efficient query
      query = query.limit(100);
    }

    const { data: priceData, error } = await query;

    if (error) {
      throw error;
    }

    if (!priceData || priceData.length === 0) {
      return new Response(
        JSON.stringify({ success: true, data: symbol ? null : [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Format tickers
    const formatTicker = (p: any) => ({
      symbol: p.symbol,
      price: parseFloat(p.price.toString()),
      priceChange24h: 0, // Would need historical data to calculate
      priceChangePercent24h: 0,
      high24h: p.high_24h ? parseFloat(p.high_24h.toString()) : 0,
      low24h: p.low_24h ? parseFloat(p.low_24h.toString()) : 0,
      volume24h: p.volume_24h ? parseFloat(p.volume_24h.toString()) : 0,
      quoteVolume24h: 0,
      bid: p.bid ? parseFloat(p.bid.toString()) : 0,
      ask: p.ask ? parseFloat(p.ask.toString()) : 0,
      timestamp: new Date(p.timestamp).getTime(),
    });

    if (symbol && symbol !== 'tickers') {
      const ticker = formatTicker(priceData[0]);
      return new Response(
        JSON.stringify({ success: true, data: ticker }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } else {
      // Deduplicate by symbol (keep latest)
      const latestBySymbol = new Map();
      for (const p of priceData) {
        if (!latestBySymbol.has(p.symbol)) {
          latestBySymbol.set(p.symbol, p);
        }
      }
      const tickers = Array.from(latestBySymbol.values()).map(formatTicker);
      return new Response(
        JSON.stringify({ success: true, data: tickers }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
  } catch (error) {
    console.error('Error in get-market-tickers:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
