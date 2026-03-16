import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../utils/api';
import type { KLineDataPoint, TimeFrame } from '../components/KLineChart';

interface UseKLineDataResult {
  klineData: KLineDataPoint[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  currentSymbol: string; // 暴露当前 symbol 用于验证数据匹配
}

/**
 * Hook for fetching K-line (candlestick) data
 */
export const useKLineData = (
  symbol: string,
  timeframe: TimeFrame = '1h',
  limit: number = 1000
): UseKLineDataResult => {
  const [klineData, setKlineData] = useState<KLineDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track the current symbol to ensure data matches
  const currentSymbolRef = useRef<string>(symbol);
  // Track the current request to handle race conditions
  const requestIdRef = useRef<number>(0);

  const fetchKLineData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const requestSymbol = symbol;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('[useKLineData] Fetching K-line data for:', { symbol, timeframe, limit, requestId });
      const data = await api.getKLineData(symbol, timeframe, limit);
      
      // Check if this is still the current request (no newer request has started)
      if (requestId !== requestIdRef.current) {
        console.log('[useKLineData] Stale response detected, ignoring data for:', requestSymbol);
        return;
      }
      
      // Verify symbol hasn't changed while fetching
      if (requestSymbol !== currentSymbolRef.current) {
        console.log('[useKLineData] Symbol changed during fetch, ignoring data for:', requestSymbol);
        return;
      }
      
      console.log('[useKLineData] Received data:', data?.length, 'points for symbol:', requestSymbol);
      
      if (!Array.isArray(data)) {
        console.error('[useKLineData] Invalid data format: not an array');
        setError('数据格式错误');
        setKlineData([]);
      } else {
        // Log first data point for debugging
        if (data.length > 0) {
          console.log('[useKLineData] First data point for', requestSymbol, ':', {
            time: data[0].time,
            open: data[0].open,
            close: data[0].close,
          });
        }
        setKlineData(data);
      }
    } catch (err: any) {
      // Check if this is still the current request
      if (requestId !== requestIdRef.current) {
        console.log('[useKLineData] Stale error response, ignoring for:', requestSymbol);
        return;
      }
      
      console.error('[useKLineData] Failed to fetch K-line data:', err.message);
      setError(err.message || '未知错误');
      setKlineData([]);
    } finally {
      // Only update loading state if this is the current request
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [symbol, timeframe, limit]);

  useEffect(() => {
    // Update the current symbol ref
    const previousSymbol = currentSymbolRef.current;
    currentSymbolRef.current = symbol;
    
    if (previousSymbol !== symbol) {
      console.log('[useKLineData] Symbol changed from', previousSymbol, 'to', symbol, '- clearing data');
      // Clear data immediately when symbol changes to prevent stale data
      setKlineData([]);
      setLoading(true);
      setError(null);
    }
    
    fetchKLineData();
  }, [fetchKLineData, symbol]);

  return { 
    klineData, 
    loading, 
    error, 
    refresh: fetchKLineData,
    currentSymbol: symbol 
  };
};

export default useKLineData;
