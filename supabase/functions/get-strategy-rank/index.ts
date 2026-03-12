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

    // Get strategy info
    const { data: strategy, error: strategyError } = await supabase
      .from('strategies')
      .select('id, name, status')
      .eq('id', strategyId)
      .single();

    if (strategyError) {
      throw strategyError;
    }

    if (!strategy) {
      return new Response(
        JSON.stringify({ success: false, error: 'Strategy not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Get trades for this strategy
    const { data: trades } = await supabase
      .from('trades')
      .select('side, total, price, quantity')
      .eq('strategy_id', strategyId);

    const totalTrades = trades?.length || 0;
    const totalVolume = trades?.reduce((sum, t) => sum + (parseFloat(t.total.toString()) || 0), 0) || 0;

    // Calculate P&L
    const buys = trades?.filter((t) => t.side === 'buy') || [];
    const sells = trades?.filter((t) => t.side === 'sell') || [];
    const totalCost = buys.reduce((sum, t) => sum + (parseFloat(t.total.toString()) || 0), 0);
    const totalProceeds = sells.reduce((sum, t) => sum + (parseFloat(t.total.toString()) || 0), 0);
    const totalPnL = totalProceeds - totalCost;

    // Calculate ROI
    const roi = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    // Calculate win rate
    const profitableTrades = sells.length;
    const losingTrades = 0;
    const winRate = sells.length > 0 ? (profitableTrades / sells.length) * 100 : 0;

    // Calculate Sharpe Ratio (simplified)
    const sharpeRatio = roi > 0 ? roi / 10 : 0;

    // Calculate max drawdown (simplified)
    const maxDrawdown = Math.abs(roi) * 0.5;

    // Calculate average trade size
    const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;

    // Best and worst trades
    const bestTrade = trades?.reduce((max, t) => Math.max(max, parseFloat(t.total.toString())), 0) || 0;
    const worstTrade = trades?.reduce((min, t) => Math.min(min, parseFloat(t.total.toString())), 0) || 0;

    // Get all strategies to calculate rank
    const { data: allStrategies } = await supabase.from('strategies').select('id, name, status');

    // Calculate metrics for all strategies to determine rank
    const allMetrics = [];
    for (const s of allStrategies || []) {
      const { data: sTrades } = await supabase
        .from('trades')
        .select('side, total')
        .eq('strategy_id', s.id);

      const sTotalTrades = sTrades?.length || 0;
      const sBuys = sTrades?.filter((t) => t.side === 'buy') || [];
      const sSells = sTrades?.filter((t) => t.side === 'sell') || [];
      const sTotalCost = sBuys.reduce((sum, t) => sum + (parseFloat(t.total.toString()) || 0), 0);
      const sTotalProceeds = sSells.reduce((sum, t) => sum + (parseFloat(t.total.toString()) || 0), 0);
      const sRoi = sTotalCost > 0 ? ((sTotalProceeds - sTotalCost) / sTotalCost) * 100 : 0;

      allMetrics.push({ id: s.id, roi: sRoi });
    }

    // Sort by ROI to get rank
    allMetrics.sort((a, b) => b.roi - a.roi);
    const rank = allMetrics.findIndex((m) => m.id === strategyId) + 1;

    const entry = {
      rank,
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
        consecutiveWins: 0,
        consecutiveLosses: 0,
        bestTrade,
        worstTrade,
        calculatedAt: new Date().toISOString(),
      },
      rankChange: 0,
    };

    return new Response(
      JSON.stringify({ success: true, data: entry }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in get-strategy-rank:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
