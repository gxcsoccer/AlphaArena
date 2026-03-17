import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigration() {
  console.log('Starting migration...');

  // Check if table exists
  const { error: checkError } = await supabase
    .from('strategy_templates')
    .select('id')
    .limit(1);

  if (checkError?.code === 'PGRST205') {
    console.log('strategy_templates table does not exist. Creating...');
    
    // Create table using raw SQL via RPC
    // Note: We need to use a different approach since Supabase JS client doesn't support DDL directly
    console.log('Table needs to be created. Please run migration via Supabase Dashboard SQL Editor.');
    console.log('Migration SQL file: supabase/migrations/20260401_create_strategy_templates.sql');
    return;
  }

  if (checkError) {
    console.error('Error checking table:', checkError);
    return;
  }

  // Table exists, check if data exists
  const { data: existingTemplates, error: dataError } = await supabase
    .from('strategy_templates')
    .select('id, name');

  if (dataError) {
    console.error('Error fetching templates:', dataError);
    return;
  }

  console.log(`Found ${existingTemplates?.length || 0} existing templates`);

  if (existingTemplates && existingTemplates.length > 0) {
    console.log('Templates already exist:', existingTemplates.map(t => t.name).join(', '));
    return;
  }

  console.log('No templates found. Inserting seed data...');

  // Insert seed data
  const templates = [
    {
      name: 'RSI Reversal Strategy',
      description: 'A mean reversion strategy based on RSI oversold/overbought conditions. Buys when RSI < 30 and sells when RSI > 70. Best for sideways markets.',
      strategy_type: 'rsi',
      category: 'mean_reversion',
      symbol: 'BTC-USDT',
      config: { rsi_period: 14, oversold_threshold: 30, overbought_threshold: 70, confirm_candles: 2 },
      risk_params: { stop_loss_pct: 3, take_profit_pct: 5, position_size_pct: 5 },
      tags: ['rsi', 'mean-reversion', 'reversal', 'oscillator'],
      is_public: true,
      is_featured: true,
      is_builtin: true,
      performance_metrics: { winRate: 58.5, avgReturn: 2.3, sharpeRatio: 1.2, maxDrawdown: -12.5 },
      backtest_period: '1_year',
    },
    {
      name: 'MACD Trend Following',
      description: 'A trend-following strategy using MACD crossovers. Buys on bullish crossover and sells on bearish crossover. Works well in trending markets.',
      strategy_type: 'macd',
      category: 'momentum',
      symbol: 'BTC-USDT',
      config: { fast_period: 12, slow_period: 26, signal_period: 9, confirm_trend: true },
      risk_params: { stop_loss_pct: 4, take_profit_pct: 8, position_size_pct: 6 },
      tags: ['macd', 'trend-following', 'momentum', 'crossover'],
      is_public: true,
      is_featured: true,
      is_builtin: true,
      performance_metrics: { winRate: 52.3, avgReturn: 4.5, sharpeRatio: 1.5, maxDrawdown: -18.2 },
      backtest_period: '1_year',
    },
    {
      name: 'Bollinger Bands Breakout',
      description: 'A breakout strategy using Bollinger Bands. Enters when price breaks above/below bands. Uses volatility expansion for entries.',
      strategy_type: 'bollinger_bands',
      category: 'breakout',
      symbol: 'BTC-USDT',
      config: { period: 20, std_dev: 2, breakout_confirm: true, volume_factor: 1.5 },
      risk_params: { stop_loss_pct: 2.5, take_profit_pct: 6, position_size_pct: 4 },
      tags: ['bollinger', 'breakout', 'volatility', 'momentum'],
      is_public: true,
      is_featured: true,
      is_builtin: true,
      performance_metrics: { winRate: 55.8, avgReturn: 3.8, sharpeRatio: 1.3, maxDrawdown: -15.3 },
      backtest_period: '6_months',
    },
    {
      name: 'VWAP Scalping Strategy',
      description: 'A scalping strategy using VWAP as dynamic support/resistance. Enters on VWAP bounces in the direction of trend. Best for high-volume periods.',
      strategy_type: 'vwap',
      category: 'scalping',
      symbol: 'BTC-USDT',
      config: { vwap_period: 14, entry_threshold: 0.3, trend_ema: 50, volume_filter: true },
      risk_params: { stop_loss_pct: 1, take_profit_pct: 1.5, position_size_pct: 3 },
      tags: ['vwap', 'scalping', 'intraday', 'volume'],
      is_public: true,
      is_featured: true,
      is_builtin: true,
      performance_metrics: { winRate: 62.1, avgReturn: 0.8, sharpeRatio: 1.8, maxDrawdown: -5.2 },
      backtest_period: '6_months',
    },
    {
      name: 'Stochastic Reversal',
      description: 'Uses Stochastic oscillator to identify overbought/oversold conditions. Combines %K and %D lines for confirmation signals.',
      strategy_type: 'stochastic',
      category: 'mean_reversion',
      symbol: 'BTC-USDT',
      config: { k_period: 14, d_period: 3, smooth: 3, oversold: 20, overbought: 80 },
      risk_params: { stop_loss_pct: 2, take_profit_pct: 4, position_size_pct: 4 },
      tags: ['stochastic', 'oscillator', 'reversal', 'mean-reversion'],
      is_public: true,
      is_featured: false,
      is_builtin: true,
      performance_metrics: { winRate: 56.7, avgReturn: 2.1, sharpeRatio: 1.1, maxDrawdown: -10.8 },
      backtest_period: '1_year',
    },
    {
      name: 'Fibonacci Retracement Strategy',
      description: 'Uses Fibonacci retracement levels for entries and exits. Buys at key support levels (38.2%, 50%, 61.8%) in uptrends.',
      strategy_type: 'fibonacci',
      category: 'trend_following',
      symbol: 'BTC-USDT',
      config: { fib_levels: [0.382, 0.5, 0.618], trend_period: 50, confirm_volume: true },
      risk_params: { stop_loss_pct: 3, take_profit_pct: 7, position_size_pct: 5 },
      tags: ['fibonacci', 'retracement', 'trend', 'support-resistance'],
      is_public: true,
      is_featured: false,
      is_builtin: true,
      performance_metrics: { winRate: 54.2, avgReturn: 3.5, sharpeRatio: 1.4, maxDrawdown: -14.7 },
      backtest_period: '1_year',
    },
    {
      name: 'ATR Volatility Breakout',
      description: 'Uses Average True Range to measure volatility and set breakout levels. Adapts to market volatility dynamically.',
      strategy_type: 'atr',
      category: 'breakout',
      symbol: 'BTC-USDT',
      config: { atr_period: 14, breakout_multiplier: 1.5, trail_stop: true, volume_confirm: true },
      risk_params: { stop_loss_atr: 2, take_profit_atr: 3, position_size_pct: 5 },
      tags: ['atr', 'volatility', 'breakout', 'adaptive'],
      is_public: true,
      is_featured: false,
      is_builtin: true,
      performance_metrics: { winRate: 51.8, avgReturn: 5.2, sharpeRatio: 1.6, maxDrawdown: -20.1 },
      backtest_period: '1_year',
    },
    {
      name: 'Ichimoku Cloud Strategy',
      description: 'Comprehensive strategy using all Ichimoku components. Enters when price breaks above cloud with Tenkan/Kijun crossover confirmation.',
      strategy_type: 'ichimoku',
      category: 'trend_following',
      symbol: 'BTC-USDT',
      config: { tenkan_period: 9, kijun_period: 26, senkou_b_period: 52, cloud_confirm: true },
      risk_params: { stop_loss_pct: 4, take_profit_pct: 10, position_size_pct: 6 },
      tags: ['ichimoku', 'cloud', 'trend', 'multi-indicator'],
      is_public: true,
      is_featured: false,
      is_builtin: true,
      performance_metrics: { winRate: 53.6, avgReturn: 6.8, sharpeRatio: 1.7, maxDrawdown: -16.5 },
      backtest_period: '1_year',
    },
    {
      name: 'Elliott Wave Counter',
      description: 'Identifies Elliott Wave patterns and enters on Wave 2 and Wave 4 corrections. Uses Fibonacci ratios for wave validation.',
      strategy_type: 'elliott_wave',
      category: 'advanced',
      symbol: 'BTC-USDT',
      config: { min_wave1_pct: 10, wave2_retrace: [0.382, 0.618], wave4_retrace: [0.236, 0.382], confirm_patterns: true },
      risk_params: { stop_loss_pct: 3, take_profit_pct: 8, position_size_pct: 4 },
      tags: ['elliott', 'wave', 'pattern', 'advanced', 'fibonacci'],
      is_public: true,
      is_featured: false,
      is_builtin: true,
      performance_metrics: { winRate: 49.5, avgReturn: 7.2, sharpeRatio: 1.8, maxDrawdown: -22.3 },
      backtest_period: '1_year',
    },
    {
      name: 'SMA Golden Cross',
      description: 'Classic trend-following strategy using Simple Moving Average crossovers. Golden Cross (50/200) for longs, Death Cross for exits.',
      strategy_type: 'sma',
      category: 'trend_following',
      symbol: 'BTC-USDT',
      config: { fast_period: 50, slow_period: 200, confirm_candles: 3, use_ema: false },
      risk_params: { stop_loss_pct: 5, take_profit_pct: 15, position_size_pct: 8 },
      tags: ['sma', 'moving-average', 'crossover', 'golden-cross', 'trend'],
      is_public: true,
      is_featured: false,
      is_builtin: true,
      performance_metrics: { winRate: 48.2, avgReturn: 12.5, sharpeRatio: 1.1, maxDrawdown: -25.8 },
      backtest_period: '1_year',
    },
  ];

  const { data, error } = await supabase
    .from('strategy_templates')
    .insert(templates)
    .select();

  if (error) {
    console.error('Error inserting templates:', error);
    return;
  }

  console.log(`Successfully inserted ${data?.length || 0} templates!`);
}

runMigration().catch(console.error);
