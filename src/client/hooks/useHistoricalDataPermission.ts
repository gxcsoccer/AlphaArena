/**
 * useHistoricalDataPermission Hook
 * Manages historical data access based on subscription tier
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSubscription } from './useSubscription';
import { api } from '../utils/api';
import { createLogger } from '../../utils/logger';

const log = createLogger('useHistoricalDataPermission');

export interface HistoricalDataLimit {
  maxDays: number;
  isUnlimited: boolean;
  description: string;
}

export interface HistoricalDataPermissionState {
  limit: HistoricalDataLimit;
  loading: boolean;
  error: string | null;
  checkPermission: (requestedDays: number) => { allowed: boolean; message?: string };
  getAdjustedStartDate: (requestedStartDate: Date) => Date;
}

// Data limits by plan (matching backend)
const HISTORICAL_DATA_LIMITS: Record<string, number> = {
  free: 7,
  pro: 30,
  enterprise: -1,
};

/**
 * Hook for managing historical data permissions
 */
export function useHistoricalDataPermission(): HistoricalDataPermissionState {
  const { subscription, isLoading, isPro } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine plan from subscription
  const plan = useMemo(() => {
    if (!subscription) return 'free';
    return (subscription.planId || subscription.plan || 'free') as string;
  }, [subscription]);

  // Calculate limit based on plan
  const limit = useMemo<HistoricalDataLimit>(() => {
    const maxDays = HISTORICAL_DATA_LIMITS[plan] ?? HISTORICAL_DATA_LIMITS.free;
    
    if (maxDays === -1) {
      return {
        maxDays: -1,
        isUnlimited: true,
        description: '无限历史数据访问',
      };
    }
    
    return {
      maxDays,
      isUnlimited: false,
      description: `最近 ${maxDays} 天历史数据`,
    };
  }, [plan]);

  // Update loading state
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading]);

  // Check if requested days are within limit
  const checkPermission = useCallback(
    (requestedDays: number): { allowed: boolean; message?: string } => {
      if (limit.isUnlimited) {
        return { allowed: true };
      }

      if (requestedDays <= limit.maxDays) {
        return { allowed: true };
      }

      return {
        allowed: false,
        message: `您的订阅计划仅允许访问 ${limit.maxDays} 天的历史数据。请升级到更高级别的订阅计划以获取更多历史数据。`,
      };
    },
    [limit]
  );

  // Get adjusted start date based on limit
  const getAdjustedStartDate = useCallback(
    (requestedStartDate: Date): Date => {
      if (limit.isUnlimited) {
        return requestedStartDate;
      }

      const now = new Date();
      const minStartDate = new Date(now);
      minStartDate.setDate(minStartDate.getDate() - limit.maxDays);

      // If requested start date is earlier than allowed, adjust it
      if (requestedStartDate < minStartDate) {
        log.info(`Adjusting start date from ${requestedStartDate.toISOString()} to ${minStartDate.toISOString()}`);
        return minStartDate;
      }

      return requestedStartDate;
    },
    [limit]
  );

  return {
    limit,
    loading,
    error,
    checkPermission,
    getAdjustedStartDate,
  };
}

/**
 * Hook for fetching limited historical data
 * Automatically adjusts data range based on subscription
 */
export function useLimitedHistoricalData(
  symbol: string,
  requestedStartDate: Date,
  requestedEndDate: Date = new Date()
) {
  const { limit, loading: permissionLoading, checkPermission, getAdjustedStartDate } = useHistoricalDataPermission();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Calculate requested days
  const requestedDays = useMemo(() => {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((requestedEndDate.getTime() - requestedStartDate.getTime()) / oneDay));
  }, [requestedStartDate, requestedEndDate]);

  // Adjust start date if needed
  const adjustedStartDate = useMemo(() => {
    return getAdjustedStartDate(requestedStartDate);
  }, [requestedStartDate, getAdjustedStartDate]);

  // Check permission and set warning
  useEffect(() => {
    const result = checkPermission(requestedDays);
    if (!result.allowed && result.message) {
      setWarning(result.message);
    } else {
      setWarning(null);
    }
  }, [requestedDays, checkPermission]);

  // Fetch data with adjusted range
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // In a real implementation, this would call the API with the adjusted dates
        // For now, we'll use the existing K-line data API
        const response = await api.getKLineData(symbol, '1h', limit.isUnlimited ? undefined : limit.maxDays * 24);
        setData(response);
      } catch (err: any) {
        setError(err.message || '获取数据失败');
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchData();
    }
  }, [symbol, adjustedStartDate, limit]);

  return {
    data,
    loading: loading || permissionLoading,
    error,
    warning,
    limit,
    adjustedStartDate,
    actualDays: limit.isUnlimited ? requestedDays : Math.min(requestedDays, limit.maxDays),
  };
}

export default useHistoricalDataPermission;