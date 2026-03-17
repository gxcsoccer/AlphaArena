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

    // Only allow GET
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol');
    const status = url.searchParams.get('status');
    const strategyId = url.searchParams.get('strategyId');
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');

    // Build query
    let query = supabase
      .from('oco_orders')
      .select('*');

    if (symbol) {
      query = query.eq('symbol', symbol);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (strategyId) {
      query = query.eq('strategy_id', strategyId);
    }

    // Order by created_at descending
    query = query.order('created_at', { ascending: false });

    // Apply pagination
    if (limit) {
      query = query.limit(parseInt(limit, 10));
    }
    if (offset) {
      query = query.range(
        parseInt(offset, 10),
        parseInt(offset, 10) + (limit ? parseInt(limit, 10) : 100) - 1
      );
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Error fetching OCO orders:', error);
      throw error;
    }

    // Format response
    const formattedOrders = (orders || []).map((order: any) => ({
      id: order.id,
      strategyId: order.strategy_id,
      symbol: order.symbol,
      side: order.side,
      
      takeProfit: {
        triggerPrice: parseFloat(order.take_profit_trigger_price),
        quantity: parseFloat(order.take_profit_quantity),
        orderType: order.take_profit_order_type,
        limitPrice: order.take_profit_limit_price ? parseFloat(order.take_profit_limit_price) : null,
      },
      
      stopLoss: {
        triggerPrice: parseFloat(order.stop_loss_trigger_price),
        quantity: parseFloat(order.stop_loss_quantity),
        orderType: order.stop_loss_order_type,
        limitPrice: order.stop_loss_limit_price ? parseFloat(order.stop_loss_limit_price) : null,
      },
      
      status: order.status,
      triggeredBy: order.triggered_by,
      triggeredAt: order.triggered_at,
      triggeredOrderId: order.triggered_order_id,
      cancelledOrderId: order.cancelled_order_id,
      
      takeProfitConditionalOrderId: order.take_profit_conditional_order_id,
      stopLossConditionalOrderId: order.stop_loss_conditional_order_id,
      
      expiresAt: order.expires_at,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    }));

    return new Response(
      JSON.stringify({ success: true, data: formattedOrders }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in oco-orders:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
