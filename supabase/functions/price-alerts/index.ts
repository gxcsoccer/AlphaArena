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
    const userId = searchParams.get('userId');
    const symbol = searchParams.get('symbol');
    const status = searchParams.get('status');
    const conditionType = searchParams.get('conditionType');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build query with optional filters
    let query = supabase.from('price_alerts').select('*');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (symbol) {
      query = query.eq('symbol', symbol);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (conditionType) {
      query = query.eq('condition_type', conditionType);
    }

    const { data: alerts, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // If table doesn't exist yet, return empty array
      if (error.message.includes('Could not find the table') || error.code === '42P01') {
        console.warn('price_alerts table not found, returning empty array');
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
    const formattedAlerts = alerts.map((a) => ({
      id: a.id,
      userId: a.user_id,
      symbol: a.symbol,
      conditionType: a.condition_type,
      targetPrice: a.target_price ? parseFloat(a.target_price.toString()) : null,
      currentPrice: a.current_price ? parseFloat(a.current_price.toString()) : null,
      status: a.status,
      notificationMethod: a.notification_method,
      triggeredAt: a.triggered_at,
      triggeredPrice: a.triggered_price ? parseFloat(a.triggered_price.toString()) : null,
      isRecurring: a.is_recurring || false,
      notes: a.notes,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      expiresAt: a.expires_at,
    }));

    return new Response(JSON.stringify({
      success: true,
      data: formattedAlerts
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in price-alerts:', error);
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
