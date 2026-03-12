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

    // Only allow PATCH
    if (req.method !== 'PATCH') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
      );
    }

    // Extract strategy ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const strategyId = pathParts[pathParts.length - 1];

    if (!strategyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing strategy ID' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Parse request body
    const body = await req.json();
    const updates: any = {};

    // Allow specific fields to be updated
    const allowedFields = ['name', 'description', 'symbol', 'status', 'config'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No valid fields to update' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Update strategy
    const { data: strategy, error } = await supabase
      .from('strategies')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', strategyId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!strategy) {
      return new Response(
        JSON.stringify({ success: false, error: 'Strategy not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
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
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in update-strategy:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
