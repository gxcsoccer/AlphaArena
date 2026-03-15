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

    // Parse request body
    const body = await req.json();
    const { symbol, conditionType, targetPrice, notificationMethod, expiresAt, isRecurring, notes, userId } = body;

    // Validate required fields
    if (!symbol || !conditionType || !targetPrice) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: symbol, conditionType, targetPrice' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate condition type
    if (!['above', 'below'].includes(conditionType)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid conditionType. Must be "above" or "below"' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate target price
    if (typeof targetPrice !== 'number' || targetPrice <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid targetPrice. Must be a positive number' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate notification method (optional)
    if (notificationMethod && !['in_app', 'feishu', 'email', 'push'].includes(notificationMethod)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid notificationMethod. Must be "in_app", "feishu", "email", or "push"' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get current market price for reference
    const { data: priceData } = await supabase
      .from('price_history')
      .select('price')
      .eq('symbol', symbol)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    
    let currentPrice = null;
    if (priceData) {
      currentPrice = parseFloat(priceData.price.toString());
    }

    // Create price alert record
    const { data: alert, error } = await supabase
      .from('price_alerts')
      .insert([
        {
          user_id: userId || null,
          symbol,
          condition_type: conditionType,
          target_price: targetPrice.toString(),
          current_price: currentPrice?.toString() || null,
          notification_method: notificationMethod || 'in_app',
          is_recurring: isRecurring || false,
          notes: notes || null,
          expires_at: expiresAt || null,
          status: 'active',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating price alert:', error);
      throw error;
    }

    // Format response
    const formattedAlert = {
      id: alert.id,
      userId: alert.user_id,
      symbol: alert.symbol,
      conditionType: alert.condition_type,
      targetPrice: parseFloat(alert.target_price),
      currentPrice: alert.current_price ? parseFloat(alert.current_price) : null,
      status: alert.status,
      notificationMethod: alert.notification_method,
      triggeredAt: alert.triggered_at,
      triggeredPrice: alert.triggered_price ? parseFloat(alert.triggered_price) : null,
      isRecurring: alert.is_recurring,
      notes: alert.notes,
      expiresAt: alert.expires_at,
      createdAt: alert.created_at,
      updatedAt: alert.updated_at,
    };

    return new Response(
      JSON.stringify({ success: true, data: formattedAlert }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      }
    );
  } catch (error) {
    console.error('Error in create-price-alert:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
