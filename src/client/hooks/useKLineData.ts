import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../utils/api';
import type { KLineDataPoint, TimeFrame } from '../components/KLineChart';

/**
 * Hook for fetching K-line (candlestick) data
 */
export const useKLineData = (
  symbol: string,
  timeframe: TimeFrame = '1h',
  limit: number = 1000
) => {
  const [klineData, setKlineData] = useState<KLineDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevSymbolRef = useRef<string>('');

  const fetchKLineData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[useKLineData] Fetching K-line data for:', { symbol, timeframe, limit });
      const data = await api.getKLineData(symbol, timeframe, limit);
      console.log('[useKLineData] Received data:', data?.length, 'points');
      
      if (!Array.isArray(data)) {
        console.error('[useKLineData] Invalid data format: not an array');
        setError('数据格式错误');
        setKlineData([]);
      } else {
        setKlineData(data);
      }
    } catch (err: any) {
      console.error('[useKLineData] Failed to fetch K-line data:', err.message);
      setError(err.message || '未知错误');
      setKlineData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, limit]);

  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      console.log('[useKLineData] Symbol changed, resetting data');
      setKlineData([]);
      setLoading(true);
      prevSymbolRef.current = symbol;
    }
    fetchKLineData();
  }, [fetchKLineData, symbol]);

  return { klineData, loading, error, refresh: fetchKLineData };
};

export default useKLineData;
