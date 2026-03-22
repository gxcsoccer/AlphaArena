/**
 * useSchedulerRealtime Hook
 * Provides WebSocket real-time status updates for the scheduler
 * 
 * Features:
 * - Real-time scheduler status updates
 * - Execution event streaming
 * - Automatic reconnection on disconnect
 * - Multi-tab synchronization
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { RealtimeChannel, createClient } from '@supabase/supabase-js';
import { validateConfig } from '../utils/config';

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

export interface SchedulerRealtimeState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastEvent: SchedulerRealtimeEvent | null;
  executionEvents: ExecutionEvent[];
  schedulerStatus: SchedulerStatus | null;
  activeJobs: number;
}

export interface UseSchedulerRealtimeOptions {
  userId: string | undefined;
  maxExecutionEvents?: number;
  onStatusChange?: (event: SchedulerStatusEvent) => void;
  onExecutionStart?: (event: ExecutionEvent) => void;
  onExecutionComplete?: (event: ExecutionEvent) => void;
  onExecutionFailed?: (event: ExecutionEvent) => void;
  onExecutionSkipped?: (event: ExecutionEvent) => void;
  onScheduleUpdated?: (event: ScheduleUpdatedEvent) => void;
}

// Get or create Supabase client for scheduler realtime
function getSchedulerSupabaseClient() {
  const config = validateConfig();
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

export function useSchedulerRealtime(options: UseSchedulerRealtimeOptions): SchedulerRealtimeState {
  const {
    userId,
    maxExecutionEvents = 50,
    onStatusChange,
    onExecutionStart,
    onExecutionComplete,
    onExecutionFailed,
    onExecutionSkipped,
    onScheduleUpdated,
  } = options;

  const [state, setState] = useState<SchedulerRealtimeState>({
    isConnected: false,
    isReconnecting: false,
    lastEvent: null,
    executionEvents: [],
    schedulerStatus: null,
    activeJobs: 0,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<ReturnType<typeof getSchedulerSupabaseClient> | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const connectRef = useRef<() => Promise<void>>();

  const addExecutionEvent = useCallback((event: ExecutionEvent) => {
    setState(prev => {
      const newEvents = [event, ...prev.executionEvents].slice(0, maxExecutionEvents);
      return { ...prev, executionEvents: newEvents };
    });
  }, [maxExecutionEvents]);

  const setupChannel = useCallback(() => {
    if (!userId) return null;

    if (!supabaseRef.current) {
      supabaseRef.current = getSchedulerSupabaseClient();
    }

    const topic = `scheduler:${userId}`;
    
    const channel = supabaseRef.current.channel(topic, {
      config: {
        private: false,
      },
    });

    // Subscribe to status change events
    channel.on('broadcast', { event: 'status_change' }, (payload) => {
      const event = payload.payload as SchedulerStatusEvent;
      setState(prev => ({
        ...prev,
        lastEvent: event,
        schedulerStatus: event.status,
        activeJobs: event.activeJobs,
      }));
      onStatusChange?.(event);
    });

    // Subscribe to execution start events
    channel.on('broadcast', { event: 'execution_start' }, (payload) => {
      const event = payload.payload as ExecutionEvent;
      setState(prev => ({ ...prev, lastEvent: event }));
      addExecutionEvent(event);
      onExecutionStart?.(event);
    });

    // Subscribe to execution complete events
    channel.on('broadcast', { event: 'execution_complete' }, (payload) => {
      const event = payload.payload as ExecutionEvent;
      setState(prev => ({ ...prev, lastEvent: event }));
      addExecutionEvent(event);
      onExecutionComplete?.(event);
    });

    // Subscribe to execution failed events
    channel.on('broadcast', { event: 'execution_failed' }, (payload) => {
      const event = payload.payload as ExecutionEvent;
      setState(prev => ({ ...prev, lastEvent: event }));
      addExecutionEvent(event);
      onExecutionFailed?.(event);
    });

    // Subscribe to execution skipped events
    channel.on('broadcast', { event: 'execution_skipped' }, (payload) => {
      const event = payload.payload as ExecutionEvent;
      setState(prev => ({ ...prev, lastEvent: event }));
      addExecutionEvent(event);
      onExecutionSkipped?.(event);
    });

    // Subscribe to schedule updated events
    channel.on('broadcast', { event: 'schedule_updated' }, (payload) => {
      const event = payload.payload as ScheduleUpdatedEvent;
      setState(prev => ({ ...prev, lastEvent: event }));
      onScheduleUpdated?.(event);
    });

    return channel;
  }, [userId, onStatusChange, onExecutionStart, onExecutionComplete, onExecutionFailed, onExecutionSkipped, onScheduleUpdated, addExecutionEvent]);

  const connect = useCallback(async () => {
    if (!userId) return;

    const channel = setupChannel();
    if (!channel) return;

    try {
      await channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setState(prev => ({
            ...prev,
            isConnected: true,
            isReconnecting: false,
          }));
          reconnectAttemptsRef.current = 0;
        } else if (status === 'CLOSED') {
          setState(prev => ({
            ...prev,
            isConnected: false,
          }));
          // Attempt to reconnect with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          
          setState(prev => ({ ...prev, isReconnecting: true }));
          
          reconnectTimeoutRef.current = setTimeout(() => {
            // Use ref to avoid self-reference issue
            connectRef.current?.();
          }, delay);
        } else if (status === 'CHANNEL_ERROR') {
          setState(prev => ({
            ...prev,
            isConnected: false,
            isReconnecting: false,
          }));
        }
      });

      channelRef.current = channel;
    } catch (error) {
      console.error('Failed to subscribe to scheduler channel:', error);
      setState(prev => ({
        ...prev,
        isConnected: false,
        isReconnecting: false,
      }));
    }
  }, [userId, setupChannel]);

  // Keep connectRef in sync with connect (in useEffect to avoid render-phase ref update)
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(async () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (channelRef.current && supabaseRef.current) {
      await supabaseRef.current.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isReconnecting: false,
    }));
  }, []);

  // Handle page visibility changes for multi-tab sync
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !state.isConnected && userId) {
        // Reconnect when tab becomes visible
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.isConnected, userId, connect]);

  // Connect on mount and when userId changes
  useEffect(() => {
    if (userId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [userId, connect, disconnect]);

  return state;
}

/**
 * Hook to get scheduler status indicator
 */
export function useSchedulerStatus(userId: string | undefined) {
  const { isConnected, schedulerStatus, activeJobs, isReconnecting } = useSchedulerRealtime({
    userId,
  });

  const statusColor = schedulerStatus === 'running' ? 'green' : 
                      schedulerStatus === 'paused' ? 'orange' : 
                      schedulerStatus === 'stopped' ? 'gray' : 'gray';

  const statusText = schedulerStatus === 'running' ? '运行中' :
                     schedulerStatus === 'paused' ? '已暂停' :
                     schedulerStatus === 'stopped' ? '已停止' : '未连接';

  return {
    isConnected,
    isReconnecting,
    schedulerStatus,
    activeJobs,
    statusColor,
    statusText,
  };
}

export default useSchedulerRealtime;