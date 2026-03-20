import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user.id;
  } catch { return null; }
}

function validatePositiveNumber(value: unknown, fieldName: string): { valid: boolean; error?: string } {
  if (value === undefined || value === null) return { valid: true };
  const num = Number(value);
  if (isNaN(num) || num <= 0) return { valid: false, error: fieldName + ' must be a positive number' };
  return { valid: true };
}

function validateRange(value: unknown, min: number, max: number, fieldName: string): { valid: boolean; error?: string } {
  if (value === undefined || value === null) return { valid: true };
  const num = Number(value);
  if (isNaN(num) || num < min || num > max) return { valid: false, error: fieldName + ' must be between ' + min + ' and ' + max };
  return { valid: true };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const currentUserId = await getUserId(req);

    // POST /signals - Publish a new signal
    if (method === 'POST' && (path === '/signals' || path === '/api/signals')) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const body = await req.json();
      const { symbol, side, strategyId, signalType, entryPrice, entryPriceRangeLow, entryPriceRangeHigh, targetPrice, stopLossPrice, quantity, title, description, analysis, riskLevel, confidenceScore, expiresAt } = body;
      if (!symbol || !side) {
        return new Response(JSON.stringify({ success: false, error: 'symbol and side are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const validations = [validatePositiveNumber(quantity, 'quantity'), validatePositiveNumber(entryPrice, 'entryPrice'), validatePositiveNumber(targetPrice, 'targetPrice'), validatePositiveNumber(stopLossPrice, 'stopLossPrice'), validateRange(confidenceScore, 0, 100, 'confidenceScore')];
      for (const v of validations) { if (!v.valid) return new Response(JSON.stringify({ success: false, error: v.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

      const { data: signal, error } = await supabase.from('trading_signals').insert([{
        publisher_id: currentUserId, strategy_id: strategyId, symbol, side, signal_type: signalType || 'entry',
        entry_price: entryPrice, entry_price_range_low: entryPriceRangeLow, entry_price_range_high: entryPriceRangeHigh,
        target_price: targetPrice, stop_loss_price: stopLossPrice, quantity, title, description, analysis,
        risk_level: riskLevel, confidence_score: confidenceScore, expires_at: expiresAt ? new Date(expiresAt) : null
      }]).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: { id: signal.id, publisherId: signal.publisher_id, symbol: signal.symbol, side: signal.side, signalType: signal.signal_type, entryPrice: signal.entry_price, targetPrice: signal.target_price, stopLossPrice: signal.stop_loss_price, quantity: signal.quantity, title: signal.title, description: signal.description, status: signal.status, createdAt: signal.created_at } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /signals - Get active signals
    if (method === 'GET' && (path === '/signals' || path === '/api/signals')) {
      const symbol = url.searchParams.get('symbol');
      const riskLevel = url.searchParams.get('riskLevel');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const orderBy = url.searchParams.get('orderBy') || 'created_at';
      let query = supabase.from('trading_signals').select('*').eq('status', 'active');
      if (symbol) query = query.eq('symbol', symbol);
      if (riskLevel) query = query.eq('risk_level', riskLevel);
      query = query.order(orderBy === 'views_count' ? 'views_count' : orderBy === 'executions_count' ? 'executions_count' : 'created_at', { ascending: false }).range(offset, offset + limit - 1);
      const { data: signals, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: signals?.map(s => ({ id: s.id, publisherId: s.publisher_id, symbol: s.symbol, side: s.side, signalType: s.signal_type, entryPrice: s.entry_price, targetPrice: s.target_price, stopLossPrice: s.stop_loss_price, quantity: s.quantity, title: s.title, description: s.description, riskLevel: s.risk_level, confidenceScore: s.confidence_score, status: s.status, viewsCount: s.views_count, executionsCount: s.executions_count, createdAt: s.created_at })) || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /signals/feed - Get personalized feed
    if (method === 'GET' && (path === '/signals/feed' || path === '/api/signals/feed')) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const symbols = url.searchParams.get('symbols')?.split(',');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const { data: subscriptions } = await supabase.from('signal_subscriptions').select('source_type, source_id').eq('subscriber_id', currentUserId).eq('status', 'active');
      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const publisherIds = subscriptions.filter(s => s.source_type === 'user').map(s => s.source_id);
      let query = supabase.from('trading_signals').select('*').in('publisher_id', publisherIds).eq('status', 'active');
      if (symbols && symbols.length > 0) query = query.in('symbol', symbols);
      const { data: signals, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: signals?.map(s => ({ id: s.id, publisherId: s.publisher_id, symbol: s.symbol, side: s.side, signalType: s.signal_type, entryPrice: s.entry_price, targetPrice: s.target_price, stopLossPrice: s.stop_loss_price, quantity: s.quantity, title: s.title, description: s.description, status: s.status, createdAt: s.created_at })) || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /signals/executions - Get user's execution history
    if (method === 'GET' && (path === '/signals/executions' || path === '/api/signals/executions')) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const { data: executions, error } = await supabase.from('signal_executions').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: executions?.map(e => ({ id: e.id, signalId: e.signal_id, subscriptionId: e.subscription_id, executionType: e.execution_type, quantity: e.quantity, price: e.price, status: e.status, pnl: e.pnl, pnlPercent: e.pnl_percent, createdAt: e.created_at })) || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /signals/executions/stats
    if (method === 'GET' && (path === '/signals/executions/stats' || path === '/api/signals/executions/stats')) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: executions, error } = await supabase.from('signal_executions').select('pnl, status').eq('user_id', currentUserId);
      if (error) throw error;
      const stats = { totalExecutions: executions?.length || 0, filledExecutions: executions?.filter(e => e.status === 'filled').length || 0, totalPnl: executions?.reduce((sum, e) => sum + (e.pnl || 0), 0) || 0 };
      return new Response(JSON.stringify({ success: true, data: stats }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /signals/publisher/:publisherId
    const publisherMatch = path.match(/^\/(api\/)?signals\/publisher\/([^\/]+)$/);
    if (method === 'GET' && publisherMatch) {
      const publisherId = publisherMatch[2];
      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      let query = supabase.from('trading_signals').select('*').eq('publisher_id', publisherId);
      if (status) query = query.eq('status', status);
      const { data: signals, error } = await query.order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: signals?.map(s => ({ id: s.id, publisherId: s.publisher_id, symbol: s.symbol, side: s.side, signalType: s.signal_type, entryPrice: s.entry_price, targetPrice: s.target_price, stopLossPrice: s.stop_loss_price, quantity: s.quantity, title: s.title, description: s.description, status: s.status, createdAt: s.created_at })) || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /signals/publisher/:publisherId/stats
    const publisherStatsMatch = path.match(/^\/(api\/)?signals\/publisher\/([^\/]+)\/stats$/);
    if (method === 'GET' && publisherStatsMatch) {
      const publisherId = publisherStatsMatch[2];
      const { data: stats, error } = await supabase.from('signal_publisher_stats').select('*').eq('publisher_id', publisherId).eq('period_type', 'all_time').single();
      if (error && error.code !== 'PGRST116') throw error;
      return new Response(JSON.stringify({ success: true, data: stats ? { totalSignals: stats.total_signals, activeSignals: stats.active_signals, winRate: stats.win_rate, avgPnlPercent: stats.avg_pnl_percent, subscriberCount: stats.subscriber_count } : { totalSignals: 0, activeSignals: 0, winRate: 0, avgPnlPercent: 0, subscriberCount: 0 } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /signals/:id
    const signalMatch = path.match(/^\/(api\/)?signals\/([a-f0-9-]+)$/i);
    if (method === 'GET' && signalMatch) {
      const signalId = signalMatch[2];
      const { data: signal, error } = await supabase.from('trading_signals').select('*').eq('id', signalId).single();
      if (error || !signal) {
        return new Response(JSON.stringify({ success: false, error: 'Signal not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      await supabase.from('trading_signals').update({ views_count: signal.views_count + 1 }).eq('id', signalId);
      return new Response(JSON.stringify({ success: true, data: { id: signal.id, publisherId: signal.publisher_id, symbol: signal.symbol, side: signal.side, signalType: signal.signal_type, entryPrice: signal.entry_price, entryPriceRangeLow: signal.entry_price_range_low, entryPriceRangeHigh: signal.entry_price_range_high, targetPrice: signal.target_price, stopLossPrice: signal.stop_loss_price, quantity: signal.quantity, title: signal.title, description: signal.description, analysis: signal.analysis, riskLevel: signal.risk_level, confidenceScore: signal.confidence_score, status: signal.status, viewsCount: signal.views_count + 1, executionsCount: signal.executions_count, createdAt: signal.created_at } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // DELETE /signals/:id
    if (method === 'DELETE' && signalMatch) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const signalId = signalMatch[2];
      const { data: signal, error: fetchError } = await supabase.from('trading_signals').select('publisher_id').eq('id', signalId).single();
      if (fetchError || !signal) {
        return new Response(JSON.stringify({ success: false, error: 'Signal not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (signal.publisher_id !== currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'Not authorized to cancel this signal' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: updated, error } = await supabase.from('trading_signals').update({ status: 'cancelled', cancelled_at: new Date() }).eq('id', signalId).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: { id: updated.id, status: updated.status } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST /signals/:id/execute
    const executeMatch = path.match(/^\/(api\/)?signals\/([a-f0-9-]+)\/execute$/i);
    if (method === 'POST' && executeMatch) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const signalId = executeMatch[2];
      const body = await req.json();
      const { executionType, quantity, price } = body;
      if (!quantity || !price) {
        return new Response(JSON.stringify({ success: false, error: 'quantity and price are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const qtyValidation = validatePositiveNumber(quantity, 'quantity');
      if (!qtyValidation.valid) return new Response(JSON.stringify({ success: false, error: qtyValidation.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const priceValidation = validatePositiveNumber(price, 'price');
      if (!priceValidation.valid) return new Response(JSON.stringify({ success: false, error: priceValidation.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: signal } = await supabase.from('trading_signals').select('publisher_id').eq('id', signalId).single();
      if (!signal) {
        return new Response(JSON.stringify({ success: false, error: 'Signal not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: subscription } = await supabase.from('signal_subscriptions').select('id').eq('subscriber_id', currentUserId).eq('source_type', 'user').eq('source_id', signal.publisher_id).eq('status', 'active').single();
      if (!subscription) {
        return new Response(JSON.stringify({ success: false, error: 'Not subscribed to this signal source' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: execution, error } = await supabase.from('signal_executions').insert([{ signal_id: signalId, subscription_id: subscription.id, user_id: currentUserId, execution_type: executionType || 'manual', quantity, price, status: 'pending' }]).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: { id: execution.id, signalId: execution.signal_id, executionType: execution.execution_type, quantity: execution.quantity, price: execution.price, status: execution.status, createdAt: execution.created_at } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /signals/:id/executions
    const signalExecutionsMatch = path.match(/^\/(api\/)?signals\/([a-f0-9-]+)\/executions$/i);
    if (method === 'GET' && signalExecutionsMatch) {
      const signalId = signalExecutionsMatch[2];
      const { data: executions, error } = await supabase.from('signal_executions').select('*').eq('signal_id', signalId).order('created_at', { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: executions?.map(e => ({ id: e.id, userId: e.user_id, executionType: e.execution_type, quantity: e.quantity, price: e.price, status: e.status, pnl: e.pnl, createdAt: e.created_at })) || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========== SUBSCRIPTION ROUTES ==========

    // POST /signals/subscriptions
    if (method === 'POST' && (path === '/signals/subscriptions' || path === '/api/signals/subscriptions')) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const body = await req.json();
      const { sourceType, sourceId, autoExecute, copyRatio, fixedAmount, maxAmount, maxRiskPerTrade, allowedSymbols, blockedSymbols, notifyInApp, notifyPush, notifyEmail } = body;
      if (!sourceType || !sourceId) {
        return new Response(JSON.stringify({ success: false, error: 'sourceType and sourceId are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: subscription, error } = await supabase.from('signal_subscriptions').insert([{ subscriber_id: currentUserId, source_type: sourceType, source_id: sourceId, auto_execute: autoExecute || false, copy_ratio: copyRatio || 1.0, fixed_amount: fixedAmount, max_amount: maxAmount, max_risk_per_trade: maxRiskPerTrade, allowed_symbols: allowedSymbols || [], blocked_symbols: blockedSymbols || [], notify_in_app: notifyInApp !== false, notify_push: notifyPush || false, notify_email: notifyEmail || false, status: 'active' }]).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: { id: subscription.id, subscriberId: subscription.subscriber_id, sourceType: subscription.source_type, sourceId: subscription.source_id, autoExecute: subscription.auto_execute, status: subscription.status, createdAt: subscription.created_at } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /signals/subscriptions
    if (method === 'GET' && (path === '/signals/subscriptions' || path === '/api/signals/subscriptions')) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const status = url.searchParams.get('status');
      let query = supabase.from('signal_subscriptions').select('*').eq('subscriber_id', currentUserId);
      if (status) query = query.eq('status', status);
      const { data: subscriptions, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: subscriptions?.map(s => ({ id: s.id, subscriberId: s.subscriber_id, sourceType: s.source_type, sourceId: s.source_id, autoExecute: s.auto_execute, copyRatio: s.copy_ratio, fixedAmount: s.fixed_amount, maxAmount: s.max_amount, status: s.status, signalsReceived: s.signals_received, signalsExecuted: s.signals_executed, totalPnl: s.total_pnl, createdAt: s.created_at })) || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /signals/subscriptions/stats
    if (method === 'GET' && (path === '/signals/subscriptions/stats' || path === '/api/signals/subscriptions/stats')) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: subscriptions, error } = await supabase.from('signal_subscriptions').select('status, signals_received, signals_executed, total_pnl').eq('subscriber_id', currentUserId);
      if (error) throw error;
      const stats = { totalSubscriptions: subscriptions?.length || 0, activeSubscriptions: subscriptions?.filter(s => s.status === 'active').length || 0, signalsReceived: subscriptions?.reduce((sum, s) => sum + (s.signals_received || 0), 0) || 0, signalsExecuted: subscriptions?.reduce((sum, s) => sum + (s.signals_executed || 0), 0) || 0, totalPnl: subscriptions?.reduce((sum, s) => sum + (s.total_pnl || 0), 0) || 0 };
      return new Response(JSON.stringify({ success: true, data: stats }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /signals/subscriptions/:id
    const subscriptionMatch = path.match(/^\/(api\/)?signals\/subscriptions\/([a-f0-9-]+)$/i);
    if (method === 'GET' && subscriptionMatch) {
      const subscriptionId = subscriptionMatch[2];
      const { data: subscription, error } = await supabase.from('signal_subscriptions').select('*').eq('id', subscriptionId).single();
      if (error || !subscription) {
        return new Response(JSON.stringify({ success: false, error: 'Subscription not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, data: { id: subscription.id, subscriberId: subscription.subscriber_id, sourceType: subscription.source_type, sourceId: subscription.source_id, autoExecute: subscription.auto_execute, copyRatio: subscription.copy_ratio, fixedAmount: subscription.fixed_amount, maxAmount: subscription.max_amount, status: subscription.status, createdAt: subscription.created_at } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // PATCH /signals/subscriptions/:id
    if (method === 'PATCH' && subscriptionMatch) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const subscriptionId = subscriptionMatch[2];
      const body = await req.json();
      const updates: Record<string, any> = {};
      if (body.autoExecute !== undefined) updates.auto_execute = body.autoExecute;
      if (body.copyRatio !== undefined) updates.copy_ratio = body.copyRatio;
      if (body.fixedAmount !== undefined) updates.fixed_amount = body.fixedAmount;
      if (body.maxAmount !== undefined) updates.max_amount = body.maxAmount;
      if (body.maxRiskPerTrade !== undefined) updates.max_risk_per_trade = body.maxRiskPerTrade;
      if (body.allowedSymbols !== undefined) updates.allowed_symbols = body.allowedSymbols;
      if (body.blockedSymbols !== undefined) updates.blocked_symbols = body.blockedSymbols;
      if (body.notifyInApp !== undefined) updates.notify_in_app = body.notifyInApp;
      if (body.notifyPush !== undefined) updates.notify_push = body.notifyPush;
      if (body.notifyEmail !== undefined) updates.notify_email = body.notifyEmail;
      const { data: subscription, error } = await supabase.from('signal_subscriptions').update(updates).eq('id', subscriptionId).eq('subscriber_id', currentUserId).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: { id: subscription.id, status: subscription.status } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // DELETE /signals/subscriptions/:id
    if (method === 'DELETE' && subscriptionMatch) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const subscriptionId = subscriptionMatch[2];
      const { error } = await supabase.from('signal_subscriptions').delete().eq('id', subscriptionId).eq('subscriber_id', currentUserId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST /signals/subscriptions/:id/pause
    const pauseMatch = path.match(/^\/(api\/)?signals\/subscriptions\/([a-f0-9-]+)\/pause$/i);
    if (method === 'POST' && pauseMatch) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const subscriptionId = pauseMatch[2];
      const { data: subscription, error } = await supabase.from('signal_subscriptions').update({ status: 'paused' }).eq('id', subscriptionId).eq('subscriber_id', currentUserId).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: { id: subscription.id, status: subscription.status } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST /signals/subscriptions/:id/resume
    const resumeMatch = path.match(/^\/(api\/)?signals\/subscriptions\/([a-f0-9-]+)\/resume$/i);
    if (method === 'POST' && resumeMatch) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const subscriptionId = resumeMatch[2];
      const { data: subscription, error } = await supabase.from('signal_subscriptions').update({ status: 'active' }).eq('id', subscriptionId).eq('subscriber_id', currentUserId).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: { id: subscription.id, status: subscription.status } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
