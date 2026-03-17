/**
 * Risk Monitor Data Access Object
 * 
 * Handles database operations for risk alerts, risk history, 
 * position risks, and correlation matrix.
 */

import { getSupabaseClient, type Database } from './client';

// Types
export type RiskMetric = 
  | 'var95' 
  | 'var99' 
  | 'maxDrawdown' 
  | 'sharpeRatio' 
  | 'volatility' 
  | 'beta' 
  | 'concentrationRisk' 
  | 'liquidityRisk';

export type AlertOperator = 'gt' | 'lt' | 'gte' | 'lte';
export type AlertChannel = 'ui' | 'email' | 'webhook';
export type RiskPeriodType = 'snapshot' | 'daily' | 'weekly';

export interface RiskAlert {
  id: string;
  userId: string;
  metric: RiskMetric;
  threshold: number;
  operator: AlertOperator;
  channels: AlertChannel[];
  enabled: boolean;
  lastTriggeredAt?: Date;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRiskAlertInput {
  userId: string;
  metric: RiskMetric;
  threshold: number;
  operator: AlertOperator;
  channels?: AlertChannel[];
  enabled?: boolean;
}

export interface UpdateRiskAlertInput {
  metric?: RiskMetric;
  threshold?: number;
  operator?: AlertOperator;
  channels?: AlertChannel[];
  enabled?: boolean;
}

export interface RiskAlertHistoryEntry {
  id: string;
  alertId: string;
  userId: string;
  metric: RiskMetric;
  threshold: number;
  actualValue: number;
  operator: AlertOperator;
  channels: AlertChannel[];
  notificationSent: boolean;
  notificationError?: string;
  triggeredAt: Date;
}

export interface RiskHistoryEntry {
  id: string;
  userId: string;
  recordedAt: Date;
  periodType: RiskPeriodType;
  var95?: number;
  var99?: number;
  maxDrawdown?: number;
  currentDrawdown?: number;
  sharpeRatio?: number;
  volatility?: number;
  beta?: number;
  concentrationRisk?: number;
  liquidityRisk?: number;
  sortinoRatio?: number;
  expectedShortfall95?: number;
  expectedShortfall99?: number;
  calmarRatio?: number;
  treynorRatio?: number;
  informationRatio?: number;
  trackingError?: number;
  portfolioValue?: number;
  positionCount?: number;
}

export interface CreateRiskHistoryInput {
  userId: string;
  periodType?: RiskPeriodType;
  var95?: number;
  var99?: number;
  maxDrawdown?: number;
  currentDrawdown?: number;
  sharpeRatio?: number;
  volatility?: number;
  beta?: number;
  concentrationRisk?: number;
  liquidityRisk?: number;
  sortinoRatio?: number;
  expectedShortfall95?: number;
  expectedShortfall99?: number;
  calmarRatio?: number;
  treynorRatio?: number;
  informationRatio?: number;
  trackingError?: number;
  portfolioValue?: number;
  positionCount?: number;
}

export interface PositionRisk {
  id: string;
  userId: string;
  riskHistoryId?: string;
  symbol: string;
  weight: number;
  contributionToRisk: number;
  varContribution: number;
  betaToPortfolio?: number;
  liquidityScore?: number;
  concentrationRisk?: number;
  recordedAt: Date;
}

export interface CreatePositionRiskInput {
  userId: string;
  riskHistoryId?: string;
  symbol: string;
  weight: number;
  contributionToRisk: number;
  varContribution: number;
  betaToPortfolio?: number;
  liquidityScore?: number;
  concentrationRisk?: number;
}

export interface CorrelationEntry {
  id: string;
  userId: string;
  symbol1: string;
  symbol2: string;
  correlation: number;
  periodDays: number;
  calculatedAt: Date;
}

export interface CreateCorrelationInput {
  userId: string;
  symbol1: string;
  symbol2: string;
  correlation: number;
  periodDays?: number;
}

export interface RiskHistoryFilters {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  periodType?: RiskPeriodType;
  limit?: number;
  offset?: number;
}

export interface RiskAlertFilters {
  userId: string;
  enabled?: boolean;
  metric?: RiskMetric;
  limit?: number;
  offset?: number;
}

/**
 * Risk Monitor DAO
 */
export class RiskMonitorDAO {
  private supabase = getSupabaseClient();

  // ============= Risk Alerts =============

  /**
   * Create a new risk alert
   */
  async createAlert(input: CreateRiskAlertInput): Promise<RiskAlert> {
    const { data, error } = await this.supabase
      .from('risk_alerts')
      .insert({
        user_id: input.userId,
        metric: input.metric,
        threshold: input.threshold,
        operator: input.operator,
        channels: input.channels || ['ui'],
        enabled: input.enabled ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create risk alert: ${error.message}`);
    }

    return this.mapAlertFromDb(data);
  }

  /**
   * Get alert by ID
   */
  async getAlertById(id: string, userId: string): Promise<RiskAlert | null> {
    const { data, error } = await this.supabase
      .from('risk_alerts')
      .select()
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get risk alert: ${error.message}`);
    }

    return this.mapAlertFromDb(data);
  }

  /**
   * List alerts for a user
   */
  async listAlerts(filters: RiskAlertFilters): Promise<RiskAlert[]> {
    let query = this.supabase
      .from('risk_alerts')
      .select()
      .eq('user_id', filters.userId);

    if (filters.enabled !== undefined) {
      query = query.eq('enabled', filters.enabled);
    }

    if (filters.metric) {
      query = query.eq('metric', filters.metric);
    }

    query = query.order('created_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list risk alerts: ${error.message}`);
    }

    return data.map(this.mapAlertFromDb);
  }

  /**
   * Update an alert
   */
  async updateAlert(id: string, userId: string, input: UpdateRiskAlertInput): Promise<RiskAlert> {
    const updateData: Record<string, unknown> = {};

    if (input.metric !== undefined) updateData.metric = input.metric;
    if (input.threshold !== undefined) updateData.threshold = input.threshold;
    if (input.operator !== undefined) updateData.operator = input.operator;
    if (input.channels !== undefined) updateData.channels = input.channels;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;

    const { data, error } = await this.supabase
      .from('risk_alerts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update risk alert: ${error.message}`);
    }

    return this.mapAlertFromDb(data);
  }

  /**
   * Delete an alert
   */
  async deleteAlert(id: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('risk_alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete risk alert: ${error.message}`);
    }
  }

  /**
   * Record alert trigger
   */
  async recordAlertTrigger(
    alertId: string,
    userId: string,
    actualValue: number,
    notificationSent: boolean = true,
    notificationError?: string
  ): Promise<RiskAlertHistoryEntry> {
    // Get the alert first
    const alert = await this.getAlertById(alertId, userId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    // Create history entry
    const { data: historyData, error: historyError } = await this.supabase
      .from('risk_alert_history')
      .insert({
        alert_id: alertId,
        user_id: userId,
        metric: alert.metric,
        threshold: alert.threshold,
        actual_value: actualValue,
        operator: alert.operator,
        channels: alert.channels,
        notification_sent: notificationSent,
        notification_error: notificationError,
      })
      .select()
      .single();

    if (historyError) {
      throw new Error(`Failed to record alert trigger: ${historyError.message}`);
    }

    // Update alert trigger count and last triggered time
    await this.supabase
      .from('risk_alerts')
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: (alert.triggerCount || 0) + 1,
      })
      .eq('id', alertId);

    return this.mapAlertHistoryFromDb(historyData);
  }

  // ============= Risk History =============

  /**
   * Create risk history entry
   */
  async createRiskHistory(input: CreateRiskHistoryInput): Promise<RiskHistoryEntry> {
    const { data, error } = await this.supabase
      .from('risk_history')
      .insert({
        user_id: input.userId,
        period_type: input.periodType || 'snapshot',
        var95: input.var95,
        var99: input.var99,
        max_drawdown: input.maxDrawdown,
        current_drawdown: input.currentDrawdown,
        sharpe_ratio: input.sharpeRatio,
        volatility: input.volatility,
        beta: input.beta,
        concentration_risk: input.concentrationRisk,
        liquidity_risk: input.liquidityRisk,
        sortino_ratio: input.sortinoRatio,
        expected_shortfall_95: input.expectedShortfall95,
        expected_shortfall_99: input.expectedShortfall99,
        calmar_ratio: input.calmarRatio,
        treynor_ratio: input.treynorRatio,
        information_ratio: input.informationRatio,
        tracking_error: input.trackingError,
        portfolio_value: input.portfolioValue,
        position_count: input.positionCount,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create risk history: ${error.message}`);
    }

    return this.mapRiskHistoryFromDb(data);
  }

  /**
   * Get risk history for a user
   */
  async getRiskHistory(filters: RiskHistoryFilters): Promise<RiskHistoryEntry[]> {
    let query = this.supabase
      .from('risk_history')
      .select()
      .eq('user_id', filters.userId);

    if (filters.startDate) {
      query = query.gte('recorded_at', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('recorded_at', filters.endDate.toISOString());
    }

    if (filters.periodType) {
      query = query.eq('period_type', filters.periodType);
    }

    query = query.order('recorded_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get risk history: ${error.message}`);
    }

    return data.map(this.mapRiskHistoryFromDb);
  }

  /**
   * Get latest risk snapshot
   */
  async getLatestRiskSnapshot(userId: string): Promise<RiskHistoryEntry | null> {
    const { data, error } = await this.supabase
      .from('risk_history')
      .select()
      .eq('user_id', userId)
      .eq('period_type', 'snapshot')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get latest risk snapshot: ${error.message}`);
    }

    return this.mapRiskHistoryFromDb(data);
  }

  // ============= Position Risks =============

  /**
   * Create position risk entry
   */
  async createPositionRisk(input: CreatePositionRiskInput): Promise<PositionRisk> {
    const { data, error } = await this.supabase
      .from('position_risks')
      .insert({
        user_id: input.userId,
        risk_history_id: input.riskHistoryId,
        symbol: input.symbol,
        weight: input.weight,
        contribution_to_risk: input.contributionToRisk,
        var_contribution: input.varContribution,
        beta_to_portfolio: input.betaToPortfolio,
        liquidity_score: input.liquidityScore,
        concentration_risk: input.concentrationRisk,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create position risk: ${error.message}`);
    }

    return this.mapPositionRiskFromDb(data);
  }

  /**
   * Batch create position risks
   */
  async batchCreatePositionRisks(inputs: CreatePositionRiskInput[]): Promise<PositionRisk[]> {
    const records = inputs.map(input => ({
      user_id: input.userId,
      risk_history_id: input.riskHistoryId,
      symbol: input.symbol,
      weight: input.weight,
      contribution_to_risk: input.contributionToRisk,
      var_contribution: input.varContribution,
      beta_to_portfolio: input.betaToPortfolio,
      liquidity_score: input.liquidityScore,
      concentration_risk: input.concentrationRisk,
    }));

    const { data, error } = await this.supabase
      .from('position_risks')
      .insert(records)
      .select();

    if (error) {
      throw new Error(`Failed to batch create position risks: ${error.message}`);
    }

    return data.map(this.mapPositionRiskFromDb);
  }

  /**
   * Get position risks for a risk history entry
   */
  async getPositionRisksByHistoryId(riskHistoryId: string): Promise<PositionRisk[]> {
    const { data, error } = await this.supabase
      .from('position_risks')
      .select()
      .eq('risk_history_id', riskHistoryId);

    if (error) {
      throw new Error(`Failed to get position risks: ${error.message}`);
    }

    return data.map(this.mapPositionRiskFromDb);
  }

  /**
   * Get latest position risks for a user
   */
  async getLatestPositionRisks(userId: string): Promise<PositionRisk[]> {
    // Get the latest risk history entry
    const latestSnapshot = await this.getLatestRiskSnapshot(userId);
    if (!latestSnapshot) return [];

    return this.getPositionRisksByHistoryId(latestSnapshot.id);
  }

  // ============= Correlation Matrix =============

  /**
   * Create or update correlation
   */
  async upsertCorrelation(input: CreateCorrelationInput): Promise<CorrelationEntry> {
    const { data, error } = await this.supabase
      .from('correlation_matrix')
      .upsert({
        user_id: input.userId,
        symbol1: input.symbol1,
        symbol2: input.symbol2,
        correlation: input.correlation,
        period_days: input.periodDays || 30,
      }, {
        onConflict: 'user_id,symbol1,symbol2,period_days',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert correlation: ${error.message}`);
    }

    return this.mapCorrelationFromDb(data);
  }

  /**
   * Batch upsert correlations
   */
  async batchUpsertCorrelations(inputs: CreateCorrelationInput[]): Promise<CorrelationEntry[]> {
    const records = inputs.map(input => ({
      user_id: input.userId,
      symbol1: input.symbol1,
      symbol2: input.symbol2,
      correlation: input.correlation,
      period_days: input.periodDays || 30,
    }));

    const { data, error } = await this.supabase
      .from('correlation_matrix')
      .upsert(records, {
        onConflict: 'user_id,symbol1,symbol2,period_days',
      })
      .select();

    if (error) {
      throw new Error(`Failed to batch upsert correlations: ${error.message}`);
    }

    return data.map(this.mapCorrelationFromDb);
  }

  /**
   * Get correlation matrix for a user
   */
  async getCorrelationMatrix(userId: string, periodDays: number = 30): Promise<CorrelationEntry[]> {
    const { data, error } = await this.supabase
      .from('correlation_matrix')
      .select()
      .eq('user_id', userId)
      .eq('period_days', periodDays);

    if (error) {
      throw new Error(`Failed to get correlation matrix: ${error.message}`);
    }

    return data.map(this.mapCorrelationFromDb);
  }

  // ============= Alert History =============

  /**
   * Get alert history for a user
   */
  async getAlertHistory(
    userId: string,
    options?: { limit?: number; offset?: number; alertId?: string }
  ): Promise<RiskAlertHistoryEntry[]> {
    let query = this.supabase
      .from('risk_alert_history')
      .select()
      .eq('user_id', userId);

    if (options?.alertId) {
      query = query.eq('alert_id', options.alertId);
    }

    query = query.order('triggered_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 10) - 1
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get alert history: ${error.message}`);
    }

    return data.map(this.mapAlertHistoryFromDb);
  }

  // ============= Mapping Functions =============

  private mapAlertFromDb(data: Record<string, unknown>): RiskAlert {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      metric: data.metric as RiskMetric,
      threshold: Number(data.threshold),
      operator: data.operator as AlertOperator,
      channels: (data.channels as AlertChannel[]) || ['ui'],
      enabled: data.enabled as boolean,
      lastTriggeredAt: data.last_triggered_at ? new Date(data.last_triggered_at as string) : undefined,
      triggerCount: (data.trigger_count as number) || 0,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  private mapAlertHistoryFromDb(data: Record<string, unknown>): RiskAlertHistoryEntry {
    return {
      id: data.id as string,
      alertId: data.alert_id as string,
      userId: data.user_id as string,
      metric: data.metric as RiskMetric,
      threshold: Number(data.threshold),
      actualValue: Number(data.actual_value),
      operator: data.operator as AlertOperator,
      channels: (data.channels as AlertChannel[]) || ['ui'],
      notificationSent: data.notification_sent as boolean,
      notificationError: data.notification_error as string | undefined,
      triggeredAt: new Date(data.triggered_at as string),
    };
  }

  private mapRiskHistoryFromDb(data: Record<string, unknown>): RiskHistoryEntry {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      recordedAt: new Date(data.recorded_at as string),
      periodType: (data.period_type as RiskPeriodType) || 'snapshot',
      var95: data.var95 ? Number(data.var95) : undefined,
      var99: data.var99 ? Number(data.var99) : undefined,
      maxDrawdown: data.max_drawdown ? Number(data.max_drawdown) : undefined,
      currentDrawdown: data.current_drawdown ? Number(data.current_drawdown) : undefined,
      sharpeRatio: data.sharpe_ratio ? Number(data.sharpe_ratio) : undefined,
      volatility: data.volatility ? Number(data.volatility) : undefined,
      beta: data.beta ? Number(data.beta) : undefined,
      concentrationRisk: data.concentration_risk ? Number(data.concentration_risk) : undefined,
      liquidityRisk: data.liquidity_risk ? Number(data.liquidity_risk) : undefined,
      sortinoRatio: data.sortino_ratio ? Number(data.sortino_ratio) : undefined,
      expectedShortfall95: data.expected_shortfall_95 ? Number(data.expected_shortfall_95) : undefined,
      expectedShortfall99: data.expected_shortfall_99 ? Number(data.expected_shortfall_99) : undefined,
      calmarRatio: data.calmar_ratio ? Number(data.calmar_ratio) : undefined,
      treynorRatio: data.treynor_ratio ? Number(data.treynor_ratio) : undefined,
      informationRatio: data.information_ratio ? Number(data.information_ratio) : undefined,
      trackingError: data.tracking_error ? Number(data.tracking_error) : undefined,
      portfolioValue: data.portfolio_value ? Number(data.portfolio_value) : undefined,
      positionCount: data.position_count as number | undefined,
    };
  }

  private mapPositionRiskFromDb(data: Record<string, unknown>): PositionRisk {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      riskHistoryId: data.risk_history_id as string | undefined,
      symbol: data.symbol as string,
      weight: Number(data.weight),
      contributionToRisk: Number(data.contribution_to_risk),
      varContribution: Number(data.var_contribution),
      betaToPortfolio: data.beta_to_portfolio ? Number(data.beta_to_portfolio) : undefined,
      liquidityScore: data.liquidity_score ? Number(data.liquidity_score) : undefined,
      concentrationRisk: data.concentration_risk ? Number(data.concentration_risk) : undefined,
      recordedAt: new Date(data.recorded_at as string),
    };
  }

  private mapCorrelationFromDb(data: Record<string, unknown>): CorrelationEntry {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      symbol1: data.symbol1 as string,
      symbol2: data.symbol2 as string,
      correlation: Number(data.correlation),
      periodDays: (data.period_days as number) || 30,
      calculatedAt: new Date(data.calculated_at as string),
    };
  }
}

// Export singleton instance
export const riskMonitorDAO = new RiskMonitorDAO();
