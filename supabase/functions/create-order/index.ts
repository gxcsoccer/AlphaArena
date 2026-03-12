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

    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { symbol, side, type, price, quantity, strategyId } = body;

    // Validate required fields
    if (!symbol || !side || !quantity) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: symbol, side, quantity' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!['buy', 'sell'].includes(side)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid side. Must be "buy" or "sell"' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // For limit orders, price is required
    if (type === 'limit' && !price) {
      return new Response(
        JSON.stringify({ success: false, error: 'Price is required for limit orders' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get current market price if not provided
    let orderPrice = price;
    if (!orderPrice) {
      const { data: priceData } = await supabase
        .from('price_history')
        .select('price')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();
      
      if (priceData) {
        orderPrice = parseFloat(priceData.price.toString());
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'No price data available for symbol' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    // Create order record (simplified - in production this would be more complex)
    const total = orderPrice * quantity;
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Note: This is a simplified implementation
    // In production, you'd have a proper orders table and matching logic
    const order = {
      id: orderId,
      symbol,
      side,
      type: type || 'market',
      price: orderPrice,
      quantity,
      total,
      status: 'pending',
      strategyId: strategyId || null,
      createdAt: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({ success: true, data: order }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      }
    );
  } catch (error) {
    console.error('Error in create-order:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
