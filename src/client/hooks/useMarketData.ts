import { useEffect, useState, useCallback, useRef } from 'react';
import { api, WebSocketClient } from '../utils/api';
import type { TradingPair } from '../components/TradingPairList';

/**
 * Hook for real-time market data (ticker data for all trading pairs)
 */
export const useMarketData = (refreshInterval: number = 3000) => {
  const [marketData, setMarketData] = useState<TradingPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connected, subscribe, on } = useWebSocket();
  const lastUpdateRef = useRef<Map<string, number>>(new Map());

  // Fetch initial market data
  const fetchMarketData = useCallback(async () => {
    try {
      const data = await api.getMarketTickers();
      if (data) {
        setMarketData(data);
        setError(null);
        // Track last update time for each symbol
        data.forEach(ticker => {
          lastUpdateRef.current.set(ticker.symbol, Date.now());
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMarketData, refreshInterval]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!connected) return;

    // Subscribe to all symbols
    subscribe();

    // Listen for market tick updates
    const handleMarketTick = (data: any) => {
      if (!data || !data.symbol) return;

      setMarketData(prev => {
        const index = prev.findIndex(p => p.symbol === data.symbol);
        if (index === -1) {
          // New trading pair
          return [...prev, transformMarketTickToTradingPair(data)];
        }
        // Update existing pair
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          ...transformMarketTickToTradingPair(data),
        };
        return updated;
      });

      lastUpdateRef.current.set(data.symbol, Date.now());
    };

    on('market:tick', handleMarketTick);

    return () => {
      // Cleanup handled by useWebSocket
    };
  }, [connected, subscribe, on]);

  return { marketData, loading, error, refresh: fetchMarketData };
};

/**
 * Transform MarketTick API response to TradingPair format
 */
function transformMarketTickToTradingPair(tick: any): TradingPair {
  const symbol = tick.symbol || 'UNKNOWN';
  const [baseCurrency, quoteCurrency] = symbol.split('/');

  return {
    symbol,
    baseCurrency: baseCurrency || 'UNKNOWN',
    quoteCurrency: quoteCurrency || 'USD',
    lastPrice: tick.price || 0,
    priceChange24h: tick.priceChange24h || 0,
    priceChangePercent24h: tick.priceChangePercent24h || 0,
    high24h: tick.high24h || 0,
    low24h: tick.low24h || 0,
    volume24h: tick.volume24h || 0,
    quoteVolume24h: tick.quoteVolume24h || 0,
    bid: tick.bid || 0,
    ask: tick.ask || 0,
    timestamp: tick.timestamp || Date.now(),
  };
}

/**
 * Simplified WebSocket hook for market data
 */
const useWebSocket = () => {
  const [connected, setConnected] = useState(false);
  const wsClientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    const client = new WebSocketClient();

    client.connect()
      .then(() => setConnected(true))
      .catch((err) => console.error('[useMarketData WebSocket] Connection failed:', err));

    wsClientRef.current = client;

    return () => {
      client.disconnect();
      setConnected(false);
    };
  }, []);

  const subscribe = useCallback(() => {
    // Subscribe to market data room
    wsClientRef.current?.socket?.emit('subscribe:market');
  }, []);

  const on = useCallback((event: string, callback: Function) => {
    wsClientRef.current?.on(event, callback);
  }, []);

  return { connected, subscribe, on };
};

export default useMarketData;
