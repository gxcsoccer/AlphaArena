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
      
      const data = await api.getKLineData(symbol, timeframe, limit);
      setKlineData(data);
    } catch (err: any) {
      setError(err.message);
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
