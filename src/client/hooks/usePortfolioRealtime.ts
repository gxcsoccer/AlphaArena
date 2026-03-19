/**
 * Hook for Real-time Portfolio P/L Updates
 * 
 * Subscribes to market price updates via Supabase Realtime and calculates
 * unrealized P/L in real-time as prices change.
 * 
 * Features:
 * - Real-time P/L calculations based on live price feeds
 * - Visual indicators for P/L direction (green/red)
 * - Change detection with flash animations
 * - Proper cleanup on unmount
 * - Debounced calculations to avoid performance issues
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getRealtimeClient } from '../utils/realtime';
import { api, Portfolio } from '../utils/api';

export interface PortfolioWithPnL extends Portfolio {
  positions: Array<{
    symbol: string;
    quantity: number;
    averageCost: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    priceChange24h: number;
    priceChangePercent24h: number;
  }>;
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPercent: number;
  totalRealizedPnL: number;
  totalPnL: number;
  totalPnLPercent: number;
}

export interface PnLChange {
  symbol: string;
  previousValue: number;
  currentValue: number;
  change: number;
  changePercent: number;
  direction: 'up' | 'down' | 'unchanged';
  timestamp: number;
}

interface UsePortfolioRealtimeOptions {
  strategyId?: string;
  symbol?: string;
  debounceMs?: number; // Debounce P/L calculations (default: 100ms)
}

/**
 * Hook for real-time portfolio P/L tracking
 */
export const usePortfolioRealtime = (options: UsePortfolioRealtimeOptions = {}) => {
  const { strategyId, symbol, debounceMs = 100 } = options;
  
  const [portfolio, setPortfolio] = useState<PortfolioWithPnL | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentChanges, setRecentChanges] = useState<PnLChange[]>([]);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const priceCacheRef = useRef<Map<string, number>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPnLValuesRef = useRef<Map<string, number>>(new Map());
  const isMountedRef = useRef<boolean>(false);

  // Fetch initial portfolio data
  const fetchPortfolio = useCallback(async () => {
    try {
      const data = await api.getPortfolio(strategyId, symbol);
      if (isMountedRef.current) {
        if (data) {
          // Initialize price cache with current data
          const enrichedPortfolio = enrichPortfolioWithPrices(data, priceCacheRef.current);
          setPortfolio(enrichedPortfolio);
          setError(null);
        } else {
          setPortfolio(null);
          setError(null);
        }
        setLoading(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, [strategyId, symbol]);

  // Calculate P/L for a position
  const calculatePositionPnL = useCallback((
    quantity: number,
    averageCost: number,
    currentPrice: number
  ) => {
    if (quantity === 0 || averageCost === 0) {
      return {
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        marketValue: 0,
      };
    }

    const marketValue = quantity * currentPrice;
    const costBasis = quantity * averageCost;
    const unrealizedPnL = marketValue - costBasis;
    const unrealizedPnLPercent = (unrealizedPnL / costBasis) * 100;

    return {
      unrealizedPnL,
      unrealizedPnLPercent,
      marketValue,
    };
  }, []);

  // Enrich portfolio with current prices and P/L calculations
  const enrichPortfolioWithPrices = useCallback((
    portfolioData: Portfolio,
    prices: Map<string, number>
  ): PortfolioWithPnL => {
    const enrichedPositions = portfolioData.positions.map(pos => {
      const currentPrice = prices.get(pos.symbol) || pos.averageCost;
      const { unrealizedPnL, unrealizedPnLPercent, marketValue } = 
        calculatePositionPnL(pos.quantity, pos.averageCost, currentPrice);

      return {
        ...pos,
        currentPrice,
        marketValue,
        unrealizedPnL,
        unrealizedPnLPercent,
        priceChange24h: 0, // Will be updated by market tick
        priceChangePercent24h: 0,
      };
    });

    const _totalPositionValue = enrichedPositions.reduce((sum, pos) => sum + pos.marketValue, 0);
    const totalCostBasis = enrichedPositions.reduce(
      (sum, pos) => sum + (pos.quantity * pos.averageCost),
      0
    );
    const totalUnrealizedPnL = enrichedPositions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    const totalUnrealizedPnLPercent = totalCostBasis > 0 
      ? (totalUnrealizedPnL / totalCostBasis) * 100 
      : 0;

    // Calculate realized P/L (simplified - would need trade history for accurate calc)
    const totalRealizedPnL = 0;

    const totalPnL = totalUnrealizedPnL + totalRealizedPnL;
    const totalPnLPercent = totalCostBasis > 0 
      ? (totalPnL / totalCostBasis) * 100 
      : 0;

    return {
      ...portfolioData,
      positions: enrichedPositions,
      totalUnrealizedPnL,
      totalUnrealizedPnLPercent,
      totalRealizedPnL,
      totalPnL,
      totalPnLPercent,
    };
  }, [calculatePositionPnL]);

  // Debounced P/L recalculation
  const _recalculatePnL = useCallback((updatedPrices: Map<string, number>) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current || !portfolio) return;

      const enrichedPortfolio = enrichPortfolioWithPrices(portfolio, updatedPrices);
      
      // Track changes for visual indicators
      const changes: PnLChange[] = [];
      enrichedPortfolio.positions.forEach(pos => {
        const previousPnL = lastPnLValuesRef.current.get(pos.symbol) || 0;
        const currentPnL = pos.unrealizedPnL;
        
        if (previousPnL !== 0 && currentPnL !== previousPnL) {
          const change = currentPnL - previousPnL;
          const changePercent = previousPnL !== 0 ? (change / Math.abs(previousPnL)) * 100 : 0;
          
          changes.push({
            symbol: pos.symbol,
            previousValue: previousPnL,
            currentValue: currentPnL,
            change,
            changePercent,
            direction: change > 0 ? 'up' : change < 0 ? 'down' : 'unchanged',
            timestamp: Date.now(),
          });
        }
        
        lastPnLValuesRef.current.set(pos.symbol, currentPnL);
      });

      if (changes.length > 0 && isMountedRef.current) {
        setRecentChanges(prev => [...changes, ...prev].slice(0, 10)); // Keep last 10 changes
        setPortfolio(enrichedPortfolio);
      }
    }, debounceMs);
  }, [portfolio, enrichPortfolioWithPrices, debounceMs]);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchPortfolio();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchPortfolio]);

  // Subscribe to market price updates
  useEffect(() => {
    const client = getRealtimeClient();

    // Subscribe to market ticks for all symbols in portfolio
    const subscribeToSymbols = async (symbols: string[]) => {
      const unsubscribeFunctions: (() => void)[] = [];

      symbols.forEach(symbol => {
        const unsubscribe = client.onMarketTick(symbol, (data: any) => {
          if (!isMountedRef.current) return;
          if (!data || !data.symbol || !data.price) return;

          // Update price cache
          priceCacheRef.current.set(data.symbol, data.price);

          // Update portfolio with 24h change data
          setPortfolio(prev => {
            if (!prev) return prev;
            
            return {
              ...prev,
              positions: prev.positions.map(pos => {
                if (pos.symbol === data.symbol) {
                  return {
                    ...pos,
                    currentPrice: data.price,
                    priceChange24h: data.priceChange24h || 0,
                    priceChangePercent24h: data.priceChangePercent24h || 0,
                    ...calculatePositionPnL(pos.quantity, pos.averageCost, data.price),
                  };
                }
                return pos;
              }),
            };
          });
        });

        unsubscribeFunctions.push(unsubscribe);
      });

      return () => {
        unsubscribeFunctions.forEach(unsub => unsub());
      };
    };

    // Subscribe when portfolio is loaded
    if (portfolio && portfolio.positions.length > 0) {
      const symbols = portfolio.positions.map(pos => pos.symbol);
      subscribeToSymbols(symbols).then(unsubscribe => {
        unsubscribeRef.current = unsubscribe;
      });
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [portfolio, calculatePositionPnL]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    portfolio,
    loading,
    error,
    refresh: fetchPortfolio,
    recentChanges,
  };
};

export default usePortfolioRealtime;
