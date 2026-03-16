/**
 * usePriceAlerts Hook
 * 
 * Manages price alerts with real-time updates via Supabase Realtime.
 * Provides CRUD operations and real-time monitoring of triggered alerts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, PriceAlert } from '../utils/api';
import { getRealtimeClient } from '../utils/realtime';
import { getNotificationService } from '../utils/notificationService';

export interface CreateAlertParams {
  symbol: string;
  conditionType: 'above' | 'below';
  targetPrice: number;
  notificationMethod?: 'in_app' | 'feishu' | 'email' | 'push';
  expiresAt?: string;
  isRecurring?: boolean;
  notes?: string;
}

export interface UpdateAlertParams {
  targetPrice?: number;
  conditionType?: 'above' | 'below';
  notificationMethod?: 'in_app' | 'feishu' | 'email' | 'push';
  isRecurring?: boolean;
  notes?: string;
}

interface UsePriceAlertsOptions {
  symbol?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function usePriceAlerts(options: UsePriceAlertsOptions = {}) {
  const { symbol, autoRefresh = true, refreshInterval = 30000 } = options;
  
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(false);

  const notificationService = getNotificationService();

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPriceAlerts({ symbol, limit: 100 });
      if (isMountedRef.current) {
        setAlerts(data);
        setError(null);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || '获取价格提醒失败');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [symbol]);

  // Create alert
  const createAlert = useCallback(async (params: CreateAlertParams): Promise<PriceAlert | null> => {
    try {
      setActionLoading('create');
      const alert = await api.createPriceAlert({
        ...params,
        notificationMethod: params.notificationMethod || 'in_app',
      });
      
      if (alert && isMountedRef.current) {
        setAlerts(prev => [alert, ...prev]);
      }
      
      return alert;
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || '创建价格提醒失败');
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        setActionLoading(null);
      }
    }
  }, []);

  // Update alert
  const updateAlert = useCallback(async (id: string, params: UpdateAlertParams): Promise<PriceAlert | null> => {
    try {
      setActionLoading(`update-${id}`);
      const alert = await api.updatePriceAlert(id, params);
      
      if (alert && isMountedRef.current) {
        setAlerts(prev => prev.map(a => a.id === id ? alert : a));
      }
      
      return alert;
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || '更新价格提醒失败');
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        setActionLoading(null);
      }
    }
  }, []);

  // Delete alert
  const deleteAlert = useCallback(async (id: string): Promise<boolean> => {
    try {
      setActionLoading(`delete-${id}`);
      const success = await api.deletePriceAlert(id);
      
      if (success && isMountedRef.current) {
        setAlerts(prev => prev.filter(a => a.id !== id));
      }
      
      return success;
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || '删除价格提醒失败');
      }
      return false;
    } finally {
      if (isMountedRef.current) {
        setActionLoading(null);
      }
    }
  }, []);

  // Toggle alert status
  const toggleAlertStatus = useCallback(async (id: string): Promise<PriceAlert | null> => {
    const alert = alerts.find(a => a.id === id);
    if (!alert) return null;
    
    const newStatus = alert.status === 'active' ? 'disabled' : 'active';
    return updateAlert(id, { ...alert, status: newStatus } as any);
  }, [alerts, updateAlert]);

  // Enable alert
  const enableAlert = useCallback(async (id: string): Promise<PriceAlert | null> => {
    return updateAlert(id, { status: 'active' } as any);
  }, [updateAlert]);

  // Disable alert
  const disableAlert = useCallback(async (id: string): Promise<PriceAlert | null> => {
    return updateAlert(id, { status: 'disabled' } as any);
  }, [updateAlert]);

  // Subscribe to real-time updates
  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch
    fetchAlerts();

    // Set up auto-refresh
    let refreshTimer: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      refreshTimer = setInterval(fetchAlerts, refreshInterval);
    }

    // Subscribe to realtime updates
    const client = getRealtimeClient();
    
    const handleAlertTriggered = (data: any) => {
      if (!isMountedRef.current) return;
      
      // Update the alert in the list
      setAlerts(prev => prev.map(a => 
        a.id === data.id ? { ...a, ...data } : a
      ));

      // Show notification
      notificationService.showAlertTriggered({
        id: data.id,
        symbol: data.symbol,
        conditionType: data.conditionType,
        targetPrice: data.targetPrice,
        triggeredPrice: data.triggeredPrice,
      });
    };

    const handleAlertCreated = (data: PriceAlert) => {
      if (!isMountedRef.current) return;
      setAlerts(prev => [data, ...prev]);
    };

    const handleAlertUpdated = (data: PriceAlert) => {
      if (!isMountedRef.current) return;
      setAlerts(prev => prev.map(a => a.id === data.id ? data : a));
    };

    const handleAlertDeleted = (data: { id: string }) => {
      if (!isMountedRef.current) return;
      setAlerts(prev => prev.filter(a => a.id !== data.id));
    };

    // Subscribe to alert events
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(client.on('price-alerts:global', 'alert:triggered', handleAlertTriggered));
    unsubscribers.push(client.on('price-alerts:global', 'alert:created', handleAlertCreated));
    unsubscribers.push(client.on('price-alerts:global', 'alert:updated', handleAlertUpdated));
    unsubscribers.push(client.on('price-alerts:global', 'alert:deleted', handleAlertDeleted));

    // Subscribe to the channel
    client.subscribe('price-alerts:global').catch(err => {
      console.error('[usePriceAlerts] Failed to subscribe:', err);
    });

    unsubscribeRef.current = () => {
      unsubscribers.forEach(unsub => unsub());
    };

    return () => {
      isMountedRef.current = false;
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [fetchAlerts, autoRefresh, refreshInterval]);

  // Get alerts by status
  const getAlertsByStatus = useCallback((status: PriceAlert['status']) => {
    return alerts.filter(a => a.status === status);
  }, [alerts]);

  // Get active alerts count
  const activeCount = alerts.filter(a => a.status === 'active').length;
  const triggeredCount = alerts.filter(a => a.status === 'triggered').length;

  return {
    alerts,
    loading,
    error,
    actionLoading,
    activeCount,
    triggeredCount,
    createAlert,
    updateAlert,
    deleteAlert,
    toggleAlertStatus,
    enableAlert,
    disableAlert,
    refresh: fetchAlerts,
    getAlertsByStatus,
  };
}

export default usePriceAlerts;
