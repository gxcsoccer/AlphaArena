/**
 * Rebalance Scheduler
 * 
 * Automated scheduling service for portfolio rebalancing.
 * Supports daily, weekly, and monthly rebalancing schedules.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  RebalancePlan,
  ScheduleFrequency,
  RebalanceTrigger,
  RebalanceExecution,
  RebalanceExecutionStatus,
  RebalanceResult,
} from './types';
import { RebalanceEngine } from './RebalanceEngine';
import { rebalanceDAO } from '../../database/rebalance.dao';
import { createLogger } from '../../utils/logger';

const log = createLogger('RebalanceScheduler');

/**
 * Scheduled job representation
 */
interface ScheduledJob {
  id: string;
  planId: string;
  nextRunTime: Date;
  lastRunTime?: Date;
  status: 'scheduled' | 'running' | 'paused' | 'failed';
  error?: string;
}

/**
 * Scheduler configuration
 */
interface SchedulerConfig {
  checkIntervalMs: number; // How often to check for scheduled jobs
  maxConcurrentJobs: number; // Maximum concurrent rebalances
  enableRetry: boolean; // Enable retry on failure
  notifyOnExecution: boolean; // Send notifications on execution
}

const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  checkIntervalMs: 60000, // 1 minute
  maxConcurrentJobs: 3,
  enableRetry: true,
  notifyOnExecution: true,
};

/**
 * Rebalance Scheduler Service
 * 
 * Manages automated rebalancing schedules and executes rebalancing
 * according to the configured frequency and time.
 */
export class RebalanceScheduler {
  private config: SchedulerConfig;
  private engine: RebalanceEngine;
  private scheduledJobs: Map<string, ScheduledJob>;
  private runningJobs: Set<string>;
  private checkInterval?: ReturnType<typeof setInterval>;
  private isRunning: boolean;

  constructor(
    engine: RebalanceEngine,
    config?: Partial<SchedulerConfig>
  ) {
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    this.engine = engine;
    this.scheduledJobs = new Map();
    this.runningJobs = new Set();
    this.isRunning = false;
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    
    // Load all active scheduled plans
    await this.loadScheduledPlans();
    
    // Start the check interval
    this.checkInterval = setInterval(() => {
      this.checkAndExecute().catch(error => {
        log.error('Error in scheduler check', { error: error.message });
      });
    }, this.config.checkIntervalMs);

    log.info('Rebalance scheduler started', {
      checkIntervalMs: this.config.checkIntervalMs,
      activeJobs: this.scheduledJobs.size,
    });
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    // Wait for running jobs to complete (with timeout)
    const maxWait = 30000; // 30 seconds
    const startTime = Date.now();
    while (this.runningJobs.size > 0 && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    log.info('Rebalance scheduler stopped');
  }

  /**
   * Load all active scheduled plans from database
   */
  private async loadScheduledPlans(): Promise<void> {
    try {
      const plans = await rebalanceDAO.getPlans(true);
      const scheduledPlans = plans.filter(
        p => p.trigger === RebalanceTrigger.SCHEDULED && p.schedule
      );

      for (const plan of scheduledPlans) {
        await this.schedulePlan(plan);
      }

      log.info('Loaded scheduled plans', { count: scheduledPlans.length });
    } catch (error: any) {
      log.error('Failed to load scheduled plans', { error: error.message });
    }
  }

  /**
   * Schedule a plan for automated rebalancing
   */
  async schedulePlan(plan: RebalancePlan): Promise<ScheduledJob> {
    if (plan.trigger !== RebalanceTrigger.SCHEDULED || !plan.schedule) {
      throw new Error('Plan is not configured for scheduled rebalancing');
    }

    const nextRunTime = this.calculateNextRunTime(plan.schedule);
    
    const job: ScheduledJob = {
      id: uuidv4(),
      planId: plan.id,
      nextRunTime,
      status: 'scheduled',
    };

    this.scheduledJobs.set(plan.id, job);

    log.info('Scheduled plan', {
      planId: plan.id,
      planName: plan.name,
      frequency: plan.schedule.frequency,
      nextRunTime: nextRunTime.toISOString(),
    });

    return job;
  }

  /**
   * Unschedule a plan
   */
  async unschedulePlan(planId: string): Promise<boolean> {
    const job = this.scheduledJobs.get(planId);
    if (!job) {
      return false;
    }

    if (job.status === 'running') {
      log.warn('Cannot unschedule a running job', { planId });
      return false;
    }

    this.scheduledJobs.delete(planId);
    log.info('Unscheduled plan', { planId });
    return true;
  }

  /**
   * Update schedule for a plan
   */
  async updateSchedule(plan: RebalancePlan): Promise<ScheduledJob> {
    await this.unschedulePlan(plan.id);
    return this.schedulePlan(plan);
  }

  /**
   * Get all scheduled jobs
   */
  getScheduledJobs(): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values());
  }

  /**
   * Get next run time for a plan
   */
  getNextRunTime(planId: string): Date | undefined {
    return this.scheduledJobs.get(planId)?.nextRunTime;
  }

  /**
   * Calculate next run time based on schedule config
   */
  private calculateNextRunTime(schedule: NonNullable<RebalancePlan['schedule']>): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    let nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    switch (schedule.frequency) {
      case ScheduleFrequency.DAILY:
        // If time has passed today, schedule for tomorrow
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;

      case ScheduleFrequency.WEEKLY:
        const targetDay = schedule.dayOfWeek ?? 1; // Default Monday
        const currentDay = now.getDay();
        let daysUntilTarget = targetDay - currentDay;
        
        if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
          daysUntilTarget += 7;
        }
        
        nextRun.setDate(nextRun.getDate() + daysUntilTarget);
        break;

      case ScheduleFrequency.MONTHLY:
        const targetDate = schedule.dayOfMonth ?? 1;
        const currentDate = now.getDate();
        
        nextRun.setDate(targetDate);
        
        // If we've passed this month's target date, move to next month
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;
    }

    return nextRun;
  }

  /**
   * Check and execute scheduled jobs
   */
  private async checkAndExecute(): Promise<void> {
    const now = new Date();

    for (const [planId, job] of this.scheduledJobs) {
      // Skip if already running
      if (job.status === 'running' || this.runningJobs.has(planId)) {
        continue;
      }

      // Check if it's time to run
      if (job.nextRunTime <= now && this.runningJobs.size < this.config.maxConcurrentJobs) {
        await this.executeScheduledJob(planId);
      }
    }
  }

  /**
   * Execute a scheduled job
   */
  private async executeScheduledJob(planId: string): Promise<void> {
    const job = this.scheduledJobs.get(planId);
    if (!job) return;

    const plan = await rebalanceDAO.getPlan(planId);
    if (!plan || !plan.isActive) {
      log.warn('Plan not found or inactive, removing from schedule', { planId });
      this.scheduledJobs.delete(planId);
      return;
    }

    // Check cooldown period
    if (plan.threshold && job.lastRunTime) {
      const cooldownHours = 24; // Default 24 hours
      const hoursSinceLastRun = (Date.now() - job.lastRunTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastRun < cooldownHours) {
        log.debug('Skipping due to cooldown period', { planId, hoursSinceLastRun });
        return;
      }
    }

    // Mark as running
    job.status = 'running';
    this.runningJobs.add(planId);

    log.info('Executing scheduled rebalance', { planId, planName: plan.name });

    try {
      // Get user positions from virtual account
      // Note: In production, this would integrate with the account system
      const positions: Array<{ symbol: string; quantity: number; averageCost: number }> = []; // TODO: Fetch from virtual account
      
      // Execute rebalancing
      const result: RebalanceResult = await this.engine.execute(
        plan,
        positions,
        RebalanceTrigger.SCHEDULED
      );

      if (result.success && result.execution) {
        // Save execution record
        await rebalanceDAO.createExecution(result.execution);

        // Update job status
        job.lastRunTime = new Date();
        job.status = 'scheduled';
        
        // Calculate next run time
        if (plan.schedule) {
          job.nextRunTime = this.calculateNextRunTime(plan.schedule);
        }

        log.info('Scheduled rebalance completed', {
          planId,
          executionId: result.execution.id,
          status: result.execution.status,
        });
      } else {
        throw new Error(result.error || 'Rebalancing failed');
      }
    } catch (error: any) {
      log.error('Scheduled rebalance failed', { planId, error: error.message });
      
      job.status = 'failed';
      job.error = error.message;

      // Retry logic
      if (this.config.enableRetry) {
        // Schedule retry in 1 hour
        job.nextRunTime = new Date(Date.now() + 60 * 60 * 1000);
        job.status = 'scheduled';
        log.info('Scheduled retry for failed job', { planId, nextRunTime: job.nextRunTime });
      }
    } finally {
      this.runningJobs.delete(planId);
    }
  }

  /**
   * Manually trigger a scheduled plan
   */
  async triggerNow(planId: string): Promise<RebalanceResult> {
    const plan = await rebalanceDAO.getPlan(planId);
    if (!plan) {
      return {
        success: false,
        error: 'Plan not found',
      };
    }

    // Get positions from virtual account
    const positions: Array<{ symbol: string; quantity: number; averageCost: number }> = []; // TODO: Fetch from virtual account

    return this.engine.execute(plan, positions, RebalanceTrigger.MANUAL);
  }

  /**
   * Pause a scheduled job
   */
  pauseJob(planId: string): boolean {
    const job = this.scheduledJobs.get(planId);
    if (!job || job.status === 'running') {
      return false;
    }

    job.status = 'paused';
    log.info('Paused scheduled job', { planId });
    return true;
  }

  /**
   * Resume a paused job
   */
  resumeJob(planId: string): boolean {
    const job = this.scheduledJobs.get(planId);
    if (!job || job.status !== 'paused') {
      return false;
    }

    job.status = 'scheduled';
    log.info('Resumed scheduled job', { planId });
    return true;
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    totalJobs: number;
    runningJobs: number;
    scheduledJobs: number;
    pausedJobs: number;
    failedJobs: number;
  } {
    const jobs = Array.from(this.scheduledJobs.values());
    
    return {
      isRunning: this.isRunning,
      totalJobs: jobs.length,
      runningJobs: jobs.filter(j => j.status === 'running').length,
      scheduledJobs: jobs.filter(j => j.status === 'scheduled').length,
      pausedJobs: jobs.filter(j => j.status === 'paused').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
    };
  }
}

// Singleton instance
let schedulerInstance: RebalanceScheduler | null = null;

/**
 * Get or create the scheduler singleton
 */
export function getRebalanceScheduler(
  engine: RebalanceEngine,
  config?: Partial<SchedulerConfig>
): RebalanceScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new RebalanceScheduler(engine, config);
  }
  return schedulerInstance;
}

export default RebalanceScheduler;