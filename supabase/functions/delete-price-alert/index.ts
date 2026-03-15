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

    // Extract alert ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const alertId = pathParts[pathParts.length - 2]; // Get the ID from /price-alerts/{id}/delete

    if (!alertId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Alert ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if alert exists
    const { data: existingAlert, error: fetchError } = await supabase
      .from('price_alerts')
      .select('id, status')
      .eq('id', alertId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ success: false, error: 'Price alert not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      throw fetchError;
    }

    // Delete the alert
    const { error: deleteError } = await supabase
      .from('price_alerts')
      .delete()
      .eq('id', alertId);

    if (deleteError) {
      console.error('Error deleting price alert:', deleteError);
      throw deleteError;
    }

    return new Response(
      JSON.stringify({ success: true, data: { id: alertId, deleted: true } }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in delete-price-alert:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
