import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
};

// Helper to get user ID from request
function getUserId(req: Request): string {
  const headerUserId = req.headers.get('x-user-id');
  if (headerUserId) return headerUserId;
  return 'anonymous';
}

// Helper to parse path segments
function parsePath(pathname: string): { resource: string; id?: string; subResource?: string } {
  // Handle various path formats:
  // - /functions/v1/marketplace/strategies
  // - /marketplace/strategies
  // - /strategies
  let path = pathname;
  
  // Remove /functions/v1/marketplace prefix if present
  if (path.includes('/marketplace')) {
    path = path.replace(/^\/functions\/v1\/marketplace/, '');
    path = path.replace(/^\/marketplace/, '');
  }
  
  const segments = path.split('/').filter(Boolean);
  
  return {
    resource: segments[0] || '',
    id: segments[1],
    subResource: segments[2],
  };
}

// Get Supabase client
function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ==================== Strategy Handlers ====================

async function listStrategies(req: Request, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const url = new URL(req.url);
  const params = url.searchParams;
  
  let query = supabase
    .from('marketplace_strategies')
    .select('*')
    .eq('status', 'approved')
    .eq('visibility', 'public');
  
  const category = params.get('category');
  if (category) {
    query = query.eq('category', category);
  }
  
  const strategyType = params.get('strategyType');
  if (strategyType) {
    query = query.eq('strategy_type', strategyType);
  }
  
  const search = params.get('search');
  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }
  
  const minRating = params.get('minRating');
  if (minRating) {
    query = query.gte('rating_avg', parseFloat(minRating));
  }
  
  const isFeatured = params.get('isFeatured');
  if (isFeatured) {
    query = query.eq('is_featured', isFeatured === 'true');
  }
  
  const tags = params.get('tags');
  if (tags) {
    query = query.contains('tags', tags.split(','));
  }
  
  const orderBy = params.get('orderBy') || 'created_at';
  const orderDirection = params.get('orderDirection') || 'desc';
  query = query.order(orderBy, { ascending: orderDirection === 'asc' });
  
  const limit = parseInt(params.get('limit') || '20');
  query = query.limit(limit);
  
  const offset = params.get('offset');
  if (offset) {
    query = query.range(parseInt(offset), parseInt(offset) + limit - 1);
  }
  
  const { data, error } = await query;
  
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Map to camelCase
  const strategies = (data || []).map(mapStrategyRow);
  
  return new Response(JSON.stringify({ success: true, data: strategies, timestamp: Date.now() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getStrategy(id: string, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const { data, error } = await supabase
    .from('marketplace_strategies')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    return new Response(JSON.stringify({ success: false, error: 'Strategy not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Increment view count
  await supabase.rpc('increment_strategy_views', { strategy_uuid: id }).catch(() => {});
  
  return new Response(JSON.stringify({ success: true, data: mapStrategyRow(data), timestamp: Date.now() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function createStrategy(req: Request, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const userId = getUserId(req);
  const body = await req.json();
  
  const { data, error } = await supabase
    .from('marketplace_strategies')
    .insert({
      publisher_id: body.publisherId || userId,
      name: body.name,
      description: body.description || null,
      strategy_type: body.strategyType,
      category: body.category || 'general',
      symbols: body.symbols || [],
      config: body.config || {},
      risk_params: body.riskParams || {},
      tags: body.tags || [],
      visibility: body.visibility || 'public',
      subscription_fee: body.subscriptionFee || 0,
      fee_currency: body.feeCurrency || 'USDT',
      revenue_share_percent: body.revenueSharePercent || 70,
      performance_metrics: body.performanceMetrics || {},
      status: 'draft',
    })
    .select()
    .single();
  
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify({ success: true, data: mapStrategyRow(data), timestamp: Date.now() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getCategories(supabase: ReturnType<typeof createClient>): Promise<Response> {
  const { data, error } = await supabase
    .from('marketplace_strategies')
    .select('category')
    .eq('status', 'approved')
    .eq('visibility', 'public');
  
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const categories = [...new Set((data || []).map(row => row.category))];
  
  return new Response(JSON.stringify({ success: true, data: categories.sort(), timestamp: Date.now() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getTags(supabase: ReturnType<typeof createClient>): Promise<Response> {
  const { data, error } = await supabase
    .from('marketplace_strategies')
    .select('tags')
    .eq('status', 'approved')
    .eq('visibility', 'public');
  
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const tags = new Set<string>();
  (data || []).forEach(row => {
    (row.tags as string[]).forEach(tag => tags.add(tag));
  });
  
  return new Response(JSON.stringify({ success: true, data: [...tags].sort(), timestamp: Date.now() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ==================== Subscription Handlers ====================

async function listSubscriptions(req: Request, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const userId = getUserId(req);
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  
  let query = supabase
    .from('strategy_marketplace_subscriptions')
    .select('*')
    .eq('subscriber_id', userId);
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data, error } = await query;
  
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const subscriptions = (data || []).map(mapSubscriptionRow);
  
  return new Response(JSON.stringify({ success: true, data: subscriptions, timestamp: Date.now() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function createSubscription(req: Request, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const userId = getUserId(req);
  const body = await req.json();
  
  // Check if already subscribed
  const { data: existing } = await supabase
    .from('strategy_marketplace_subscriptions')
    .select('*')
    .eq('subscriber_id', body.subscriberId || userId)
    .eq('strategy_id', body.strategyId)
    .single();
  
  if (existing && existing.status === 'active') {
    return new Response(JSON.stringify({ success: false, error: 'Already subscribed to this strategy' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const { data, error } = await supabase
    .from('strategy_marketplace_subscriptions')
    .insert({
      subscriber_id: body.subscriberId || userId,
      strategy_id: body.strategyId,
      auto_execute: body.autoExecute ?? false,
      copy_ratio: body.copyRatio ?? 1.0,
      fixed_amount: body.fixedAmount || null,
      max_risk_per_trade: body.maxRiskPerTrade || null,
      allowed_symbols: body.allowedSymbols || [],
      blocked_symbols: body.blockedSymbols || [],
      notify_signal: body.notifySignal ?? true,
      notify_execution: body.notifyExecution ?? true,
      expires_at: body.expiresAt || null,
    })
    .select()
    .single();
  
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Increment subscriber count
  await supabase.rpc('increment_strategy_subscribers', { strategy_uuid: body.strategyId }).catch(() => {});
  
  return new Response(JSON.stringify({ success: true, data: mapSubscriptionRow(data), timestamp: Date.now() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function pauseSubscription(id: string, req: Request, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const userId = getUserId(req);
  
  const { data: sub } = await supabase
    .from('strategy_marketplace_subscriptions')
    .select('*')
    .eq('id', id)
    .single();
  
  if (!sub || sub.subscriber_id !== userId) {
    return new Response(JSON.stringify({ success: false, error: 'Subscription not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const { data, error } = await supabase
    .from('strategy_marketplace_subscriptions')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify({ success: true, data: mapSubscriptionRow(data), timestamp: Date.now() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function resumeSubscription(id: string, req: Request, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const userId = getUserId(req);
  
  const { data: sub } = await supabase
    .from('strategy_marketplace_subscriptions')
    .select('*')
    .eq('id', id)
    .single();
  
  if (!sub || sub.subscriber_id !== userId) {
    return new Response(JSON.stringify({ success: false, error: 'Subscription not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const { data, error } = await supabase
    .from('strategy_marketplace_subscriptions')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify({ success: true, data: mapSubscriptionRow(data), timestamp: Date.now() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function cancelSubscription(id: string, req: Request, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const userId = getUserId(req);
  
  const { data: sub } = await supabase
    .from('strategy_marketplace_subscriptions')
    .select('*')
    .eq('id', id)
    .single();
  
  if (!sub || sub.subscriber_id !== userId) {
    return new Response(JSON.stringify({ success: false, error: 'Subscription not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const { error } = await supabase
    .from('strategy_marketplace_subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);
  
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Decrement subscriber count
  await supabase.rpc('decrement_strategy_subscribers', { strategy_uuid: sub.strategy_id }).catch(() => {});
  
  return new Response(JSON.stringify({ success: true, message: 'Subscription cancelled', timestamp: Date.now() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ==================== Review Handlers ====================

async function listReviews(strategyId: string, req: Request, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '10');
  
  const { data, error } = await supabase
    .from('strategy_reviews')
    .select('*')
    .eq('strategy_id', strategyId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const reviews = (data || []).map(mapReviewRow);
  
  return new Response(JSON.stringify({ success: true, data: reviews, timestamp: Date.now() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function createReview(strategyId: string, req: Request, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const userId = getUserId(req);
  const body = await req.json();
  
  // Check if already reviewed
  const { data: existing } = await supabase
    .from('strategy_reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('strategy_id', strategyId)
    .single();
  
  if (existing) {
    return new Response(JSON.stringify({ success: false, error: 'Already reviewed this strategy' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Check if verified subscriber
  const { data: sub } = await supabase
    .from('strategy_marketplace_subscriptions')
    .select('*')
    .eq('subscriber_id', userId)
    .eq('strategy_id', strategyId)
    .eq('status', 'active')
    .single();
  
  const { data, error } = await supabase
    .from('strategy_reviews')
    .insert({
      strategy_id: strategyId,
      user_id: userId,
      rating: body.rating,
      title: body.title || null,
      content: body.content || null,
      is_verified_subscriber: !!sub,
    })
    .select()
    .single();
  
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify({ success: true, data: mapReviewRow(data), timestamp: Date.now() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ==================== Signal Handlers ====================

async function listSignals(strategyId: string, req: Request, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  
  const { data, error } = await supabase
    .from('marketplace_strategy_signals')
    .select('*')
    .eq('strategy_id', strategyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const signals = (data || []).map(mapSignalRow);
  
  return new Response(JSON.stringify({ success: true, data: signals, timestamp: Date.now() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ==================== Mapping Functions ====================

function mapStrategyRow(row: Record<string, any>) {
  return {
    id: row.id,
    publisherId: row.publisher_id,
    name: row.name,
    description: row.description,
    strategyType: row.strategy_type,
    category: row.category,
    symbols: row.symbols || [],
    config: row.config || {},
    riskParams: row.risk_params || {},
    tags: row.tags || [],
    visibility: row.visibility,
    status: row.status,
    performanceMetrics: row.performance_metrics || {},
    backtestPeriod: row.backtest_period,
    backtestStats: row.backtest_stats,
    subscriptionFee: parseFloat(row.subscription_fee) || 0,
    feeCurrency: row.fee_currency,
    revenueSharePercent: parseFloat(row.revenue_share_percent) || 70,
    subscriberCount: row.subscriber_count || 0,
    viewCount: row.view_count || 0,
    ratingAvg: parseFloat(row.rating_avg) || 0,
    ratingCount: row.rating_count || 0,
    signalCount: row.signal_count || 0,
    isFeatured: row.is_featured || false,
    isVerified: row.is_verified || false,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubscriptionRow(row: Record<string, any>) {
  return {
    id: row.id,
    subscriberId: row.subscriber_id,
    strategyId: row.strategy_id,
    autoExecute: row.auto_execute,
    copyRatio: parseFloat(row.copy_ratio) || 1.0,
    fixedAmount: row.fixed_amount ? parseFloat(row.fixed_amount) : null,
    maxRiskPerTrade: row.max_risk_per_trade ? parseFloat(row.max_risk_per_trade) : null,
    allowedSymbols: row.allowed_symbols || [],
    blockedSymbols: row.blocked_symbols || [],
    notifySignal: row.notify_signal,
    notifyExecution: row.notify_execution,
    status: row.status,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    cancelledAt: row.cancelled_at,
    signalsReceived: row.signals_received || 0,
    signalsExecuted: row.signals_executed || 0,
    totalPnl: parseFloat(row.total_pnl) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReviewRow(row: Record<string, any>) {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    userId: row.user_id,
    rating: row.rating,
    title: row.title,
    content: row.content,
    isVerifiedSubscriber: row.is_verified_subscriber,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSignalRow(row: Record<string, any>) {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    publisherId: row.publisher_id,
    symbol: row.symbol,
    side: row.side,
    signalType: row.signal_type,
    entryPrice: row.entry_price ? parseFloat(row.entry_price) : null,
    targetPrice: row.target_price ? parseFloat(row.target_price) : null,
    stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : null,
    quantity: row.quantity ? parseFloat(row.quantity) : null,
    riskPercent: row.risk_percent ? parseFloat(row.risk_percent) : null,
    title: row.title,
    description: row.description,
    analysis: row.analysis,
    confidenceScore: row.confidence_score,
    riskLevel: row.risk_level,
    status: row.status,
    executedAt: row.executed_at,
    executionPrice: row.execution_price ? parseFloat(row.execution_price) : null,
    pnl: row.pnl ? parseFloat(row.pnl) : null,
    subscribersNotified: row.subscribers_notified || 0,
    executionsCount: row.executions_count || 0,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==================== Main Handler ====================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  const supabase = getSupabaseClient();
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;
  
  const { resource, id, subResource } = parsePath(pathname);
  
  try {
    // Route: /strategies
    if (resource === 'strategies') {
      if (!id) {
        if (method === 'GET') {
          return await listStrategies(req, supabase);
        }
        if (method === 'POST') {
          return await createStrategy(req, supabase);
        }
      }
      
      // /strategies/categories
      if (id === 'categories' && method === 'GET') {
        return await getCategories(supabase);
      }
      
      // /strategies/tags
      if (id === 'tags' && method === 'GET') {
        return await getTags(supabase);
      }
      
      // /strategies/featured
      if (id === 'featured' && method === 'GET') {
        const url = new URL(req.url);
        url.searchParams.set('isFeatured', 'true');
        const newReq = new Request(url.toString(), req);
        return await listStrategies(newReq, supabase);
      }
      
      // /strategies/top-rated
      if (id === 'top-rated' && method === 'GET') {
        const url = new URL(req.url);
        url.searchParams.set('minRating', '4');
        url.searchParams.set('orderBy', 'rating_avg');
        const newReq = new Request(url.toString(), req);
        return await listStrategies(newReq, supabase);
      }
      
      // /strategies/:id
      if (id && !subResource) {
        if (method === 'GET') {
          return await getStrategy(id, supabase);
        }
      }
      
      // /strategies/:id/reviews
      if (id && subResource === 'reviews') {
        if (method === 'GET') {
          return await listReviews(id, req, supabase);
        }
        if (method === 'POST') {
          return await createReview(id, req, supabase);
        }
      }
      
      // /strategies/:id/signals
      if (id && subResource === 'signals') {
        if (method === 'GET') {
          return await listSignals(id, req, supabase);
        }
      }
    }
    
    // Route: /subscriptions
    if (resource === 'subscriptions') {
      if (!id) {
        if (method === 'GET') {
          return await listSubscriptions(req, supabase);
        }
        if (method === 'POST') {
          return await createSubscription(req, supabase);
        }
      }
      
      // /subscriptions/:id/pause
      if (id && subResource === 'pause' && method === 'POST') {
        return await pauseSubscription(id, req, supabase);
      }
      
      // /subscriptions/:id/resume
      if (id && subResource === 'resume' && method === 'POST') {
        return await resumeSubscription(id, req, supabase);
      }
      
      // /subscriptions/:id
      if (id && !subResource) {
        if (method === 'DELETE') {
          return await cancelSubscription(id, req, supabase);
        }
      }
    }
    
    // Not found
    return new Response(JSON.stringify({ success: false, error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});