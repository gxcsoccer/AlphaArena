import { useEffect, useState, useCallback, useRef } from 'react';
import { api, Strategy, Trade, Portfolio, Stats, OrderBookSnapshot, RealtimeClient } from '../utils/api';
import { getRealtimeClient } from '../utils/realtime';

/**
 * Hook for Supabase Realtime connection management
 */
export const useWebSocket = () => {
  const [connected, setConnected] = useState(false);
  const realtimeClientRef = useRef<RealtimeClient | null>(null);

  useEffect(() => {
    const client = getRealtimeClient();
    realtimeClientRef.current = client;
    
    client.connect()
      .then(() => setConnected(true))
      .catch((err) => console.error('[useWebSocket] Connection failed:', err));

    return () => {
      // Don't disconnect - other components may be using it
    };
  }, []);

  const subscribe = useCallback(async (strategyId?: string, symbol?: string) => {
    if (strategyId) {
      await realtimeClientRef.current?.subscribe(`strategy:${strategyId}`);
    }
    if (symbol) {
      await realtimeClientRef.current?.subscribe(`ticker:${symbol}`);
    }
  }, []);

  const unsubscribe = useCallback(async (topic: string) => {
    await realtimeClientRef.current?.unsubscribe(topic);
  }, []);

  const on = useCallback((event: string, callback: Function) => {
    const client = realtimeClientRef.current;
    if (!client) return () => {};

    // Map legacy events to Realtime channels
    const [channelType, ...eventParts] = event.split(':');
    const eventName = eventParts.join(':');

    switch (channelType) {
      case 'strategy':
        return client.on(`strategy:${eventName}`, event, callback as any);
      case 'trade':
        return client.on('trade:global', event, callback as any);
      case 'portfolio':
        return client.on('trade:global', event, callback as any);
      case 'leaderboard':
        return client.on('leaderboard:global', event, callback as any);
      default:
        console.warn(`[Realtime] Unknown event type: ${event}`);
        return () => {};
    }
  }, []);

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
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef<boolean>(false);

  const fetchStrategies = useCallback(async () => {
    try {
      const data = await api.getStrategies();
      if (isMountedRef.current) {
        setStrategies(data);
        setError(null);
        setLoading(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchStrategies();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchStrategies]);

  // Listen for strategy updates via Supabase Realtime
  useEffect(() => {
    const client = getRealtimeClient();
    
    const handleStrategyUpdate = (data: any) => {
      if (!isMountedRef.current) return;
      setStrategies(prev => {
        const index = prev.findIndex(s => s.id === data.strategyId);
        if (index === -1) return prev;
        const updated = [...prev];
        updated[index] = { ...updated[index], ...data };
        return updated;
      });
    };

    // Subscribe to all strategy channels (in production, this should be dynamic)
    const unsubscribe = client.on('strategy:*', 'strategy:tick', handleStrategyUpdate);
    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return { strategies, loading, error, refresh: fetchStrategies };
};

/**
 * Hook for recent trades with real-time updates
 */
export const useTrades = (
  filters?: { strategyId?: string; symbol?: string; side?: 'buy' | 'sell' },
  limit: number = 100
) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef<boolean>(false);

  const fetchTrades = useCallback(async () => {
    try {
      const data = await api.getTrades({ ...filters, limit });
      if (isMountedRef.current) {
        setTrades(data);
        setError(null);
        setLoading(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, [filters, limit]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchTrades();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchTrades]);

  // Listen for new trades via Supabase Realtime
  useEffect(() => {
    const client = getRealtimeClient();

    const handleNewTrade = (trade: Trade) => {
      if (!isMountedRef.current) return;
      // Filter by current filters if set
      if (filters?.strategyId && trade.strategyId !== filters.strategyId) return;
      if (filters?.symbol && trade.symbol !== filters.symbol) return;

      setTrades(prev => [trade, ...prev].slice(0, limit));
    };

    const unsubscribe = client.onTrade('global', handleNewTrade);
    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [filters, limit]);

  return { trades, loading, error, refresh: fetchTrades };
};

/**
 * Hook for portfolio data
 */
export const usePortfolio = (strategyId?: string, symbol?: string) => {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef<boolean>(false);

  const fetchPortfolio = useCallback(async () => {
    try {
      const data = await api.getPortfolio(strategyId, symbol);
      if (isMountedRef.current) {
        setPortfolio(data);
        setError(null);
        setLoading(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, [strategyId, symbol]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchPortfolio();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchPortfolio]);

  // Listen for portfolio updates via Supabase Realtime
  useEffect(() => {
    const client = getRealtimeClient();

    const handlePortfolioUpdate = (data: Portfolio) => {
      if (!isMountedRef.current) return;
      if (strategyId && data.strategyId !== strategyId) return;
      setPortfolio(data);
    };

    const unsubscribe = client.on('trade:global', 'portfolio_update', handlePortfolioUpdate);
    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [strategyId]);

  return { portfolio, loading, error, refresh: fetchPortfolio };
};

/**
 * Hook for portfolio PnL history with time range support
 */
export const usePortfolioHistory = (
  strategyId: string | undefined,
  timeRange: '1d' | '1w' | '1m' | 'all' = '1w'
) => {
  const [history, setHistory] = useState<
    Array<{
      timestamp: Date;
      totalValue: number;
      realizedPnL: number;
      unrealizedPnL: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!strategyId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    try {
      const data = await api.getPortfolioHistory(strategyId, timeRange);
      setHistory(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [strategyId, timeRange]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, loading, error, refresh: fetchHistory };
};

export const useOrderBook = (symbol: string, levels: number = 20) => {
  const [orderBook, setOrderBook] = useState<OrderBookSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const realtimeClientRef = useRef<ReturnType<typeof getRealtimeClient> | null>(null);
  const unsubscribeRef = useRef<(() => void)[]>([]);
  const isMountedRef = useRef<boolean>(false);

  const fetchOrderBook = useCallback(async () => {
    try {
      const data = await api.getOrderBook(symbol, levels);
      if (isMountedRef.current) {
        setOrderBook(data);
        setError(null);
        setLoading(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, [symbol, levels]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchOrderBook();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchOrderBook]);

  useEffect(() => {
    if (!symbol) return;

    const client = getRealtimeClient();
    realtimeClientRef.current = client;

    // Subscribe to orderbook channel
    client.subscribeOrderBook(symbol).catch(err => {
      console.error(`[useOrderBook] Failed to subscribe to orderbook:${symbol}`, err);
    });

    // Listen for snapshot and delta events
    const unsubscribeSnapshot = client.onOrderBookSnapshot(symbol, (data: OrderBookSnapshot) => {
      if (isMountedRef.current) {
        setOrderBook(data);
        setLoading(false);
      }
    });

    const unsubscribeDelta = client.onOrderBookDelta(symbol, (delta: OrderBookSnapshot) => {
      if (isMountedRef.current) {
        setOrderBook(prev => {
          if (!prev || !delta) return prev;
          return { ...delta };
        });
      }
    });

    unsubscribeRef.current = [unsubscribeSnapshot, unsubscribeDelta];

    return () => {
      // Cleanup subscriptions
      unsubscribeSnapshot();
      unsubscribeDelta();
      client.unsubscribe(`orderbook:${symbol}`);
    };
  }, [symbol]);

  return { orderBook, loading, error, refresh: fetchOrderBook };
};
