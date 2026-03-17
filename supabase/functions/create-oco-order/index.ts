import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';
import { serve } from 'https://deno.land/std@0.168.0/http/service_worker.ts';

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
    const {
      symbol,
      side,
      strategyId,
      // Take Profit leg
      takeProfitTriggerPrice,
      takeProfitQuantity,
      takeProfitOrderType = 'limit',
      takeProfitLimitPrice,
      // Stop Loss leg
      stopLossTriggerPrice,
      stopLossQuantity,
      stopLossOrderType = 'market',
      stopLossLimitPrice,
      // Expiry
      expiresAt,
    } = body;

    // Validate required fields
    if (!symbol || !side || !takeProfitTriggerPrice || !takeProfitQuantity || !stopLossTriggerPrice || !stopLossQuantity) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: symbol, side, takeProfitTriggerPrice, takeProfitQuantity, stopLossTriggerPrice, stopLossQuantity' 
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

    // Validate order types
    if (!['limit', 'market'].includes(takeProfitOrderType)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid takeProfitOrderType. Must be "limit" or "market"' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!['limit', 'market'].includes(stopLossOrderType)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid stopLossOrderType. Must be "limit" or "market"' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate limit orders have limit prices
    if (takeProfitOrderType === 'limit' && !takeProfitLimitPrice) {
      return new Response(
        JSON.stringify({ success: false, error: 'takeProfitLimitPrice is required when takeProfitOrderType is "limit"' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (stopLossOrderType === 'limit' && !stopLossLimitPrice) {
      return new Response(
        JSON.stringify({ success: false, error: 'stopLossLimitPrice is required when stopLossOrderType is "limit"' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate trigger price logic for OCO
    // For long (buy): TP should be above current price, SL should be below
    // For short (sell): TP should be below current price, SL should be above
    if (side === 'buy' && takeProfitTriggerPrice <= stopLossTriggerPrice) {
      return new Response(
        JSON.stringify({ success: false, error: 'For buy (long) orders, takeProfitTriggerPrice must be greater than stopLossTriggerPrice' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (side === 'sell' && stopLossTriggerPrice <= takeProfitTriggerPrice) {
      return new Response(
        JSON.stringify({ success: false, error: 'For sell (short) orders, stopLossTriggerPrice must be greater than takeProfitTriggerPrice' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create OCO order record
    const { data: ocoOrder, error } = await supabase
      .from('oco_orders')
      .insert([
        {
          strategy_id: strategyId || null,
          symbol,
          side,
          
          take_profit_trigger_price: takeProfitTriggerPrice.toString(),
          take_profit_quantity: takeProfitQuantity.toString(),
          take_profit_order_type: takeProfitOrderType,
          take_profit_limit_price: takeProfitLimitPrice?.toString() || null,
          
          stop_loss_trigger_price: stopLossTriggerPrice.toString(),
          stop_loss_quantity: stopLossQuantity.toString(),
          stop_loss_order_type: stopLossOrderType,
          stop_loss_limit_price: stopLossLimitPrice?.toString() || null,
          
          expires_at: expiresAt || null,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating OCO order:', error);
      throw error;
    }

    // Format response
    const formattedOrder = {
      id: ocoOrder.id,
      strategyId: ocoOrder.strategy_id,
      symbol: ocoOrder.symbol,
      side: ocoOrder.side,
      
      takeProfit: {
        triggerPrice: parseFloat(ocoOrder.take_profit_trigger_price),
        quantity: parseFloat(ocoOrder.take_profit_quantity),
        orderType: ocoOrder.take_profit_order_type,
        limitPrice: ocoOrder.take_profit_limit_price ? parseFloat(ocoOrder.take_profit_limit_price) : null,
      },
      
      stopLoss: {
        triggerPrice: parseFloat(ocoOrder.stop_loss_trigger_price),
        quantity: parseFloat(ocoOrder.stop_loss_quantity),
        orderType: ocoOrder.stop_loss_order_type,
        limitPrice: ocoOrder.stop_loss_limit_price ? parseFloat(ocoOrder.stop_loss_limit_price) : null,
      },
      
      status: ocoOrder.status,
      expiresAt: ocoOrder.expires_at,
      createdAt: ocoOrder.created_at,
      updatedAt: ocoOrder.updated_at,
    };

    return new Response(
      JSON.stringify({ success: true, data: formattedOrder }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      }
    );
  } catch (error) {
    console.error('Error in create-oco-order:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
