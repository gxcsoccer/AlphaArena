import { useEffect, useState, useCallback, useRef } from 'react';
import { api, RealtimeClient } from '../utils/api';
import type { TradingPair } from '../components/TradingPairList';
import { getRealtimeClient } from '../utils/realtime';

/**
 * Hook for real-time market data (ticker data for all trading pairs)
 */
export const useMarketData = (refreshInterval: number = 3000) => {
  const [marketData, setMarketData] = useState<TradingPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const realtimeClientRef = useRef<RealtimeClient | null>(null);
  const lastUpdateRef = useRef<Map<string, number>>(new Map());
  const unsubscribeRef = useRef<(() => void)[]>([]);
  const isMountedRef = useRef<boolean>(false);

  // Fetch initial market data
  const fetchMarketData = useCallback(async () => {
    try {
      const data = await api.getMarketTickers();
      if (isMountedRef.current && data) {
        setMarketData(data);
        setError(null);
        setLoading(false);
        // Track last update time for each symbol
        data.forEach(ticker => {
          lastUpdateRef.current.set(ticker.symbol, Date.now());
        });
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, []);

  // Initial fetch and periodic refresh
  useEffect(() => {
    isMountedRef.current = true;
    fetchMarketData();
    const interval = setInterval(fetchMarketData, refreshInterval);
    return () => {
      clearInterval(interval);
      isMountedRef.current = false;
    };
  }, [fetchMarketData, refreshInterval]);

  // Subscribe to real-time updates via Supabase Realtime
  useEffect(() => {
    const client = getRealtimeClient();
    realtimeClientRef.current = client;

    // Listen for market tick updates on multiple symbol channels
    const commonSymbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT'];
    
    const unsubscribeFunctions: (() => void)[] = [];

    commonSymbols.forEach(symbol => {
      const unsubscribe = client.onMarketTick(symbol, (data: any) => {
        if (!isMountedRef.current) return;
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
      });

      unsubscribeFunctions.push(unsubscribe);
    });

    unsubscribeRef.current = unsubscribeFunctions;

    return () => {
      // Cleanup all subscriptions
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }, []);

  return { marketData, loading, error, refresh: fetchMarketData };
};

/**
 * Transform MarketTick API response to TradingPair format
 * 
 * IMPORTANT: API now returns baseCurrency and quoteCurrency fields directly.
 * We prioritize these fields over symbol parsing to handle both:
 * - Crypto pairs like "BTC/USD" → baseCurrency="BTC", quoteCurrency="USD"
 * - Stock symbols like "AAPL" → baseCurrency="AAPL", quoteCurrency="USD"
 */
function transformMarketTickToTradingPair(tick: any): TradingPair {
  const symbol = tick.symbol || 'UNKNOWN';
  
  // Prioritize API-provided baseCurrency and quoteCurrency fields
  // Fallback to symbol parsing only if API doesn't provide these fields
  let baseCurrency: string;
  let quoteCurrency: string;
  
  if (tick.baseCurrency && tick.quoteCurrency) {
    // API provided the currencies directly - use them
    baseCurrency = tick.baseCurrency;
    quoteCurrency = tick.quoteCurrency;
  } else {
    // Fallback: parse from symbol (works for crypto pairs like "BTC/USD")
    // For stock symbols like "AAPL", split('/')[1] would be undefined
    const [base, quote] = symbol.split('/');
    baseCurrency = base || symbol || 'UNKNOWN';
    quoteCurrency = quote || 'USD'; // Default to USD for stock symbols
  }

  return {
    symbol,
    baseCurrency,
    quoteCurrency,
    lastPrice: tick.lastPrice ?? tick.price ?? 0,
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

export default useMarketData;
