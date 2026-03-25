/**
 * Scheduler Realtime Service
 * Provides WebSocket real-time status updates for the scheduler
 * 
 * Channel naming:
 * - scheduler:{userId} - User-specific scheduler events
 * 
 * Events:
 * - status_change - Scheduler running/stopped/paused
 * - execution_start - Schedule execution started
 * - execution_complete - Schedule execution completed (success/failed)
 * - schedule_updated - Schedule configuration changed
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../database/client';
import { createLogger } from '../utils/logger';

const log = createLogger('SchedulerRealtime');

export type SchedulerStatus = 'running' | 'stopped' | 'paused';
export type ExecutionEventType = 'execution_start' | 'execution_complete' | 'execution_failed' | 'execution_skipped';

export interface SchedulerStatusEvent {
  type: 'status_change';
  userId: string;
  status: SchedulerStatus;
  activeJobs: number;
  timestamp: number;
}

export interface ExecutionEvent {
  type: ExecutionEventType;
  userId: string;
  scheduleId: string;
  scheduleName: string;
  executionId: string;
  triggerType: 'scheduled' | 'manual' | 'condition';
  result?: {
    success: boolean;
    tradesExecuted: number;
    totalValue?: number;
    errorMessage?: string;
  };
  timestamp: number;
}

export interface ScheduleUpdatedEvent {
  type: 'schedule_updated';
  userId: string;
  scheduleId: string;
  action: 'created' | 'updated' | 'deleted' | 'enabled' | 'disabled';
  timestamp: number;
}

export type SchedulerRealtimeEvent = SchedulerStatusEvent | ExecutionEvent | ScheduleUpdatedEvent;

class SchedulerRealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private supabase = getSupabaseClient();

  /**
   * Get or create a channel for a user
   */
  private getChannel(userId: string): RealtimeChannel {
    const topic = `scheduler:${userId}`;
    
    if (!this.channels.has(topic)) {
      const channel = this.supabase.channel(topic, {
        config: {
          private: false,
        },
      });
      this.channels.set(topic, channel);
    }
    
    return this.channels.get(topic)!;
  }

  /**
   * Broadcast scheduler status change
   */
  async broadcastStatus(
    userId: string,
    status: SchedulerStatus,
    activeJobs: number
  ): Promise<boolean> {
    try {
      const channel = this.getChannel(userId);
      const event: SchedulerStatusEvent = {
        type: 'status_change',
        userId,
        status,
        activeJobs,
        timestamp: Date.now(),
      };

      const result = await channel.send({
        type: 'broadcast',
        event: 'status_change',
        payload: event,
      });

      const success = result === 'ok' || (result as any).status === 'ok';
      
      if (success) {
        log.debug(`Broadcast status change for user ${userId}: ${status}`);
      } else {
        log.error(`Failed to broadcast status for user ${userId}`);
      }

      return success;
    } catch (error: any) {
      log.error(`Error broadcasting status: ${error.message}`);
      return false;
    }
  }

  /**
   * Broadcast execution started event
   */
  async broadcastExecutionStart(
    userId: string,
    scheduleId: string,
    scheduleName: string,
    executionId: string,
    triggerType: 'scheduled' | 'manual' | 'condition'
  ): Promise<boolean> {
    try {
      const channel = this.getChannel(userId);
      const event: ExecutionEvent = {
        type: 'execution_start',
        userId,
        scheduleId,
        scheduleName,
        executionId,
        triggerType,
        timestamp: Date.now(),
      };

      const result = await channel.send({
        type: 'broadcast',
        event: 'execution_start',
        payload: event,
      });

      const success = result === 'ok' || (result as any).status === 'ok';
      
      if (success) {
        log.info(`Broadcast execution start: ${scheduleName} (${scheduleId})`);
      }

      return success;
    } catch (error: any) {
      log.error(`Error broadcasting execution start: ${error.message}`);
      return false;
    }
  }

  /**
   * Broadcast execution completed event
   */
  async broadcastExecutionComplete(
    userId: string,
    scheduleId: string,
    scheduleName: string,
    executionId: string,
    triggerType: 'scheduled' | 'manual' | 'condition',
    result: {
      success: boolean;
      tradesExecuted: number;
      totalValue?: number;
      errorMessage?: string;
    }
  ): Promise<boolean> {
    try {
      const channel = this.getChannel(userId);
      const eventType: ExecutionEventType = result.success ? 'execution_complete' : 'execution_failed';
      const event: ExecutionEvent = {
        type: eventType,
        userId,
        scheduleId,
        scheduleName,
        executionId,
        triggerType,
        result,
        timestamp: Date.now(),
      };

      const broadcastResult = await channel.send({
        type: 'broadcast',
        event: eventType,
        payload: event,
      });

      const success = broadcastResult === 'ok' || (broadcastResult as any).status === 'ok';
      
      if (success) {
        log.info(`Broadcast execution complete: ${scheduleName} - ${result.success ? 'success' : 'failed'}`);
      }

      return success;
    } catch (error: any) {
      log.error(`Error broadcasting execution complete: ${error.message}`);
      return false;
    }
  }

  /**
   * Broadcast execution skipped event
   */
  async broadcastExecutionSkipped(
    userId: string,
    scheduleId: string,
    scheduleName: string,
    executionId: string,
    reason: string
  ): Promise<boolean> {
    try {
      const channel = this.getChannel(userId);
      const event: ExecutionEvent = {
        type: 'execution_skipped',
        userId,
        scheduleId,
        scheduleName,
        executionId,
        triggerType: 'scheduled',
        result: {
          success: false,
          tradesExecuted: 0,
          errorMessage: reason,
        },
        timestamp: Date.now(),
      };

      const result = await channel.send({
        type: 'broadcast',
        event: 'execution_skipped',
        payload: event,
      });

      const success = result === 'ok' || (result as any).status === 'ok';
      
      if (success) {
        log.info(`Broadcast execution skipped: ${scheduleName} - ${reason}`);
      }

      return success;
    } catch (error: any) {
      log.error(`Error broadcasting execution skipped: ${error.message}`);
      return false;
    }
  }

  /**
   * Broadcast schedule updated event
   */
  async broadcastScheduleUpdate(
    userId: string,
    scheduleId: string,
    action: 'created' | 'updated' | 'deleted' | 'enabled' | 'disabled'
  ): Promise<boolean> {
    try {
      const channel = this.getChannel(userId);
      const event: ScheduleUpdatedEvent = {
        type: 'schedule_updated',
        userId,
        scheduleId,
        action,
        timestamp: Date.now(),
      };

      const result = await channel.send({
        type: 'broadcast',
        event: 'schedule_updated',
        payload: event,
      });

      const success = result === 'ok' || (result as any).status === 'ok';
      
      if (success) {
        log.info(`Broadcast schedule update: ${scheduleId} - ${action}`);
      }

      return success;
    } catch (error: any) {
      log.error(`Error broadcasting schedule update: ${error.message}`);
      return false;
    }
  }

  /**
   * Cleanup channels for a user
   */
  async cleanup(userId: string): Promise<void> {
    const topic = `scheduler:${userId}`;
    const channel = this.channels.get(topic);
    
    if (channel) {
      await this.supabase.removeChannel(channel);
      this.channels.delete(topic);
      log.debug(`Cleaned up channel for user ${userId}`);
    }
  }

  /**
   * Cleanup all channels
   */
  async cleanupAll(): Promise<void> {
    for (const [topic, channel] of this.channels) {
      await this.supabase.removeChannel(channel);
      this.channels.delete(topic);
    }
    log.debug('Cleaned up all scheduler realtime channels');
  }
}

// Singleton instance
let instance: SchedulerRealtimeService | null = null;

export function getSchedulerRealtimeService(): SchedulerRealtimeService {
  if (!instance) {
    instance = new SchedulerRealtimeService();
  }
  return instance;
}

/**
 * Reset the singleton instance (for testing purposes only)
 */
export function resetSchedulerRealtimeService(): void {
  instance = null;
}

export default SchedulerRealtimeService;
