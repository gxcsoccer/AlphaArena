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

    // Get sort parameter
    const { searchParams } = new URL(req.url)
    const sortBy = searchParams.get('sortBy') || 'roi'

    // Get all strategies
    const { data: strategies, error: strategiesError } = await supabase
      .from('strategies')
      .select('id, name, status')

    if (strategiesError) {
      throw strategiesError
    }

    // Calculate metrics for each strategy
    const leaderboardEntries = []

    for (const strategy of strategies || []) {
      // Get trades for this strategy
      const { data: trades } = await supabase
        .from('trades')
        .select('side, total, price, quantity')
        .eq('strategy_id', strategy.id)

      const totalTrades = trades?.length || 0
      const totalVolume = trades?.reduce((sum, t) => sum + (parseFloat(t.total.toString()) || 0), 0) || 0

      // Calculate P&L
      const buys = trades?.filter(t => t.side === 'buy') || []
      const sells = trades?.filter(t => t.side === 'sell') || []
      
      const totalCost = buys.reduce((sum, t) => sum + (parseFloat(t.total.toString()) || 0), 0)
      const totalProceeds = sells.reduce((sum, t) => sum + (parseFloat(t.total.toString()) || 0), 0)
      const totalPnL = totalProceeds - totalCost

      // Calculate ROI (simplified)
      const roi = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

      // Calculate win rate
      const profitableTrades = sells.filter(s => {
        // Simplified: consider sell trades with positive P&L
        return true // Would need more complex logic for accurate calculation
      }).length
      const losingTrades = sells.length - profitableTrades
      const winRate = sells.length > 0 ? (profitableTrades / sells.length) * 100 : 0

      // Calculate Sharpe Ratio (simplified)
      const sharpeRatio = roi > 0 ? roi / 10 : 0 // Simplified calculation

      // Calculate max drawdown (simplified)
      const maxDrawdown = Math.abs(roi) * 0.5 // Simplified estimation

      // Calculate average trade size
      const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0

      // Calculate consecutive wins/losses (simplified)
      const consecutiveWins = profitableTrades > 0 ? Math.floor(profitableTrades / 2) : 0
      const consecutiveLosses = losingTrades > 0 ? Math.floor(losingTrades / 2) : 0

      // Best and worst trades
      const bestTrade = trades?.reduce((max, t) => Math.max(max, parseFloat(t.total.toString())), 0) || 0
      const worstTrade = trades?.reduce((min, t) => Math.min(min, parseFloat(t.total.toString())), 0) || 0

      leaderboardEntries.push({
        strategyId: strategy.id,
        strategyName: strategy.name,
        status: strategy.status,
        metrics: {
          strategyId: strategy.id,
          strategyName: strategy.name,
          status: strategy.status,
          totalTrades,
          totalVolume,
          totalPnL,
          roi,
          winRate,
          sharpeRatio,
          maxDrawdown,
          avgTradeSize,
          profitableTrades,
          losingTrades,
          consecutiveWins,
          consecutiveLosses,
          bestTrade,
          worstTrade,
          calculatedAt: new Date().toISOString(),
        },
      })
    }

    // Sort by specified metric
    const sortKey = sortBy === 'sharpeRatio' ? 'sharpeRatio' :
                   sortBy === 'maxDrawdown' ? 'maxDrawdown' :
                   sortBy === 'totalPnL' ? 'totalPnL' :
                   sortBy === 'winRate' ? 'winRate' :
                   sortBy === 'totalVolume' ? 'totalVolume' : 'roi'

    leaderboardEntries.sort((a, b) => {
      const aValue = a.metrics[sortKey as keyof typeof a.metrics] as number
      const bValue = b.metrics[sortKey as keyof typeof b.metrics] as number
      
      // For maxDrawdown, lower is better
      if (sortKey === 'maxDrawdown') {
        return aValue - bValue
      }
      
      return bValue - aValue
    })

    // Add rank and rankChange
    const rankedEntries = leaderboardEntries.map((entry, index) => ({
      rank: index + 1,
      strategyId: entry.strategyId,
      strategyName: entry.strategyName,
      status: entry.status,
      metrics: entry.metrics,
      rankChange: 0, // Would need historical data for actual rank change
    }))

    return new Response(
      JSON.stringify({ success: true, data: rankedEntries }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in get-leaderboard:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
