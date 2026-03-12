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
    const { name, description, symbol, status, config } = body;

    // Validate required fields
    if (!name || !symbol) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: name, symbol' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Insert strategy
    const { data: strategy, error } = await supabase
      .from('strategies')
      .insert({
        name,
        description: description || null,
        symbol,
        status: status || 'active',
        config: config || {},
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Transform data to match expected format
    const formattedStrategy = {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      symbol: strategy.symbol,
      status: strategy.status,
      config: strategy.config,
      createdAt: strategy.created_at,
      updatedAt: strategy.updated_at,
    };

    return new Response(
      JSON.stringify({ success: true, data: formattedStrategy }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      }
    );
  } catch (error) {
    console.error('Error in create-strategy:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
