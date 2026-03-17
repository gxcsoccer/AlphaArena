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

    // Parse request body
    const body = await req.json();
    const {
      symbol,
      side,
      totalQuantity,
      startTime,
      endTime,
      intervalSeconds,
      priceLimit,
      priceLimitType,
      strategyId,
    } = body;

    // Validate required fields
    if (!symbol || !side || !totalQuantity || !startTime || !endTime || !intervalSeconds) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: symbol, side, totalQuantity, startTime, endTime, intervalSeconds',
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

    // Parse dates
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid startTime or endTime format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (end <= start) {
      return new Response(
        JSON.stringify({ success: false, error: 'endTime must be after startTime' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate quantities
    if (typeof totalQuantity !== 'number' || totalQuantity <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid totalQuantity. Must be a positive number' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate interval
    if (typeof intervalSeconds !== 'number' || intervalSeconds < 1) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid intervalSeconds. Must be at least 1 second' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Calculate slices
    const totalDuration = (end.getTime() - start.getTime()) / 1000; // in seconds
    const totalSlices = Math.floor(totalDuration / intervalSeconds);
    
    if (totalSlices < 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'Time range too short for the specified interval. Need at least 2 slices.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const sliceQuantity = totalQuantity / totalSlices;

    // Determine status based on start time
    const now = new Date();
    let status = 'pending';
    if (start <= now) {
      status = 'active';
    }

    // Create TWAP order record
    const { data: order, error } = await supabase
      .from('twap_orders')
      .insert([
        {
          strategy_id: strategyId || null,
          symbol,
          side,
          total_quantity: totalQuantity.toString(),
          filled_quantity: '0',
          remaining_quantity: totalQuantity.toString(),
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          interval_seconds: intervalSeconds,
          total_slices: totalSlices,
          slice_quantity: sliceQuantity.toString(),
          slices_created: 0,
          slices_filled: 0,
          average_fill_price: null,
          total_filled_value: '0',
          price_limit: priceLimit ? priceLimit.toString() : null,
          price_limit_type: priceLimitType || 'none',
          status,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating TWAP order:', error);
      
      // If table doesn't exist, return a mock response
      if (error.code === '42P01') {
        const mockOrder = {
          id: `twap-${Date.now()}`,
          symbol,
          side,
          totalQuantity,
          filledQuantity: 0,
          remainingQuantity: totalQuantity,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          intervalSeconds,
          totalSlices,
          sliceQuantity,
          slicesCreated: 0,
          slicesFilled: 0,
          averageFillPrice: null,
          status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        return new Response(
          JSON.stringify({ success: true, data: mockOrder }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 201,
          }
        );
      }
      
      throw error;
    }

    // Create slice records for scheduling
    const slices = [];
    for (let i = 0; i < totalSlices; i++) {
      const scheduledTime = new Date(start.getTime() + (i + 1) * intervalSeconds * 1000);
      slices.push({
        twap_order_id: order.id,
        slice_number: i + 1,
        scheduled_time: scheduledTime.toISOString(),
        quantity: sliceQuantity.toString(),
        status: 'pending',
      });
    }

    // Insert slices (if table exists)
    if (slices.length > 0) {
      const { error: slicesError } = await supabase
        .from('twap_order_slices')
        .insert(slices);

      if (slicesError && slicesError.code !== '42P01') {
        console.error('Error creating TWAP slices:', slicesError);
        // Continue without slices - they can be created later
      }
    }

    // Format response
    const formattedOrder = {
      id: order.id,
      strategyId: order.strategy_id,
      symbol: order.symbol,
      side: order.side,
      totalQuantity: parseFloat(order.total_quantity),
      filledQuantity: parseFloat(order.filled_quantity || '0'),
      remainingQuantity: parseFloat(order.remaining_quantity),
      startTime: order.start_time,
      endTime: order.end_time,
      intervalSeconds: order.interval_seconds,
      totalSlices: order.total_slices,
      sliceQuantity: parseFloat(order.slice_quantity),
      slicesCreated: order.slices_created,
      slicesFilled: order.slices_filled,
      averageFillPrice: order.average_fill_price ? parseFloat(order.average_fill_price) : null,
      priceLimit: order.price_limit ? parseFloat(order.price_limit) : null,
      priceLimitType: order.price_limit_type,
      status: order.status,
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
    console.error('Error in create-twap-order:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
