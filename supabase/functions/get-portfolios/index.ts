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
    // Get portfolios with optional filters
    const { searchParams } = new URL(req.url);
    const strategyId = searchParams.get('strategyId');
    const symbol = searchParams.get('symbol');
    let query = supabase.from('portfolios').select('*');
    if (strategyId) {
      query = query.eq('strategy_id', strategyId);
    }
    if (symbol) {
      query = query.eq('symbol', symbol);
    }
    const { data: portfolios, error } = await query.order('snapshot_at', {
      ascending: false
    }).limit(1);
    if (error) {
      throw error;
    }
    if (!portfolios || portfolios.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        data: null
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // Get positions for this portfolio (from trades)
    const portfolio = portfolios[0];
    // Calculate positions from trades
    const { data: trades } = await supabase.from('trades').select('symbol, side, quantity, price').eq('strategy_id', portfolio.strategy_id);
    // Aggregate positions
    const positionsMap = new Map();
    if (trades) {
      for (const trade of trades){
        const symbol = trade.symbol;
        const quantity = parseFloat(trade.quantity.toString());
        const price = parseFloat(trade.price.toString());
        const total = quantity * price;
        if (!positionsMap.has(symbol)) {
          positionsMap.set(symbol, {
            quantity: 0,
            averageCost: 0,
            symbol
          });
        }
        const position = positionsMap.get(symbol);
        if (trade.side === 'buy') {
          const totalCost = position.quantity * position.averageCost + total;
          position.quantity += quantity;
          position.averageCost = position.quantity > 0 ? totalCost / position.quantity : 0;
        } else {
          position.quantity -= quantity;
        }
      }
    }
    const positions = Array.from(positionsMap.values()).filter((p)=>p.quantity > 0).map((p)=>({
        symbol: p.symbol,
        quantity: p.quantity,
        averageCost: p.averageCost
      }));
    // Format portfolio
    const formattedPortfolio = {
      id: portfolio.id,
      strategyId: portfolio.strategy_id,
      symbol: portfolio.symbol,
      baseCurrency: portfolio.base_currency,
      quoteCurrency: portfolio.quote_currency,
      cashBalance: parseFloat(portfolio.quote_balance.toString()),
      positions,
      totalValue: portfolio.total_value ? parseFloat(portfolio.total_value.toString()) : 0,
      snapshotAt: portfolio.snapshot_at
    };
    return new Response(JSON.stringify({
      success: true,
      data: formattedPortfolio
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in get-portfolios:', error);
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
