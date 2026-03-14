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

    // Extract symbol from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const symbol = pathParts[pathParts.length - 1];

    if (!symbol) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing symbol' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get latest price data
    const { data: priceData, error } = await supabase
      .from('price_history')
      .select('price, bid, ask, volume_24h, high_24h, low_24h, timestamp')
      .eq('symbol', symbol)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw error;
    }

    // Use latest price or default to simulated price
    let midPrice = 50000; // Default BTC-like price
    if (priceData) {
      midPrice = parseFloat(priceData.price.toString());
    }
    
    const spread = midPrice * 0.001; // 0.1% spread

    // Generate 20 levels of bids and asks (matches frontend default)
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

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          bids,
          asks,
          timestamp: Date.now(),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in get-orderbook:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
