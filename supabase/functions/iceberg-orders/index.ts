import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';
import { serve } from 'https://deno.land/std@0.168.0/http/service';

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
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('iceberg_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (symbol) {
      query = query.eq('symbol', symbol);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (strategyId) {
      query = query.eq('strategy_id', strategyId);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Error fetching iceberg orders:', error);
      
      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        return new Response(
          JSON.stringify({ success: true, data: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw error;
    }

    // Format response
    const formattedOrders = (orders || []).map(order => ({
      id: order.id,
      strategyId: order.strategy_id,
      symbol: order.symbol,
      side: order.side,
      price: parseFloat(order.price),
      totalQuantity: parseFloat(order.total_quantity),
      displayQuantity: parseFloat(order.display_quantity),
      hiddenQuantity: parseFloat(order.hidden_quantity),
      filledQuantity: parseFloat(order.filled_quantity || '0'),
      variance: order.variance ? parseFloat(order.variance) : null,
      status: order.status,
      expiresAt: order.expires_at,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    }));

    return new Response(
      JSON.stringify({ success: true, data: formattedOrders }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in iceberg-orders:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
