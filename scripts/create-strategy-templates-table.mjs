import pkg from 'pg';
const { Client } = pkg;

// 从 Supabase 项目信息构建连接字符串
// 格式: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL or SUPABASE_DB_URL');
  console.error('Please get the connection string from Supabase Dashboard > Project Settings > Database > Connection string (URI)');
  process.exit(1);
}

const client = new Client({ connectionString });

async function createTables() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Check if table exists
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'strategy_templates'
      );
    `);

    if (checkResult.rows[0].exists) {
      console.log('strategy_templates table already exists');
      
      // Check if data exists
      const dataResult = await client.query('SELECT COUNT(*) FROM strategy_templates');
      console.log(`Found ${dataResult.rows[0].count} templates`);
      
      await client.end();
      return;
    }

    console.log('Creating strategy_templates table...');

    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS strategy_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        author_user_id VARCHAR(255),
        author_name VARCHAR(255),
        
        strategy_type VARCHAR(100) NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        symbol VARCHAR(50) DEFAULT 'BTC-USDT',
        
        config JSONB NOT NULL,
        risk_params JSONB DEFAULT '{}',
        
        tags JSONB DEFAULT '[]',
        is_public BOOLEAN DEFAULT true,
        is_featured BOOLEAN DEFAULT false,
        is_builtin BOOLEAN DEFAULT false,
        
        performance_metrics JSONB DEFAULT '{}',
        backtest_period VARCHAR(50),
        
        use_count INTEGER DEFAULT 0,
        rating_avg DECIMAL(3, 2) DEFAULT 0,
        rating_count INTEGER DEFAULT 0,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('Created strategy_templates table');

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_templates_strategy_type ON strategy_templates(strategy_type);
      CREATE INDEX IF NOT EXISTS idx_templates_category ON strategy_templates(category);
      CREATE INDEX IF NOT EXISTS idx_templates_is_public ON strategy_templates(is_public);
      CREATE INDEX IF NOT EXISTS idx_templates_is_featured ON strategy_templates(is_featured);
      CREATE INDEX IF NOT EXISTS idx_templates_author ON strategy_templates(author_user_id);
      CREATE INDEX IF NOT EXISTS idx_templates_rating ON strategy_templates(rating_avg DESC);
      CREATE INDEX IF NOT EXISTS idx_templates_use_count ON strategy_templates(use_count DESC);
      CREATE INDEX IF NOT EXISTS idx_templates_created_at ON strategy_templates(created_at DESC);
    `);
    console.log('Created indexes');

    // Create related tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS template_ratings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID REFERENCES strategy_templates(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        CONSTRAINT unique_user_template_rating UNIQUE (template_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS template_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID REFERENCES strategy_templates(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        strategy_id UUID,
        template_config_snapshot JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_template_ratings_template ON template_ratings(template_id);
      CREATE INDEX IF NOT EXISTS idx_template_ratings_user ON template_ratings(user_id);
      CREATE INDEX IF NOT EXISTS idx_template_usage_template ON template_usage(template_id);
      CREATE INDEX IF NOT EXISTS idx_template_usage_user ON template_usage(user_id);
    `);
    console.log('Created template_ratings and template_usage tables');

    // Insert seed data
    console.log('Inserting seed data...');
    await client.query(`
      INSERT INTO strategy_templates (name, description, strategy_type, category, config, risk_params, tags, is_builtin, is_featured, performance_metrics, backtest_period) VALUES
      ('RSI Reversal Strategy', 'A mean reversion strategy based on RSI oversold/overbought conditions. Buys when RSI < 30 and sells when RSI > 70. Best for sideways markets.', 'rsi', 'mean_reversion', '{"rsi_period": 14, "oversold_threshold": 30, "overbought_threshold": 70, "confirm_candles": 2}'::jsonb, '{"stop_loss_pct": 3, "take_profit_pct": 5, "position_size_pct": 5}'::jsonb, '["rsi", "mean-reversion", "reversal", "oscillator"]'::jsonb, true, true, '{"winRate": 58.5, "avgReturn": 2.3, "sharpeRatio": 1.2, "maxDrawdown": -12.5}'::jsonb, '1_year'),
      ('MACD Trend Following', 'A trend-following strategy using MACD crossovers. Buys on bullish crossover and sells on bearish crossover. Works well in trending markets.', 'macd', 'momentum', '{"fast_period": 12, "slow_period": 26, "signal_period": 9, "confirm_trend": true}'::jsonb, '{"stop_loss_pct": 4, "take_profit_pct": 8, "position_size_pct": 6}'::jsonb, '["macd", "trend-following", "momentum", "crossover"]'::jsonb, true, true, '{"winRate": 52.3, "avgReturn": 4.5, "sharpeRatio": 1.5, "maxDrawdown": -18.2}'::jsonb, '1_year'),
      ('Bollinger Bands Breakout', 'A breakout strategy using Bollinger Bands. Enters when price breaks above/below bands. Uses volatility expansion for entries.', 'bollinger_bands', 'breakout', '{"period": 20, "std_dev": 2, "breakout_confirm": true, "volume_factor": 1.5}'::jsonb, '{"stop_loss_pct": 2.5, "take_profit_pct": 6, "position_size_pct": 4}'::jsonb, '["bollinger", "breakout", "volatility", "momentum"]'::jsonb, true, true, '{"winRate": 55.8, "avgReturn": 3.8, "sharpeRatio": 1.3, "maxDrawdown": -15.3}'::jsonb, '6_months'),
      ('VWAP Scalping Strategy', 'A scalping strategy using VWAP as dynamic support/resistance. Enters on VWAP bounces in the direction of trend. Best for high-volume periods.', 'vwap', 'scalping', '{"vwap_period": 14, "entry_threshold": 0.3, "trend_ema": 50, "volume_filter": true}'::jsonb, '{"stop_loss_pct": 1, "take_profit_pct": 1.5, "position_size_pct": 3}'::jsonb, '["vwap", "scalping", "intraday", "volume"]'::jsonb, true, true, '{"winRate": 62.1, "avgReturn": 0.8, "sharpeRatio": 1.8, "maxDrawdown": -5.2}'::jsonb, '6_months'),
      ('Stochastic Reversal', 'Uses Stochastic oscillator to identify overbought/oversold conditions. Combines %K and %D lines for confirmation signals.', 'stochastic', 'mean_reversion', '{"k_period": 14, "d_period": 3, "smooth": 3, "oversold": 20, "overbought": 80}'::jsonb, '{"stop_loss_pct": 2, "take_profit_pct": 4, "position_size_pct": 4}'::jsonb, '["stochastic", "oscillator", "reversal", "mean-reversion"]'::jsonb, true, false, '{"winRate": 56.7, "avgReturn": 2.1, "sharpeRatio": 1.1, "maxDrawdown": -10.8}'::jsonb, '1_year'),
      ('Fibonacci Retracement Strategy', 'Uses Fibonacci retracement levels for entries and exits. Buys at key support levels (38.2%, 50%, 61.8%) in uptrends.', 'fibonacci', 'trend_following', '{"fib_levels": [0.382, 0.5, 0.618], "trend_period": 50, "confirm_volume": true}'::jsonb, '{"stop_loss_pct": 3, "take_profit_pct": 7, "position_size_pct": 5}'::jsonb, '["fibonacci", "retracement", "trend", "support-resistance"]'::jsonb, true, false, '{"winRate": 54.2, "avgReturn": 3.5, "sharpeRatio": 1.4, "maxDrawdown": -14.7}'::jsonb, '1_year'),
      ('ATR Volatility Breakout', 'Uses Average True Range to measure volatility and set breakout levels. Adapts to market volatility dynamically.', 'atr', 'breakout', '{"atr_period": 14, "breakout_multiplier": 1.5, "trail_stop": true, "volume_confirm": true}'::jsonb, '{"stop_loss_atr": 2, "take_profit_atr": 3, "position_size_pct": 5}'::jsonb, '["atr", "volatility", "breakout", "adaptive"]'::jsonb, true, false, '{"winRate": 51.8, "avgReturn": 5.2, "sharpeRatio": 1.6, "maxDrawdown": -20.1}'::jsonb, '1_year'),
      ('Ichimoku Cloud Strategy', 'Comprehensive strategy using all Ichimoku components. Enters when price breaks above cloud with Tenkan/Kijun crossover confirmation.', 'ichimoku', 'trend_following', '{"tenkan_period": 9, "kijun_period": 26, "senkou_b_period": 52, "cloud_confirm": true}'::jsonb, '{"stop_loss_pct": 4, "take_profit_pct": 10, "position_size_pct": 6}'::jsonb, '["ichimoku", "cloud", "trend", "multi-indicator"]'::jsonb, true, false, '{"winRate": 53.6, "avgReturn": 6.8, "sharpeRatio": 1.7, "maxDrawdown": -16.5}'::jsonb, '1_year'),
      ('Elliott Wave Counter', 'Identifies Elliott Wave patterns and enters on Wave 2 and Wave 4 corrections. Uses Fibonacci ratios for wave validation.', 'elliott_wave', 'advanced', '{"min_wave1_pct": 10, "wave2_retrace": [0.382, 0.618], "wave4_retrace": [0.236, 0.382], "confirm_patterns": true}'::jsonb, '{"stop_loss_pct": 3, "take_profit_pct": 8, "position_size_pct": 4}'::jsonb, '["elliott", "wave", "pattern", "advanced", "fibonacci"]'::jsonb, true, false, '{"winRate": 49.5, "avgReturn": 7.2, "sharpeRatio": 1.8, "maxDrawdown": -22.3}'::jsonb, '1_year'),
      ('SMA Golden Cross', 'Classic trend-following strategy using Simple Moving Average crossovers. Golden Cross (50/200) for longs, Death Cross for exits.', 'sma', 'trend_following', '{"fast_period": 50, "slow_period": 200, "confirm_candles": 3, "use_ema": false}'::jsonb, '{"stop_loss_pct": 5, "take_profit_pct": 15, "position_size_pct": 8}'::jsonb, '["sma", "moving-average", "crossover", "golden-cross", "trend"]'::jsonb, true, false, '{"winRate": 48.2, "avgReturn": 12.5, "sharpeRatio": 1.1, "maxDrawdown": -25.8}'::jsonb, '1_year');
    `);
    console.log('Inserted 10 strategy templates');

    // Verify
    const result = await client.query('SELECT id, name FROM strategy_templates');
    console.log('\nCreated templates:');
    result.rows.forEach(row => console.log(`  - ${row.name}`));

    await client.end();
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
    await client.end();
    process.exit(1);
  }
}

createTables();
