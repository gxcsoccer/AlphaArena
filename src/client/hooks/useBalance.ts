import { useEffect, useState, useCallback, useRef } from 'react';
import { api, Portfolio } from '../utils/api';
import { getRealtimeClient } from '../utils/realtime';

/**
 * Hook for fetching user's total balance across all portfolios
 * Updates in real-time when trades execute
 */
export const useBalance = () => {
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      // Fetch all portfolios (no strategyId or symbol filter)
      const portfolio = await api.getPortfolio();
      
      if (portfolio) {
        setTotalBalance(portfolio.totalValue);
        setAvailableBalance(portfolio.cashBalance);
        setError(null);
      } else {
        // No portfolio yet, initialize to 0
        setTotalBalance(0);
        setAvailableBalance(0);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Listen for portfolio updates via Supabase Realtime
  useEffect(() => {
    const client = getRealtimeClient();

    const handlePortfolioUpdate = (data: Portfolio) => {
      setTotalBalance(data.totalValue);
      setAvailableBalance(data.cashBalance);
    };

    const unsubscribe = client.on('trade:global', 'portfolio_update', handlePortfolioUpdate);
    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return { totalBalance, availableBalance, loading, error, refresh: fetchBalance };
};
