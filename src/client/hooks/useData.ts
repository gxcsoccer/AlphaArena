import { useEffect, useState, useCallback } from 'react';
import { WebSocketClient, api, Strategy, Trade, Portfolio, Stats } from '../utils/api';

/**
 * Hook for WebSocket connection management
 */
export const useWebSocket = () => {
  const [connected, setConnected] = useState(false);
  const [wsClient, setWsClient] = useState<WebSocketClient | null>(null);

  useEffect(() => {
    const client = new WebSocketClient();
    
    client.connect()
      .then(() => setConnected(true))
      .catch((err) => console.error('[useWebSocket] Connection failed:', err));

    setWsClient(client);

    return () => {
      client.disconnect();
      setConnected(false);
    };
  }, []);

  const subscribe = useCallback((strategyId?: string, symbol?: string) => {
    wsClient?.subscribe(strategyId, symbol);
  }, [wsClient]);

  const unsubscribe = useCallback((room: string) => {
    wsClient?.unsubscribe(room);
  }, [wsClient]);

  const on = useCallback((event: string, callback: Function) => {
    wsClient?.on(event, callback);
  }, [wsClient]);

  return { connected, subscribe, unsubscribe, on };
};

/**
 * Hook for fetching and auto-refreshing stats
 */
export const useStats = (refreshInterval: number = 5000) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchStats, refreshInterval]);

  return { stats, loading, error, refresh: fetchStats };
};

/**
 * Hook for strategies with real-time updates
 */
export const useStrategies = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connected, on } = useWebSocket();

  const fetchStrategies = useCallback(async () => {
    try {
      const data = await api.getStrategies();
      setStrategies(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  // Listen for strategy updates via WebSocket
  useEffect(() => {
    if (!connected) return;

    const handleStrategyUpdate = (data: any) => {
      setStrategies(prev => {
        const index = prev.findIndex(s => s.id === data.strategyId);
        if (index === -1) return prev;
        const updated = [...prev];
        updated[index] = { ...updated[index], ...data };
        return updated;
      });
    };

    on('strategy:tick', handleStrategyUpdate);
    return () => {
      // Cleanup handled by useWebSocket
    };
  }, [connected, on]);

  return { strategies, loading, error, refresh: fetchStrategies };
};

/**
 * Hook for recent trades with real-time updates
 */
export const useTrades = (filters?: { strategyId?: string; symbol?: string }, limit: number = 100) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connected, on } = useWebSocket();

  const fetchTrades = useCallback(async () => {
    try {
      const data = await api.getTrades({ ...filters, limit });
      setTrades(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, limit]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // Listen for new trades via WebSocket
  useEffect(() => {
    if (!connected) return;

    const handleNewTrade = (trade: Trade) => {
      // Filter by current filters if set
      if (filters?.strategyId && trade.strategyId !== filters.strategyId) return;
      if (filters?.symbol && trade.symbol !== filters.symbol) return;

      setTrades(prev => [trade, ...prev].slice(0, limit));
    };

    on('trade:new', handleNewTrade);
    return () => {
      // Cleanup handled by useWebSocket
    };
  }, [connected, on, filters, limit]);

  return { trades, loading, error, refresh: fetchTrades };
};

/**
 * Hook for portfolio data
 */
export const usePortfolio = (strategyId?: string, symbol?: string) => {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connected, on } = useWebSocket();

  const fetchPortfolio = useCallback(async () => {
    try {
      const data = await api.getPortfolio(strategyId, symbol);
      setPortfolio(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [strategyId, symbol]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  // Listen for portfolio updates via WebSocket
  useEffect(() => {
    if (!connected) return;

    const handlePortfolioUpdate = (data: Portfolio) => {
      if (strategyId && data.strategyId !== strategyId) return;
      setPortfolio(data);
    };

    on('portfolio:update', handlePortfolioUpdate);
    return () => {
      // Cleanup handled by useWebSocket
    };
  }, [connected, on, strategyId]);

  return { portfolio, loading, error, refresh: fetchPortfolio };
};
