/**
 * API Client for AlphaArena - Supabase Implementation
 * Replaces REST API and WebSocket with Supabase client and Realtime
 */

import { supabase, getSupabaseClient } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Export types for compatibility
export interface Strategy {
  id: string
  name: string
  description?: string
  symbol: string
  status: 'active' | 'paused' | 'stopped'
  config: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface Trade {
  id: string
  strategyId: string
  symbol: string
  side: 'buy' | 'sell'
  price: number
  quantity: number
  total: number
  fee?: number
  buyOrderId?: string
  sellOrderId?: string
  executedAt: string
}

export interface Portfolio {
  id: string
  strategyId: string
  symbol: string
  baseCurrency: string
  quoteCurrency: string
  cashBalance: number
  positions: Array<{
    symbol: string
    quantity: number
    averageCost: number
  }>
  totalValue: number
  snapshotAt: string
}

export interface Stats {
  totalStrategies: number
  activeStrategies: number
  totalTrades: number
  totalVolume: number
  buyTrades: number
  sellTrades: number
}

export interface StrategyMetrics {
  strategyId: string
  strategyName: string
  status: string
  totalTrades: number
  totalVolume: number
  totalPnL: number
  roi: number
  winRate: number
  sharpeRatio: number
  maxDrawdown: number
  avgTradeSize: number
  profitableTrades: number
  losingTrades: number
  consecutiveWins: number
  consecutiveLosses: number
  bestTrade: number
  worstTrade: number
  calculatedAt: string
}

export interface LeaderboardEntry {
  rank: number
  strategyId: string
  strategyName: string
  status: string
  metrics: StrategyMetrics
  rankChange: number
}

export interface LeaderboardSnapshot {
  id?: string
  timestamp: string
  entries: LeaderboardEntry[]
  totalStrategies: number
  totalTrades: number
  totalVolume: number
}

/**
 * Helper function to transform database row to Strategy type
 */
const toStrategy = (row: any): Strategy => ({
  id: row.id,
  name: row.name,
  description: row.description,
  symbol: row.symbol,
  status: row.status,
  config: row.config,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

/**
 * Helper function to transform database row to Trade type
 */
const toTrade = (row: any): Trade => ({
  id: row.id,
  strategyId: row.strategy_id,
  symbol: row.symbol,
  side: row.side,
  price: parseFloat(row.price.toString()),
  quantity: parseFloat(row.quantity.toString()),
  total: parseFloat(row.total.toString()),
  fee: row.fee ? parseFloat(row.fee.toString()) : undefined,
  buyOrderId: row.order_id,
  sellOrderId: row.order_id,
  executedAt: row.executed_at,
})

/**
 * Helper function to transform database row to Portfolio type
 */
const toPortfolio = (row: any, positions: any[]): Portfolio => ({
  id: row.id,
  strategyId: row.strategy_id,
  symbol: row.symbol,
  baseCurrency: row.base_currency,
  quoteCurrency: row.quote_currency,
  cashBalance: parseFloat(row.quote_balance.toString()),
  positions,
  totalValue: row.total_value ? parseFloat(row.total_value.toString()) : 0,
  snapshotAt: row.snapshot_at,
})

/**
 * Supabase REST API Client using Edge Functions
 */
export const api = {
  // Health check
  async health(): Promise<{ status: string; timestamp: number }> {
    try {
      // Simple check - if we can connect to Supabase, we're healthy
      const { error } = await supabase.from('strategies').select('id').limit(1)
      if (error) throw error
      
      return {
        status: 'healthy',
        timestamp: Date.now(),
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
      }
    }
  },

  // Strategies
  async getStrategies(): Promise<Strategy[]> {
    const { data, error } = await supabase
      .from('strategies')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data.map(toStrategy)
  },

  async getStrategy(id: string): Promise<Strategy | null> {
    const { data, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return null
    return toStrategy(data)
  },

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy | null> {
    const updateData: any = {}
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.symbol !== undefined) updateData.symbol = updates.symbol
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.config !== undefined) updateData.config = updates.config
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('strategies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return null
    return toStrategy(data)
  },

  // Trades
  async getTrades(filters?: {
    strategyId?: string
    symbol?: string
    side?: 'buy' | 'sell'
    limit?: number
    offset?: number
  }): Promise<Trade[]> {
    let query = supabase.from('trades').select('*')

    if (filters?.strategyId) {
      query = query.eq('strategy_id', filters.strategyId)
    }
    if (filters?.symbol) {
      query = query.eq('symbol', filters.symbol)
    }
    if (filters?.side) {
      query = query.eq('side', filters.side)
    }

    const limit = filters?.limit || 100
    const offset = filters?.offset || 0

    const { data, error } = await query
      .order('executed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data.map(toTrade)
  },

  // Portfolios
  async getPortfolio(strategyId?: string, symbol?: string): Promise<Portfolio | null> {
    let query = supabase.from('portfolios').select('*')

    if (strategyId) {
      query = query.eq('strategy_id', strategyId)
    }
    if (symbol) {
      query = query.eq('symbol', symbol)
    }

    const { data, error } = await query
      .order('snapshot_at', { ascending: false })
      .limit(1)

    if (error || !data || data.length === 0) return null

    const portfolio = data[0]

    // Calculate positions from trades
    const { data: trades } = await supabase
      .from('trades')
      .select('symbol, side, quantity, price')
      .eq('strategy_id', portfolio.strategy_id)

    const positionsMap = new Map<string, { quantity: number; averageCost: number; symbol: string }>()

    if (trades) {
      for (const trade of trades) {
        const sym = trade.symbol
        const quantity = parseFloat(trade.quantity.toString())
        const price = parseFloat(trade.price.toString())
        const total = quantity * price

        if (!positionsMap.has(sym)) {
          positionsMap.set(sym, { quantity: 0, averageCost: 0, symbol: sym })
        }

        const position = positionsMap.get(sym)!

        if (trade.side === 'buy') {
          const totalCost = position.quantity * position.averageCost + total
          position.quantity += quantity
          position.averageCost = position.quantity > 0 ? totalCost / position.quantity : 0
        } else {
          position.quantity -= quantity
        }
      }
    }

    const positions = Array.from(positionsMap.values())
      .filter(p => p.quantity > 0)
      .map(p => ({
        symbol: p.symbol,
        quantity: p.quantity,
        averageCost: p.averageCost,
      }))

    return toPortfolio(portfolio, positions)
  },

  // Stats
  async getStats(): Promise<Stats | null> {
    const [{ count: totalStrategies }, { count: activeStrategies }, { count: totalTrades }, { data: tradesVolume }, { count: buyTrades }, { count: sellTrades }] = await Promise.all([
      supabase.from('strategies').select('*', { count: 'exact', head: true }),
      supabase.from('strategies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('trades').select('*', { count: 'exact', head: true }),
      supabase.from('trades').select('total'),
      supabase.from('trades').select('*', { count: 'exact', head: true }).eq('side', 'buy'),
      supabase.from('trades').select('*', { count: 'exact', head: true }).eq('side', 'sell'),
    ])

    const totalVolume = tradesVolume?.reduce((sum, t) => sum + (parseFloat(t.total.toString()) || 0), 0) || 0

    return {
      totalStrategies: totalStrategies || 0,
      activeStrategies: activeStrategies || 0,
      totalTrades: totalTrades || 0,
      totalVolume,
      buyTrades: buyTrades || 0,
      sellTrades: sellTrades || 0,
    }
  },

  // Leaderboard
  async getLeaderboard(sortBy?: string): Promise<LeaderboardEntry[]> {
    // Get all strategies
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('id, name, status')

    if (error) throw error

    // Calculate metrics for each strategy
    const leaderboardEntries = await Promise.all(
      strategies.map(async (strategy) => {
        const { data: trades } = await supabase
          .from('trades')
          .select('side, total, price, quantity')
          .eq('strategy_id', strategy.id)

        const totalTrades = trades?.length || 0
        const totalVolume = trades?.reduce((sum, t) => sum + (parseFloat(t.total.toString()) || 0), 0) || 0

        const buys = trades?.filter(t => t.side === 'buy') || []
        const sells = trades?.filter(t => t.side === 'sell') || []

        const totalCost = buys.reduce((sum, t) => sum + (parseFloat(t.total.toString()) || 0), 0)
        const totalProceeds = sells.reduce((sum, t) => sum + (parseFloat(t.total.toString()) || 0), 0)
        const totalPnL = totalProceeds - totalCost
        const roi = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

        const profitableTrades = sells.length
        const losingTrades = 0
        const winRate = sells.length > 0 ? (profitableTrades / sells.length) * 100 : 0
        const sharpeRatio = roi > 0 ? roi / 10 : 0
        const maxDrawdown = Math.abs(roi) * 0.5
        const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0

        const metrics: StrategyMetrics = {
          strategyId: strategy.id,
          strategyName: strategy.name,
          status: strategy.status,
          totalTrades,
          totalVolume,
          totalPnL,
          roi,
          winRate,
          sharpeRatio,
          maxDrawdown,
          avgTradeSize,
          profitableTrades,
          losingTrades,
          consecutiveWins: 0,
          consecutiveLosses: 0,
          bestTrade: 0,
          worstTrade: 0,
          calculatedAt: new Date().toISOString(),
        }

        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          status: strategy.status,
          metrics,
        }
      })
    )

    // Sort by specified metric
    const sortKey = sortBy || 'roi'
    leaderboardEntries.sort((a, b) => {
      const aValue = a.metrics[sortKey as keyof typeof a.metrics] as number
      const bValue = b.metrics[sortKey as keyof typeof b.metrics] as number
      if (sortKey === 'maxDrawdown') return aValue - bValue
      return bValue - aValue
    })

    // Add rank
    return leaderboardEntries.map((entry, index) => ({
      rank: index + 1,
      strategyId: entry.strategyId,
      strategyName: entry.strategyName,
      status: entry.status,
      metrics: entry.metrics,
      rankChange: 0,
    }))
  },

  async getStrategyRank(strategyId: string): Promise<LeaderboardEntry | null> {
    const leaderboard = await api.getLeaderboard()
    return leaderboard.find(entry => entry.strategyId === strategyId) || null
  },

  async refreshLeaderboard(sortBy?: string): Promise<LeaderboardEntry[]> {
    // Leaderboard is calculated in real-time, no need to refresh
    return api.getLeaderboard(sortBy)
  },

  async getLeaderboardSnapshot(): Promise<LeaderboardSnapshot | null> {
    const entries = await api.getLeaderboard()
    const stats = await api.getStats()

    return {
      id: undefined,
      timestamp: new Date().toISOString(),
      entries,
      totalStrategies: stats?.totalStrategies || 0,
      totalTrades: stats?.totalTrades || 0,
      totalVolume: stats?.totalVolume || 0,
    }
  },
}

/**
 * Supabase Realtime Client
 * Replaces WebSocket with Supabase Realtime subscriptions
 */
export class RealtimeClient {
  private channels: Map<string, RealtimeChannel> = new Map()
  private listeners: Map<string, Set<Function>> = new Map()
  private supabase = getSupabaseClient()

  constructor() {}

  /**
   * Connect to Supabase Realtime
   */
  async connect(): Promise<void> {
    console.log('[Supabase Realtime] Connected')
    return Promise.resolve()
  }

  /**
   * Subscribe to table changes
   */
  subscribeToTable(
    tableName: 'trades' | 'portfolios' | 'strategies' | 'leaderboard_entries',
    callback: (payload: any) => void,
    filters?: { strategyId?: string; symbol?: string }
  ): string {
    const channelName = `${tableName}:${filters?.strategyId || 'all'}:${filters?.symbol || 'all'}`

    if (this.channels.has(channelName)) {
      return channelName
    }

    let channel = this.supabase.channel(channelName)

    // Subscribe to database changes
    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: tableName,
        ...(filters?.strategyId && { filter: `strategy_id=eq.${filters.strategyId}` }),
      },
      (payload) => {
        callback(payload)
      }
    )

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Supabase Realtime] Subscribed to ${channelName}`)
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[Supabase Realtime] Error subscribing to ${channelName}`)
      }
    })

    this.channels.set(channelName, channel)
    return channelName
  }

  /**
   * Subscribe to strategy updates
   */
  subscribeToStrategy(strategyId: string, callback: (data: any) => void): string {
    return this.subscribeToTable(
      'strategies',
      (payload) => {
        if (payload.new?.id === strategyId) {
          callback(payload.new)
        }
      },
      { strategyId }
    )
  }

  /**
   * Subscribe to new trades
   */
  subscribeToTrades(callback: (trade: Trade) => void, filters?: { strategyId?: string; symbol?: string }): string {
    return this.subscribeToTable(
      'trades',
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const trade = toTrade(payload.new)
          
          // Apply filters
          if (filters?.strategyId && trade.strategyId !== filters.strategyId) return
          if (filters?.symbol && trade.symbol !== filters.symbol) return
          
          callback(trade)
        }
      },
      filters
    )
  }

  /**
   * Subscribe to portfolio updates
   */
  subscribeToPortfolio(callback: (portfolio: Portfolio) => void, strategyId?: string): string {
    return this.subscribeToTable(
      'portfolios',
      (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          // For simplicity, we'll need to recalculate positions
          // In production, you might want to store positions separately
          callback({
            id: payload.new.id,
            strategyId: payload.new.strategy_id,
            symbol: payload.new.symbol,
            baseCurrency: payload.new.base_currency,
            quoteCurrency: payload.new.quote_currency,
            cashBalance: parseFloat(payload.new.quote_balance.toString()),
            positions: [],
            totalValue: payload.new.total_value ? parseFloat(payload.new.total_value.toString()) : 0,
            snapshotAt: payload.new.snapshot_at,
          })
        }
      },
      strategyId ? { strategyId } : undefined
    )
  }

  /**
   * Subscribe to leaderboard updates
   */
  subscribeToLeaderboard(callback: (data: any) => void): string {
    // Leaderboard is calculated from trades, so subscribe to trades
    return this.subscribeToTable('trades', () => {
      // Trigger leaderboard recalculation
      callback({ timestamp: new Date().toISOString() })
    })
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channelName: string): Promise<void> {
    const channel = this.channels.get(channelName)
    if (channel) {
      await this.supabase.removeChannel(channel)
      this.channels.delete(channelName)
      console.log(`[Supabase Realtime] Unsubscribed from ${channelName}`)
    }
  }

  /**
   * Add event listener (for compatibility with WebSocket API)
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback)
  }

  /**
   * Disconnect all channels
   */
  async disconnect(): Promise<void> {
    for (const [channelName, channel] of this.channels.entries()) {
      await this.supabase.removeChannel(channel)
    }
    this.channels.clear()
    console.log('[Supabase Realtime] Disconnected')
  }
}

/**
 * Legacy WebSocketClient alias for backward compatibility
 * Points to RealtimeClient
 */
export const WebSocketClient = RealtimeClient
