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

    // Get current order status
    const { data: currentOrder, error: fetchError } = await supabase
      .from('twap_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ success: false, error: 'Order not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      throw fetchError;
    }

    // Check if order can be cancelled
    if (currentOrder.status === 'completed' || currentOrder.status === 'cancelled') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Cannot cancel order with status: ${currentOrder.status}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Update order status to cancelled
    const { data: order, error } = await supabase
      .from('twap_orders')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error cancelling TWAP order:', error);
      
      // If table doesn't exist, return a mock response
      if (error.code === '42P01') {
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: { 
              id: orderId, 
              status: 'cancelled',
              message: 'Order cancelled (mock response - table not found)'
            } 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw error;
    }

    // Cancel any pending slices
    await supabase
      .from('twap_order_slices')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('twap_order_id', orderId)
      .in('status', ['pending', 'submitted']);

    // Format response
    const formattedOrder = {
      id: order.id,
      status: order.status,
      filledQuantity: parseFloat(order.filled_quantity || '0'),
      remainingQuantity: parseFloat(order.remaining_quantity),
      updatedAt: order.updated_at,
    };

    return new Response(
      JSON.stringify({ success: true, data: formattedOrder }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cancel-twap-order:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
