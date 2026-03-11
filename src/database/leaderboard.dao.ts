import { getSupabaseClient } from './client';
import { LeaderboardEntry, LeaderboardSnapshot } from '../strategy/LeaderboardService';

/**
 * Leaderboard snapshot record - 排行榜快照记录
 */
export interface LeaderboardSnapshotRecord {
  id: string;
  timestamp: Date;
  totalStrategies: number;
  totalTrades: number;
  totalVolume: number;
  createdAt: Date;
}

/**
 * Leaderboard entry record - 排行榜条目记录
 */
export interface LeaderboardEntryRecord {
  id: string;
  snapshotId: string;
  strategyId: string;
  rank: number;
  rankChange: number;
  totalTrades: number;
  totalVolume: number;
  totalPnl: number;
  roi: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgTradeSize: number;
  profitableTrades: number;
  losingTrades: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  bestTrade: number;
  worstTrade: number;
  createdAt: Date;
}

/**
 * Leaderboard Data Access Object - 排行榜数据访问层
 */
export class LeaderboardDAO {
  /**
   * Save a leaderboard snapshot - 保存排行榜快照
   */
  async saveSnapshot(snapshot: LeaderboardSnapshot): Promise<string> {
    const supabase = getSupabaseClient();

    // Insert snapshot
    const { data: snapshotData, error: snapshotError } = await supabase
      .from('leaderboard_snapshots')
      .insert([{
        timestamp: snapshot.timestamp.toISOString(),
        total_strategies: snapshot.totalStrategies,
        total_trades: snapshot.totalTrades,
        total_volume: snapshot.totalVolume,
      }])
      .select()
      .single();

    if (snapshotError) throw snapshotError;

    const snapshotId = snapshotData.id;

    // Insert entries
    if (snapshot.entries.length > 0) {
      const entries = snapshot.entries.map(entry => ({
        snapshot_id: snapshotId,
        strategy_id: entry.strategyId,
        rank: entry.rank,
        rank_change: entry.rankChange,
        total_trades: entry.metrics.totalTrades,
        total_volume: entry.metrics.totalVolume,
        total_pnl: entry.metrics.totalPnL,
        roi: entry.metrics.roi,
        win_rate: entry.metrics.winRate,
        sharpe_ratio: entry.metrics.sharpeRatio,
        max_drawdown: entry.metrics.maxDrawdown,
        avg_trade_size: entry.metrics.avgTradeSize,
        profitable_trades: entry.metrics.profitableTrades,
        losing_trades: entry.metrics.losingTrades,
        consecutive_wins: entry.metrics.consecutiveWins,
        consecutive_losses: entry.metrics.consecutiveLosses,
        best_trade: entry.metrics.bestTrade,
        worst_trade: entry.metrics.worstTrade,
      }));

      const { error: entriesError } = await supabase
        .from('leaderboard_entries')
        .insert(entries);

      if (entriesError) throw entriesError;
    }

    return snapshotId;
  }

  /**
   * Get latest snapshot - 获取最新快照
   */
  async getLatestSnapshot(): Promise<LeaderboardSnapshot | null> {
    const supabase = getSupabaseClient();

    const { data: snapshotData, error: snapshotError } = await supabase
      .from('leaderboard_snapshots')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (snapshotError && snapshotError.code !== 'PGRST116') throw snapshotError;
    if (!snapshotData) return null;

    const { data: entriesData, error: entriesError } = await supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('snapshot_id', snapshotData.id)
      .order('rank', { ascending: true });

    if (entriesError) throw entriesError;

    return {
      id: snapshotData.id,
      timestamp: new Date(snapshotData.timestamp),
      totalStrategies: snapshotData.total_strategies,
      totalTrades: snapshotData.total_trades,
      totalVolume: snapshotData.total_volume,
      entries: entriesData.map(this.mapToEntry),
    };
  }

  /**
   * Get snapshots by time range - 按时间范围获取快照
   */
  async getSnapshotsByRange(
    startTime: Date,
    endTime: Date,
    limit = 100
  ): Promise<LeaderboardSnapshotRecord[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('leaderboard_snapshots')
      .select('*')
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapToSnapshotRecord);
  }

  /**
   * Get strategy ranking history - 获取策略排名历史
   */
  async getStrategyHistory(
    strategyId: string,
    limit = 50
  ): Promise<LeaderboardEntryRecord[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('strategy_id', strategyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapToEntryRecord);
  }

  /**
   * Get top strategies for a specific snapshot - 获取特定快照的顶级策略
   */
  async getTopStrategies(
    snapshotId: string,
    limit = 10
  ): Promise<LeaderboardEntry[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('snapshot_id', snapshotId)
      .order('rank', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapToEntry);
  }

  /**
   * Delete old snapshots - 删除旧快照
   */
  async deleteOldSnapshots(daysToKeep = 30): Promise<number> {
    const supabase = getSupabaseClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { data: oldSnapshots, error: fetchError } = await supabase
      .from('leaderboard_snapshots')
      .select('id')
      .lt('timestamp', cutoffDate.toISOString());

    if (fetchError) throw fetchError;

    if (oldSnapshots.length === 0) return 0;

    const snapshotIds = oldSnapshots.map(s => s.id);
    const { error: deleteError } = await supabase
      .from('leaderboard_snapshots')
      .delete()
      .in('id', snapshotIds);

    if (deleteError) throw deleteError;

    return oldSnapshots.length;
  }

  private mapToSnapshotRecord(row: any): LeaderboardSnapshotRecord {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      totalStrategies: row.total_strategies,
      totalTrades: row.total_trades,
      totalVolume: row.total_volume,
      createdAt: new Date(row.created_at),
    };
  }

  private mapToEntryRecord(row: any): LeaderboardEntryRecord {
    return {
      id: row.id,
      snapshotId: row.snapshot_id,
      strategyId: row.strategy_id,
      rank: row.rank,
      rankChange: row.rank_change,
      totalTrades: row.total_trades,
      totalVolume: row.total_volume,
      totalPnl: row.total_pnl,
      roi: row.roi,
      winRate: row.win_rate,
      sharpeRatio: row.sharpe_ratio,
      maxDrawdown: row.max_drawdown,
      avgTradeSize: row.avg_trade_size,
      profitableTrades: row.profitable_trades,
      losingTrades: row.losing_trades,
      consecutiveWins: row.consecutive_wins,
      consecutiveLosses: row.consecutive_losses,
      bestTrade: row.best_trade,
      worstTrade: row.worst_trade,
      createdAt: new Date(row.created_at),
    };
  }

  private mapToEntry(row: any): LeaderboardEntry {
    return {
      rank: row.rank,
      strategyId: row.strategy_id,
      strategyName: '', // Will be populated from strategy
      status: '', // Will be populated from strategy
      rankChange: row.rank_change,
      metrics: {
        strategyId: row.strategy_id,
        strategyName: '',
        status: '',
        totalTrades: row.total_trades,
        totalVolume: row.total_volume,
        totalPnL: row.total_pnl,
        roi: row.roi,
        winRate: row.win_rate,
        sharpeRatio: row.sharpe_ratio,
        maxDrawdown: row.max_drawdown,
        avgTradeSize: row.avg_trade_size,
        profitableTrades: row.profitable_trades,
        losingTrades: row.losing_trades,
        consecutiveWins: row.consecutive_wins,
        consecutiveLosses: row.consecutive_losses,
        bestTrade: row.best_trade,
        worstTrade: row.worst_trade,
        calculatedAt: new Date(row.created_at),
      },
    };
  }
}

export default LeaderboardDAO;
