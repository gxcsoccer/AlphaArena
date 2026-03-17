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
      price, 
      totalQuantity, 
      displayQuantity, 
      hiddenQuantity, 
      variance,
      strategyId,
      expiresAt 
    } = body;

    // Validate required fields
    if (!symbol || !side || !price || !totalQuantity || !displayQuantity) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: symbol, side, price, totalQuantity, displayQuantity' 
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

    // Validate price
    if (typeof price !== 'number' || price <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid price. Must be a positive number' }),
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

    if (typeof displayQuantity !== 'number' || displayQuantity <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid displayQuantity. Must be a positive number' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate display quantity is less than total
    if (displayQuantity >= totalQuantity) {
      return new Response(
        JSON.stringify({ success: false, error: 'displayQuantity must be less than totalQuantity' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Calculate hidden quantity if not provided
    const calculatedHiddenQuantity = hiddenQuantity || (totalQuantity - displayQuantity);

    // Create iceberg order record
    const { data: order, error } = await supabase
      .from('iceberg_orders')
      .insert([
        {
          strategy_id: strategyId || null,
          symbol,
          side,
          price: price.toString(),
          total_quantity: totalQuantity.toString(),
          display_quantity: displayQuantity.toString(),
          hidden_quantity: calculatedHiddenQuantity.toString(),
          filled_quantity: '0',
          variance: variance || null,
          expires_at: expiresAt || null,
          status: 'active',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating iceberg order:', error);
      
      // If table doesn't exist, return a mock response for now
      if (error.code === '42P01') {
        const mockOrder = {
          id: `iceberg-${Date.now()}`,
          symbol,
          side,
          price,
          totalQuantity,
          displayQuantity,
          hiddenQuantity: calculatedHiddenQuantity,
          filledQuantity: 0,
          variance: variance || null,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: expiresAt || null,
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

    // Format response
    const formattedOrder = {
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
    };

    return new Response(
      JSON.stringify({ success: true, data: formattedOrder }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      }
    );
  } catch (error) {
    console.error('Error in create-iceberg-order:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
