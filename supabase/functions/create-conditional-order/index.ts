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
    const { symbol, side, orderType, triggerPrice, quantity, expiresAt, strategyId } = body;

    // Validate required fields
    if (!symbol || !side || !orderType || !triggerPrice || !quantity) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: symbol, side, orderType, triggerPrice, quantity' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate side
    if (!['buy', 'sell'].includes(side)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid side. Must be "buy" or "sell"' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate order type
    if (!['stop_loss', 'take_profit'].includes(orderType)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid orderType. Must be "stop_loss" or "take_profit"' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate trigger price
    if (typeof triggerPrice !== 'number' || triggerPrice <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid triggerPrice. Must be a positive number' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate quantity
    if (typeof quantity !== 'number' || quantity <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid quantity. Must be a positive number' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate trigger price logic
    // Stop-loss: should trigger when price falls below trigger price (typically for sell orders)
    // Take-profit: should trigger when price rises above trigger price (typically for sell orders)
    // Note: We allow flexibility but warn about unusual combinations

    // Get current market price for validation
    const { data: priceData } = await supabase
      .from('price_history')
      .select('price')
      .eq('symbol', symbol)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    
    let currentPrice = null;
    if (priceData) {
      currentPrice = parseFloat(priceData.price.toString());
    }

    // Optional validation warnings (not blocking)
    if (currentPrice) {
      if (orderType === 'stop_loss' && side === 'buy' && triggerPrice > currentPrice) {
        console.warn('Stop-loss buy order with trigger above current price - unusual combination');
      }
      if (orderType === 'take_profit' && side === 'buy' && triggerPrice < currentPrice) {
        console.warn('Take-profit buy order with trigger below current price - unusual combination');
      }
    }

    // Create conditional order record
    const { data: order, error } = await supabase
      .from('conditional_orders')
      .insert([
        {
          strategy_id: strategyId || null,
          symbol,
          side,
          order_type: orderType,
          trigger_price: triggerPrice.toString(),
          quantity: quantity.toString(),
          expires_at: expiresAt || null,
          status: 'active',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating conditional order:', error);
      throw error;
    }

    // Format response
    const formattedOrder = {
      id: order.id,
      strategyId: order.strategy_id,
      symbol: order.symbol,
      side: order.side,
      orderType: order.order_type,
      triggerPrice: parseFloat(order.trigger_price),
      quantity: parseFloat(order.quantity),
      status: order.status,
      expiresAt: order.expires_at,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };

    return new Response(
      JSON.stringify({ success: true, data: formattedOrder }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      }
    );
  } catch (error) {
    console.error('Error in create-conditional-order:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
