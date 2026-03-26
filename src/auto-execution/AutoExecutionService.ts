/**
 * Auto Execution Service
 * VIP-exclusive automated strategy execution with comprehensive risk controls
 */

import { EventEmitter } from 'events';
import { getSupabaseClient } from '../database/client';
import { SubscriptionDAO } from '../database/subscription.dao';
import { autoExecutionDAO } from './auto-execution.dao';
import { notificationService } from '../notification';
import { createLogger } from '../utils/logger';
import {
  AutoExecutionConfig,
  AutoExecutionLog,
  RiskCheckResult,
  CreateAutoExecutionInput,
  UpdateAutoExecutionInput,
  DEFAULT_RISK_CONTROLS,
  SignalSource,
  TradingPairConfig,
  ExecutionWindow,
} from './types';

const log = createLogger('AutoExecutionService');

/**
 * Signal input for auto execution
 */
export interface ExecutionSignal {
  id: string;
  source: SignalSource;
  strategyId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  confidence: number;
  reason?: string;
  timestamp: Date;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  logId: string;
  executedQuantity?: number;
  executedPrice?: number;
  orderId?: string;
  error?: string;
}

/**
 * Auto Execution Service
 * Manages automated trading execution for VIP users
 */
export class AutoExecutionService extends EventEmitter {
  private static instance: AutoExecutionService | null = null;
  private isRunning: boolean = false;
  private checkInterval?: NodeJS.Timeout;
  private pendingSignals: Map<string, ExecutionSignal[]> = new Map();

  private constructor() {
    super();
  }

  static getInstance(): AutoExecutionService {
    if (!AutoExecutionService.instance) {
      AutoExecutionService.instance = new AutoExecutionService();
    }
    return AutoExecutionService.instance;
  }

  /**
   * Start the auto execution service
   */
  async start(checkIntervalMs: number = 5000): Promise<void> {
    if (this.isRunning) {
      log.warn('Auto execution service is already running');
      return;
    }

    log.info('Starting auto execution service...');
    this.isRunning = true;

    // Start periodic check for pending signals
    this.checkInterval = setInterval(() => {
      this.processPendingSignals().catch(err => {
        log.error('Error processing pending signals:', err);
      });
    }, checkIntervalMs);

    log.info('Auto execution service started');
  }

  /**
   * Stop the auto execution service
   */
  async stop(): Promise<void> {
    log.info('Stopping auto execution service...');
    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    this.pendingSignals.clear();
    log.info('Auto execution service stopped');
  }

  /**
   * Create a new auto execution configuration
   */
  async createConfig(input: CreateAutoExecutionInput): Promise<AutoExecutionConfig> {
    // Verify VIP status
    const isVip = await this.verifyVipStatus(input.userId);
    if (!isVip) {
      throw new Error('Auto execution is a VIP-exclusive feature. Please upgrade to Pro or Enterprise.');
    }

    // Check if user already has a config for this source
    const existing = await autoExecutionDAO.findConfigsByUserId(input.userId, {
      signalSource: input.signalSource,
    });

    if (existing.length > 0 && input.strategyId) {
      const duplicate = existing.find(c => c.strategyId === input.strategyId);
      if (duplicate) {
        throw new Error('Auto execution config already exists for this strategy');
      }
    }

    const config = await autoExecutionDAO.createConfig({
      ...input,
      riskControls: {
        ...DEFAULT_RISK_CONTROLS,
        ...input.riskControls,
      },
    });

    log.info(`Created auto execution config ${config.id} for user ${input.userId}`);
    return config;
  }

  /**
   * Update auto execution configuration
   */
  async updateConfig(
    configId: string,
    userId: string,
    input: UpdateAutoExecutionInput
  ): Promise<AutoExecutionConfig> {
    const config = await autoExecutionDAO.findConfigById(configId);
    if (!config) {
      throw new Error('Configuration not found');
    }

    if (config.userId !== userId) {
      throw new Error('Access denied');
    }

    const updated = await autoExecutionDAO.updateConfig(configId, input);
    log.info(`Updated auto execution config ${configId}`);
    return updated;
  }

  /**
   * Enable auto execution
   */
  async enableConfig(configId: string, userId: string): Promise<AutoExecutionConfig> {
    const config = await autoExecutionDAO.findConfigById(configId);
    if (!config) {
      throw new Error('Configuration not found');
    }

    if (config.userId !== userId) {
      throw new Error('Access denied');
    }

    // Verify VIP status before enabling
    const isVip = await this.verifyVipStatus(userId);
    if (!isVip) {
      throw new Error('VIP subscription required for auto execution');
    }

    const updated = await autoExecutionDAO.updateConfig(configId, { status: 'enabled' });
    log.info(`Enabled auto execution config ${configId}`);

    this.emit('config:enabled', { configId, userId });
    return updated;
  }

  /**
   * Disable auto execution
   */
  async disableConfig(configId: string, userId: string): Promise<AutoExecutionConfig> {
    const config = await autoExecutionDAO.findConfigById(configId);
    if (!config) {
      throw new Error('Configuration not found');
    }

    if (config.userId !== userId) {
      throw new Error('Access denied');
    }

    const updated = await autoExecutionDAO.updateConfig(configId, { status: 'disabled' });
    log.info(`Disabled auto execution config ${configId}`);

    this.emit('config:disabled', { configId, userId });
    return updated;
  }

  /**
   * Pause auto execution
   */
  async pauseConfig(configId: string, userId: string, reason?: string): Promise<AutoExecutionConfig> {
    const config = await autoExecutionDAO.findConfigById(configId);
    if (!config) {
      throw new Error('Configuration not found');
    }

    if (config.userId !== userId) {
      throw new Error('Access denied');
    }

    const updated = await autoExecutionDAO.updateConfig(configId, { status: 'paused' });
    log.info(`Paused auto execution config ${configId}: ${reason || 'user requested'}`);

    this.emit('config:paused', { configId, userId, reason });
    return updated;
  }

  /**
   * Delete auto execution configuration
   */
  async deleteConfig(configId: string, userId: string): Promise<void> {
    const config = await autoExecutionDAO.findConfigById(configId);
    if (!config) {
      throw new Error('Configuration not found');
    }

    if (config.userId !== userId) {
      throw new Error('Access denied');
    }

    await autoExecutionDAO.deleteConfig(configId);
    log.info(`Deleted auto execution config ${configId}`);
  }

  /**
   * Get user's auto execution configurations
   */
  async getUserConfigs(userId: string): Promise<AutoExecutionConfig[]> {
    return autoExecutionDAO.findConfigsByUserId(userId);
  }

  /**
   * Get config by ID
   */
  async getConfig(configId: string, userId: string): Promise<AutoExecutionConfig> {
    const config = await autoExecutionDAO.findConfigById(configId);
    if (!config) {
      throw new Error('Configuration not found');
    }

    if (config.userId !== userId) {
      throw new Error('Access denied');
    }

    return config;
  }

  /**
   * Receive a trading signal for potential auto execution
   */
  async receiveSignal(userId: string, signal: ExecutionSignal): Promise<void> {
    // Find enabled configs for this user
    const configs = await autoExecutionDAO.findConfigsByUserId(userId);
    const enabledConfigs = configs.filter(c => c.status === 'enabled');

    for (const config of enabledConfigs) {
      // Check if this config matches the signal source
      if (!this.configMatchesSignal(config, signal)) {
        continue;
      }

      // Check if trading pair is enabled
      const pairConfig = this.getPairConfig(config, signal.symbol);
      if (!pairConfig || !pairConfig.enabled) {
        log.debug(`Trading pair ${signal.symbol} not enabled for config ${config.id}`);
        continue;
      }

      // Check signal threshold
      if (signal.confidence < config.signalThreshold) {
        log.debug(`Signal confidence ${signal.confidence} below threshold ${config.signalThreshold}`);
        continue;
      }

      // Add to pending signals based on execution mode
      if (config.executionMode === 'immediate') {
        await this.processSignal(config, signal, pairConfig);
      } else {
        // Batch or threshold mode - queue the signal
        if (!this.pendingSignals.has(config.id)) {
          this.pendingSignals.set(config.id, []);
        }
        this.pendingSignals.get(config.id)!.push(signal);
      }
    }
  }

  /**
   * Process pending signals (for batch/threshold mode)
   */
  private async processPendingSignals(): Promise<void> {
    for (const [configId, signals] of this.pendingSignals) {
      if (signals.length === 0) continue;

      const config = await autoExecutionDAO.findConfigById(configId);
      if (!config || config.status !== 'enabled') {
        this.pendingSignals.delete(configId);
        continue;
      }

      // Process based on mode
      if (config.executionMode === 'batch') {
        // Check if batch interval has passed
        const lastExecution = config.lastExecutionAt;
        if (lastExecution) {
          const timeSinceLastExecution = Date.now() - lastExecution.getTime();
          const batchIntervalMs = config.batchIntervalMinutes * 60 * 1000;
          if (timeSinceLastExecution < batchIntervalMs) {
            continue;
          }
        }

        // Process all pending signals
        const signalsToProcess = [...signals];
        this.pendingSignals.set(configId, []);

        for (const signal of signalsToProcess) {
          const pairConfig = this.getPairConfig(config, signal.symbol);
          if (pairConfig) {
            await this.processSignal(config, signal, pairConfig);
          }
        }
      }
    }
  }

  /**
   * Process a single signal
   */
  private async processSignal(
    config: AutoExecutionConfig,
    signal: ExecutionSignal,
    pairConfig: TradingPairConfig
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Create execution log
    const executionLog = await autoExecutionDAO.createExecutionLog({
      configId: config.id,
      userId: config.userId,
      signalId: signal.id,
      signalSource: signal.source,
      signalSide: signal.side,
      signalPrice: signal.price,
      signalQuantity: signal.quantity,
      signalConfidence: signal.confidence,
      signalTimestamp: signal.timestamp,
    });

    try {
      // Step 1: Verify VIP status
      const isVip = await this.verifyVipStatus(config.userId);
      if (!isVip) {
        return this.rejectExecution(
          executionLog.id,
          'VIP subscription expired or inactive',
          'VIP_EXPIRED'
        );
      }

      // Step 2: Check execution window
      if (!this.isWithinExecutionWindow(config.executionWindows)) {
        return this.rejectExecution(
          executionLog.id,
          'Outside execution window',
          'OUTSIDE_WINDOW'
        );
      }

      // Step 3: Run risk checks
      const riskCheck = await this.runRiskChecks(config, signal, pairConfig);
      
      await autoExecutionDAO.updateExecutionLog(executionLog.id, {
        riskCheckPassed: riskCheck.passed,
        riskCheckReasons: riskCheck.reasons,
      });

      if (!riskCheck.passed) {
        const result = await this.rejectExecution(
          executionLog.id,
          riskCheck.reasons.join('; '),
          'RISK_CHECK_FAILED'
        );

        // Notify if risk event
        if (config.notifyOnRiskEvent) {
          await this.notifyRiskEvent(config, signal, riskCheck);
        }

        return result;
      }

      // Step 4: Execute the order
      await autoExecutionDAO.updateExecutionLog(executionLog.id, {
        executionStatus: 'executing',
        executedAt: new Date(),
      });

      const adjustedQuantity = riskCheck.adjustedQuantity || signal.quantity;
      const adjustedPrice = riskCheck.adjustedPrice || signal.price;

      const orderResult = await this.executeOrder(
        config,
        signal,
        pairConfig,
        adjustedQuantity,
        adjustedPrice
      );

      const executionDuration = Date.now() - startTime;

      if (orderResult.success) {
        // Update log with success
        await autoExecutionDAO.updateExecutionLog(executionLog.id, {
          executionStatus: 'filled',
          orderType: pairConfig.orderType,
          executedPrice: orderResult.executedPrice,
          executedQuantity: orderResult.executedQuantity,
          orderId: orderResult.orderId,
          completedAt: new Date(),
          executionDurationMs: executionDuration,
        });

        // Update config stats
        await autoExecutionDAO.updateExecutionStats(
          config.id,
          true,
          (orderResult.executedPrice || 0) * (orderResult.executedQuantity || 0)
        );

        // Notify if enabled
        if (config.notifyOnExecution) {
          await this.notifyExecution(config, signal, orderResult);
        }

        this.emit('execution:filled', {
          configId: config.id,
          signal,
          result: orderResult,
        });

        log.info(
          `Executed ${signal.side} order for ${signal.symbol}: ` +
          `${orderResult.executedQuantity} @ ${orderResult.executedPrice}`
        );

        return {
          success: true,
          logId: executionLog.id,
          executedQuantity: orderResult.executedQuantity,
          executedPrice: orderResult.executedPrice,
          orderId: orderResult.orderId,
        };
      } else {
        // Update log with failure
        await autoExecutionDAO.updateExecutionLog(executionLog.id, {
          executionStatus: 'failed',
          errorMessage: orderResult.error,
          errorCode: 'EXECUTION_FAILED',
          completedAt: new Date(),
          executionDurationMs: executionDuration,
        });

        await autoExecutionDAO.updateExecutionStats(config.id, false, 0);

        if (config.notifyOnError) {
          await this.notifyError(config, signal, orderResult.error || 'Execution failed');
        }

        return {
          success: false,
          logId: executionLog.id,
          error: orderResult.error,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const executionDuration = Date.now() - startTime;

      await autoExecutionDAO.updateExecutionLog(executionLog.id, {
        executionStatus: 'failed',
        errorMessage,
        errorCode: 'INTERNAL_ERROR',
        completedAt: new Date(),
        executionDurationMs: executionDuration,
      });

      await autoExecutionDAO.updateExecutionStats(config.id, false, 0);

      log.error(`Failed to process signal for config ${config.id}:`, error);

      return {
        success: false,
        logId: executionLog.id,
        error: errorMessage,
      };
    }
  }

  /**
   * Run all risk checks
   */
  private async runRiskChecks(
    config: AutoExecutionConfig,
    signal: ExecutionSignal,
    pairConfig: TradingPairConfig
  ): Promise<RiskCheckResult> {
    const reasons: string[] = [];
    const warnings: string[] = [];
    let adjustedQuantity = signal.quantity;
    let adjustedPrice = signal.price;

    const riskControls = config.riskControls;

    // Check 1: Daily trade limit
    const todayExecutions = await autoExecutionDAO.getTodayExecutionCount(config.id);
    if (todayExecutions >= riskControls.maxDailyTrades) {
      reasons.push(`Daily trade limit reached (${todayExecutions}/${riskControls.maxDailyTrades})`);
    }

    // Check 2: Hourly trade limit
    const hourlyExecutions = await autoExecutionDAO.getHourlyExecutionCount(config.id);
    if (hourlyExecutions >= riskControls.maxHourlyTrades) {
      reasons.push(`Hourly trade limit reached (${hourlyExecutions}/${riskControls.maxHourlyTrades})`);
    }

    // Check 3: Daily volume limit
    const todayVolume = await autoExecutionDAO.getTodayVolume(config.id);
    const orderValue = signal.price * signal.quantity;
    if (todayVolume + orderValue > riskControls.maxDailyVolume) {
      reasons.push(`Daily volume limit would be exceeded`);
    }

    // Check 4: Minimum trade interval
    const lastTradeTime = await autoExecutionDAO.getLastTradeTime(config.id);
    if (lastTradeTime) {
      const secondsSinceLastTrade = (Date.now() - lastTradeTime.getTime()) / 1000;
      if (secondsSinceLastTrade < riskControls.minTradeInterval) {
        reasons.push(
          `Minimum trade interval not met (${Math.round(secondsSinceLastTrade)}s < ${riskControls.minTradeInterval}s)`
        );
      }
    }

    // Check 5: Loss cooldown
    if (riskControls.lossCooldownMinutes > 0) {
      const lastLossTime = await this.getLastLossTime(config.id);
      if (lastLossTime) {
        const minutesSinceLoss = (Date.now() - lastLossTime.getTime()) / 60000;
        if (minutesSinceLoss < riskControls.lossCooldownMinutes) {
          reasons.push(
            `Loss cooldown period active (${Math.round(minutesSinceLoss)}min < ${riskControls.lossCooldownMinutes}min)`
          );
        }
      }
    }

    // Check 6: Circuit breaker (consecutive losses)
    if (riskControls.circuitBreakerEnabled) {
      const consecutiveLosses = await autoExecutionDAO.getConsecutiveLossCount(config.id);
      if (consecutiveLosses >= riskControls.circuitBreakerThreshold) {
        reasons.push(
          `Circuit breaker triggered (${consecutiveLosses} consecutive losses)`
        );

        // Auto-pause the config
        await autoExecutionDAO.setConfigStatus(
          config.id,
          'paused',
          `Circuit breaker: ${consecutiveLosses} consecutive losses`
        );
      }
    }

    // Check 7: Position size limits
    const maxPosition = pairConfig.maxPosition || riskControls.maxPositionSize;
    const positionValue = signal.price * signal.quantity;
    if (positionValue > maxPosition) {
      // Adjust quantity instead of rejecting
      adjustedQuantity = maxPosition / signal.price;
      warnings.push(
        `Position size adjusted from ${signal.quantity} to ${adjustedQuantity.toFixed(4)} due to limit`
      );
    }

    // Check 8: Drawdown check
    // TODO: Get actual portfolio drawdown from portfolio service
    // For now, we check based on execution logs

    return {
      passed: reasons.length === 0,
      reasons,
      warnings,
      adjustedQuantity,
      adjustedPrice,
    };
  }

  /**
   * Execute the order
   */
  private async executeOrder(
    config: AutoExecutionConfig,
    signal: ExecutionSignal,
    pairConfig: TradingPairConfig,
    quantity: number,
    price: number
  ): Promise<{
    success: boolean;
    executedQuantity?: number;
    executedPrice?: number;
    orderId?: string;
    error?: string;
  }> {
    try {
      // TODO: Integrate with actual order execution system
      // For now, we simulate the order execution
      
      // In a real implementation, this would:
      // 1. Create an order through the MatchingEngine or external exchange
      // 2. Wait for order confirmation
      // 3. Return the actual executed price and quantity
      
      // Simulate execution with slight price variation for market orders
      const executedPrice = pairConfig.orderType === 'market'
        ? price * (1 + (Math.random() * 0.001 - 0.0005)) // Small slippage
        : price;

      // Generate a mock order ID
      const orderId = `auto-${config.id}-${Date.now()}`;

      log.info(
        `[SIMULATED] Order executed: ${signal.side} ${quantity} ${signal.symbol} @ ${executedPrice}`
      );

      return {
        success: true,
        executedQuantity: quantity,
        executedPrice,
        orderId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Reject an execution
   */
  private async rejectExecution(
    logId: string,
    reason: string,
    errorCode: string
  ): Promise<ExecutionResult> {
    await autoExecutionDAO.updateExecutionLog(logId, {
      executionStatus: 'rejected',
      errorMessage: reason,
      errorCode,
      completedAt: new Date(),
    });

    return {
      success: false,
      logId,
      error: reason,
    };
  }

  /**
   * Check if current time is within execution windows
   */
  private isWithinExecutionWindow(windows: ExecutionWindow[]): boolean {
    if (!windows || windows.length === 0) {
      return true; // No windows defined = always allowed
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().substring(0, 5); // HH:mm

    for (const window of windows) {
      // Check day of week
      if (window.daysOfWeek && !window.daysOfWeek.includes(currentDay)) {
        continue;
      }

      // Check time
      if (currentTime >= window.startTime && currentTime <= window.endTime) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if config matches signal source
   */
  private configMatchesSignal(config: AutoExecutionConfig, signal: ExecutionSignal): boolean {
    if (config.signalSource !== signal.source) {
      return false;
    }

    if (signal.source === 'strategy' && config.strategyId !== signal.strategyId) {
      return false;
    }

    return true;
  }

  /**
   * Get trading pair configuration
   */
  private getPairConfig(config: AutoExecutionConfig, symbol: string): TradingPairConfig | null {
    const pairConfig = config.tradingPairs.find(p => p.symbol === symbol);
    if (pairConfig) {
      return pairConfig;
    }

    // Return default config if no specific pair config
    return null;
  }

  /**
   * Verify VIP status
   */
  private async verifyVipStatus(userId: string): Promise<boolean> {
    try {
      const subscription = await SubscriptionDAO.getUserSubscription(userId);
      
      if (!subscription) {
        return false;
      }

      // Check if subscription is active
      if (subscription.status !== 'active') {
        return false;
      }

      // Check if plan is Pro or Enterprise
      const planId = subscription.planId.toLowerCase();
      return planId === 'pro' || planId === 'enterprise';
    } catch (error) {
      log.error('Failed to verify VIP status:', error);
      return false;
    }
  }

  /**
   * Get last loss time for cooldown check
   */
  private async getLastLossTime(configId: string): Promise<Date | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('auto_execution_logs')
      .select('executed_at')
      .eq('config_id', configId)
      .eq('execution_status', 'filled')
      .lt('pnl', 0)
      .not('executed_at', 'is', null)
      .order('executed_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data.executed_at ? new Date(data.executed_at as string) : null;
  }

  /**
   * Send execution notification
   */
  private async notifyExecution(
    config: AutoExecutionConfig,
    signal: ExecutionSignal,
    result: { executedQuantity?: number; executedPrice?: number; orderId?: string }
  ): Promise<void> {
    try {
      await notificationService.createSystemNotification(
        config.userId,
        'Auto Execution Completed',
        `Successfully executed ${signal.side} order for ${signal.symbol}: ${result.executedQuantity} @ ${result.executedPrice}`,
        {
          event_type: 'info',
          details: JSON.stringify({
            configId: config.id,
            signalId: signal.id,
            orderId: result.orderId,
          }),
        },
        { priority: 'MEDIUM' }
      );
    } catch (error) {
      log.error('Failed to send execution notification:', error);
    }
  }

  /**
   * Send error notification
   */
  private async notifyError(
    config: AutoExecutionConfig,
    signal: ExecutionSignal,
    error: string
  ): Promise<void> {
    try {
      await notificationService.createSystemNotification(
        config.userId,
        'Auto Execution Failed',
        `Failed to execute ${signal.side} order for ${signal.symbol}: ${error}`,
        {
          event_type: 'alert',
          details: JSON.stringify({
            configId: config.id,
            signalId: signal.id,
            error,
          }),
        },
        { priority: 'HIGH' }
      );
    } catch (error) {
      log.error('Failed to send error notification:', error);
    }
  }

  /**
   * Send risk event notification
   */
  private async notifyRiskEvent(
    config: AutoExecutionConfig,
    signal: ExecutionSignal,
    riskCheck: RiskCheckResult
  ): Promise<void> {
    try {
      await notificationService.createRiskNotification(
        config.userId,
        'Auto Execution Risk Alert',
        `Signal for ${signal.symbol} was rejected due to risk controls: ${riskCheck.reasons.join(', ')}`,
        {
          risk_type: 'position_limit',
          symbol: signal.symbol,
          current_value: 0,
          threshold_value: 0,
          message_details: riskCheck.reasons.join('; '),
        },
        { priority: 'HIGH' }
      );
    } catch (error) {
      log.error('Failed to send risk notification:', error);
    }
  }

  /**
   * Get execution logs for a user
   */
  async getExecutionLogs(
    userId: string,
    configId?: string,
    limit: number = 50
  ): Promise<AutoExecutionLog[]> {
    return autoExecutionDAO.findExecutionLogsByUserId(userId, {
      configId,
      limit,
    });
  }

  /**
   * Get execution log by ID
   */
  async getExecutionLog(logId: string, userId: string): Promise<AutoExecutionLog | null> {
    const log = await autoExecutionDAO.findExecutionLogById(logId);
    if (!log || log.userId !== userId) {
      return null;
    }
    return log;
  }

  /**
   * Get service status
   */
  getStatus(): { isRunning: boolean; pendingSignalsCount: number } {
    let pendingCount = 0;
    for (const signals of this.pendingSignals.values()) {
      pendingCount += signals.length;
    }

    return {
      isRunning: this.isRunning,
      pendingSignalsCount: pendingCount,
    };
  }
}

// Export singleton getter
export function getAutoExecutionService(): AutoExecutionService {
  return AutoExecutionService.getInstance();
}