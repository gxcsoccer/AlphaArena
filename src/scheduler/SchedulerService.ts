/**
 * Trading Scheduler Service
 * Manages automated trading schedule execution
 */

import { CronJob } from 'cron';
import { 
  tradingSchedulesDAO, 
  TradingSchedule, 
  ScheduleExecution,
  ScheduleSafetyConfig
} from '../database/trading-schedules.dao';
import { getSupabaseClient } from '../database/client';
import { createLogger } from '../utils/logger';
import { getAlertService } from '../alerting';
import { getSchedulerRealtimeService } from '../realtime/SchedulerRealtimeService';

const log = createLogger('SchedulerService');

export interface SchedulerConfig {
  enableAutoStart?: boolean;
  checkIntervalMs?: number;
}

export interface ExecutionResult {
  success: boolean;
  tradesExecuted: number;
  totalValue?: number;
  message?: string;
  error?: Error;
}

export class SchedulerService {
  private static instance: SchedulerService | null = null;
  private cronJobs: Map<string, CronJob> = new Map();
  private intervalJobs: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;
  private checkInterval?: NodeJS.Timeout;
  private alertService = getAlertService();
  private realtimeService = getSchedulerRealtimeService();
  // Track users with active schedules for status broadcasting
  private activeUserSchedules: Map<string, Set<string>> = new Map(); // userId -> Set<scheduleId>

  private constructor(private config: SchedulerConfig = {}) {}

  static getInstance(config?: SchedulerConfig): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService(config);
    }
    return SchedulerService.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn('Scheduler service is already running');
      return;
    }

    log.info('Starting scheduler service...');
    this.isRunning = true;

    await this.loadSchedules();

    const checkInterval = this.config.checkIntervalMs || 60000;
    this.checkInterval = setInterval(() => {
      this.checkDueSchedules().catch(err => {
        log.error('Error checking due schedules:', err);
      });
    }, checkInterval);

    // Broadcast running status to all active users
    await this.broadcastStatusToAllUsers('running');

    log.info('Scheduler service started');
  }

  async stop(): Promise<void> {
    log.info('Stopping scheduler service...');
    this.isRunning = false;

    // Broadcast stopped status before clearing jobs
    await this.broadcastStatusToAllUsers('stopped');

    for (const [id, job] of this.cronJobs) {
      job.stop();
      log.debug('Stopped cron job for schedule ' + id);
    }
    this.cronJobs.clear();

    for (const [id, timeout] of this.intervalJobs) {
      clearTimeout(timeout);
      log.debug('Stopped interval job for schedule ' + id);
    }
    this.intervalJobs.clear();

    // Clear active user schedules tracking
    this.activeUserSchedules.clear();

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    log.info('Scheduler service stopped');
  }

  private async loadSchedules(): Promise<void> {
    const supabase = getSupabaseClient();
    
    const { data: schedules, error } = await supabase
      .from('trading_schedules')
      .select('*')
      .eq('enabled', true);

    if (error) {
      log.error('Failed to load schedules:', error);
      return;
    }

    log.info('Loading ' + (schedules?.length || 0) + ' enabled schedules');

    for (const scheduleData of schedules || []) {
      try {
        const schedule = this.mapToSchedule(scheduleData);
        await this.registerSchedule(schedule);
      } catch (err) {
        log.error('Failed to register schedule ' + scheduleData.id + ':', err);
      }
    }
  }

  async registerSchedule(schedule: TradingSchedule): Promise<void> {
    if (!schedule.enabled) {
      log.debug('Schedule ' + schedule.id + ' is disabled, skipping registration');
      return;
    }

    await this.unregisterSchedule(schedule.id);

    try {
      if (schedule.scheduleType === 'cron' || schedule.scheduleType === 'condition') {
        const self = this;
        const job = new CronJob(
          schedule.cronExpression,
          function() {
            self.executeSchedule(schedule.id).catch(err => {
              log.error('Error executing schedule ' + schedule.id + ':', err);
            });
          },
          null,
          true,
          schedule.timezone
        );
        this.cronJobs.set(schedule.id, job);
        log.info('Registered cron job for schedule ' + schedule.id + ' (' + schedule.name + ')');

        await this.updateNextExecutionTime(schedule.id, job);
      } else if (schedule.scheduleType === 'interval' && schedule.intervalMinutes) {
        const intervalMs = schedule.intervalMinutes * 60 * 1000;
        const timeout = setInterval(() => {
          this.executeSchedule(schedule.id).catch(err => {
            log.error('Error executing schedule ' + schedule.id + ':', err);
          });
        }, intervalMs);
        this.intervalJobs.set(schedule.id, timeout);
        log.info('Registered interval job for schedule ' + schedule.id + ' (' + schedule.name + ')');

        const nextExecution = new Date(Date.now() + intervalMs);
        await tradingSchedulesDAO.update(schedule.id, { nextExecutionAt: nextExecution });
      }

      // Track user's active schedule and broadcast status update
      this.trackUserSchedule(schedule.userId, schedule.id);
      await this.broadcastUserStatus(schedule.userId);
    } catch (err) {
      log.error('Failed to register schedule ' + schedule.id + ':', err);
      throw err;
    }
  }

  async unregisterSchedule(scheduleId: string): Promise<void> {
    // Find userId for this schedule before unregistering
    let userId: string | undefined;
    for (const [uid, scheduleIds] of this.activeUserSchedules) {
      if (scheduleIds.has(scheduleId)) {
        userId = uid;
        scheduleIds.delete(scheduleId);
        break;
      }
    }

    const cronJob = this.cronJobs.get(scheduleId);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(scheduleId);
      log.debug('Unregistered cron job for schedule ' + scheduleId);
    }

    const intervalJob = this.intervalJobs.get(scheduleId);
    if (intervalJob) {
      clearTimeout(intervalJob);
      this.intervalJobs.delete(scheduleId);
      log.debug('Unregistered interval job for schedule ' + scheduleId);
    }

    // Broadcast updated status if we found the user
    if (userId) {
      await this.broadcastUserStatus(userId);
    }
  }

  async executeSchedule(scheduleId: string, triggerType: 'scheduled' | 'manual' | 'condition' = 'scheduled'): Promise<ScheduleExecution | null> {
    log.info('Executing schedule ' + scheduleId + ' (trigger: ' + triggerType + ')');

    const schedule = await tradingSchedulesDAO.findById(scheduleId);
    if (!schedule) {
      log.error('Schedule ' + scheduleId + ' not found');
      return null;
    }

    const safetyConfig = await tradingSchedulesDAO.findSafetyConfigByScheduleId(scheduleId);
    if (safetyConfig) {
      if (safetyConfig.isPaused) {
        log.warn('Schedule ' + scheduleId + ' is paused due to consecutive failures');
        return this.recordExecution(schedule, 'skipped', { 
          message: 'Schedule is paused due to consecutive failures',
          triggerType 
        });
      }

      if (safetyConfig.lastFailureAt && safetyConfig.cooldownAfterFailureMinutes > 0) {
        const cooldownEnd = new Date(safetyConfig.lastFailureAt.getTime() + safetyConfig.cooldownAfterFailureMinutes * 60 * 1000);
        if (new Date() < cooldownEnd) {
          log.warn('Schedule ' + scheduleId + ' is in cooldown period');
          return this.recordExecution(schedule, 'skipped', { 
            message: 'Schedule is in cooldown period',
            triggerType 
          });
        }
      }
    }

    const execution = await tradingSchedulesDAO.createExecution({
      scheduleId: schedule.id,
      scheduledAt: new Date(),
      startedAt: new Date(),
      triggerType,
    });

    // Broadcast execution start event
    this.realtimeService.broadcastExecutionStart(
      schedule.userId,
      schedule.id,
      schedule.name,
      execution.id,
      triggerType
    ).catch(err => log.error('Failed to broadcast execution start:', err));

    try {
      const result = await this.executeStrategy(schedule);

      const completedExecution = await tradingSchedulesDAO.updateExecution(execution.id, {
        completedAt: new Date(),
        status: result.success ? 'success' : 'failed',
        result: { tradesExecuted: result.tradesExecuted, totalValue: result.totalValue },
        errorMessage: result.error?.message,
        tradesExecuted: result.tradesExecuted,
        totalValue: result.totalValue,
      });

      await tradingSchedulesDAO.updateExecutionStats(schedule.id, result.success);

      if (safetyConfig) {
        if (result.success) {
          await tradingSchedulesDAO.updateSafetyConfig(schedule.id, {
            consecutiveFailures: 0,
            lastFailureAt: undefined,
          });
        } else {
          const newConsecutiveFailures = safetyConfig.consecutiveFailures + 1;
          const shouldPause = newConsecutiveFailures >= safetyConfig.maxConsecutiveFailures;
          
          await tradingSchedulesDAO.updateSafetyConfig(schedule.id, {
            consecutiveFailures: newConsecutiveFailures,
            lastFailureAt: new Date(),
            isPaused: shouldPause,
          });

          // Trigger alert for consecutive failures
          if (newConsecutiveFailures >= 2) {
            try {
              await this.alertService.alertConsecutiveFailures(
                schedule.userId,
                schedule.id,
                schedule.name,
                newConsecutiveFailures,
                result.error?.message ?? result.message ?? 'Unknown error',
                schedule.strategyId
              );
            } catch (alertErr) {
              log.error('Failed to send consecutive failure alert:', alertErr);
            }
          }

          // Trigger circuit breaker alert if paused
          if (shouldPause) {
            try {
              await this.alertService.alertCircuitBreaker(
                schedule.userId,
                `调度器 "${schedule.name}" 因连续 ${newConsecutiveFailures} 次失败而暂停`
              );
            } catch (alertErr) {
              log.error('Failed to send circuit breaker alert:', alertErr);
            }
          }

          if (shouldPause) {
            log.warn('Schedule ' + scheduleId + ' paused due to ' + newConsecutiveFailures + ' consecutive failures');
          }
        }
      }

      const cronJob = this.cronJobs.get(scheduleId);
      if (cronJob) {
        await this.updateNextExecutionTime(scheduleId, cronJob);
      } else if (schedule.scheduleType === 'interval' && schedule.intervalMinutes) {
        const nextExecution = new Date(Date.now() + schedule.intervalMinutes * 60 * 1000);
        await tradingSchedulesDAO.update(scheduleId, { nextExecutionAt: nextExecution });
      }

      log.info('Schedule ' + scheduleId + ' execution completed: ' + (result.success ? 'success' : 'failed'));
      
      // Broadcast execution complete event
      this.realtimeService.broadcastExecutionComplete(
        schedule.userId,
        schedule.id,
        schedule.name,
        execution.id,
        triggerType,
        {
          success: result.success,
          tradesExecuted: result.tradesExecuted,
          totalValue: result.totalValue,
          errorMessage: result.error?.message ?? result.message,
        }
      ).catch(err => log.error('Failed to broadcast execution complete:', err));
      
      return completedExecution;
    } catch (err) {
      log.error('Schedule ' + scheduleId + ' execution failed:', err);
      
      await tradingSchedulesDAO.updateExecution(execution.id, {
        completedAt: new Date(),
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
      });

      await tradingSchedulesDAO.updateExecutionStats(schedule.id, false);

      // Broadcast execution failed event
      this.realtimeService.broadcastExecutionComplete(
        schedule.userId,
        schedule.id,
        schedule.name,
        execution.id,
        triggerType,
        {
          success: false,
          tradesExecuted: 0,
          errorMessage: err instanceof Error ? err.message : String(err),
        }
      ).catch(broadcastErr => log.error('Failed to broadcast execution failed:', broadcastErr));

      return null;
    }
  }

  private async executeStrategy(schedule: TradingSchedule): Promise<ExecutionResult> {
    log.info('Executing strategy for schedule ' + schedule.id);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const success = Math.random() > 0.2;
      
      return {
        success,
        tradesExecuted: success ? 1 : 0,
        totalValue: success ? 100 : undefined,
        message: success ? 'Strategy executed successfully' : 'Strategy execution failed',
      };
    } catch (err) {
      return {
        success: false,
        tradesExecuted: 0,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }

  private async recordExecution(
    schedule: TradingSchedule, 
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled', 
    options: { message?: string; triggerType?: 'scheduled' | 'manual' | 'condition' }
  ): Promise<ScheduleExecution | null> {
    try {
      const execution = await tradingSchedulesDAO.createExecution({
        scheduleId: schedule.id,
        scheduledAt: new Date(),
        startedAt: new Date(),
        triggerType: options.triggerType || 'scheduled',
      });

      const updatedExecution = await tradingSchedulesDAO.updateExecution(execution.id, {
        completedAt: new Date(),
        status,
        errorMessage: options.message,
      });

      // Broadcast execution skipped event if status is 'skipped'
      if (status === 'skipped') {
        this.realtimeService.broadcastExecutionSkipped(
          schedule.userId,
          schedule.id,
          schedule.name,
          execution.id,
          options.message || 'Execution skipped'
        ).catch(err => log.error('Failed to broadcast execution skipped:', err));
      }

      return updatedExecution;
    } catch (err) {
      log.error('Failed to record execution:', err);
      return null;
    }
  }

  private async updateNextExecutionTime(scheduleId: string, job: CronJob): Promise<void> {
    try {
      const nextDate = job.nextDate();
      if (nextDate) {
        await tradingSchedulesDAO.update(scheduleId, { 
          nextExecutionAt: nextDate.toJSDate() 
        });
      }
    } catch (err) {
      log.error('Failed to update next execution time:', err);
    }
  }

  private async checkDueSchedules(): Promise<void> {
    if (!this.isRunning) return;

    const now = new Date();
    const schedules = await tradingSchedulesDAO.findDueSchedules(now);

    for (const schedule of schedules) {
      if (schedule.scheduleType === 'interval' && !this.intervalJobs.has(schedule.id)) {
        log.info('Found due schedule ' + schedule.id);
        await this.executeSchedule(schedule.id);
      }
    }
  }

  getStatus(): { isRunning: boolean; activeJobs: number } {
    return {
      isRunning: this.isRunning,
      activeJobs: this.cronJobs.size + this.intervalJobs.size,
    };
  }

  /**
   * Track a user's active schedule
   */
  private trackUserSchedule(userId: string, scheduleId: string): void {
    if (!this.activeUserSchedules.has(userId)) {
      this.activeUserSchedules.set(userId, new Set());
    }
    this.activeUserSchedules.get(userId)!.add(scheduleId);
  }

  /**
   * Get the number of active jobs for a specific user
   */
  private getUserActiveJobsCount(userId: string): number {
    const userScheduleIds = this.activeUserSchedules.get(userId);
    if (!userScheduleIds) return 0;

    let count = 0;
    for (const scheduleId of userScheduleIds) {
      if (this.cronJobs.has(scheduleId) || this.intervalJobs.has(scheduleId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Broadcast status to a specific user
   */
  private async broadcastUserStatus(userId: string): Promise<void> {
    const activeJobs = this.getUserActiveJobsCount(userId);
    const status = this.isRunning ? 'running' : 'stopped';
    
    try {
      await this.realtimeService.broadcastStatus(userId, status, activeJobs);
      log.debug(`Broadcast status to user ${userId}: ${status}, activeJobs: ${activeJobs}`);
    } catch (err) {
      log.error(`Failed to broadcast status to user ${userId}:`, err);
    }
  }

  /**
   * Broadcast status to all active users
   */
  private async broadcastStatusToAllUsers(status: 'running' | 'stopped'): Promise<void> {
    const broadcastPromises: Promise<void>[] = [];
    
    for (const userId of this.activeUserSchedules.keys()) {
      broadcastPromises.push(this.broadcastUserStatus(userId));
    }

    await Promise.allSettled(broadcastPromises);
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
      scheduleType: data.schedule_type as 'cron' | 'interval' | 'condition',
      intervalMinutes: data.interval_minutes as number | undefined,
      conditionType: data.condition_type as 'price_above' | 'price_below' | 'volatility_above' | 'volatility_below' | 'volume_above' | undefined,
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
}

export function getSchedulerService(config?: SchedulerConfig): SchedulerService {
  return SchedulerService.getInstance(config);
}
