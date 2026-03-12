import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
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
    // Get strategies with optional filters
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const symbol = searchParams.get('symbol');
    let query = supabase.from('strategies').select('*');
    if (status) {
      query = query.eq('status', status);
    }
    if (symbol) {
      query = query.eq('symbol', symbol);
    }
    const { data: strategies, error } = await query.order('created_at', {
      ascending: false
    });
    if (error) {
      throw error;
    }
    // Transform data to match expected format
    const formattedStrategies = strategies.map((s)=>({
        id: s.id,
        name: s.name,
        description: s.description,
        symbol: s.symbol,
        status: s.status,
        config: s.config,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }));
    return new Response(JSON.stringify({
      success: true,
      data: formattedStrategies
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in get-strategies:', error);
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
