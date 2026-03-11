import { useEffect, useState, useCallback, useRef } from 'react'
import { api, RealtimeClient, Strategy, Trade, Portfolio, Stats } from '../utils/api'

/**
 * Hook for Supabase Realtime connection management
 */
export const useRealtime = () => {
  const [connected, setConnected] = useState(true) // Supabase Realtime is always connected
  const [client] = useState(() => new RealtimeClient())
  const subscriptionsRef = useRef<string[]>([])

  useEffect(() => {
    client.connect()
      .then(() => setConnected(true))
      .catch((err) => console.error('[useRealtime] Connection failed:', err))

    return () => {
      // Cleanup all subscriptions
      subscriptionsRef.current.forEach(sub => {
        client.unsubscribe(sub).catch(console.error)
      })
      subscriptionsRef.current = []
      client.disconnect().catch(console.error)
      setConnected(false)
    }
  }, [client])

  const subscribe = useCallback((strategyId?: string, symbol?: string) => {
    // Subscriptions are now handled by specific hooks
    if (strategyId) {
      const subId = client.subscribeToStrategy(strategyId, (data) => {
        console.log('[useRealtime] Strategy update:', data)
      })
      subscriptionsRef.current.push(subId)
    }
    if (symbol) {
      const subId = client.subscribeToTrades((trade) => {
        console.log('[useRealtime] Trade update:', trade)
      }, { symbol })
      subscriptionsRef.current.push(subId)
    }
  }, [client])

  const on = useCallback((event: string, callback: Function) => {
    // Map legacy events to Supabase Realtime subscriptions
    switch (event) {
      case 'trade:new':
        client.subscribeToTrades((trade) => callback(trade))
        break
      case 'portfolio:update':
        client.subscribeToPortfolio((portfolio) => callback(portfolio))
        break
      case 'strategy:tick':
        client.subscribeToTable('strategies', (payload) => callback(payload.new))
        break
      case 'leaderboard:update':
        client.subscribeToLeaderboard((data) => callback(data))
        break
    }
  }, [client])

  return { connected, subscribe, on, client }
}

/**
 * Hook for fetching and auto-refreshing stats
 */
export const useStats = (refreshInterval: number = 5000) => {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { client } = useRealtime()
  const subscriptionRef = useRef<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats()
      setStats(data)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchStats, refreshInterval])

  // Subscribe to trade changes for real-time stats updates
  useEffect(() => {
    if (!client) return

    const handleTradeChange = () => {
      fetchStats()
    }

    subscriptionRef.current = client.subscribeToTrades(handleTradeChange)

    return () => {
      if (subscriptionRef.current) {
        client.unsubscribe(subscriptionRef.current).catch(console.error)
        subscriptionRef.current = null
      }
    }
  }, [client, fetchStats])

  return { stats, loading, error, refresh: fetchStats }
}

/**
 * Hook for strategies with real-time updates
 */
export const useStrategies = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { connected, client } = useRealtime()
  const subscriptionRef = useRef<string | null>(null)

  const fetchStrategies = useCallback(async () => {
    try {
      const data = await api.getStrategies()
      setStrategies(data)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStrategies()
  }, [fetchStrategies])

  // Listen for strategy updates via Supabase Realtime
  useEffect(() => {
    if (!connected || !client) return

    const handleStrategyUpdate = (payload: any) => {
      if (payload.eventType === 'INSERT') {
        setStrategies(prev => [...prev, payload.new])
      } else if (payload.eventType === 'UPDATE') {
        setStrategies(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s))
      } else if (payload.eventType === 'DELETE') {
        setStrategies(prev => prev.filter(s => s.id !== payload.old.id))
      }
    }

    subscriptionRef.current = client.subscribeToTable('strategies', handleStrategyUpdate)

    return () => {
      if (subscriptionRef.current) {
        client.unsubscribe(subscriptionRef.current).catch(console.error)
        subscriptionRef.current = null
      }
    }
  }, [connected, client])

  return { strategies, loading, error, refresh: fetchStrategies }
}

/**
 * Hook for recent trades with real-time updates
 */
export const useTrades = (filters?: { strategyId?: string; symbol?: string }, limit: number = 100) => {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { connected, client } = useRealtime()
  const subscriptionRef = useRef<string | null>(null)

  const fetchTrades = useCallback(async () => {
    try {
      const data = await api.getTrades({ ...filters, limit })
      setTrades(data)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filters, limit])

  useEffect(() => {
    fetchTrades()
  }, [fetchTrades])

  // Listen for new trades via Supabase Realtime
  useEffect(() => {
    if (!connected || !client) return

    const handleNewTrade = (trade: Trade) => {
      // Filter by current filters if set
      if (filters?.strategyId && trade.strategyId !== filters.strategyId) return
      if (filters?.symbol && trade.symbol !== filters.symbol) return

      setTrades(prev => [trade, ...prev].slice(0, limit))
    }

    subscriptionRef.current = client.subscribeToTrades(handleNewTrade, filters)

    return () => {
      if (subscriptionRef.current) {
        client.unsubscribe(subscriptionRef.current).catch(console.error)
        subscriptionRef.current = null
      }
    }
  }, [connected, client, filters, limit])

  return { trades, loading, error, refresh: fetchTrades }
}

/**
 * Hook for portfolio data
 */
export const usePortfolio = (strategyId?: string, symbol?: string) => {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { connected, client } = useRealtime()
  const subscriptionRef = useRef<string | null>(null)

  const fetchPortfolio = useCallback(async () => {
    try {
      const data = await api.getPortfolio(strategyId, symbol)
      setPortfolio(data)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [strategyId, symbol])

  useEffect(() => {
    fetchPortfolio()
  }, [fetchPortfolio])

  // Listen for portfolio updates via Supabase Realtime
  useEffect(() => {
    if (!connected || !client) return

    const handlePortfolioUpdate = (payload: any) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        // Refetch to get updated positions
        fetchPortfolio()
      }
    }

    subscriptionRef.current = client.subscribeToTable(
      'portfolios',
      handlePortfolioUpdate,
      strategyId ? { strategyId } : undefined
    )

    return () => {
      if (subscriptionRef.current) {
        client.unsubscribe(subscriptionRef.current).catch(console.error)
        subscriptionRef.current = null
      }
    }
  }, [connected, client, strategyId, fetchPortfolio])

  return { portfolio, loading, error, refresh: fetchPortfolio }
}

/**
 * Hook for leaderboard with real-time updates
 */
export const useLeaderboard = (sortBy?: string, refreshInterval: number = 60000) => {
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const { connected, client } = useRealtime()
  const subscriptionRef = useRef<string | null>(null)

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getLeaderboard(sortBy)
      setLeaderboard(data)
      setLastUpdated(new Date())
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [sortBy])

  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchLeaderboard, refreshInterval])

  // Listen for trade changes to update leaderboard
  useEffect(() => {
    if (!connected || !client) return

    const handleTradeChange = () => {
      fetchLeaderboard()
    }

    subscriptionRef.current = client.subscribeToTrades(handleTradeChange)

    return () => {
      if (subscriptionRef.current) {
        client.unsubscribe(subscriptionRef.current).catch(console.error)
        subscriptionRef.current = null
      }
    }
  }, [connected, client, fetchLeaderboard])

  return { leaderboard, loading, error, lastUpdated, refresh: fetchLeaderboard }
}
