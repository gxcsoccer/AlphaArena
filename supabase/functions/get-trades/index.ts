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

    // Get trades with optional filters
    const { searchParams } = new URL(req.url)
    const strategyId = searchParams.get('strategyId')
    const symbol = searchParams.get('symbol')
    const side = searchParams.get('side')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase.from('trades').select('*')

    if (strategyId) {
      query = query.eq('strategy_id', strategyId)
    }
    if (symbol) {
      query = query.eq('symbol', symbol)
    }
    if (side) {
      query = query.eq('side', side)
    }

    const { data: trades, error } = await query
      .order('executed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    // Transform data to match expected format
    const formattedTrades = trades.map(t => ({
      id: t.id,
      strategyId: t.strategy_id,
      symbol: t.symbol,
      side: t.side,
      price: parseFloat(t.price.toString()),
      quantity: parseFloat(t.quantity.toString()),
      total: parseFloat(t.total.toString()),
      fee: t.fee ? parseFloat(t.fee.toString()) : undefined,
      buyOrderId: t.order_id,
      sellOrderId: t.order_id,
      executedAt: t.executed_at,
    }))

    return new Response(
      JSON.stringify({ success: true, data: formattedTrades }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in get-trades:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
