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

    // Extract order ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const orderId = pathParts[pathParts.length - 1];

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if order exists and is cancellable
    const { data: existingOrder, error: fetchError } = await supabase
      .from('oco_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !existingOrder) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (existingOrder.status !== 'pending') {
      return new Response(
        JSON.stringify({ success: false, error: `Cannot cancel order with status "${existingOrder.status}"` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Cancel any linked conditional orders
    if (existingOrder.take_profit_conditional_order_id) {
      await supabase
        .from('conditional_orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', existingOrder.take_profit_conditional_order_id);
    }

    if (existingOrder.stop_loss_conditional_order_id) {
      await supabase
        .from('conditional_orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', existingOrder.stop_loss_conditional_order_id);
    }

    // Update OCO order status
    const { data: cancelledOrder, error: updateError } = await supabase
      .from('oco_orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      console.error('Error cancelling OCO order:', updateError);
      throw updateError;
    }

    // Format response
    const formattedOrder = {
      id: cancelledOrder.id,
      strategyId: cancelledOrder.strategy_id,
      symbol: cancelledOrder.symbol,
      side: cancelledOrder.side,
      
      takeProfit: {
        triggerPrice: parseFloat(cancelledOrder.take_profit_trigger_price),
        quantity: parseFloat(cancelledOrder.take_profit_quantity),
        orderType: cancelledOrder.take_profit_order_type,
        limitPrice: cancelledOrder.take_profit_limit_price ? parseFloat(cancelledOrder.take_profit_limit_price) : null,
      },
      
      stopLoss: {
        triggerPrice: parseFloat(cancelledOrder.stop_loss_trigger_price),
        quantity: parseFloat(cancelledOrder.stop_loss_quantity),
        orderType: cancelledOrder.stop_loss_order_type,
        limitPrice: cancelledOrder.stop_loss_limit_price ? parseFloat(cancelledOrder.stop_loss_limit_price) : null,
      },
      
      status: cancelledOrder.status,
      cancelledAt: cancelledOrder.updated_at,
    };

    return new Response(
      JSON.stringify({ success: true, data: formattedOrder }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in cancel-oco-order:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
