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

    // Get latest snapshot
    const { data: snapshot, error } = await supabase
      .from('leaderboard_snapshots')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!snapshot) {
      // No snapshot exists, return empty
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            timestamp: new Date().toISOString(),
            entries: [],
            totalStrategies: 0,
            totalTrades: 0,
            totalVolume: 0,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Format snapshot
    const formattedSnapshot = {
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      entries: snapshot.entries || [],
      totalStrategies: snapshot.total_strategies || 0,
      totalTrades: snapshot.total_trades || 0,
      totalVolume: parseFloat(snapshot.total_volume?.toString() || '0'),
    };

    return new Response(
      JSON.stringify({ success: true, data: formattedSnapshot }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in get-leaderboard-snapshot:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
