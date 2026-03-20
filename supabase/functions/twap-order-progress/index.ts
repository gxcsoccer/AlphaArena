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

    // Get TWAP order details
    const { data: order, error: orderError } = await supabase
      .from('twap_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ success: false, error: 'Order not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      
      // If table doesn't exist, return mock progress
      if (orderError.code === '42P01') {
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: {
              orderId,
              progress: 0,
              slicesTotal: 0,
              slicesFilled: 0,
              slicesPending: 0,
              averageFillPrice: null,
              estimatedCompletion: null,
              message: 'Mock response - table not found'
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw orderError;
    }

    // Get slice details
    const { data: slices, error: _slicesError } = await supabase
      .from('twap_order_slices')
      .select('*')
      .eq('twap_order_id', orderId)
      .order('slice_number', { ascending: true });

    // Calculate progress metrics
    const totalSlices = order.total_slices;
    const slicesFilled = order.slices_filled;
    const slicesPending = slices ? slices.filter(s => s.status === 'pending').length : 0;
    const slicesSubmitted = slices ? slices.filter(s => s.status === 'submitted').length : 0;
    
    const totalQuantity = parseFloat(order.total_quantity);
    const filledQuantity = parseFloat(order.filled_quantity || '0');
    const remainingQuantity = parseFloat(order.remaining_quantity);
    
    const progressPercent = totalQuantity > 0 ? (filledQuantity / totalQuantity) * 100 : 0;
    
    // Calculate estimated completion time
    const now = new Date();
    const endTime = new Date(order.end_time);
    let estimatedCompletion = null;
    
    if (order.status === 'active' && filledQuantity < totalQuantity) {
      const slicesRemaining = totalSlices - slicesFilled;
      if (slicesRemaining > 0 && slicesFilled > 0) {
        const startTime = new Date(order.start_time);
        const elapsedPerSlice = (now.getTime() - startTime.getTime()) / slicesFilled;
        estimatedCompletion = new Date(now.getTime() + (elapsedPerSlice * slicesRemaining));
      } else {
        estimatedCompletion = endTime;
      }
    }

    // Get recent slice activity (last 5 slices)
    const recentSlices = slices ? slices.slice(-5).map(slice => ({
      sliceNumber: slice.slice_number,
      scheduledTime: slice.scheduled_time,
      status: slice.status,
      filledQuantity: parseFloat(slice.filled_quantity || '0'),
      fillPrice: slice.fill_price ? parseFloat(slice.fill_price) : null,
      executedAt: slice.executed_at,
    })) : [];

    // Calculate performance metrics
    const averageFillPrice = order.average_fill_price ? parseFloat(order.average_fill_price) : null;
    const totalFilledValue = parseFloat(order.total_filled_value || '0');
    
    const progress = {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      status: order.status,
      
      // Quantity progress
      totalQuantity,
      filledQuantity,
      remainingQuantity,
      progressPercent: Math.round(progressPercent * 100) / 100,
      
      // Slice progress
      slicesTotal: totalSlices,
      slicesFilled,
      slicesPending,
      slicesSubmitted,
      
      // Price metrics
      averageFillPrice,
      totalFilledValue,
      
      // Time estimates
      startTime: order.start_time,
      endTime: order.end_time,
      estimatedCompletion: estimatedCompletion ? estimatedCompletion.toISOString() : null,
      
      // Recent activity
      recentSlices,
      
      // Price limit
      priceLimit: order.price_limit ? parseFloat(order.price_limit) : null,
      priceLimitType: order.price_limit_type,
    };

    return new Response(
      JSON.stringify({ success: true, data: progress }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in twap-order-progress:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
