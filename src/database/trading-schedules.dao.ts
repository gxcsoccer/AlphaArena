/**
 * Trading Scheduler DAO
 * Data access layer for automated trading schedules
 */

import { getSupabaseClient } from './client';

// Type definitions
export type ScheduleType = 'cron' | 'interval' | 'condition';
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';
export type TriggerType = 'scheduled' | 'manual' | 'condition';
export type ConditionType = 'price_above' | 'price_below' | 'volatility_above' | 'volatility_below' | 'volume_above';

export interface TradingSchedule {
  id: string;
  userId: string;
  strategyId?: string;
  name: string;
  description?: string;
  cronExpression: string;
  timezone: string;
  scheduleType: ScheduleType;
  intervalMinutes?: number;
  conditionType?: ConditionType;
  conditionParams: Record<string, unknown>;
  params: Record<string, unknown>;
  enabled: boolean;
  lastExecutionAt?: Date;
  lastExecutionResult?: 'success' | 'failed' | 'skipped';
  lastExecutionMessage?: string;
  nextExecutionAt?: Date;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduleInput {
  userId: string;
  strategyId?: string;
  name: string;
  description?: string;
  cronExpression: string;
  timezone?: string;
  scheduleType?: ScheduleType;
  intervalMinutes?: number;
  conditionType?: ConditionType;
  conditionParams?: Record<string, unknown>;
  params: Record<string, unknown>;
  enabled?: boolean;
}

export interface UpdateScheduleInput {
  name?: string;
  description?: string;
  cronExpression?: string;
  timezone?: string;
  scheduleType?: ScheduleType;
  intervalMinutes?: number;
  conditionType?: ConditionType;
  conditionParams?: Record<string, unknown>;
  params?: Record<string, unknown>;
  enabled?: boolean;
  lastExecutionAt?: Date;
  lastExecutionResult?: 'success' | 'failed' | 'skipped';
  lastExecutionMessage?: string;
  nextExecutionAt?: Date;
}

export interface ScheduleFilters {
  userId?: string;
  strategyId?: string;
  enabled?: boolean;
  scheduleType?: ScheduleType;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'updated_at' | 'next_execution_at' | 'name';
  orderDirection?: 'asc' | 'desc';
}

export interface ScheduleExecution {
  id: string;
  scheduleId: string;
  scheduledAt: Date;
  startedAt: Date;
  completedAt?: Date;
  status: ExecutionStatus;
  triggerType: TriggerType;
  result: Record<string, unknown>;
  errorMessage?: string;
  errorStack?: string;
  tradesExecuted: number;
  totalValue?: number;
  createdAt: Date;
}

export interface CreateExecutionInput {
  scheduleId: string;
  scheduledAt: Date;
  startedAt: Date;
  triggerType?: TriggerType;
}

export interface UpdateExecutionInput {
  completedAt?: Date;
  status?: ExecutionStatus;
  result?: Record<string, unknown>;
  errorMessage?: string;
  errorStack?: string;
  tradesExecuted?: number;
  totalValue?: number;
}

export interface ExecutionFilters {
  scheduleId?: string;
  status?: ExecutionStatus;
  triggerType?: TriggerType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  orderBy?: 'scheduled_at' | 'created_at' | 'started_at';
  orderDirection?: 'asc' | 'desc';
}

export interface ScheduleSafetyConfig {
  scheduleId: string;
  maxPositionSize?: number;
  maxPositionPercent?: number;
  maxDailyTrades: number;
  maxDailyValue?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  minBalanceRequired?: number;
  minMarginAvailable?: number;
  maxConsecutiveFailures: number;
  cooldownAfterFailureMinutes: number;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  consecutiveFailures: number;
  lastFailureAt?: Date;
  isPaused: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSafetyConfigInput {
  scheduleId: string;
  maxPositionSize?: number;
  maxPositionPercent?: number;
  maxDailyTrades?: number;
  maxDailyValue?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  minBalanceRequired?: number;
  minMarginAvailable?: number;
  maxConsecutiveFailures?: number;
  cooldownAfterFailureMinutes?: number;
  notifyOnSuccess?: boolean;
  notifyOnFailure?: boolean;
}

export interface UpdateSafetyConfigInput {
  maxPositionSize?: number;
  maxPositionPercent?: number;
  maxDailyTrades?: number;
  maxDailyValue?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  minBalanceRequired?: number;
  minMarginAvailable?: number;
  maxConsecutiveFailures?: number;
  cooldownAfterFailureMinutes?: number;
  notifyOnSuccess?: boolean;
  notifyOnFailure?: boolean;
  consecutiveFailures?: number;
  lastFailureAt?: Date;
  isPaused?: boolean;
}

export class TradingSchedulesDAO {
  async create(input: CreateScheduleInput): Promise<TradingSchedule> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('trading_schedules')
      .insert({
        user_id: input.userId,
        strategy_id: input.strategyId || null,
        name: input.name,
        description: input.description || null,
        cron_expression: input.cronExpression,
        timezone: input.timezone || 'UTC',
        schedule_type: input.scheduleType || 'cron',
        interval_minutes: input.intervalMinutes || null,
        condition_type: input.conditionType || null,
        condition_params: input.conditionParams || {},
        params: input.params,
        enabled: input.enabled ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create trading schedule: ' + error.message);
    }

    return this.mapToSchedule(data);
  }

  async findById(id: string): Promise<TradingSchedule | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('trading_schedules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error('Failed to find trading schedule: ' + error.message);
    }

    return this.mapToSchedule(data);
  }

  async findByUserId(userId: string, filters?: ScheduleFilters): Promise<TradingSchedule[]> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('trading_schedules')
      .select('*')
      .eq('user_id', userId);

    if (filters?.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }
    if (filters?.enabled !== undefined) {
      query = query.eq('enabled', filters.enabled);
    }
    if (filters?.scheduleType) {
      query = query.eq('schedule_type', filters.scheduleType);
    }

    const orderBy = filters?.orderBy || 'created_at';
    const orderDirection = filters?.orderDirection || 'desc';
    query = query.order(orderBy, { ascending: orderDirection === 'asc' });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error('Failed to find trading schedules: ' + error.message);
    }

    return data.map(this.mapToSchedule);
  }

  async findDueSchedules(beforeTime: Date): Promise<TradingSchedule[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('trading_schedules')
      .select('*')
      .eq('enabled', true)
      .lte('next_execution_at', beforeTime.toISOString())
      .order('next_execution_at', { ascending: true });

    if (error) {
      throw new Error('Failed to find due schedules: ' + error.message);
    }

    return data.map(this.mapToSchedule);
  }

  async update(id: string, input: UpdateScheduleInput): Promise<TradingSchedule> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.cronExpression !== undefined) updateData.cron_expression = input.cronExpression;
    if (input.timezone !== undefined) updateData.timezone = input.timezone;
    if (input.scheduleType !== undefined) updateData.schedule_type = input.scheduleType;
    if (input.intervalMinutes !== undefined) updateData.interval_minutes = input.intervalMinutes;
    if (input.conditionType !== undefined) updateData.condition_type = input.conditionType;
    if (input.conditionParams !== undefined) updateData.condition_params = input.conditionParams;
    if (input.params !== undefined) updateData.params = input.params;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;
    if (input.lastExecutionAt !== undefined) updateData.last_execution_at = input.lastExecutionAt;
    if (input.lastExecutionResult !== undefined) updateData.last_execution_result = input.lastExecutionResult;
    if (input.lastExecutionMessage !== undefined) updateData.last_execution_message = input.lastExecutionMessage;
    if (input.nextExecutionAt !== undefined) updateData.next_execution_at = input.nextExecutionAt;

    const { data, error } = await supabase
      .from('trading_schedules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update trading schedule: ' + error.message);
    }

    return this.mapToSchedule(data);
  }

  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('trading_schedules')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error('Failed to delete trading schedule: ' + error.message);
    }
  }

  async updateExecutionStats(id: string, success: boolean): Promise<void> {
    const schedule = await this.findById(id);
    if (schedule) {
      await this.update(id, {
        lastExecutionAt: new Date(),
        lastExecutionResult: success ? 'success' : 'failed',
      });
    }
  }

  async createExecution(input: CreateExecutionInput): Promise<ScheduleExecution> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('schedule_executions')
      .insert({
        schedule_id: input.scheduleId,
        scheduled_at: input.scheduledAt,
        started_at: input.startedAt,
        trigger_type: input.triggerType || 'scheduled',
        status: 'running',
        result: {},
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create schedule execution: ' + error.message);
    }

    return this.mapToExecution(data);
  }

  async findExecutionById(id: string): Promise<ScheduleExecution | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('schedule_executions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error('Failed to find schedule execution: ' + error.message);
    }

    return this.mapToExecution(data);
  }

  async findExecutionsByScheduleId(
    scheduleId: string,
    filters?: ExecutionFilters
  ): Promise<ScheduleExecution[]> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('schedule_executions')
      .select('*')
      .eq('schedule_id', scheduleId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.triggerType) {
      query = query.eq('trigger_type', filters.triggerType);
    }
    if (filters?.startDate) {
      query = query.gte('scheduled_at', filters.startDate.toISOString());
    }
    if (filters?.endDate) {
      query = query.lte('scheduled_at', filters.endDate.toISOString());
    }

    const orderBy = filters?.orderBy || 'scheduled_at';
    const orderDirection = filters?.orderDirection || 'desc';
    query = query.order(orderBy, { ascending: orderDirection === 'asc' });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error('Failed to find schedule executions: ' + error.message);
    }

    return data.map(this.mapToExecution);
  }

  async updateExecution(id: string, input: UpdateExecutionInput): Promise<ScheduleExecution> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {};

    if (input.completedAt !== undefined) updateData.completed_at = input.completedAt;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.result !== undefined) updateData.result = input.result;
    if (input.errorMessage !== undefined) updateData.error_message = input.errorMessage;
    if (input.errorStack !== undefined) updateData.error_stack = input.errorStack;
    if (input.tradesExecuted !== undefined) updateData.trades_executed = input.tradesExecuted;
    if (input.totalValue !== undefined) updateData.total_value = input.totalValue;

    const { data, error } = await supabase
      .from('schedule_executions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update schedule execution: ' + error.message);
    }

    return this.mapToExecution(data);
  }

  async countExecutionsByScheduleId(scheduleId: string, status?: ExecutionStatus): Promise<number> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('schedule_executions')
      .select('id', { count: 'exact', head: true })
      .eq('schedule_id', scheduleId);

    if (status) {
      query = query.eq('status', status);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error('Failed to count executions: ' + error.message);
    }

    return count || 0;
  }

  async createSafetyConfig(input: CreateSafetyConfigInput): Promise<ScheduleSafetyConfig> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('schedule_safety_configs')
      .insert({
        schedule_id: input.scheduleId,
        max_position_size: input.maxPositionSize || null,
        max_position_percent: input.maxPositionPercent || null,
        max_daily_trades: input.maxDailyTrades ?? 10,
        max_daily_value: input.maxDailyValue || null,
        stop_loss_percent: input.stopLossPercent || null,
        take_profit_percent: input.takeProfitPercent || null,
        min_balance_required: input.minBalanceRequired || null,
        min_margin_available: input.minMarginAvailable || null,
        max_consecutive_failures: input.maxConsecutiveFailures ?? 3,
        cooldown_after_failure_minutes: input.cooldownAfterFailureMinutes ?? 30,
        notify_on_success: input.notifyOnSuccess ?? false,
        notify_on_failure: input.notifyOnFailure ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create safety config: ' + error.message);
    }

    return this.mapToSafetyConfig(data);
  }

  async findSafetyConfigByScheduleId(scheduleId: string): Promise<ScheduleSafetyConfig | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('schedule_safety_configs')
      .select('*')
      .eq('schedule_id', scheduleId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error('Failed to find safety config: ' + error.message);
    }

    return this.mapToSafetyConfig(data);
  }

  async updateSafetyConfig(scheduleId: string, input: UpdateSafetyConfigInput): Promise<ScheduleSafetyConfig> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {};

    if (input.maxPositionSize !== undefined) updateData.max_position_size = input.maxPositionSize;
    if (input.maxPositionPercent !== undefined) updateData.max_position_percent = input.maxPositionPercent;
    if (input.maxDailyTrades !== undefined) updateData.max_daily_trades = input.maxDailyTrades;
    if (input.maxDailyValue !== undefined) updateData.max_daily_value = input.maxDailyValue;
    if (input.stopLossPercent !== undefined) updateData.stop_loss_percent = input.stopLossPercent;
    if (input.takeProfitPercent !== undefined) updateData.take_profit_percent = input.takeProfitPercent;
    if (input.minBalanceRequired !== undefined) updateData.min_balance_required = input.minBalanceRequired;
    if (input.minMarginAvailable !== undefined) updateData.min_margin_available = input.minMarginAvailable;
    if (input.maxConsecutiveFailures !== undefined) updateData.max_consecutive_failures = input.maxConsecutiveFailures;
    if (input.cooldownAfterFailureMinutes !== undefined) updateData.cooldown_after_failure_minutes = input.cooldownAfterFailureMinutes;
    if (input.notifyOnSuccess !== undefined) updateData.notify_on_success = input.notifyOnSuccess;
    if (input.notifyOnFailure !== undefined) updateData.notify_on_failure = input.notifyOnFailure;
    if (input.consecutiveFailures !== undefined) updateData.consecutive_failures = input.consecutiveFailures;
    if (input.lastFailureAt !== undefined) updateData.last_failure_at = input.lastFailureAt;
    if (input.isPaused !== undefined) updateData.is_paused = input.isPaused;

    const { data, error } = await supabase
      .from('schedule_safety_configs')
      .update(updateData)
      .eq('schedule_id', scheduleId)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update safety config: ' + error.message);
    }

    return this.mapToSafetyConfig(data);
  }

  private mapToSchedule(data: Record<string, unknown>): TradingSchedule {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      strategyId: data.strategy_id as string | undefined,
      name: data.name as string,
      description: data.description as string | undefined,
      cronExpression: data.cron_expression as string,
      timezone: data.timezone as string,
      scheduleType: data.schedule_type as ScheduleType,
      intervalMinutes: data.interval_minutes as number | undefined,
      conditionType: data.condition_type as ConditionType | undefined,
      conditionParams: (data.condition_params as Record<string, unknown>) || {},
      params: (data.params as Record<string, unknown>) || {},
      enabled: data.enabled as boolean,
      lastExecutionAt: data.last_execution_at ? new Date(data.last_execution_at as string) : undefined,
      lastExecutionResult: data.last_execution_result as 'success' | 'failed' | 'skipped' | undefined,
      lastExecutionMessage: data.last_execution_message as string | undefined,
      nextExecutionAt: data.next_execution_at ? new Date(data.next_execution_at as string) : undefined,
      totalExecutions: (data.total_executions as number) || 0,
      successfulExecutions: (data.successful_executions as number) || 0,
      failedExecutions: (data.failed_executions as number) || 0,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  private mapToExecution(data: Record<string, unknown>): ScheduleExecution {
    return {
      id: data.id as string,
      scheduleId: data.schedule_id as string,
      scheduledAt: new Date(data.scheduled_at as string),
      startedAt: new Date(data.started_at as string),
      completedAt: data.completed_at ? new Date(data.completed_at as string) : undefined,
      status: data.status as ExecutionStatus,
      triggerType: data.trigger_type as TriggerType,
      result: (data.result as Record<string, unknown>) || {},
      errorMessage: data.error_message as string | undefined,
      errorStack: data.error_stack as string | undefined,
      tradesExecuted: (data.trades_executed as number) || 0,
      totalValue: data.total_value as number | undefined,
      createdAt: new Date(data.created_at as string),
    };
  }

  private mapToSafetyConfig(data: Record<string, unknown>): ScheduleSafetyConfig {
    return {
      scheduleId: data.schedule_id as string,
      maxPositionSize: data.max_position_size as number | undefined,
      maxPositionPercent: data.max_position_percent as number | undefined,
      maxDailyTrades: (data.max_daily_trades as number) || 10,
      maxDailyValue: data.max_daily_value as number | undefined,
      stopLossPercent: data.stop_loss_percent as number | undefined,
      takeProfitPercent: data.take_profit_percent as number | undefined,
      minBalanceRequired: data.min_balance_required as number | undefined,
      minMarginAvailable: data.min_margin_available as number | undefined,
      maxConsecutiveFailures: (data.max_consecutive_failures as number) || 3,
      cooldownAfterFailureMinutes: (data.cooldown_after_failure_minutes as number) || 30,
      notifyOnSuccess: (data.notify_on_success as boolean) ?? false,
      notifyOnFailure: (data.notify_on_failure as boolean) ?? true,
      consecutiveFailures: (data.consecutive_failures as number) || 0,
      lastFailureAt: data.last_failure_at ? new Date(data.last_failure_at as string) : undefined,
      isPaused: (data.is_paused as boolean) || false,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }
}

export const tradingSchedulesDAO = new TradingSchedulesDAO();
