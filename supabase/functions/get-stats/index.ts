import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Get stats
    const [strategiesCount, tradesCount, tradesVolume] = await Promise.all([
      supabase.from('strategies').select('*', { count: 'exact', head: true }),
      supabase.from('trades').select('*', { count: 'exact', head: true }),
      supabase.from('trades').select('total'),
    ])

    const activeStrategies = await supabase
      .from('strategies')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    const totalVolume = tradesVolume.data?.reduce((sum, t) => sum + (t.total || 0), 0) || 0
    
    const buyTrades = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('side', 'buy')

    const sellTrades = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('side', 'sell')

    const stats = {
      totalStrategies: strategiesCount.count || 0,
      activeStrategies: activeStrategies.count || 0,
      totalTrades: tradesCount.count || 0,
      totalVolume: totalVolume,
      buyTrades: buyTrades.count || 0,
      sellTrades: sellTrades.count || 0,
    }

    return new Response(
      JSON.stringify({ success: true, data: stats }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in get-stats:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
