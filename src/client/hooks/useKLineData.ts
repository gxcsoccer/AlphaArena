import { useEffect, useState, useCallback } from 'react';
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

  const fetchKLineData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[useKLineData] Fetching K-line data for:', { symbol, timeframe, limit });
      const data = await api.getKLineData(symbol, timeframe, limit);
      console.log('[useKLineData] Received data:', data?.length, 'points');
      setKlineData(data);
    } catch (err: any) {
      console.error('[useKLineData] Failed to fetch K-line data:', err);
      setError(err.message || '未知错误');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, limit]);

  useEffect(() => {
    fetchKLineData();
  }, [fetchKLineData]);

  return { klineData, loading, error, refresh: fetchKLineData };
};

export default useKLineData;
