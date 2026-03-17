/**
 * Bot Storage Module - 机器人持久化存储
 *
 * Handles persistence of bot configurations, states, logs, and trades
 */

import { getSupabaseClient } from '../database/client';
import {
  BotConfig,
  BotState,
  BotLog,
  BotTrade,
  BotStatus,
  TradingMode,
  StrategyType,
  TradingPair,
  TimeInterval,
  StrategyParams,
  BotRiskSettings,
} from './BotConfig';

/**
 * Database representation of bot configuration
 */
interface BotConfigRow {
  id: string;
  name: string;
  description: string | null;
  strategy: string;
  strategy_params: StrategyParams;
  trading_pair: TradingPair;
  interval: string;
  mode: string;
  risk_settings: BotRiskSettings;
  initial_capital: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Database representation of bot state
 */
interface BotStateRow {
  bot_id: string;
  status: string;
  portfolio_value: number;
  initial_capital: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  trade_count: number;
  win_count: number;
  loss_count: number;
  position_quantity: number;
  position_average_price: number;
  last_signal_time: string | null;
  last_trade_time: string | null;
  last_error: string | null;
  started_at: string | null;
  total_runtime_ms: number;
  daily_pnl: number;
  daily_pnl_reset_at: string | null;
}

/**
 * Database representation of bot log
 */
interface BotLogRow {
  id: string;
  bot_id: string;
  timestamp: string;
  level: string;
  message: string;
  data: Record<string, unknown> | null;
}

/**
 * Database representation of bot trade
 */
interface BotTradeRow {
  id: string;
  bot_id: string;
  strategy_id: string;
  symbol: string;
  side: string;
  price: number;
  quantity: number;
  total: number;
  fee: number;
  executed_at: string;
  order_id: string;
  is_paper_trade: boolean;
}

/**
 * Bot Storage - Handles all database operations for bots
 */
export class BotStorage {
  /**
   * Create a new bot configuration
   */
  async createBot(config: BotConfig): Promise<BotConfig> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('bot_configs')
      .insert([
        {
          id: config.id,
          name: config.name,
          description: config.description || null,
          strategy: config.strategy,
          strategy_params: config.strategyParams,
          trading_pair: config.tradingPair,
          interval: config.interval,
          mode: config.mode,
          risk_settings: config.riskSettings,
          initial_capital: config.initialCapital,
          enabled: config.enabled,
          created_at: config.createdAt.toISOString(),
          updated_at: config.updatedAt.toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create bot: ${error.message}`);
    }

    return this.mapToBotConfig(data);
  }

  /**
   * Get bot configuration by ID
   */
  async getBot(id: string): Promise<BotConfig | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.from('bot_configs').select('*').eq('id', id).single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get bot: ${error.message}`);
    }
    if (!data) return null;

    return this.mapToBotConfig(data);
  }

  /**
   * Get all bot configurations
   */
  async getAllBots(): Promise<BotConfig[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('bot_configs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get bots: ${error.message}`);
    }

    return data.map(this.mapToBotConfig);
  }

  /**
   * Get enabled bots
   */
  async getEnabledBots(): Promise<BotConfig[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('bot_configs')
      .select('*')
      .eq('enabled', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get enabled bots: ${error.message}`);
    }

    return data.map(this.mapToBotConfig);
  }

  /**
   * Update bot configuration
   */
  async updateBot(id: string, updates: Partial<BotConfig>): Promise<BotConfig> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.strategyParams !== undefined) updateData.strategy_params = updates.strategyParams;
    if (updates.riskSettings !== undefined) updateData.risk_settings = updates.riskSettings;
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
    if (updates.mode !== undefined) updateData.mode = updates.mode;

    const { data, error } = await supabase
      .from('bot_configs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update bot: ${error.message}`);
    }

    return this.mapToBotConfig(data);
  }

  /**
   * Delete bot configuration
   */
  async deleteBot(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase.from('bot_configs').delete().eq('id', id);

    if (error) {
      throw new Error(`Failed to delete bot: ${error.message}`);
    }
  }

  /**
   * Save bot state
   */
  async saveState(state: BotState): Promise<void> {
    const supabase = getSupabaseClient();

    const stateData = {
      bot_id: state.botId,
      status: state.status,
      portfolio_value: state.portfolioValue,
      initial_capital: state.initialCapital,
      realized_pnl: state.realizedPnL,
      unrealized_pnl: state.unrealizedPnL,
      total_pnl: state.totalPnL,
      trade_count: state.tradeCount,
      win_count: state.winCount,
      loss_count: state.lossCount,
      position_quantity: state.positionQuantity,
      position_average_price: state.positionAveragePrice,
      last_signal_time: state.lastSignalTime?.toISOString() || null,
      last_trade_time: state.lastTradeTime?.toISOString() || null,
      last_error: state.lastError || null,
      started_at: state.startedAt?.toISOString() || null,
      total_runtime_ms: state.totalRuntimeMs,
      daily_pnl: state.dailyPnL,
      daily_pnl_reset_at: state.dailyPnLResetAt?.toISOString() || null,
    };

    const { error } = await supabase.from('bot_states').upsert([stateData]);

    if (error) {
      throw new Error(`Failed to save state: ${error.message}`);
    }
  }

  /**
   * Get bot state
   */
  async getState(botId: string): Promise<BotState | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.from('bot_states').select('*').eq('bot_id', botId).single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get state: ${error.message}`);
    }
    if (!data) return null;

    return this.mapToBotState(data);
  }

  /**
   * Add bot log entry
   */
  async addLog(log: BotLog): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase.from('bot_logs').insert([
      {
        id: log.id,
        bot_id: log.botId,
        timestamp: log.timestamp.toISOString(),
        level: log.level,
        message: log.message,
        data: log.data || null,
      },
    ]);

    if (error) {
      throw new Error(`Failed to add log: ${error.message}`);
    }
  }

  /**
   * Get bot logs
   */
  async getLogs(botId: string, limit: number = 100): Promise<BotLog[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('bot_logs')
      .select('*')
      .eq('bot_id', botId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get logs: ${error.message}`);
    }

    return data.map(this.mapToBotLog);
  }

  /**
   * Save trade record
   */
  async saveTrade(trade: BotTrade): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase.from('bot_trades').insert([
      {
        id: trade.id,
        bot_id: trade.botId,
        strategy_id: trade.strategyId,
        symbol: trade.symbol,
        side: trade.side,
        price: trade.price,
        quantity: trade.quantity,
        total: trade.total,
        fee: trade.fee,
        executed_at: trade.executedAt.toISOString(),
        order_id: trade.orderId,
        is_paper_trade: trade.isPaperTrade,
      },
    ]);

    if (error) {
      throw new Error(`Failed to save trade: ${error.message}`);
    }
  }

  /**
   * Get bot trades
   */
  async getTrades(botId: string, limit: number = 100): Promise<BotTrade[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('bot_trades')
      .select('*')
      .eq('bot_id', botId)
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get trades: ${error.message}`);
    }

    return data.map(this.mapToBotTrade);
  }

  /**
   * Map database row to BotConfig
   */
  private mapToBotConfig(row: BotConfigRow): BotConfig {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      strategy: row.strategy as StrategyType,
      strategyParams: row.strategy_params,
      tradingPair: row.trading_pair,
      interval: row.interval as TimeInterval,
      mode: row.mode as TradingMode,
      riskSettings: row.risk_settings,
      initialCapital: row.initial_capital,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      enabled: row.enabled,
    };
  }

  /**
   * Map database row to BotState
   */
  private mapToBotState(row: BotStateRow): BotState {
    return {
      botId: row.bot_id,
      status: row.status as BotStatus,
      portfolioValue: row.portfolio_value,
      initialCapital: row.initial_capital,
      realizedPnL: row.realized_pnl,
      unrealizedPnL: row.unrealized_pnl,
      totalPnL: row.total_pnl,
      tradeCount: row.trade_count,
      winCount: row.win_count,
      lossCount: row.loss_count,
      positionQuantity: row.position_quantity,
      positionAveragePrice: row.position_average_price,
      lastSignalTime: row.last_signal_time ? new Date(row.last_signal_time) : undefined,
      lastTradeTime: row.last_trade_time ? new Date(row.last_trade_time) : undefined,
      lastError: row.last_error || undefined,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      totalRuntimeMs: row.total_runtime_ms,
      dailyPnL: row.daily_pnl,
      dailyPnLResetAt: row.daily_pnl_reset_at ? new Date(row.daily_pnl_reset_at) : undefined,
    };
  }

  /**
   * Map database row to BotLog
   */
  private mapToBotLog(row: BotLogRow): BotLog {
    return {
      id: row.id,
      botId: row.bot_id,
      timestamp: new Date(row.timestamp),
      level: row.level as 'info' | 'warn' | 'error' | 'debug',
      message: row.message,
      data: row.data || undefined,
    };
  }

  /**
   * Map database row to BotTrade
   */
  private mapToBotTrade(row: BotTradeRow): BotTrade {
    return {
      id: row.id,
      botId: row.bot_id,
      strategyId: row.strategy_id,
      symbol: row.symbol,
      side: row.side as 'buy' | 'sell',
      price: row.price,
      quantity: row.quantity,
      total: row.total,
      fee: row.fee,
      executedAt: new Date(row.executed_at),
      orderId: row.order_id,
      isPaperTrade: row.is_paper_trade,
    };
  }
}
