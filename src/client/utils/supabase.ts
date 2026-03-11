/**
 * Supabase Client Configuration
 * Provides a singleton Supabase client instance for the application
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Get Supabase configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

// Create a singleton Supabase client
let supabaseClient: SupabaseClient | null = null

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  }
  return supabaseClient
}

// Export direct client instance for convenience
export const supabase = getSupabaseClient()

// Database type definitions for better type safety
export interface Database {
  public: {
    Tables: {
      strategies: {
        Row: {
          id: string
          name: string
          description: string | null
          symbol: string
          status: 'active' | 'paused' | 'stopped'
          config: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          symbol: string
          status?: 'active' | 'paused' | 'stopped'
          config?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          symbol?: string
          status?: 'active' | 'paused' | 'stopped'
          config?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      trades: {
        Row: {
          id: string
          strategy_id: string | null
          symbol: string
          side: 'buy' | 'sell'
          price: string
          quantity: string
          total: string
          fee: string | null
          fee_currency: string | null
          order_id: string | null
          trade_id: string | null
          executed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          strategy_id?: string | null
          symbol: string
          side: 'buy' | 'sell'
          price: string
          quantity: string
          total: string
          fee?: string | null
          fee_currency?: string | null
          order_id?: string | null
          trade_id?: string | null
          executed_at: string
          created_at?: string
        }
        Update: {
          id?: string
          strategy_id?: string | null
          symbol?: string
          side?: 'buy' | 'sell'
          price?: string
          quantity?: string
          total?: string
          fee?: string | null
          fee_currency?: string | null
          order_id?: string | null
          trade_id?: string | null
          executed_at?: string
          created_at?: string
        }
      }
      portfolios: {
        Row: {
          id: string
          strategy_id: string | null
          symbol: string
          base_currency: string
          quote_currency: string
          base_balance: string
          quote_balance: string
          total_value: string | null
          snapshot_at: string
          created_at: string
        }
        Insert: {
          id?: string
          strategy_id?: string | null
          symbol: string
          base_currency: string
          quote_currency: string
          base_balance?: string
          quote_balance?: string
          total_value?: string | null
          snapshot_at: string
          created_at?: string
        }
        Update: {
          id?: string
          strategy_id?: string | null
          symbol?: string
          base_currency?: string
          quote_currency?: string
          base_balance?: string
          quote_balance?: string
          total_value?: string | null
          snapshot_at?: string
          created_at?: string
        }
      }
      leaderboard_entries: {
        Row: {
          id: string
          snapshot_id: string | null
          strategy_id: string | null
          rank: number
          rank_change: number
          total_trades: number
          total_volume: string
          total_pnl: string
          roi: number
          win_rate: number
          sharpe_ratio: number
          max_drawdown: number
          avg_trade_size: string
          profitable_trades: number
          losing_trades: number
          consecutive_wins: number
          consecutive_losses: number
          best_trade: string
          worst_trade: string
          created_at: string
        }
        Insert: {
          id?: string
          snapshot_id?: string | null
          strategy_id?: string | null
          rank: number
          rank_change?: number
          total_trades?: number
          total_volume?: string
          total_pnl?: string
          roi?: number
          win_rate?: number
          sharpe_ratio?: number
          max_drawdown?: number
          avg_trade_size?: string
          profitable_trades?: number
          losing_trades?: number
          consecutive_wins?: number
          consecutive_losses?: number
          best_trade?: string
          worst_trade?: string
          created_at?: string
        }
        Update: {
          id?: string
          snapshot_id?: string | null
          strategy_id?: string | null
          rank?: number
          rank_change?: number
          total_trades?: number
          total_volume?: string
          total_pnl?: string
          roi?: number
          win_rate?: number
          sharpe_ratio?: number
          max_drawdown?: number
          avg_trade_size?: string
          profitable_trades?: number
          losing_trades?: number
          consecutive_wins?: number
          consecutive_losses?: number
          best_trade?: string
          worst_trade?: string
          created_at?: string
        }
      }
      leaderboard_snapshots: {
        Row: {
          id: string
          timestamp: string
          total_strategies: number
          total_trades: number
          total_volume: string
          created_at: string
        }
        Insert: {
          id?: string
          timestamp?: string
          total_strategies?: number
          total_trades?: number
          total_volume?: string
          created_at?: string
        }
        Update: {
          id?: string
          timestamp?: string
          total_strategies?: number
          total_trades?: number
          total_volume?: string
          created_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
