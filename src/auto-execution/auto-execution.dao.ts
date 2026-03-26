/**
 * Auto Execution DAO
 * Data access layer for automated strategy execution configurations and logs
 */

import { getSupabaseClient, getSupabaseAdminClient } from '../database/client';
import { createLogger } from '../utils/logger';
import {
  AutoExecutionConfig,
  AutoExecutionLog,
  CreateAutoExecutionInput,
  UpdateAutoExecutionInput,
  CreateExecutionLogInput,
  UpdateExecutionLogInput,
  AutoExecutionFilters,
  ExecutionLogFilters,
  DailyExecutionStats,
  RiskControls,
  TradingPairConfig,
  ExecutionWindow,
  AutoExecutionStatus,
  SignalSource,
} from './types';

const log = createLogger('AutoExecutionDAO');

/**
 * Auto Execution DAO Class
 */
export class AutoExecutionDAO {
  /**
   * Create a new auto execution configuration
   */
  async createConfig(input: CreateAutoExecutionInput): Promise<AutoExecutionConfig> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('auto_execution_configs')
      .insert({
        user_id: input.userId,
        status: 'disabled',
        signal_source: input.signalSource,
        strategy_id: input.strategyId || null,
        signal_subscription_id: input.signalSubscriptionId || null,
        copy_trading_id: input.copyTradingId || null,
        execution_mode: input.executionMode || 'immediate',
        default_order_type: input.defaultOrderType || 'market',
        batch_interval_minutes: input.batchIntervalMinutes || 5,
        signal_threshold: input.signalThreshold || 0.7,
        trading_pairs: input.tradingPairs || [],
        execution_windows: input.executionWindows || [],
        risk_controls: input.riskControls || {},
        notify_on_execution: input.notifyOnExecution ?? true,
        notify_on_error: input.notifyOnError ?? true,
        notify_on_risk_event: input.notifyOnRiskEvent ?? true,
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        total_volume: 0,
        total_pnl: 0,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create auto execution config:', error);
      throw new Error('Failed to create auto execution config: ' + error.message);
    }

    return this.mapToConfig(data);
  }

  /**
   * Find config by ID
   */
  async findConfigById(id: string): Promise<AutoExecutionConfig | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('auto_execution_configs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Failed to find auto execution config:', error);
      throw new Error('Failed to find auto execution config: ' + error.message);
    }

    return this.mapToConfig(data);
  }

  /**
   * Find configs by user ID
   */
  async findConfigsByUserId(userId: string, filters?: AutoExecutionFilters): Promise<AutoExecutionConfig[]> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('auto_execution_configs')
      .select('*')
      .eq('user_id', userId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.signalSource) {
      query = query.eq('signal_source', filters.signalSource);
    }
    if (filters?.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }

    query = query.order('created_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      log.error('Failed to find auto execution configs:', error);
      throw new Error('Failed to find auto execution configs: ' + error.message);
    }

    return (data || []).map(this.mapToConfig);
  }

  /**
   * Find all enabled configs (for auto execution service)
   */
  async findAllEnabled(): Promise<AutoExecutionConfig[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('auto_execution_configs')
      .select('*')
      .eq('status', 'enabled');

    if (error) {
      log.error('Failed to find enabled auto execution configs:', error);
      throw new Error('Failed to find enabled auto execution configs: ' + error.message);
    }

    return (data || []).map(this.mapToConfig);
  }

  /**
   * Update config
   */
  async updateConfig(id: string, input: UpdateAutoExecutionInput): Promise<AutoExecutionConfig> {
    const supabase = getSupabaseAdminClient();

    const updateData: Record<string, unknown> = { updated_at: new Date() };

    if (input.status !== undefined) updateData.status = input.status;
    if (input.executionMode !== undefined) updateData.execution_mode = input.executionMode;
    if (input.defaultOrderType !== undefined) updateData.default_order_type = input.defaultOrderType;
    if (input.batchIntervalMinutes !== undefined) updateData.batch_interval_minutes = input.batchIntervalMinutes;
    if (input.signalThreshold !== undefined) updateData.signal_threshold = input.signalThreshold;
    if (input.tradingPairs !== undefined) updateData.trading_pairs = input.tradingPairs;
    if (input.executionWindows !== undefined) updateData.execution_windows = input.executionWindows;
    if (input.riskControls !== undefined) updateData.risk_controls = input.riskControls;
    if (input.notifyOnExecution !== undefined) updateData.notify_on_execution = input.notifyOnExecution;
    if (input.notifyOnError !== undefined) updateData.notify_on_error = input.notifyOnError;
    if (input.notifyOnRiskEvent !== undefined) updateData.notify_on_risk_event = input.notifyOnRiskEvent;

    const { data, error } = await supabase
      .from('auto_execution_configs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      log.error('Failed to update auto execution config:', error);
      throw new Error('Failed to update auto execution config: ' + error.message);
    }

    return this.mapToConfig(data);
  }

  /**
   * Delete config
   */
  async deleteConfig(id: string): Promise<void> {
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('auto_execution_configs')
      .delete()
      .eq('id', id);

    if (error) {
      log.error('Failed to delete auto execution config:', error);
      throw new Error('Failed to delete auto execution config: ' + error.message);
    }
  }

  /**
   * Update execution statistics
   */
  async updateExecutionStats(
    configId: string,
    success: boolean,
    volume: number,
    pnl?: number
  ): Promise<void> {
    const supabase = getSupabaseAdminClient();

    // Get current stats
    const config = await this.findConfigById(configId);
    if (!config) return;

    const { error } = await supabase
      .from('auto_execution_configs')
      .update({
        total_executions: config.totalExecutions + 1,
        successful_executions: config.successfulExecutions + (success ? 1 : 0),
        failed_executions: config.failedExecutions + (success ? 0 : 1),
        total_volume: config.totalVolume + volume,
        total_pnl: config.totalPnl + (pnl || 0),
        last_execution_at: new Date(),
        updated_at: new Date(),
      })
      .eq('id', configId);

    if (error) {
      log.error('Failed to update execution stats:', error);
    }
  }

  /**
   * Set config status
   */
  async setConfigStatus(
    configId: string,
    status: AutoExecutionStatus,
    errorMessage?: string
  ): Promise<void> {
    const supabase = getSupabaseAdminClient();

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date(),
    };

    if (errorMessage) {
      updateData.last_error_at = new Date();
      updateData.last_error_message = errorMessage;
    }

    const { error } = await supabase
      .from('auto_execution_configs')
      .update(updateData)
      .eq('id', configId);

    if (error) {
      log.error('Failed to set config status:', error);
      throw new Error('Failed to set config status: ' + error.message);
    }
  }

  // ============================================
  // Execution Logs
  // ============================================

  /**
   * Create execution log
   */
  async createExecutionLog(input: CreateExecutionLogInput): Promise<AutoExecutionLog> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('auto_execution_logs')
      .insert({
        config_id: input.configId,
        user_id: input.userId,
        signal_id: input.signalId,
        signal_source: input.signalSource,
        signal_side: input.signalSide,
        signal_price: input.signalPrice,
        signal_quantity: input.signalQuantity,
        signal_confidence: input.signalConfidence,
        signal_timestamp: input.signalTimestamp,
        execution_status: 'pending',
        risk_check_passed: false,
        risk_check_reasons: [],
        metadata: {},
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create execution log:', error);
      throw new Error('Failed to create execution log: ' + error.message);
    }

    return this.mapToLog(data);
  }

  /**
   * Find execution log by ID
   */
  async findExecutionLogById(id: string): Promise<AutoExecutionLog | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('auto_execution_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Failed to find execution log:', error);
      throw new Error('Failed to find execution log: ' + error.message);
    }

    return this.mapToLog(data);
  }

  /**
   * Find execution logs by config ID
   */
  async findExecutionLogsByConfigId(
    configId: string,
    filters?: ExecutionLogFilters
  ): Promise<AutoExecutionLog[]> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('auto_execution_logs')
      .select('*')
      .eq('config_id', configId);

    if (filters?.executionStatus) {
      query = query.eq('execution_status', filters.executionStatus);
    }
    if (filters?.signalSource) {
      query = query.eq('signal_source', filters.signalSource);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    query = query.order('created_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      log.error('Failed to find execution logs:', error);
      throw new Error('Failed to find execution logs: ' + error.message);
    }

    return (data || []).map(this.mapToLog);
  }

  /**
   * Find execution logs by user ID
   */
  async findExecutionLogsByUserId(
    userId: string,
    filters?: ExecutionLogFilters
  ): Promise<AutoExecutionLog[]> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('auto_execution_logs')
      .select('*')
      .eq('user_id', userId);

    if (filters?.configId) {
      query = query.eq('config_id', filters.configId);
    }
    if (filters?.executionStatus) {
      query = query.eq('execution_status', filters.executionStatus);
    }
    if (filters?.signalSource) {
      query = query.eq('signal_source', filters.signalSource);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    query = query.order('created_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      log.error('Failed to find execution logs:', error);
      throw new Error('Failed to find execution logs: ' + error.message);
    }

    return (data || []).map(this.mapToLog);
  }

  /**
   * Update execution log
   */
  async updateExecutionLog(id: string, input: UpdateExecutionLogInput): Promise<AutoExecutionLog> {
    const supabase = getSupabaseAdminClient();

    const updateData: Record<string, unknown> = {};

    if (input.executionStatus !== undefined) updateData.execution_status = input.executionStatus;
    if (input.orderType !== undefined) updateData.order_type = input.orderType;
    if (input.executedPrice !== undefined) updateData.executed_price = input.executedPrice;
    if (input.executedQuantity !== undefined) updateData.executed_quantity = input.executedQuantity;
    if (input.orderId !== undefined) updateData.order_id = input.orderId;
    if (input.tradeId !== undefined) updateData.trade_id = input.tradeId;
    if (input.riskCheckPassed !== undefined) updateData.risk_check_passed = input.riskCheckPassed;
    if (input.riskCheckReasons !== undefined) updateData.risk_check_reasons = input.riskCheckReasons;
    if (input.executedAt !== undefined) updateData.executed_at = input.executedAt;
    if (input.completedAt !== undefined) updateData.completed_at = input.completedAt;
    if (input.executionDurationMs !== undefined) updateData.execution_duration_ms = input.executionDurationMs;
    if (input.feeAmount !== undefined) updateData.fee_amount = input.feeAmount;
    if (input.feeCurrency !== undefined) updateData.fee_currency = input.feeCurrency;
    if (input.pnl !== undefined) updateData.pnl = input.pnl;
    if (input.pnlPercent !== undefined) updateData.pnl_percent = input.pnlPercent;
    if (input.errorMessage !== undefined) updateData.error_message = input.errorMessage;
    if (input.errorCode !== undefined) updateData.error_code = input.errorCode;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    const { data, error } = await supabase
      .from('auto_execution_logs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      log.error('Failed to update execution log:', error);
      throw new Error('Failed to update execution log: ' + error.message);
    }

    return this.mapToLog(data);
  }

  /**
   * Get daily execution stats
   */
  async getDailyExecutionStats(configId: string, date: Date): Promise<DailyExecutionStats | null> {
    const supabase = getSupabaseClient();

    const dateStr = date.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('auto_execution_daily_stats')
      .select('*')
      .eq('config_id', configId)
      .eq('date', dateStr)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Failed to get daily execution stats:', error);
      throw new Error('Failed to get daily execution stats: ' + error.message);
    }

    return this.mapToDailyStats(data);
  }

  /**
   * Get execution count for today
   */
  async getTodayExecutionCount(configId: string): Promise<number> {
    const supabase = getSupabaseClient();

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const { count, error } = await supabase
      .from('auto_execution_logs')
      .select('id', { count: 'exact', head: true })
      .eq('config_id', configId)
      .gte('created_at', today)
      .lt('created_at', tomorrow);

    if (error) {
      log.error('Failed to get today execution count:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Get hourly execution count
   */
  async getHourlyExecutionCount(configId: string): Promise<number> {
    const supabase = getSupabaseClient();

    const oneHourAgo = new Date(Date.now() - 3600000);

    const { count, error } = await supabase
      .from('auto_execution_logs')
      .select('id', { count: 'exact', head: true })
      .eq('config_id', configId)
      .gte('created_at', oneHourAgo.toISOString());

    if (error) {
      log.error('Failed to get hourly execution count:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Get today's volume
   */
  async getTodayVolume(configId: string): Promise<number> {
    const supabase = getSupabaseClient();

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('auto_execution_logs')
      .select('executed_price, executed_quantity')
      .eq('config_id', configId)
      .eq('execution_status', 'filled')
      .gte('created_at', today)
      .lt('created_at', tomorrow);

    if (error) {
      log.error('Failed to get today volume:', error);
      return 0;
    }

    return (data || []).reduce((sum, log) => {
      return sum + (log.executed_price || 0) * (log.executed_quantity || 0);
    }, 0);
  }

  /**
   * Get consecutive loss count
   */
  async getConsecutiveLossCount(configId: string): Promise<number> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('auto_execution_logs')
      .select('pnl')
      .eq('config_id', configId)
      .eq('execution_status', 'filled')
      .not('pnl', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      log.error('Failed to get consecutive loss count:', error);
      return 0;
    }

    let count = 0;
    for (const log of data || []) {
      if ((log.pnl as number) < 0) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }

  /**
   * Get last trade time
   */
  async getLastTradeTime(configId: string): Promise<Date | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('auto_execution_logs')
      .select('executed_at')
      .eq('config_id', configId)
      .eq('execution_status', 'filled')
      .not('executed_at', 'is', null)
      .order('executed_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return null;
    }

    return data?.executed_at ? new Date(data.executed_at as string) : null;
  }

  // ============================================
  // Mapping Methods
  // ============================================

  private mapToConfig(data: Record<string, unknown>): AutoExecutionConfig {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      status: data.status as AutoExecutionStatus,
      signalSource: data.signal_source as SignalSource,
      strategyId: data.strategy_id as string | undefined,
      signalSubscriptionId: data.signal_subscription_id as string | undefined,
      copyTradingId: data.copy_trading_id as string | undefined,
      executionMode: data.execution_mode as 'immediate' | 'batch' | 'threshold',
      defaultOrderType: data.default_order_type as 'market' | 'limit' | 'smart',
      batchIntervalMinutes: data.batch_interval_minutes as number,
      signalThreshold: data.signal_threshold as number,
      tradingPairs: (data.trading_pairs as TradingPairConfig[]) || [],
      executionWindows: (data.execution_windows as ExecutionWindow[]) || [],
      riskControls: this.mapToRiskControls(data.risk_controls as Record<string, unknown>),
      notifyOnExecution: data.notify_on_execution as boolean,
      notifyOnError: data.notify_on_error as boolean,
      notifyOnRiskEvent: data.notify_on_risk_event as boolean,
      totalExecutions: (data.total_executions as number) || 0,
      successfulExecutions: (data.successful_executions as number) || 0,
      failedExecutions: (data.failed_executions as number) || 0,
      totalVolume: (data.total_volume as number) || 0,
      totalPnl: (data.total_pnl as number) || 0,
      lastExecutionAt: data.last_execution_at ? new Date(data.last_execution_at as string) : undefined,
      lastErrorAt: data.last_error_at ? new Date(data.last_error_at as string) : undefined,
      lastErrorMessage: data.last_error_message as string | undefined,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  private mapToRiskControls(data?: Record<string, unknown>): RiskControls {
    if (!data) {
      return {
        maxPositionSize: 1000,
        maxPositionPercent: 5,
        maxTotalExposure: 50,
        stopLossPercent: 5,
        takeProfitPercent: 10,
        maxDailyTrades: 20,
        maxDailyVolume: 10000,
        maxHourlyTrades: 5,
        minTradeInterval: 60,
        lossCooldownMinutes: 30,
        maxDrawdownPercent: 10,
        circuitBreakerEnabled: true,
        circuitBreakerThreshold: 3,
      };
    }

    return {
      maxPositionSize: (data.max_position_size as number) || 1000,
      maxPositionPercent: (data.max_position_percent as number) || 5,
      maxTotalExposure: (data.max_total_exposure as number) || 50,
      stopLossPercent: (data.stop_loss_percent as number) || 5,
      takeProfitPercent: (data.take_profit_percent as number) || 10,
      maxDailyTrades: (data.max_daily_trades as number) || 20,
      maxDailyVolume: (data.max_daily_volume as number) || 10000,
      maxHourlyTrades: (data.max_hourly_trades as number) || 5,
      minTradeInterval: (data.min_trade_interval as number) || 60,
      lossCooldownMinutes: (data.loss_cooldown_minutes as number) || 30,
      maxDrawdownPercent: (data.max_drawdown_percent as number) || 10,
      circuitBreakerEnabled: (data.circuit_breaker_enabled as boolean) ?? true,
      circuitBreakerThreshold: (data.circuit_breaker_threshold as number) || 3,
    };
  }

  private mapToLog(data: Record<string, unknown>): AutoExecutionLog {
    return {
      id: data.id as string,
      configId: data.config_id as string,
      userId: data.user_id as string,
      signalId: data.signal_id as string,
      signalSource: data.signal_source as SignalSource,
      signalSide: data.signal_side as 'buy' | 'sell',
      signalPrice: data.signal_price as number,
      signalQuantity: data.signal_quantity as number,
      signalConfidence: data.signal_confidence as number,
      signalTimestamp: new Date(data.signal_timestamp as string),
      executionStatus: data.execution_status as 'pending' | 'executing' | 'filled' | 'failed' | 'skipped' | 'rejected',
      orderType: data.order_type as 'market' | 'limit' | 'smart' | undefined,
      executedPrice: data.executed_price as number | undefined,
      executedQuantity: data.executed_quantity as number | undefined,
      orderId: data.order_id as string | undefined,
      tradeId: data.trade_id as string | undefined,
      riskCheckPassed: data.risk_check_passed as boolean,
      riskCheckReasons: (data.risk_check_reasons as string[]) || [],
      receivedAt: new Date(data.created_at as string),
      executedAt: data.executed_at ? new Date(data.executed_at as string) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at as string) : undefined,
      executionDurationMs: data.execution_duration_ms as number | undefined,
      feeAmount: data.fee_amount as number | undefined,
      feeCurrency: data.fee_currency as string | undefined,
      pnl: data.pnl as number | undefined,
      pnlPercent: data.pnl_percent as number | undefined,
      errorMessage: data.error_message as string | undefined,
      errorCode: data.error_code as string | undefined,
      metadata: (data.metadata as Record<string, unknown>) || {},
      createdAt: new Date(data.created_at as string),
    };
  }

  private mapToDailyStats(data: Record<string, unknown>): DailyExecutionStats {
    return {
      date: new Date(data.date as string),
      configId: data.config_id as string,
      userId: data.user_id as string,
      totalSignals: (data.total_signals as number) || 0,
      executedSignals: (data.executed_signals as number) || 0,
      skippedSignals: (data.skipped_signals as number) || 0,
      failedSignals: (data.failed_signals as number) || 0,
      totalVolume: (data.total_volume as number) || 0,
      totalFees: (data.total_fees as number) || 0,
      realizedPnl: (data.realized_pnl as number) || 0,
      tradesCount: (data.trades_count as number) || 0,
      winRate: (data.win_rate as number) || 0,
      avgExecutionTime: (data.avg_execution_time as number) || 0,
    };
  }
}

// Export singleton instance
export const autoExecutionDAO = new AutoExecutionDAO();