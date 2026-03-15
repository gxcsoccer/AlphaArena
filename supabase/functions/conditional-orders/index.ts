import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');
    const status = searchParams.get('status');
    const orderType = searchParams.get('orderType');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build query with optional filters
    let query = supabase.from('conditional_orders').select('*');

    if (symbol) {
      query = query.eq('symbol', symbol);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (orderType) {
      query = query.eq('order_type', orderType);
    }

    const { data: orders, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // If table doesn't exist yet, return empty array
      if (error.message.includes('Could not find the table') || error.code === '42P01') {
        console.warn('conditional_orders table not found, returning empty array');
        return new Response(JSON.stringify({
          success: true,
          data: []
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
      throw error;
    }

    // Transform data to match expected format
    const formattedOrders = orders.map((o) => ({
      id: o.id,
      strategyId: o.strategy_id,
      symbol: o.symbol,
      side: o.side,
      orderType: o.order_type,
      triggerPrice: o.trigger_price ? parseFloat(o.trigger_price.toString()) : null,
      quantity: o.quantity ? parseFloat(o.quantity.toString()) : null,
      status: o.status,
      triggeredAt: o.triggered_at,
      triggeredOrderId: o.triggered_order_id,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      expiresAt: o.expires_at,
    }));

    return new Response(JSON.stringify({
      success: true,
      data: formattedOrders
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in conditional-orders:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
