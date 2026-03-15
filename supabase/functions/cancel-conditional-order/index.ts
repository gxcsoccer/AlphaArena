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

    // Extract order ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const orderId = pathParts[pathParts.length - 2]; // Get the ID from /conditional-orders/{id}/cancel

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get the current order to check status
    const { data: existingOrder, error: fetchError } = await supabase
      .from('conditional_orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ success: false, error: 'Conditional order not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      throw fetchError;
    }

    // Check if order can be cancelled
    if (existingOrder.status !== 'active') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Cannot cancel order with status: ${existingOrder.status}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Update order status to cancelled
    const { data: updatedOrder, error: updateError } = await supabase
      .from('conditional_orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      console.error('Error cancelling conditional order:', updateError);
      throw updateError;
    }

    // Format response
    const formattedOrder = {
      id: updatedOrder.id,
      strategyId: updatedOrder.strategy_id,
      symbol: updatedOrder.symbol,
      side: updatedOrder.side,
      orderType: updatedOrder.order_type,
      triggerPrice: parseFloat(updatedOrder.trigger_price),
      quantity: parseFloat(updatedOrder.quantity),
      status: updatedOrder.status,
      triggeredAt: updatedOrder.triggered_at,
      triggeredOrderId: updatedOrder.triggered_order_id,
      expiresAt: updatedOrder.expires_at,
      createdAt: updatedOrder.created_at,
      updatedAt: updatedOrder.updated_at,
    };

    return new Response(
      JSON.stringify({ success: true, data: formattedOrder }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in cancel-conditional-order:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
